// ===== ESTADO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let vendasData = [];
let filtroAtivo = 'todos';
let filtroOrigem = 'todos';
let empresaAtualVendas = null;

let dataSelecionada = new Date();
const CATEGORIAS_INTELIGENTES = {
  bebidas: [
    "coca","coca-cola","pepsi","guarana","guaraná",
    "fanta","sprite","agua","água","suco",
    "energetico","energético","cerveja","refrigerante"
  ],

  refrigerantes: [
    "coca","coca-cola","pepsi","guarana","guaraná",
    "fanta","sprite","refrigerante"
  ],

  alimentos: [
    "lanche","hamburguer","hambúrguer",
    "pastel","coxinha","risoles",
    "salgado","porcao","porção",
    "espetinho","pizza","batata"
  ],

  lanches: [
    "lanche","hamburguer","hambúrguer",
    "x-burger","x-salada","x-tudo"
  ],

  salgados: [
    "pastel","coxinha","risoles",
    "enroladinho","kibe","esfiha","hambúrguer",
    "salgado"
  ],

  doces: [
    "brigadeiro","bolo","trufa",
    "chocolate","doce","sorvete"
  ]
};


function isoDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataTitulo(data) {
  return data.toLocaleDateString("pt-BR");
}

function inicioDiaISO(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fimDiaISO(data) {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

const labelPagto = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
const iconPagto  = { dinheiro: 'banknote', cartao: 'credit-card', pix: 'zap' };

function normalizarPagamento(valor) {
  const texto = String(valor || "").toLowerCase();

  if (texto.includes("dinheiro")) return "dinheiro";
  if (texto.includes("cart")) return "cartao";
  if (texto.includes("pix")) return "pix";

  return "outros";
}

function limparDescricaoJogoVendas(descricao) {
  let texto = String(descricao || "Pagamento de jogo").trim();

  texto = texto.replace(/\s*\|\s*Total\s*R\$\s*[\d.,]+/gi, "");

  const matchesComanda =
    texto.match(/[-·]\s*[^-·,]+ em comanda R\$\s*[\d.,]+/gi) || [];

  let qtdComanda = 0;
  let totalComanda = 0;

  matchesComanda.forEach(match => {
    const valorTexto = match
      .replace(/.*em comanda/i, "")
      .replace("R$", "")
      .trim();

    const valor = Number(
      valorTexto
        .replace(/\./g, "")
        .replace(",", ".")
    );

    qtdComanda += 1;
    totalComanda += Number.isNaN(valor) ? 0 : valor;
  });

  texto = texto.replace(/\s*[-·]\s*[^-·,]+ em comanda R\$\s*[\d.,]+/gi, "");
  texto = texto.replace(/\s*,\s*[^,]+ em comanda R\$\s*[\d.,]+/gi, "");

  if (qtdComanda > 0) {
    texto += ` · ${qtdComanda} em comanda - ${fmt(totalComanda)}`;
  }

  return texto.trim() || "Pagamento de jogo";
}

function obterDataVenda(venda) {
  return venda.data || venda.created_at || venda.criado_em || new Date().toISOString();
}

async function obterEmpresaAtualVendas() {
  if (empresaAtualVendas) return empresaAtualVendas;

  if (window.APP_EMPRESA_ID) {
    empresaAtualVendas = window.APP_EMPRESA_ID;
    return empresaAtualVendas;
  }

  if (typeof crvObterEmpresaAtual === "function") {
    const empresa = await crvObterEmpresaAtual();
    empresaAtualVendas = empresa?.id || empresa;
    return empresaAtualVendas;
  }

  if (window.sb) {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) return null;

    const { data, error } = await sb
      .from("usuarios")
      .select("empresa_id")
      .eq("id", userId)
      .single();

    if (error) throw error;

    empresaAtualVendas = data?.empresa_id || null;
    return empresaAtualVendas;
  }

  return null;
}

async function aguardarContextoVendas() {
  let tentativas = 0;

  while (tentativas < 50) {
    if (window.auth?.verificarSessao) {
      await window.auth.verificarSessao();
    }

    const empresaId = await obterEmpresaAtualVendas();

    if (
      empresaId &&
      window.APP_STATUS?.online &&
      window.APP_STATUS?.supabase_ok &&
      window.sb
    ) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativas++;
  }

  return false;
}

function criarNavegacaoDataVendas() {
  const subtitulo = document.getElementById("subtitleVendas");

  if (!subtitulo || document.getElementById("navDataVendas")) return;

  const nav = document.createElement("div");
  nav.id = "navDataVendas";
  nav.style.display = "flex";
  nav.style.alignItems = "center";
  nav.style.gap = "8px";
  nav.style.marginTop = "10px";
  nav.style.flexWrap = "wrap";

  nav.innerHTML = `
    <button class="filtro-btn" type="button" id="btnDiaAnterior">← Dia anterior</button>
    <button class="filtro-btn active" type="button" id="btnHojeVendas">Hoje</button>
    <button class="filtro-btn" type="button" id="btnProximoDia">Dia seguinte →</button>
    <span id="dataSelecionadaVendas" style="color:var(--text-muted);font-weight:700;margin-left:6px;"></span>
  `;

  subtitulo.insertAdjacentElement("afterend", nav);

  document.getElementById("btnDiaAnterior").onclick = async () => {
    dataSelecionada.setDate(dataSelecionada.getDate() - 1);
    await recarregarVendasPorData();
  };

  document.getElementById("btnHojeVendas").onclick = async () => {
    dataSelecionada = new Date();
    await recarregarVendasPorData();
  };

  document.getElementById("btnProximoDia").onclick = async () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const proximaData = new Date(dataSelecionada);
  proximaData.setDate(proximaData.getDate() + 1);
  proximaData.setHours(0, 0, 0, 0);

  if (proximaData > hoje) return;

  dataSelecionada = proximaData;
  await recarregarVendasPorData();
};

  atualizarTextoDataSelecionada();
}

function atualizarTextoDataSelecionada() {
  const el = document.getElementById("dataSelecionadaVendas");
  const btnProximo = document.getElementById("btnProximoDia");

  if (el) {
    el.textContent = `Data selecionada: ${formatarDataTitulo(dataSelecionada)}`;
  }

  if (btnProximo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataAtual = new Date(dataSelecionada);
    dataAtual.setHours(0, 0, 0, 0);

    if (dataAtual >= hoje) {
      btnProximo.disabled = true;
      btnProximo.classList.add("disabled");
    } else {
      btnProximo.disabled = false;
      btnProximo.classList.remove("disabled");
    }
  }
}

async function recarregarVendasPorData() {
  atualizarTextoDataSelecionada();
  await carregarVendas();
  renderResumo();
  renderTabela();
  renderResumo();
}

async function obterDadosOfflineVendas() {
  const vendasCache =
    await crvOfflineDB.obterCache("vendas_lista") || [];

  const itensCache =
    await crvOfflineDB.obterCache("vendas_itens_lista") || [];

  const fila =
    await crvOfflineDB.obterFilaOffline();

  const vendasPendentes =
    fila
      .filter(item => item.tabela === "vendas")
      .map(item => item.payload);

  const itensPendentes =
    fila
      .filter(item => item.tabela === "vendas_itens")
      .flatMap(item => Array.isArray(item.payload) ? item.payload : [item.payload]);

  return {
    vendas: [...vendasPendentes, ...vendasCache],
    itens: [...itensPendentes, ...itensCache]
  };
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  logSistema("VENDAS", "Inicializando...");

  await aguardarContextoVendas();

  criarNavegacaoDataVendas();

  await carregarVendas();

  criarFiltroOrigemArena();

  renderResumo();
  renderTabela();
  renderResumo();
  atualizarStatusCaixa();
});

// ===== CARREGAR =====
async function carregarVendas() {
  try {
    let vendas = [];
    let itens = [];

    if (
      window.APP_STATUS?.online &&
      window.APP_STATUS?.supabase_ok &&
      window.sb
    ) {
      logSistema("VENDAS", "Buscando do Supabase...");

const empresaId = await obterEmpresaAtualVendas();

if (!empresaId) {
  throw new Error("empresa_id não encontrado para buscar vendas.");
}

const { data: vendasSupabase, error: erroVendas } = await sb
  .from("vendas")
  .select("*")
  .eq("empresa_id", empresaId)
  .gte("data", inicioDiaISO(dataSelecionada))
  .lte("data", fimDiaISO(dataSelecionada))
  .order("data", { ascending: false });

      if (erroVendas) throw erroVendas;

const idsVendas = (vendasSupabase || []).map(v => v.id);

let itensSupabase = [];

if (idsVendas.length) {
  const { data: itensData, error: erroItens } = await sb
    .from("vendas_itens")
    .select("*")
    .eq("empresa_id", empresaId)
    .in("venda_id", idsVendas);

  if (erroItens) throw erroItens;

  itensSupabase = itensData || [];
}

      vendas = Array.isArray(vendasSupabase) ? vendasSupabase : [];
      itens = Array.isArray(itensSupabase) ? itensSupabase : [];

      await crvOfflineDB.salvarCache("vendas_lista", vendas);
      await crvOfflineDB.salvarCache("vendas_itens_lista", itens);

      logSistema("VENDAS", "Dados carregados", "success");

    } else {
      logSistema("VENDAS", "Modo offline - usando IndexedDB", "warn");

      const dadosOffline =
        await obterDadosOfflineVendas();

      vendas = dadosOffline.vendas;
      itens = dadosOffline.itens;
    }

    vendasData = vendas.map(v => {
      const itensVenda = itens.filter(i => {
        return String(i.venda_id) === String(v.id);
      });

      return {
        id: v.id,
        hora: new Date(obterDataVenda(v)).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo"
        }),
        data: obterDataVenda(v),
        total: Number(v.total || 0),
        subtotal: Number(v.subtotal || v.total || 0),
        desconto: Number(v.desconto || 0),
        formaPagamento: normalizarPagamento(v.forma_pagamento || v.pagamento),
        origem: v.origem || "pdv",
        origem_id: v.origem_id || null,
        descricao:
          v.descricao ||
          (v.origem === "agenda"
            ? "Pagamento de jogo"
            : null),
        offline: v.offline === true,
        itens: itensVenda.map(i => ({
          nome: i.nome || "Produto",
          quantidade: Number(i.quantidade || 0),
          preco: Number(i.preco || 0)
        }))
      };
    });

document.getElementById("subtitleVendas").textContent =
  `${vendasData.length} venda(s) registrada(s) · ${formatarDataTitulo(dataSelecionada)}`;

atualizarTextoDataSelecionada();

  } catch (err) {
    logSistema("VENDAS", "Erro: " + err.message, "error");

    const dadosOffline =
      await obterDadosOfflineVendas();

    const vendas = dadosOffline.vendas || [];
const itens = dadosOffline.itens || [];

vendasData = vendas.map(v => {
  const itensVenda = itens.filter(i => String(i.venda_id) === String(v.id));

  return {
    id: v.id,
    hora: new Date(obterDataVenda(v)).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    }),
    data: obterDataVenda(v),
    total: Number(v.total || 0),
    subtotal: Number(v.subtotal || v.total || 0),
    desconto: Number(v.desconto || 0),
    formaPagamento: normalizarPagamento(v.forma_pagamento || v.pagamento),
    origem: v.origem || "pdv",
    origem_id: v.origem_id || null,
    descricao: v.descricao || (v.origem === "agenda" ? "Pagamento de jogo" : null),
    offline: v.offline === true,
    itens: itensVenda.map(i => ({
      nome: i.nome || "Produto",
      quantidade: Number(i.quantidade || 0),
      preco: Number(i.preco || 0)
    }))
  };
});
  }
}

// ===== RESUMO =====
function renderResumo() {

  const base = getVendasFiltradas();

  const total = base.reduce((a, v) => a + v.total, 0);
  const qtd = base.length;
  const ticket   = qtd > 0 ? total / qtd : 0;

  const dinheiro = base.filter(v => v.formaPagamento === "dinheiro").reduce((a, v) => a + v.total, 0);
  const cartao = base.filter(v => v.formaPagamento === "cartao").reduce((a, v) => a + v.total, 0);
  const pix = base.filter(v => v.formaPagamento === "pix").reduce((a, v) => a + v.total, 0);

  document.getElementById('resumoTotal').textContent    = fmt(total);
  document.getElementById('resumoQtd').textContent      = qtd;
  document.getElementById('resumoTicket').textContent   = fmt(ticket);
  document.getElementById('resumoDinheiro').textContent = fmt(dinheiro);
  document.getElementById('resumoCartao').textContent   = fmt(cartao);
  document.getElementById('resumoPix').textContent      = fmt(pix);
}

function empresaUsaAgendaVendas() {
  const tipo =
    window.APP_EMPRESA_TIPO ||
    window.empresaTipoNegocio ||
    window.tipoNegocioEmpresa ||
    "";

  const tiposArena = [
    "arena",
    "arena_society",
    "society",
    "arena_esportiva",
    "arena_beach",
    "beach_sports",
    "beach_tennis",
    "futvolei",
    "volei_areia",
    "quadras",
    "quadras_esportivas"
  ];

  if (tiposArena.includes(String(tipo).toLowerCase())) return true;

  return (
    typeof crvModuloAtivo === "function" &&
    crvModuloAtivo("agenda")
  );
}

function criarFiltroOrigemArena() {
  if (!empresaUsaAgendaVendas()) return;

const filtrosBox =
  document.querySelector(".vendas-filtros") ||
  document.querySelector(".filtros-actions") ||
  document.querySelector(".filtros-vendas") ||
  document.querySelector(".filters-actions") ||
  document.querySelector(".sales-filters") ||
  document.querySelector(".search-filters") ||
  document.querySelector(".vendas-toolbar");

  if (!filtrosBox) return;

  if (document.getElementById("filtroOrigemArena")) return;

  const grupo = document.createElement("div");
  grupo.id = "filtroOrigemArena";
  grupo.style.display = "flex";
  grupo.style.gap = "8px";
  grupo.style.marginLeft = "8px";

  grupo.innerHTML = `
    <button class="filtro-btn active" type="button" data-origem="todos">
      Todos
    </button>

    <button class="filtro-btn" type="button" data-origem="pdv">
      Produtos
    </button>

    <button class="filtro-btn" type="button" data-origem="agenda">
      Jogos
    </button>

    <button class="filtro-btn" type="button" data-origem="comanda">
      Comandas
    </button>
  `;

  filtrosBox.appendChild(grupo);

  grupo.querySelectorAll("[data-origem]").forEach(btn => {
    btn.addEventListener("click", () => {
      grupo
        .querySelectorAll("[data-origem]")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      filtroOrigem = btn.dataset.origem || "todos";

      renderTabela();
      renderResumo();
    });
  });
}

// ===== FILTROS =====
function setFiltro(btn, filtro) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtivo = filtro;
  renderTabela();
  renderResumo();
}

function filtrarVendas() { renderTabela(); }

function getVendasFiltradas() {
  const texto = document.getElementById('filtroTexto')?.value.toLowerCase().trim() || '';

  return vendasData.filter(v => {
    const passaFiltro =
  filtroAtivo === 'todos' ||
  v.formaPagamento === filtroAtivo;

const passaOrigem =
  filtroOrigem === 'todos' ||
  v.origem === filtroOrigem;

let passaTexto = !texto;

if (!passaTexto) {

  const itensTexto = v.itens
    .map(i => String(i.nome || "").toLowerCase())
    .join(" ");

  const categoriaEncontrada =
    CATEGORIAS_INTELIGENTES[texto];

  if (categoriaEncontrada) {

    passaTexto =
      categoriaEncontrada.some(termo =>
        itensTexto.includes(termo)
      );

  } else {

    passaTexto =
      itensTexto.includes(texto) ||
      String(v.descricao || "").toLowerCase().includes(texto) ||
      String(v.origem || "").toLowerCase().includes(texto) ||
      fmt(v.total).includes(texto);
  }
}

    return passaFiltro && passaOrigem && passaTexto;
  });
}


// ===== TABELA =====
function renderTabela() {

  const tbody = document.getElementById('vendasTableBody');
  const lista = getVendasFiltradas();
  const reversed = [...lista];

  if (!reversed.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          <i data-lucide="inbox" width="28" height="28"></i>
          <p>Nenhuma venda encontrada</p>
        </td>
      </tr>`;
      prepararScrollTabelaVendas();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = reversed.map((v, idx) => {

    const num = reversed.length - idx;
    const primeiro = {
      nome:
        v.origem === "agenda"
          ? limparDescricaoJogoVendas(v.descricao)
          : v.itens[0]?.nome || (v.offline ? "Venda offline" : "Venda")
    };
    const maisItens = v.itens.length > 1 ? `+${v.itens.length - 1} item(ns)` : '';

    return `
      <tr onclick="verDetalhe('${v.id}')">
        <td><span class="venda-num">#${String(num).padStart(3,'0')}</span></td>
        <td><span class="venda-hora">${v.hora}</span></td>
        <td>
          <div class="venda-itens">
            <span class="venda-item-nome">${primeiro?.nome || '—'}</span>
            ${maisItens ? `<span class="venda-item-more">${maisItens}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="pagto-badge ${v.formaPagamento}">
            <i data-lucide="${iconPagto[v.formaPagamento] || 'receipt'}" width="11" height="11"></i>
            ${labelPagto[v.formaPagamento] || 'Outro'}
          </span>
        </td>
        <td>${v.desconto > 0 ? `<span class="venda-desconto">- ${fmt(v.desconto)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td><span class="venda-total">${fmt(v.total)}</span></td>
        <td>
          <button class="btn-ver" onclick="event.stopPropagation(); verDetalhe('${v.id}')">
            <i data-lucide="eye" width="14" height="14"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}


// ===== DETALHE =====
function verDetalhe(id) {

  const venda = vendasData.find(v => v.id === id);
  if (!venda) return;

  const body = document.getElementById('modalDetalheBody');

  body.innerHTML = `
    <div class="detalhe-row">
      <span>Horário</span>
      <span style="font-family:'Courier New',monospace;">${venda.hora}</span>
    </div>

    ${venda.origem === "agenda" ? `
<div class="detalhe-row">
  <span>Origem</span>
  <span>Agenda / Jogo</span>
</div>

<div class="detalhe-row">
  <span>Descrição</span>
  <span>${limparDescricaoJogoVendas(venda.descricao)}</span>
</div>
` : ""}

    <div class="detalhe-row" style="margin-bottom:12px;">
      <span>Pagamento</span>
      <span class="pagto-badge ${venda.formaPagamento}">
        <i data-lucide="${iconPagto[venda.formaPagamento] || 'receipt'}" width="11" height="11"></i>
        ${labelPagto[venda.formaPagamento] || 'Outro'}
      </span>
    </div>

    <div class="detalhe-itens">
      ${(venda.itens.length ? venda.itens : [{ nome: venda.descricao || "Venda", quantidade: 1, preco: venda.total }]).map(i => `
        <div class="detalhe-item">
          <div>
            <div class="detalhe-item-nome">${i.nome}</div>
            <div class="detalhe-item-qty">x${i.quantidade} · ${fmt(i.preco)} un.</div>
          </div>
          <span class="detalhe-item-val">${fmt(i.preco * i.quantidade)}</span>
        </div>
      `).join('')}
    </div>

    <div class="detalhe-row">
      <span>Subtotal</span>
      <span>${fmt(venda.subtotal || venda.total)}</span>
    </div>

    ${venda.desconto > 0 ? `
    <div class="detalhe-row">
      <span>Desconto</span>
      <span style="color:#FF5050;">- ${fmt(venda.desconto)}</span>
    </div>` : ''}

    <div class="divider" style="margin:8px 0;"></div>

    <div class="detalhe-row total">
      <span>TOTAL</span>
      <span>${fmt(venda.total)}</span>
    </div>
  `;

  document.getElementById('modalDetalhe').style.display = 'flex';

  if (typeof lucide !== 'undefined') lucide.createIcons();
}


// ===== STATUS CAIXA =====
// Status agora é controlado globalmente pelo app.js via Supabase.
// Mantido apenas para evitar erro em chamadas antigas.
function atualizarStatusCaixa() {
  if (typeof crvAtualizarStatusCaixaGlobal === "function") {
    crvAtualizarStatusCaixaGlobal();
  }
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);

// ======================================================
// AJUSTE FINAL — MODAL DETALHE + SCROLL TABELA
// ======================================================

function fecharModalDetalheVendas() {
  const modal = document.getElementById("modalDetalhe");

  if (modal) {
    modal.style.display = "none";
  }
}

function prepararScrollTabelaVendas() {
  const tbody = document.getElementById("vendasTableBody");
  if (!tbody) return;

  const table = tbody.closest("table");
  if (!table) return;

  const parent = table.parentElement;
  if (!parent || parent.classList.contains("vendas-scroll-area")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "vendas-scroll-area";

  parent.insertBefore(wrapper, table);
  wrapper.appendChild(table);
}

document.addEventListener("click", event => {
  const fechar =
    event.target.closest("#closeModalDetalhe") ||
    event.target.closest("#btnFecharModalDetalhe") ||
    event.target.closest("#modalDetalhe .modal-close") ||
    event.target.closest("#modalDetalhe .btn-ghost");

  if (fechar) {
    event.preventDefault();
    fecharModalDetalheVendas();
    return;
  }

  const modal = document.getElementById("modalDetalhe");

  if (
    modal &&
    modal.style.display === "flex" &&
    event.target === modal
  ) {
    fecharModalDetalheVendas();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    fecharModalDetalheVendas();
  }
});

setTimeout(() => {
  prepararScrollTabelaVendas();
}, 300);