// ======================================================
// CRV PDV - RELATÓRIOS GERENCIAIS
// Supabase real + lucro + PDF + Excel/CSV formatado
// ======================================================

const fmt = valor => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

let periodoAtivo = "hoje";
let chartHoras = null;
let chartPagtos = null;

let vendasData = [];
let itensData = [];
let produtosData = [];
let caixasHistorico = [];
let agendaFechadaData = [];
let nomeFantasiaRelatorio = "empresa";

const TIPOS_COM_AGENDA_ESPORTIVA = [
  "arena",
  "society",
  "arena_society",
  "arena_beach",
  "beach_sports",
  "beach_tennis",
  "futvolei",
  "volei_areia",
  "quadras"
];

function normalizarFormaPagamentoRelatorio(forma) {
  const valor = String(forma || "").toLowerCase().trim();

  if (valor === "cartao") return "debito";
  if (valor === "débito") return "debito";
  if (valor === "crédito") return "credito";

  return valor || "—";
}

function labelFormaPagamentoRelatorio(forma) {
  const valor = normalizarFormaPagamentoRelatorio(forma);

  const labels = {
    dinheiro: "Dinheiro",
    debito: "Débito",
    credito: "Crédito",
    pix: "PIX",
    misto: "Misto",
    comanda: "Comanda",
    "—": "—"
  };

  return labels[valor] || valor.toUpperCase();
}

function empresaUsaAgendaEsportiva() {
  const tipo = String(window.CRV_CONFIG?.empresa?.tipo_negocio || "")
    .toLowerCase()
    .trim();

  return TIPOS_COM_AGENDA_ESPORTIVA.includes(tipo);
}

// ======================================================
// OFFLINE RELATÓRIOS
// ======================================================

async function obterDadosOfflineRelatorios() {

  const vendasCache =
    await crvOfflineDB.obterCache("relatorios_vendas") || [];

  const itensCache =
    await crvOfflineDB.obterCache("relatorios_itens") || [];

  const caixasCache =
    await crvOfflineDB.obterCache("relatorios_caixas") || [];

  const fila =
    await crvOfflineDB.obterFilaOffline();

  const vendasPendentes =
    fila
      .filter(item => item.tabela === "vendas")
      .map(item => item.payload);

  const itensPendentes =
    fila
      .filter(item => item.tabela === "vendas_itens")
      .flatMap(item => {
        return Array.isArray(item.payload)
          ? item.payload
          : [item.payload];
      });

  return {
    vendas: [
      ...vendasPendentes,
      ...vendasCache
    ],

    itens: [
      ...itensPendentes,
      ...itensCache
    ],

    caixas: caixasCache
  };
}

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  const hoje = obterHojeLocalRelatorio();

  document.getElementById("dataInicio").value = hoje;
  document.getElementById("dataFim").value = hoje;

  await aguardarContextoRelatorios();
  await carregarDados();

  if (typeof crvAtualizarStatusCaixaGlobal === "function") {
    crvAtualizarStatusCaixaGlobal();
  }

  renderRelatorio();

  document.getElementById("btnExportPDF")?.addEventListener("click", exportarPDF);
});

async function aguardarContextoRelatorios() {
  let tentativas = 0;

  while (tentativas < 40) {
    if (window.auth?.verificarSessao) {
      await window.auth.verificarSessao();
    }

    if (
  window.APP_EMPRESA_ID &&
  window.crvOfflineDB
) {
  return true;
}

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativas++;
  }

  return false;
}

function obterHojeLocalRelatorio() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterEmpresaId() {
  return window.APP_EMPRESA_ID || APP_EMPRESA_ID || null;
}

// ======================================================
// CARREGAR DADOS
// ======================================================
async function carregarDados() {
  try {
    const empresaId = obterEmpresaId();

    if (!empresaId) {
      console.warn("[RELATÓRIOS] empresa_id não encontrado.");
      return;
    }

    let vendas = [];
    let itens = [];
    let caixas = [];
    let produtos = [];
    let empresa = null;

    if (
      window.APP_STATUS?.online &&
      window.APP_STATUS?.supabase_ok &&
      window.sb
    ) {

      const { data: vendasSupabase, error: erroVendas } = await sb
        .from("vendas")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("data", { ascending: false });

      if (erroVendas) throw erroVendas;

      const { data: itensSupabase, error: erroItens } = await sb
        .from("vendas_itens")
        .select("*")
        .eq("empresa_id", empresaId);

      if (erroItens) throw erroItens;

      const { data: caixasSupabase, error: erroCaixas } = await sb
        .from("caixa")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("data_abertura", { ascending: false });

      if (erroCaixas) throw erroCaixas;

      const { data: produtosSupabase, error: erroProdutos } = await sb
  .from("produtos")
  .select("*")
  .eq("empresa_id", empresaId)
  .eq("ativo", true)
  .lte("estoque", 5)
  .order("estoque", { ascending: true });

if (erroProdutos) throw erroProdutos;

produtos = Array.isArray(produtosSupabase)
  ? produtosSupabase
  : [];

            const { data: empresaSupabase, error: erroEmpresa } = await sb
        .from("empresas")
        .select("nome_fantasia,nome")
        .eq("id", empresaId)
        .maybeSingle();

      if (erroEmpresa) throw erroEmpresa;

      empresa = empresaSupabase || null;

      vendas = Array.isArray(vendasSupabase)
        ? vendasSupabase
        : [];

      itens = Array.isArray(itensSupabase)
        ? itensSupabase
        : [];

      caixas = Array.isArray(caixasSupabase)
        ? caixasSupabase
        : [];

      await crvOfflineDB.salvarCache("relatorios_vendas", vendas);
      await crvOfflineDB.salvarCache("relatorios_itens", itens);
      await crvOfflineDB.salvarCache("relatorios_caixas", caixas);

    } else {

      crvLog(
        "RELATÓRIOS",
        "Modo offline - usando IndexedDB",
        "warn"
      );

      const dadosOffline =
        await obterDadosOfflineRelatorios();

      vendas = dadosOffline.vendas;
      itens = dadosOffline.itens;
      caixas = dadosOffline.caixas;
    }

    itensData = Array.isArray(itens)
      ? itens
      : [];

      produtosData = Array.isArray(produtos)
  ? produtos
  : [];

    vendasData = (vendas || []).map(venda => {
      const itensVenda = itensData.filter(item => {
        return String(item.venda_id) === String(venda.id);
      });

      const lucroTotal = itensVenda.reduce((acc, item) => {
        return acc + Number(item.lucro_total || 0);
      }, 0);

      return {
        ...venda,
        itens: itensVenda,
        lucro_total:
          Number(venda.lucro_total || 0) ||
          lucroTotal
      };
    });

    caixasHistorico =
      Array.isArray(caixas)
        ? caixas
        : [];

    agendaFechadaData = [];

    nomeFantasiaRelatorio =
      limparNomeArquivo(
        empresa?.nome_fantasia ||
        empresa?.nome ||
        window.CRV_CONFIG?.empresa?.nome_fantasia ||
        "empresa"
      );

  } catch (err) {
    console.error(err);

    crvLog(
      "RELATÓRIOS",
      err.message,
      "error"
    );

    mostrarModalAviso(
      "Não foi possível carregar os relatórios agora."
    );

    vendasData = [];
    itensData = [];
    produtosData = [];
    caixasHistorico = [];
    agendaFechadaData = [];
  }
}

// ======================================================
// PERÍODO
// ======================================================

function setPeriodo(btn, periodo) {
  document.querySelectorAll(".periodo-btn").forEach(b => b.classList.remove("active"));

  btn.classList.add("active");
  periodoAtivo = periodo;

  renderRelatorio();
}

function aplicarPeriodo() {
  periodoAtivo = "custom";
  document.querySelectorAll(".periodo-btn").forEach(b => b.classList.remove("active"));
  renderRelatorio();
}

function getPeriodoDetalhado() {
  const { inicio, fim } = getIntervaloPeriodo();

  return `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;
}

function getPeriodoLabel() {
  return {
    hoje: "Hoje",
    semana: "Últimos 7 dias",
    mes: "Últimos 30 dias",
    custom: "Personalizado"
  }[periodoAtivo] || "Hoje";
}

function getIntervaloPeriodo() {
  const agora = new Date();
  let inicio = new Date();
  let fim = new Date();

  if (periodoAtivo === "hoje") {
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
  }

  if (periodoAtivo === "semana") {
    inicio.setDate(agora.getDate() - 6);
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
  }

  if (periodoAtivo === "mes") {
    inicio.setDate(agora.getDate() - 29);
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
  }

  if (periodoAtivo === "custom") {
    const dataInicio = document.getElementById("dataInicio")?.value;
    const dataFim = document.getElementById("dataFim")?.value;

    inicio = new Date(`${dataInicio}T00:00:00`);
    fim = new Date(`${dataFim}T23:59:59`);
  }

  return { inicio, fim };
}

function dataVendaRelatorio(data) {
  if (!data) return null;

  return new Date(
    String(data).endsWith("Z")
      ? data
      : `${data}Z`
  );
}

function formatarDataVendaRelatorio(data) {
  const d = dataVendaRelatorio(data);
  if (!d) return "—";

  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

function formatarHoraVendaRelatorio(data) {
  const d = dataVendaRelatorio(data);
  if (!d) return "—";

  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function getVendasFiltradas() {
  const { inicio, fim } = getIntervaloPeriodo();

  return vendasData
    .filter(venda => {
      if (!venda.data) return false;

      const dataVenda = new Date(
        String(venda.data).endsWith("Z")
          ? venda.data
          : `${venda.data}Z`
      );

      return dataVenda >= inicio && dataVenda <= fim;
    })
    .sort((a, b) => {
      const dataA = new Date(
        String(a.data).endsWith("Z") ? a.data : `${a.data}Z`
      );

      const dataB = new Date(
        String(b.data).endsWith("Z") ? b.data : `${b.data}Z`
      );

      return dataB - dataA;
    });
}

// ======================================================
// RENDER GERAL
// ======================================================
function renderRelatorio() {
  const vendas = getVendasFiltradas();

  const faturamento = vendas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const lucro = vendas.reduce((acc, v) => acc + Number(v.lucro_total || 0), 0);
  const qtd = vendas.length;
  const ticket = qtd > 0 ? faturamento / qtd : 0;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  document.getElementById("relFaturamento").textContent = fmt(faturamento);
  document.getElementById("relLucro").textContent = fmt(lucro);
  document.getElementById("relMargem").textContent = `Margem: ${margem.toFixed(1)}%`;
  document.getElementById("relVendas").textContent = qtd;
  document.getElementById("relTicket").textContent = fmt(ticket);

renderComparativoPeriodo(faturamento);

  document.getElementById("badgePeriodo").textContent = getPeriodoLabel();
  document.getElementById("subtitleRelatorio").textContent =
    `Exibindo dados de: ${getPeriodoLabel()}`;

  renderGraficoHoras(vendas);
  renderGraficoPagamentos(vendas);
  renderTopProdutos(vendas);
  renderTopProdutosLucro(vendas);
  renderRecebimentosJogos(vendas);
  renderProdutosEstoqueBaixo();
  renderHistoricoCaixas();
}

function renderComparativoPeriodo(faturamentoAtual) {
  const delta = document.getElementById("relFaturamentoDelta");
  if (!delta) return;

  const { inicio, fim } = getIntervaloPeriodo();
  const duracao = fim.getTime() - inicio.getTime();

  const inicioAnterior = new Date(inicio.getTime() - duracao - 1);
  const fimAnterior = new Date(inicio.getTime() - 1);

  const vendasAnterior = vendasData.filter(venda => {
    if (!venda.data) return false;

    const dataVenda = new Date(
      String(venda.data).endsWith("Z")
        ? venda.data
        : `${venda.data}Z`
    );

    return dataVenda >= inicioAnterior && dataVenda <= fimAnterior;
  });

  const faturamentoAnterior = vendasAnterior.reduce((acc, venda) => {
    return acc + Number(venda.total || 0);
  }, 0);

  if (faturamentoAnterior <= 0) {
    delta.textContent = "sem período anterior";
    delta.className = "card-sub";
    return;
  }

  const variacao = ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100;
  const sinal = variacao >= 0 ? "↑" : "↓";

  delta.textContent = `${sinal} ${Math.abs(variacao).toFixed(1)}% vs período anterior`;
  delta.className = variacao >= 0 ? "card-sub relatorio-delta positivo" : "card-sub relatorio-delta negativo";
}

function renderProdutosEstoqueBaixo() {
  let card = document.getElementById("cardEstoqueBaixo");

  if (!card) {
    const referencia = document.getElementById("cardRelatorioJogos");

    if (!referencia) return;

    card = document.createElement("div");
    card.id = "cardEstoqueBaixo";
    card.className = "card relatorio-estoque-baixo";

    card.innerHTML = `
      <div class="grafico-header">
        <h3>Produtos com estoque baixo</h3>
        <span class="badge-soft" id="badgeEstoqueBaixo">0 item(ns)</span>
      </div>

      <div id="listaEstoqueBaixo"></div>
    `;

    referencia.insertAdjacentElement("afterend", card);
  }

  const lista = document.getElementById("listaEstoqueBaixo");
  const badge = document.getElementById("badgeEstoqueBaixo");

  const produtos = produtosData.filter(produto => {
    return Number(produto.estoque || 0) <= 5;
  });

  if (badge) {
    badge.textContent = `${produtos.length} item(ns)`;
  }

  if (!lista) return;

  if (!produtos.length) {
    lista.innerHTML = `<div class="empty-relatorio"><p>Nenhum produto com estoque baixo.</p></div>`;
    return;
  }

  lista.innerHTML = produtos.map(produto => `
    <div class="estoque-baixo-item">
      <div>
        <strong>${produto.nome || "Produto"}</strong>
        <small>${produto.categoria || "Sem categoria"}</small>
      </div>

      <span>${Number(produto.estoque || 0)} un.</span>
    </div>
  `).join("");
}

// ======================================================
// GRÁFICO HORAS
// ======================================================

function renderGraficoHoras(vendas) {
  const horas = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2, "0")}h`);
  const dados = Array(14).fill(0);

  vendas.forEach(venda => {
    const hora = new Date(venda.data).getHours();
    const index = hora - 7;

    if (index >= 0 && index < 14) {
      dados[index] += Number(venda.total || 0);
    }
  });

  const ctx = document.getElementById("chartHoras")?.getContext("2d");
  if (!ctx) return;

  if (chartHoras) chartHoras.destroy();

  chartHoras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: horas,
      datasets: [{
        data: dados,
        backgroundColor: "rgba(249,137,72,0.7)",
        borderColor: "#F98948",
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

// ======================================================
// GRÁFICO PAGAMENTOS
// ======================================================
function renderGraficoPagamentos(vendas) {
  const totais = {
    dinheiro: 0,
    debito: 0,
    credito: 0,
    pix: 0,
    misto: 0
  };

  vendas.forEach(venda => {
    const forma = normalizarFormaPagamentoRelatorio(venda.forma_pagamento);

    if (totais[forma] !== undefined) {
      totais[forma] += Number(venda.total || 0);
    }
  });

  const ctx = document.getElementById("chartPagamentos")?.getContext("2d");
  if (!ctx) return;

  if (chartPagtos) chartPagtos.destroy();

  chartPagtos = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Dinheiro", "Débito", "Crédito", "PIX", "Misto"],
      datasets: [{
        data: [
          totais.dinheiro,
          totais.debito,
          totais.credito,
          totais.pix,
          totais.misto
        ],
        backgroundColor: ["#54CD16", "#F98948", "#D4A843", "#00D4FF", "#7C6354"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  const legenda = document.getElementById("pagamentoLegenda");

  if (legenda) {
    legenda.innerHTML = `
      <div class="legenda-item"><span>Dinheiro</span><strong>${fmt(totais.dinheiro)}</strong></div>
      <div class="legenda-item"><span>Débito</span><strong>${fmt(totais.debito)}</strong></div>
      <div class="legenda-item"><span>Crédito</span><strong>${fmt(totais.credito)}</strong></div>
      <div class="legenda-item"><span>PIX</span><strong>${fmt(totais.pix)}</strong></div>
      <div class="legenda-item"><span>Misto</span><strong>${fmt(totais.misto)}</strong></div>
    `;
  }
}

// ======================================================
// TOP PRODUTOS
// ======================================================
function itemEhPagamentoJogo(item) {
  const origem = String(item.origem || "").toLowerCase().trim();
  const nome = String(item.nome || "").toLowerCase().trim();

  return (
    origem === "agenda" ||
    Boolean(item.agenda_id) ||
    Boolean(item.agenda_jogador_id) ||
    nome.startsWith("pagamento de jogo") ||
    nome.startsWith("pagamento direto jogo") ||
    nome.includes("jogo -") ||
    nome.includes("jogo avulso") ||
    nome.includes("jogo mensal")
  );
}

function montarRankingProdutos(vendas) {
  const mapa = {};

  vendas.forEach(venda => {
    (venda.itens || []).forEach(item => {
      if (itemEhPagamentoJogo(item)) {
        return;
      }

      const chave = String(item.nome || "Produto")
        .trim()
        .toLowerCase();

      const nomeFormatado =
        chave.charAt(0).toUpperCase() + chave.slice(1);

      if (!mapa[chave]) {
        mapa[chave] = {
          nome: nomeFormatado,
          qtd: 0,
          total: 0,
          lucro: 0
        };
      }

      mapa[chave].qtd += Number(item.quantidade || 0);
      mapa[chave].total += Number(item.preco || 0) * Number(item.quantidade || 0);
      mapa[chave].lucro += Number(item.lucro_total || 0);
    });
  });

  return Object.values(mapa);
}

function renderTopProdutos(vendas) {
  const lista = montarRankingProdutos(vendas)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 5);

  const container = document.getElementById("topProdutos");
  const badge = document.getElementById("badgeTopQtd");

  if (badge) badge.textContent = `${lista.length} produto(s)`;

  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="empty-relatorio"><p>Sem dados</p></div>`;
    return;
  }

  const max = Math.max(...lista.map(p => p.qtd), 1);

  container.innerHTML = lista.map((p, index) => `
    <div class="top-produto-item">
      <div class="top-rank">${index + 1}</div>
      <div class="top-produto-info">
        <div class="top-produto-nome">${p.nome}</div>
        <div class="top-produto-qtd">${p.qtd} unidade(s)</div>
      </div>
      <div class="top-bar-wrap">
        <div class="top-bar" style="width:${((p.qtd / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="top-produto-val">${fmt(p.total)}</span>
    </div>
  `).join("");
}

function renderTopProdutosLucro(vendas) {
  const lista = montarRankingProdutos(vendas)
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 5);

  const container = document.getElementById("topProdutosLucro");
  const badge = document.getElementById("badgeTopLucro");

  if (badge) badge.textContent = `${lista.length} produto(s)`;

  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="empty-relatorio"><p>Sem dados</p></div>`;
    return;
  }

  const max = Math.max(...lista.map(p => p.lucro), 1);

  container.innerHTML = lista.map((p, index) => `
    <div class="top-produto-item">
      <div class="top-rank">${index + 1}</div>
      <div class="top-produto-info">
        <div class="top-produto-nome">${p.nome}</div>
        <div class="top-produto-qtd">${p.qtd} unidade(s) · ${fmt(p.total)} vendido</div>
      </div>
      <div class="top-bar-wrap">
        <div class="top-bar" style="width:${((p.lucro / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="top-produto-lucro">${fmt(p.lucro)}</span>
    </div>
  `).join("");
}

function renderRecebimentosJogos(vendas) {
  const card = document.getElementById("cardRelatorioJogos");
  const lista = document.getElementById("listaJogosRelatorio");
  const badge = document.getElementById("badgeJogosQtd");

  if (!card || !lista) return;

  const jogos = montarRecebimentosJogosAgrupados(vendas);

  if (badge) {
    badge.textContent = `${jogos.length} jogo(s)`;
  }

  if (!jogos.length) {
    card.style.display = "none";
    lista.innerHTML = "";
    return;
  }

  card.style.display = "block";

  lista.innerHTML = jogos.map(item => `
    <div class="jogo-relatorio-item">
      <div>
        <strong>${item.descricao}</strong>
        <small>
          ${formatarDataVendaRelatorio(item.data)}
          ·
          ${item.forma}
          ·
          Direto: ${item.qtdDireto} jogador${item.qtdDireto !== 1 ? "es" : ""}
          ·
          Comanda: ${item.qtdComanda} jogador${item.qtdComanda !== 1 ? "es" : ""}
        </small>
      </div>

      <span>${fmt(item.total)}</span>
    </div>
  `).join("");
}

// ======================================================
// HISTÓRICO DE CAIXAS
// ======================================================
function renderHistoricoCaixas() {
  const container = document.getElementById("historicoCaixas");

  if (!container) return;

  const fechados = caixasHistorico
    .filter(c => c.status === "fechado")
    .slice(0, 10);

  if (!fechados.length) {
    container.innerHTML = `<div class="empty-relatorio"><p>Nenhum caixa fechado ainda</p></div>`;
    return;
  }

  container.innerHTML = fechados.map(caixa => `
    <div class="caixa-historico-item">
      <div class="caixa-hist-info">
        <div class="caixa-hist-col">
          <span class="caixa-hist-label">Abertura</span>
          <strong class="caixa-hist-val">${formatarDataHoraCaixa(caixa.data_abertura)}</strong>
        </div>

        <div class="caixa-hist-col">
          <span class="caixa-hist-label">Fechamento</span>
          <strong class="caixa-hist-val">${formatarDataHoraCaixa(caixa.data_fechamento)}</strong>
        </div>

        <div class="caixa-hist-col">
          <span class="caixa-hist-label">Valor inicial</span>
          <strong class="caixa-hist-val">${fmt(caixa.valor_inicial)}</strong>
        </div>

        <div class="caixa-hist-col">
          <span class="caixa-hist-label">Valor final</span>
          <strong class="caixa-hist-val green">${fmt(caixa.valor_final)}</strong>
        </div>
      </div>
    </div>
  `).join("");
}

function formatarDataHoraCaixa(data) {
  if (!data) return "—";

  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatarHora(data) {
  if (!data) return "—";

  return new Date(data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function limparNomeArquivo(texto) {
  return String(texto || "empresa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function limparResponsavelJogoRelatorio(texto) {
  let valor = String(texto || "Responsável").trim();

  if (valor.includes("|")) {
    valor = valor.split("|")[0].trim();
  }

  if (valor.includes(" - ")) {
    const partes = valor.split(" - ");
    valor = partes[partes.length - 1].trim();
  }

  return valor || "Responsável";
}

function obterResponsavelJogoRelatorio(venda) {
  return limparResponsavelJogoRelatorio(venda.descricao || "Responsável");
}

function limparDescricaoJogoRelatorio(descricao) {
  let texto = String(descricao || "Jogo").trim();

  texto = texto.replace(/\s*\|\s*Total\s*R\$\s*[\d.,]+/gi, "");
  texto = texto.replace(/\s*\|\s*Direto\s*R\$\s*[\d.,]+/gi, "");
  texto = texto.replace(/\s*\|\s*Comanda\s*R\$\s*[\d.,]+/gi, "");
  texto = texto.replace(/\s*·\s*Comanda:\s*.*/gi, "");

  return texto.trim() || "Jogo";
}

function quebrarDescricaoJogoRelatorio(descricao) {
  let texto = String(descricao || "Jogo").trim();

  texto = limparDescricaoJogoRelatorio(texto);

  const lower = texto.toLowerCase();

  let tipo = "Jogo";
  let nome = texto;

  if (lower.includes("mensal")) {
    tipo = "Mensal";
  } else if (lower.includes("avulso")) {
    tipo = "Avulso";
  }

  nome = texto
    .replace(/^jogo\s*mensal\s*-\s*/i, "")
    .replace(/^jogo\s*avulso\s*-\s*/i, "")
    .replace(/^jogo\s*-\s*/i, "")
    .replace(/campo\s*maior\s*-\s*/i, "")
    .replace(/campo\s*menor\s*-\s*/i, "")
    .trim();

  return {
    tipo,
    nome: nome || texto
  };
}

function montarRecebimentosJogosAgrupados(vendas) {
  const mapa = {};

  vendas.forEach(venda => {
    const origemVenda = String(venda.origem || "").toLowerCase();

    const itensJogo =
      (venda.itens || []).filter(item => itemEhPagamentoJogo(item));

    const vendaDiretaJogo =
      origemVenda === "agenda";

    const vendaComandaComJogo =
      origemVenda === "comanda" &&
      itensJogo.length > 0;

    if (!vendaDiretaJogo && !vendaComandaComJogo) {
      return;
    }

    const chave =
      vendaDiretaJogo
        ? venda.origem_id || venda.id
        : itensJogo[0]?.origem_id || itensJogo[0]?.agenda_id || venda.id;

    const descricaoLimpa =
      vendaDiretaJogo
        ? limparDescricaoJogoRelatorio(venda.descricao)
        : limparDescricaoJogoRelatorio(
            itensJogo[0]?.nome || venda.descricao || "Jogo via comanda"
          );

    if (!mapa[chave]) {
      const jogoInfo = quebrarDescricaoJogoRelatorio(descricaoLimpa);

      mapa[chave] = {
        responsavel: obterResponsavelJogoRelatorio(venda),
        descricao: descricaoLimpa,
        nome: jogoInfo.nome,
        tipo: jogoInfo.tipo,
        data: venda.data,
        formas: new Set(),
        total: 0,
        totalDireto: 0,
        totalComanda: 0,
        qtdDireto: 0,
        qtdComanda: 0
      };
    }

    if (new Date(venda.data) > new Date(mapa[chave].data)) {
      mapa[chave].data = venda.data;
    }

    if (venda.forma_pagamento) {
      mapa[chave].formas.add(
        labelFormaPagamentoRelatorio(venda.forma_pagamento)
      );
    }

    if (vendaDiretaJogo) {
      const qtdDireto =
        itensJogo.length ||
        (Number(venda.total || 0) > 0 ? 1 : 0);

      mapa[chave].totalDireto += Number(venda.total || 0);
      mapa[chave].qtdDireto += qtdDireto;
    }

    if (vendaComandaComJogo) {
      const totalItensComanda =
        itensJogo.reduce((acc, item) => {
          return acc + (
            Number(item.preco || 0) *
            Number(item.quantidade || 1)
          );
        }, 0);

      mapa[chave].totalComanda += totalItensComanda;
      mapa[chave].qtdComanda += itensJogo.length;
    }
  });

  return Object.values(mapa)
    .map(item => {
      item.total =
        Number(item.totalDireto || 0) +
        Number(item.totalComanda || 0);

      item.forma =
        item.formas.size > 1
          ? "MISTO"
          : [...item.formas][0] || "—";

      return item;
    })
    .filter(item => Number(item.total || 0) > 0);
}

// ======================================================
// EXPORTAR EXCEL COMPATÍVEL
// ======================================================
function exportarCSV() {
  const vendas = getVendasFiltradas();

  if (!vendas.length) {
    mostrarModalAviso("Sem dados para exportar.");
    return;
  }

  const linhas = [
    ["RELATÓRIO FINANCEIRO - CRV PDV"],
    [`Período: ${getPeriodoLabel()} (${getPeriodoDetalhado()})`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Data", "Hora", "Pagamento", "Subtotal", "Desconto", "Total", "Lucro bruto", "Margem"]
  ];

  vendas.forEach(v => {
    const total = Number(v.total || 0);
    const lucro = Number(v.lucro_total || 0);
    const margem = total > 0 ? (lucro / total) * 100 : 0;

    linhas.push([
      formatarDataVendaRelatorio(v.data),
      formatarHoraVendaRelatorio(v.data),
      v.forma_pagamento || "—",
      numeroExcel(v.subtotal),
      numeroExcel(v.desconto),
      numeroExcel(v.total),
      numeroExcel(lucro),
      `${margem.toFixed(1)}%`
    ]);
  });

  const rankingVendidos = montarRankingProdutos(vendas)
    .sort((a, b) => b.qtd - a.qtd);

  if (rankingVendidos.length) {
    linhas.push([]);
    linhas.push(["PRODUTOS MAIS VENDIDOS"]);
    linhas.push(["Produto", "Quantidade", "Total vendido", "Lucro"]);

    rankingVendidos.forEach(produto => {
      linhas.push([
        produto.nome,
        produto.qtd,
        numeroExcel(produto.total),
        numeroExcel(produto.lucro)
      ]);
    });
  }

  const jogosAgrupados = montarRecebimentosJogosAgrupados(vendas);

  if (jogosAgrupados.length) {
    linhas.push([]);
    linhas.push(["RECEBIMENTOS DE JOGOS"]);
    linhas.push(["Data", "Tipo", "Jogo", "Pagamento", "Direto", "Comanda", "Total"]);

jogosAgrupados.forEach(jogo => {
  linhas.push([
    formatarDataVendaRelatorio(jogo.data),
    jogo.tipo,
    jogo.nome,
    jogo.forma,
    `${jogo.qtdDireto} jogador${jogo.qtdDireto !== 1 ? "es" : ""} - ${numeroExcel(jogo.totalDireto)}`,
    `${jogo.qtdComanda} jogador${jogo.qtdComanda !== 1 ? "es" : ""} - ${numeroExcel(jogo.totalComanda)}`,
    numeroExcel(jogo.total)
  ]);
});
  }

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_financeiro_${nomeFantasiaRelatorio}_crv_pdv_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function numeroExcel(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}

// ======================================================
// EXPORTAR PDF / IMPRESSÃO PROFISSIONAL
// ======================================================
function exportarPDF() {
  const vendas = getVendasFiltradas();

  if (!vendas.length) {
    mostrarModalAviso("Sem dados para exportar.");
    return;
  }

  const faturamento = vendas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const lucro = vendas.reduce((acc, v) => acc + Number(v.lucro_total || 0), 0);
  const qtd = vendas.length;
  const ticket = qtd > 0 ? faturamento / qtd : 0;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  const rankingVendidos = montarRankingProdutos(vendas)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  const rankingLucro = montarRankingProdutos(vendas)
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 10);

  const recebimentosJogos =
    montarRecebimentosJogosAgrupados(vendas);

  const html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>relatorio_financeiro_${nomeFantasiaRelatorio}_crv_pdv</title>

      <style>
        @page {
          size: A4;
          margin: 14mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #111;
          margin: 0;
          padding: 0;
          background: #fff;
          font-size: 12px;
          line-height: 1.45;
        }

        .logo {
          text-align: center;
          margin-bottom: 14px;
        }

        .logo img {
          height: 64px;
          max-width: 180px;
          object-fit: contain;
        }

        h1 {
          text-align: center;
          font-size: 20px;
          margin: 0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .subtitulo {
          text-align: center;
          font-size: 12px;
          color: #555;
          margin-top: 4px;
          margin-bottom: 22px;
        }

        h2 {
          font-size: 14px;
          margin: 22px 0 8px;
          padding-bottom: 5px;
          border-bottom: 1px solid #999;
          text-transform: uppercase;
        }

        .resumo {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }

        .box {
          border: 1px solid #cfcfcf;
          padding: 10px;
          border-radius: 6px;
        }

        .label {
          color: #555;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .valor {
          font-size: 17px;
          font-weight: bold;
        }

        p {
          text-align: justify;
          margin: 8px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          page-break-inside: auto;
        }

        th {
          background: #f1f1f1;
          border: 1px solid #cfcfcf;
          padding: 7px;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
        }

        td {
          border: 1px solid #d8d8d8;
          padding: 7px;
          font-size: 11px;
          vertical-align: top;
        }

        tr {
          page-break-inside: avoid;
        }

        .right {
          text-align: right;
        }

        .footer {
          margin-top: 28px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>

    <body>
      <div class="logo">
        <img src="assets/logo1.png">
      </div>

      <h1>Relatório Financeiro</h1>

      <div class="subtitulo">
        Período: ${getPeriodoLabel()} (${getPeriodoDetalhado()}) • Gerado em ${new Date().toLocaleString("pt-BR")}
      </div>

      <h2>Resumo do período</h2>

      <div class="resumo">
        <div class="box">
          <div class="label">Faturamento</div>
          <div class="valor">${fmt(faturamento)}</div>
        </div>

        <div class="box">
          <div class="label">Lucro bruto</div>
          <div class="valor">${fmt(lucro)}</div>
        </div>

        <div class="box">
          <div class="label">Total de vendas</div>
          <div class="valor">${qtd}</div>
        </div>

        <div class="box">
          <div class="label">Ticket médio</div>
          <div class="valor">${fmt(ticket)}</div>
        </div>
      </div>

      <p>
        O faturamento representa o valor total vendido no período selecionado. O lucro bruto considera os custos cadastrados nos produtos no momento da venda. A margem bruta estimada do período foi de ${margem.toFixed(1)}%.
      </p>

<h2>Formas de pagamento</h2>

<table>
  <thead>
    <tr>
      <th>Forma</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${Object.entries(
      vendas.reduce((acc, venda) => {
        const forma = labelFormaPagamentoRelatorio(
          venda.forma_pagamento
        );

        acc[forma] =
          (acc[forma] || 0) +
          Number(venda.total || 0);

        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .map(([forma, total]) => `
        <tr>
          <td>${forma}</td>
          <td class="right">${fmt(total)}</td>
        </tr>
      `)
      .join("")}
  </tbody>
</table>

      <h2>Produtos mais vendidos</h2>

      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th class="right">Qtd.</th>
            <th class="right">Total vendido</th>
          </tr>
        </thead>
        <tbody>
          ${rankingVendidos.map(p => `
            <tr>
              <td>${p.nome}</td>
              <td class="right">${p.qtd}</td>
              <td class="right">${fmt(p.total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <h2>Produtos mais lucrativos</h2>

      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th class="right">Qtd.</th>
            <th class="right">Faturamento</th>
            <th class="right">Lucro</th>
          </tr>
        </thead>
        <tbody>
          ${rankingLucro.map(p => `
            <tr>
              <td>${p.nome}</td>
              <td class="right">${p.qtd}</td>
              <td class="right">${fmt(p.total)}</td>
              <td class="right">${fmt(p.lucro)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${
  produtosData.length
    ? `
      <h2>Produtos com estoque baixo</h2>

      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th class="right">Estoque</th>
          </tr>
        </thead>

        <tbody>
          ${produtosData.map(produto => `
            <tr>
              <td>${produto.nome}</td>
              <td>${produto.categoria || "-"}</td>
              <td class="right">${produto.estoque}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : ""
}

      ${
        recebimentosJogos.length
          ? `
            <h2>Recebimentos de jogos</h2>

            <table>
              <thead>
                <tr>
                  <th>Jogo</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th class="right">Valor total</th>
                </tr>
              </thead>
              <tbody>
                ${recebimentosJogos.map(item => `
                  <tr>
                    <td>${item.nome}</td>
                    <td>${item.tipo}</td>
                    <td>${formatarDataVendaRelatorio(item.data)}</td>
                    <td class="right">${fmt(item.total)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `
          : ""
      }

      <div class="footer">
        CRV PDV • Relatório gerado automaticamente pelo sistema
      </div>
    </body>
    </html>
  `;

  const janela = window.open("", "_blank");
  janela.document.write(html);
  janela.document.close();

  janela.onload = () => {
    janela.focus();
    janela.print();
  };
}

function mostrarModalAviso(mensagem) {
    const modalExistente = document.getElementById("modalAvisoSistema");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modalAvisoSistema";
    modal.className = "modal-aviso-overlay";

    modal.innerHTML = `
        <div class="modal-aviso-card">
            <h3>Aviso</h3>
            <p>${mensagem}</p>
            <button id="btnFecharModalAviso">OK</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnFecharModalAviso").onclick = () => {
        modal.remove();
    };
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);