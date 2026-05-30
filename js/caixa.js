// ======================================================
// CRV PDV - CAIXA / PDV
// Versão operacional Supabase
// Sem produtos mockados
// Sem dependência de localDB para operação real
// ======================================================

// ===== ESTADO GLOBAL =====
let caixa = null;
let carrinho = [];
let vendas = [];
let produtos = [];
let produtosRapidos = [];
let metodoPagamento = "dinheiro";
let modoPDV = "venda";
let comandaAtiva = null;
let caixaInicializado = false;
let vendaEmProcessamento = false;
let comandasCaixa = [];
let comandasCaixaFiltradas = [];

let tipoNegocioCaixa = "";
let jogosCaixa = [];
let jogosCaixaFiltrados = [];
let jogadoresCaixaPorAgenda = {};
let filtroStatusJogosCaixa = "todos";
let jogoSelecionadoCaixa = null;


// ===== FORMATADORES =====
const fmt = valor => {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

function formatarHoraBrasil(data) {
  if (!data) return "—";

  let dataNormalizada = String(data);

  if (
    dataNormalizada.includes("T") &&
    !dataNormalizada.endsWith("Z") &&
    !dataNormalizada.includes("+")
  ) {
    dataNormalizada += "Z";
  }

  const objetoData = new Date(dataNormalizada);

  if (Number.isNaN(objetoData.getTime())) {
    return "—";
  }

  return objetoData.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function formatarDataHoraBrasil(data) {
  if (!data) return "—";

  let dataNormalizada = String(data);

  if (
    dataNormalizada.includes("T") &&
    !dataNormalizada.endsWith("Z") &&
    !dataNormalizada.includes("+")
  ) {
    dataNormalizada += "Z";
  }

  const objetoData = new Date(dataNormalizada);

  if (Number.isNaN(objetoData.getTime())) {
    return "—";
  }

  return objetoData.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  });
}

function normalizarNumero(valor) {
  let texto = String(valor || "")
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);

  if (Number.isNaN(numero) || numero < 0) {
    return 0;
  }

  return Number(numero.toFixed(2));
}

function formatarMoedaInput(valor) {
  let numeros = String(valor || "").replace(/\D/g, "");

  if (!numeros) {
    return "";
  }

  numeros = numeros.slice(0, 9);

  while (numeros.length < 3) {
    numeros = "0" + numeros;
  }

  const centavos = numeros.slice(-2);
  const reais = numeros.slice(0, -2);

  return `${Number(reais).toLocaleString("pt-BR")},${centavos}`;
}

function aplicarMascaraMoedaCaixa(input, callback) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = formatarMoedaInput(input.value);

    if (typeof callback === "function") {
      callback();
    }
  });

  input.addEventListener("blur", () => {
    input.value = formatarMoedaInput(input.value);

    if (typeof callback === "function") {
      callback();
    }
  });
}

function obterEmpresaId() {
  return window.APP_EMPRESA_ID || APP_EMPRESA_ID || null;
}

function obterUsuarioId() {
  if (window.USER?.id) return window.USER.id;
  if (typeof USER !== "undefined" && USER?.id) return USER.id;
  return null;
}

function sistemaOnline() {
  return Boolean(
    window.APP_STATUS &&
    APP_STATUS.online &&
    APP_STATUS.supabase_ok &&
    window.sb &&
    obterEmpresaId()
  );
}

function logCaixa(mensagem, tipo = "info") {
  if (typeof logSistema === "function") {
    logSistema("CAIXA", mensagem, tipo);
  } else {
    console.log(`[CRV PDV][CAIXA] ${mensagem}`);
  }
}

function logVenda(mensagem, tipo = "info") {
  if (typeof logSistema === "function") {
    logSistema("VENDA", mensagem, tipo);
  } else {
    console.log(`[CRV PDV][VENDA] ${mensagem}`);
  }
}

function abrirConfirmacaoCaixa({
  titulo = "Confirmar ação",
  mensagem = "Deseja confirmar esta ação?",
  textoConfirmar = "Confirmar",
  mostrarCancelar = true
}) {
  return new Promise(resolve => {
    const modal = document.getElementById("modalConfirmCaixa");
    const tituloEl = document.getElementById("confirmCaixaTitulo");
    const mensagemEl = document.getElementById("confirmCaixaMensagem");
    const btnFechar = document.getElementById("btnFecharConfirmCaixa");
    const btnCancelar = document.getElementById("btnCancelarConfirmCaixa");
    const btnOk = document.getElementById("btnOkConfirmCaixa");

    if (!modal || !btnOk || !mensagemEl) {
      resolve(window.confirm(mensagem));
      return;
    }

    if (tituloEl) tituloEl.textContent = titulo;
    mensagemEl.innerHTML = mensagem;
    btnOk.textContent = textoConfirmar;

    if (btnCancelar) {
      btnCancelar.style.display = mostrarCancelar ? "inline-flex" : "none";
    }

    modal.style.display = "flex";

    const fechar = resposta => {
      modal.style.display = "none";

      btnOk.onclick = null;
      if (btnCancelar) btnCancelar.onclick = null;
      if (btnFechar) btnFechar.onclick = null;

      resolve(resposta);
    };

    btnOk.onclick = () => fechar(true);

    if (btnCancelar) {
      btnCancelar.onclick = () => fechar(false);
    }

    if (btnFechar) {
      btnFechar.onclick = () => fechar(false);
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  });
}

async function alertaCaixa(titulo, mensagem) {
  await abrirConfirmacaoCaixa({
    titulo,
    mensagem,
    textoConfirmar: "OK",
    mostrarCancelar: false
  });
}

// ======================================================
// OFFLINE HELPER
// ======================================================

async function salvarOffline({
  tabela,
  operacao = "insert",
  payload
}) {

  try {

    await crvOfflineDB.adicionarFilaOffline({
      tabela,
      operacao,
      payload,
      empresa_id: obterEmpresaId()
    });

    crvToast({
      titulo: "Dados salvos offline",
      mensagem:
        "A operação será sincronizada automaticamente quando a internet voltar.",
      tipo: "warn"
    });

    crvLog(
      "OFFLINE",
      `${operacao} salvo localmente em ${tabela}`,
      "warn"
    );

    return true;

  } catch (err) {

    crvLog(
      "OFFLINE",
      err.message,
      "error"
    );

    return false;
  }
}

// ======================================================
// AGUARDAR SUPABASE / AUTH
// ======================================================
async function aguardarContextoSistema() {
  const tentativasMaximas = 40;
  let tentativa = 0;

  while (tentativa < tentativasMaximas) {
    if (sistemaOnline()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativa++;
  }

  return false;
}

// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
  logCaixa("Inicializando...");

  const pronto = await aguardarContextoSistema();

  if (!pronto) {
    logCaixa("Supabase/Auth não ficou pronto a tempo.", "error");
    renderEstado();
    renderProdutosRapidos();
    renderCarrinho();
    setupBusca();
    return;
  }

  await inicializarCaixa();

  setupBusca();
  setupAtalhos();
  setupInputs();
  setupModoPDV();
  setupModalSelecionarComanda();
  setupModalSelecionarJogo();

  caixaInicializado = true;

  logCaixa("Tela pronta para operação.", "success");
});

async function inicializarCaixa() {
  await carregarDadosSupabase();
  await carregarProdutos();
  await carregarTipoNegocioCaixa();

  renderEstado();
  renderProdutosRapidos();
  renderCarrinho();
  aplicarVisibilidadeBotaoJogos();

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// SUPABASE LOAD
// ======================================================
async function carregarDadosSupabase() {
  try {
    const empresaId = obterEmpresaId();

    if (!empresaId) {
      throw new Error("empresa_id não encontrado na sessão.");
    }

    logCaixa("Buscando caixa aberto...");

    const { data: caixaData, error: caixaError } = await sb
      .from("caixa")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("status", "aberto")
      .order("data_abertura", { ascending: false })
      .limit(1);

    if (caixaError) throw caixaError;

    caixa = caixaData?.[0] || null;

    if (caixa?.id) {
      const { data: vendasData, error: vendasError } = await sb
        .from("vendas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("caixa_id", caixa.id)
        .order("data", { ascending: false });

      if (vendasError) throw vendasError;

      vendas = vendasData || [];
    } else {
      vendas = [];
    }

    await crvOfflineDB.salvarCache(
  "caixa_status",
  caixa
);

await crvOfflineDB.salvarCache(
  "caixa_vendas",
  vendas
);

    logCaixa("Dados carregados do Supabase.", "success");

  } catch (err) {
caixa =
  await crvOfflineDB.obterCache(
    "caixa_status"
  ) || null;

vendas =
  await crvOfflineDB.obterCache(
    "caixa_vendas"
  ) || [];

    logCaixa("Erro ao carregar dados: " + err.message, "error");
  }
}

async function carregarProdutos() {
  try {
    const empresaId = obterEmpresaId();

    if (!empresaId) {
      throw new Error("empresa_id não encontrado para carregar produtos.");
    }

    const { data, error } = await sb
      .from("produtos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) throw error;

    produtos = Array.isArray(data) ? data : [];

    await crvOfflineDB.salvarCache(
  "caixa_produtos",
  produtos
);

    produtosRapidos = produtos.filter(produto => {
      return produto.produto_rapido === true;
    });

    logCaixa(`${produtos.length} produtos carregados do Supabase.`, "success");

  } catch (err) {
    const cacheProdutos =
      await crvOfflineDB.obterCache(
        "caixa_produtos"
      ) || [];

    produtos =
      cacheProdutos;

    produtosRapidos =
      produtos.filter(produto => {
        return produto.produto_rapido === true;
      });

    logCaixa("Erro ao carregar produtos: " + err.message, "error");
  }
}

async function carregarTipoNegocioCaixa() {
  try {
    const empresaId = obterEmpresaId();

    if (!empresaId) return;

    const { data, error } = await sb
      .from("empresas")
      .select("tipo_negocio")
      .eq("id", empresaId)
      .maybeSingle();

    if (error) throw error;

    tipoNegocioCaixa = String(data?.tipo_negocio || "");

  } catch (err) {
    tipoNegocioCaixa = "";
    console.error("[CAIXA][TIPO_NEGOCIO]", err);
  }
}

function caixaPermiteJogos() {
  return [
    "arena_esportiva",
    "arena_beach",
    "quadras_esportivas"
  ].includes(String(tipoNegocioCaixa || ""));
}

function aplicarVisibilidadeBotaoJogos() {
  const btnJogos = document.getElementById("btnModoJogos");

  if (!btnJogos) return;

  btnJogos.style.display = caixaPermiteJogos()
    ? "inline-flex"
    : "none";
}

// ======================================================
// ESTADO UI
// ======================================================
function renderEstado() {
  const aberto = document.getElementById("viewCaixaAberto");
  const fechado = document.getElementById("viewCaixaFechado");
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!aberto || !fechado || !dot || !text) return;

  if (caixa && caixa.status === "aberto") {
    aberto.style.display = "block";
    fechado.style.display = "none";

    dot.classList.remove("closed");
    dot.classList.add("open");

    text.textContent = "Caixa aberto";
    text.style.color = "var(--crv-green)";

    const infoAbertura = document.getElementById("infoAbertura");
    const infoValorInicial = document.getElementById("infoValorInicial");

    if (infoAbertura) {
      infoAbertura.textContent = formatarDataHoraBrasil(caixa.data_abertura);
    }

    if (infoValorInicial) {
      infoValorInicial.textContent = fmt(caixa.valor_inicial);
    }

    atualizarInfobar();
    renderHistorico();

  } else {
    aberto.style.display = "none";
    fechado.style.display = "block";

    dot.classList.remove("open");
    dot.classList.add("closed");

    text.textContent = "Caixa fechado";
    text.style.color = "";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// ABRIR CAIXA
// ======================================================
async function abrirCaixa() {
  const inputValor = document.getElementById("valorInicial");
  const valor = normalizarNumero(inputValor?.value || 0);

  if (!sistemaOnline()) {
    alert("Sistema ainda não está conectado ao Supabase. Aguarde alguns segundos e tente novamente.");
    return;
  }

  if (caixa && caixa.status === "aberto") {
    alert("Já existe um caixa aberto.");
    return;
  }

  try {
    const empresaId = obterEmpresaId();
    const usuarioId = obterUsuarioId();

    const payload = {
      empresa_id: empresaId,
      valor_inicial: valor,
      valor_final: null,
      status: "aberto",
      data_abertura: new Date().toISOString(),
      data_fechamento: null,
      observacoes: null,
      usuario_abertura: usuarioId,
      usuario_fechamento: null
    };

    const { data, error } = await sb
      .from("caixa")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    caixa = data;
    vendas = [];
    carrinho = [];

    if (inputValor) inputValor.value = "";

    renderEstado();
    renderCarrinho();
    renderHistorico();

    logCaixa("Caixa aberto no Supabase.", "success");

  } catch (err) {
    logCaixa("Erro ao abrir: " + err.message, "error");
    alert("Erro ao abrir caixa: " + err.message);
  }
}

// ======================================================
// FECHAR CAIXA
// ======================================================
function confirmarFechamento() {
  if (!caixa || caixa.status !== "aberto") {
    alert("Nenhum caixa aberto para fechar.");
    return;
  }

  preencherModalFechamento();

  const modal = document.getElementById("modalFechamento");

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function preencherModalFechamento() {
  const totalVendido = calcularTotalVendido();
  const totalDinheiro = calcularTotalVendidoDinheiro();
  const qtdVendas = vendas.length;
  const valorInicial = Number(caixa?.valor_inicial || 0);
  const saldoEsperado = valorInicial + totalDinheiro;

  const fechDataAbertura = document.getElementById("fechDataAbertura");
  const fechValorInicial = document.getElementById("fechValorInicial");
  const fechTotalVendido = document.getElementById("fechTotalVendido");
  const fechTotalDinheiro = document.getElementById("fechTotalDinheiro");
  const fechQtdVendas = document.getElementById("fechQtdVendas");
  const fechSaldoEsperado = document.getElementById("fechSaldoEsperado");
  const valorFechamento = document.getElementById("valorFechamento");
  const fechDiferenca = document.getElementById("fechDiferenca");

  if (fechDataAbertura) fechDataAbertura.textContent = formatarDataHoraBrasil(caixa?.data_abertura);
  if (fechValorInicial) fechValorInicial.textContent = fmt(valorInicial);
  if (fechTotalVendido) fechTotalVendido.textContent = fmt(totalVendido);
  if (fechTotalDinheiro) fechTotalDinheiro.textContent = fmt(totalDinheiro);
  if (fechQtdVendas) fechQtdVendas.textContent = qtdVendas;
  if (fechSaldoEsperado) fechSaldoEsperado.textContent = fmt(saldoEsperado);
  if (valorFechamento) valorFechamento.value = saldoEsperado.toFixed(2);
  if (fechDiferenca) fechDiferenca.innerHTML = "";

  calcularDiferenca();
}

function calcularDiferenca() {
  const valorFisico = normalizarNumero(
    document.getElementById("valorFechamento")?.value || 0
  );

  const saldoEsperado =
    Number(caixa?.valor_inicial || 0) +
    calcularTotalVendidoDinheiro();

  const diferenca = valorFisico - saldoEsperado;

  const box = document.getElementById("fechDiferenca");

  if (!box) return;

  if (Math.abs(diferenca) < 0.01) {
    box.innerHTML = `<span class="green">Caixa conferido sem diferença.</span>`;
    return;
  }

  if (diferenca > 0) {
    box.innerHTML = `<span class="green">Sobra de ${fmt(diferenca)}.</span>`;
    return;
  }

  box.innerHTML = `<span style="color:var(--crv-red);">Falta de ${fmt(Math.abs(diferenca))}.</span>`;
}

async function fecharCaixa() {
  if (!sistemaOnline()) {
    alert("Sistema sem conexão com Supabase.");
    return;
  }

  if (!caixa?.id) {
    alert("Nenhum caixa aberto.");
    return;
  }

  try {
    const valorFinal = normalizarNumero(
      document.getElementById("valorFechamento")?.value || 0
    );

    const usuarioId = obterUsuarioId();

    const { error } = await sb
      .from("caixa")
      .update({
        status: "fechado",
        valor_final: valorFinal,
        data_fechamento: new Date().toISOString(),
        usuario_fechamento: usuarioId
      })
      .eq("id", caixa.id)
      .eq("empresa_id", obterEmpresaId());

    if (error) throw error;

    caixa = null;
    vendas = [];
    carrinho = [];

    fecharModal();
    renderEstado();
    renderCarrinho();
    renderHistorico();

    logCaixa("Caixa fechado no Supabase.", "success");

  } catch (err) {
    logCaixa("Erro ao fechar: " + err.message, "error");
    alert("Erro ao fechar caixa: " + err.message);
  }
}

function fecharModal() {
  const modal = document.getElementById("modalFechamento");

  if (modal) {
    modal.style.display = "none";
  }
}

// ======================================================
// PRODUTOS RÁPIDOS
// ======================================================
function renderProdutosRapidos() {
  const grid = document.getElementById("produtosRapidos");

  if (!grid) return;

  grid.innerHTML = "";

  if (!produtosRapidos.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:22px;">
        <i data-lucide="package-search" width="28" height="28"></i>
        <p>Nenhum produto rápido cadastrado.</p>
        <small style="color:var(--text-muted);">
          Cadastre produtos e marque como produto rápido.
        </small>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  produtosRapidos.forEach(produto => {
    const item = document.createElement("div");

    item.className = "quick-item";

    item.innerHTML = `
      <div class="quick-item-name">
        ${produto.nome}
      </div>

      <div class="quick-item-price">
        ${fmt(produto.preco)}
      </div>
    `;

    item.onclick = async () => {
  if (modoPDV === "comanda" && comandaAtiva) {
    await adicionarProdutoNaComanda(produto);
    return;
  }

  await adicionarCarrinho(produto);
};

    grid.appendChild(item);
  });
}

// ======================================================
// BUSCA
// ======================================================
function setupBusca() {

  const input = document.getElementById("inputBusca");

  if (!input) return;

  // ====================================================
  // BUSCA VISUAL
  // ====================================================

  input.addEventListener("input", () => {

    // Em modo comanda sem ativa:
    // não mostra sugestão ainda
    if (
      modoPDV === "comanda" &&
      !comandaAtiva
    ) {
      return;
    }

    const termo = input.value
      .toLowerCase()
      .trim();

    const sugestoes =
      document.getElementById("pdvSuggestions");

    if (!sugestoes) return;

    if (!termo) {
      sugestoes.innerHTML = "";
      sugestoes.classList.remove("open");
      return;
    }

    const encontrados = produtos.filter(produto => {

      const nome =
        String(produto.nome || "")
        .toLowerCase();

      const codigo =
        String(produto.codigo || "")
        .toLowerCase();

      const codigoBarras =
        String(produto.codigo_barras || "")
        .toLowerCase();

      return (
        nome.includes(termo) ||
        codigo.includes(termo) ||
        codigoBarras.includes(termo)
      );
    });

    renderSugestoes(encontrados);
  });

  // ====================================================
  // ENTER / LEITOR USB
  // ====================================================

  input.addEventListener("keydown", async event => {

    if (event.key !== "Enter") return;

    event.preventDefault();

    const termo = input.value
      .trim();

    if (!termo) return;

    // =========================================
    // MODO VENDA
    // =========================================

    if (modoPDV === "venda") {

      await processarLeituraProduto(termo);

      return;
    }

    // =========================================
    // MODO COMANDA SEM ATIVA
    // =========================================

    if (
      modoPDV === "comanda" &&
      !comandaAtiva
    ) {

      await processarLeituraComanda(termo);

      return;
    }

    // =========================================
    // MODO COMANDA COM ATIVA
    // =========================================

    if (
      modoPDV === "comanda" &&
      comandaAtiva
    ) {

      await processarLeituraProduto(termo);

      return;
    }

  });

  // =========================================
  // FOCO AUTOMÁTICO
  // =========================================

  setInterval(() => {

    const modalAberto =
      document.querySelector(".modal-overlay[style*='flex']");

    if (modalAberto) return;

    const ativo =
      document.activeElement;

    const digitandoInput =
      ativo &&
      (
        ativo.tagName === "INPUT" ||
        ativo.tagName === "TEXTAREA"
      );

    if (!digitandoInput) {
      input.focus();
    }

  }, 1200);
}

function renderSugestoes(lista) {
  const box = document.getElementById("pdvSuggestions");

  if (!box) return;

  box.innerHTML = "";

  if (!lista.length) {
    box.classList.remove("open");
    return;
  }

  lista.slice(0, 12).forEach(produto => {
    const item = document.createElement("div");

    item.className = "suggestion-item";

    item.innerHTML = `
      <span>${produto.nome}</span>

      <span class="suggestion-price">
        ${fmt(produto.preco)}
      </span>
    `;

    item.onclick = () => {
      adicionarCarrinho(produto);

      box.innerHTML = "";
      box.classList.remove("open");

      const inputBusca = document.getElementById("inputBusca");

      if (inputBusca) {
        inputBusca.value = "";
        inputBusca.focus();
      }
    };

    box.appendChild(item);
  });

  box.classList.add("open");
}

// ======================================================
// CARRINHO
// ======================================================
async function adicionarCarrinho(produto) {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de vender."
    );
    return;
  }

  if (!produto || !produto.id) {
    await alertaCaixa(
      "Produto inválido",
      "Produto inválido."
    );
    return;
  }

  const preco = normalizarNumero(produto.preco);

  if (preco <= 0) {
    await alertaCaixa(
      "Preço inválido",
      "Produto sem preço válido."
    );
    return;
  }

  const estoqueDisponivel = Number(produto.estoque || 0);

  if (estoqueDisponivel <= 0) {
    await alertaCaixa(
      "Sem estoque",
      `Produto sem estoque: <strong>${produto.nome}</strong>`
    );
    return;
  }

  const existente = carrinho.find(item => item.id === produto.id);

  if (existente) {
    const novaQuantidade = Number(existente.quantidade || 0) + 1;

    if (novaQuantidade > estoqueDisponivel) {
      await alertaCaixa(
      "Estoque insuficiente",
      `
        Estoque insuficiente para
        <strong>${produto.nome}</strong>.<br><br>
        Disponível: ${estoqueDisponivel}
      `
    );
      return;
    }

    existente.quantidade = novaQuantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: preco,
      preco_custo: Number(produto.preco_custo || 0),
      codigo: produto.codigo || null,
      codigo_barras: produto.codigo_barras || null,
      quantidade: 1,
      produto_manual: false
    });
  }

  renderCarrinho();
}

async function adicionarManual() {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de vender."
    );
    return;
  }

  const nomeInput = document.getElementById("manualNome");
  const precoInput = document.getElementById("manualPreco");
  const qtdInput = document.getElementById("manualQtd");

  const nome = String(nomeInput?.value || "").trim();
  const preco = normalizarNumero(precoInput?.value || 0);
  const quantidade = Math.max(1, parseInt(qtdInput?.value || "1", 10));

if (!nome) {
  await alertaCaixa(
    "Item manual",
    "Informe o nome do item manual."
  );
  return;
}

if (preco <= 0) {
  await alertaCaixa(
    "Item manual",
    "Informe um preço válido."
  );
  return;
}

if (modoPDV === "comanda" && comandaAtiva) {
  await adicionarItemManualNaComanda({
    nome,
    preco,
    quantidade
  });

  if (nomeInput) nomeInput.value = "";
  if (precoInput) precoInput.value = "";
  if (qtdInput) qtdInput.value = "1";

  return;
}

  carrinho.push({
    id: "manual-" + Date.now(),
    nome: nome,
    preco: preco,
    quantidade: quantidade,
    produto_manual: true
  });

  if (nomeInput) nomeInput.value = "";
  if (precoInput) precoInput.value = "";
  if (qtdInput) qtdInput.value = "1";

  renderCarrinho();
}

function renderCarrinho() {
  const box = document.getElementById("cartItems");
  const count = document.getElementById("cartCount");

  if (!box) return;

  if (count) {
    const quantidadeTotal = carrinho.reduce((acc, item) => {
      return acc + Number(item.quantidade || 0);
    }, 0);

    count.textContent = quantidadeTotal;
  }

  if (!carrinho.length) {
    box.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shopping-cart" width="28" height="28"></i>
        <p>Carrinho vazio</p>
      </div>
    `;

    atualizarTotais();

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  box.innerHTML = "";

  carrinho.forEach((item, index) => {
    const div = document.createElement("div");

    div.className = "cart-item";

    div.innerHTML = `
      <div class="cart-item-name">
        ${item.nome}
      </div>

    <div class="cart-item-qty">
      <button class="qty-btn qty-minus" type="button">−</button>
      <span class="qty-num">${item.quantidade}</span>
      <button class="qty-btn qty-plus" type="button">+</button>
    </div>

      <div class="cart-item-price">
        ${fmt(item.preco * item.quantidade)}
      </div>

      <button class="cart-item-remove" type="button">
        ✕
      </button>
    `;

    const remover = div.querySelector(".cart-item-remove");

    const btnMinus = div.querySelector(".qty-minus");
const btnPlus = div.querySelector(".qty-plus");

if (btnMinus) {
  btnMinus.onclick = async () => {
    await alterarQuantidadeCarrinho(index, -1);
  };
}

if (btnPlus) {
  btnPlus.onclick = async () => {
    await alterarQuantidadeCarrinho(index, 1);
  };
}

    if (remover) {
      remover.onclick = async () => {
        await removerItemCarrinho(index);
      };
    }

    box.appendChild(div);
  });

  atualizarTotais();
}

async function limparCarrinho() {
  if (modoPDV === "comanda" && comandaAtiva) {
    await alertaCaixa(
      "Comanda ativa",
      "Para sair da comanda, use o botão <strong>Limpar</strong> do card da comanda ativa."
    );
    return;
  }

  if (!carrinho.length) return;

  const confirmar = await abrirConfirmacaoCaixa({
    titulo: "Limpar carrinho",
    mensagem: "Deseja limpar o carrinho atual?",
    textoConfirmar: "Limpar"
  });

  if (!confirmar) return;

  carrinho = [];
  renderCarrinho();
}

// ======================================================
// TOTAIS / INFOBAR
// ======================================================
function calcularSubtotalCarrinho() {
  return carrinho.reduce((acc, item) => {
    return acc + Number(item.preco || 0) * Number(item.quantidade || 0);
  }, 0);
}

function calcularDesconto() {
  return normalizarNumero(
    document.getElementById("inputDesconto")?.value || 0
  );
}

function calcularTotalCarrinho() {
  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();

  return Math.max(0, subtotal - desconto);
}

function calcularTotalVendido() {
  return vendas.reduce((acc, venda) => {
    return acc + Number(venda.total || 0);
  }, 0);
}

function calcularTotalVendidoDinheiro() {
  return vendas.reduce((acc, venda) => {
    const forma = String(venda.forma_pagamento || "").toLowerCase();

    if (forma !== "dinheiro") {
      return acc;
    }

    return acc + Number(venda.total || 0);
  }, 0);
}

function atualizarTotais() {
  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();
  const total = Math.max(0, subtotal - desconto);

  const subtotalEl = document.getElementById("subtotal");
  const descontoEl = document.getElementById("descontoTotal");
  const totalEl = document.getElementById("totalGeral");

  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (descontoEl) descontoEl.textContent = "- " + fmt(desconto);
  if (totalEl) totalEl.textContent = fmt(total);

  calcularTroco();
}

function atualizarInfobar() {
  const infoQtdVendas = document.getElementById("infoQtdVendas");
  const infoSaldo = document.getElementById("infoSaldo");

  const totalDinheiro = calcularTotalVendidoDinheiro();

  if (infoQtdVendas) {
    infoQtdVendas.textContent = vendas.length;
  }

  const saldo = Number(caixa?.valor_inicial || 0) + totalDinheiro;

  if (infoSaldo) {
    infoSaldo.textContent = fmt(saldo);
  }
}

// ======================================================
// PAGAMENTO / TROCO
// ======================================================
function selecionarPagamento(botao) {
  document
    .querySelectorAll(".pay-btn")
    .forEach(btn => btn.classList.remove("active"));

  botao.classList.add("active");

  metodoPagamento = botao.dataset.method || "dinheiro";

  const trocoBox = document.getElementById("cartTroco");

  if (trocoBox) {
    trocoBox.style.display = metodoPagamento === "dinheiro" ? "block" : "none";
  }

  calcularTroco();
}

function calcularTroco() {
  const recebido = normalizarNumero(
    document.getElementById("valorRecebido")?.value || 0
  );

  const total = calcularTotalCarrinho();
  const troco = Math.max(0, recebido - total);

  const resultado = document.getElementById("trocoResult");

  if (resultado) {
    resultado.innerHTML = `Troco: <strong>${fmt(troco)}</strong>`;
  }

  return troco;
}

function bloquearBotaoFinalizar(bloquear) {
  const botao = document.getElementById("btnFinalizar");

  if (!botao) return;

  botao.disabled = bloquear;
  botao.style.opacity = bloquear ? "0.65" : "";
  botao.style.pointerEvents = bloquear ? "none" : "";

  const texto = botao.querySelector("span");

  if (texto) {
    texto.textContent = bloquear ? "Finalizando..." : "Finalizar Venda";
  }
}

async function validarCarrinhoComEstoque() {
  const idsProdutos = carrinho
    .filter(item => !item.produto_manual && item.id)
    .map(item => item.id);

  if (!idsProdutos.length) {
    return true;
  }

  const idsUnicos = [...new Set(idsProdutos)];

  const { data, error } = await sb
    .from("produtos")
    .select("id, nome, preco, estoque, ativo")
    .eq("empresa_id", obterEmpresaId())
    .in("id", idsUnicos);

  if (error) throw error;

  const mapaProdutos = new Map();

  (data || []).forEach(produto => {
    mapaProdutos.set(produto.id, produto);
  });

  for (const id of idsUnicos) {
    const produtoBanco = mapaProdutos.get(id);

    if (!produtoBanco) {
      throw new Error("Um produto do carrinho não foi encontrado no Supabase.");
    }

    if (produtoBanco.ativo !== true) {
      throw new Error(`Produto inativo no caixa: ${produtoBanco.nome}`);
    }

    const quantidadeCarrinho = carrinho
      .filter(item => item.id === id)
      .reduce((acc, item) => acc + Number(item.quantidade || 0), 0);

    const estoqueAtual = Number(produtoBanco.estoque || 0);

    if (estoqueAtual < quantidadeCarrinho) {
      throw new Error(`Estoque insuficiente para ${produtoBanco.nome}. Disponível: ${estoqueAtual}`);
    }

    const produtoLocal = produtos.find(produto => produto.id === id);

    if (produtoLocal) {
      produtoLocal.preco = produtoBanco.preco;
      produtoLocal.estoque = produtoBanco.estoque;
      produtoLocal.ativo = produtoBanco.ativo;
    }
  }

  return true;
}

// ======================================================
// FINALIZAR VENDA
// ======================================================
async function finalizarVenda() {
  if (vendaEmProcessamento) {
    return;
  }

if (!sistemaOnline()) {

  const vendaOfflineId =
    "offline-" + Date.now();

  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();
  const total = calcularTotalCarrinho();

  const troco =
    metodoPagamento === "dinheiro"
      ? Math.max(
          0,
          normalizarNumero(
            document.getElementById("valorRecebido")?.value || 0
          ) - total
        )
      : 0;

  const vendaPayload = {
    id: vendaOfflineId,
    empresa_id: obterEmpresaId(),
    caixa_id: caixa?.id || null,
    subtotal,
    desconto,
    total,
    forma_pagamento: metodoPagamento,
    troco,
    data: new Date().toISOString(),
    offline: true
  };

  const itensPayload = carrinho.map(item => ({
    empresa_id: obterEmpresaId(),
    venda_id: vendaOfflineId,
    produto_id: item.produto_manual
      ? null
      : item.id,
    nome: item.nome,
    preco: Number(item.preco || 0),
    preco_custo: Number(item.preco_custo || 0),
    quantidade: Number(item.quantidade || 0)
  }));

  await salvarOffline({
    tabela: "vendas",
    payload: vendaPayload
  });

  await salvarOffline({
    tabela: "vendas_itens",
    payload: itensPayload
  });

  vendas.unshift(vendaPayload);

  exibirModalSucesso(total, troco);

  carrinho = [];

  renderCarrinho();
  atualizarInfobar();
  renderHistorico();

  logVenda(
    "Venda salva offline.",
    "warn"
  );

  return;
}

  if (!caixa || caixa.status !== "aberto") {
    alert("Abra o caixa antes de finalizar uma venda.");
    return;
  }

  if (!carrinho.length) {
    await alertaCaixa(
      "Carrinho vazio",
      "Adicione itens ao carrinho."
    );
    return;
  }

  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();
  const total = calcularTotalCarrinho();

  if (desconto > subtotal) {
    alert("O desconto não pode ser maior que o subtotal.");
    return;
  }

  if (total <= 0) {
    alert("Total da venda inválido.");
    return;
  }

  const valorRecebido = normalizarNumero(
    document.getElementById("valorRecebido")?.value || 0
  );

  if (metodoPagamento === "dinheiro" && valorRecebido > 0 && valorRecebido < total) {
    await alertaCaixa(
      "Pagamento insuficiente",
      "O valor recebido é menor que o total da venda."
    );
    return;
  }

  const troco = metodoPagamento === "dinheiro"
    ? Math.max(0, valorRecebido - total)
    : 0;

  let vendaCriadaId = null;

  try {
    vendaEmProcessamento = true;
    bloquearBotaoFinalizar(true);

    await validarCarrinhoComEstoque();

    const empresaId = obterEmpresaId();

const vendaPayload = {
  empresa_id: empresaId,
  caixa_id: caixa.id,
  cliente_id: null,
  subtotal: subtotal,
  desconto: desconto,
  total: total,
  forma_pagamento: metodoPagamento,
  troco: troco,
  origem: "pdv",
  origem_id: null,
  descricao: "Venda rápida",
  data: new Date().toISOString()
};

    const { data: vendaData, error: vendaError } = await sb
      .from("vendas")
      .insert([vendaPayload])
      .select("*")
      .single();

    if (vendaError) throw vendaError;

    vendaCriadaId = vendaData.id;

    const itensPayload = carrinho.map(item => {

      const precoVenda = Number(item.preco || 0);
      const precoCusto = Number(item.preco_custo || 0);
      const quantidade = Number(item.quantidade || 0);

      const lucroUnitario =
        precoVenda - precoCusto;

      const lucroTotal =
        lucroUnitario * quantidade;

      return {
        empresa_id: empresaId,
        venda_id: vendaData.id,
        produto_id: item.produto_manual ? null : item.id,
        nome: item.nome,
        preco: precoVenda,
        preco_custo: precoCusto,
        lucro_unitario: lucroUnitario,
        lucro_total: lucroTotal,
        quantidade: quantidade
      };
    });

    const { error: itensError } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (itensError) throw itensError;

    await baixarEstoqueProdutos();

    vendas.unshift(vendaData);

    exibirModalSucesso(total, troco);

    carrinho = [];

    const descontoInput = document.getElementById("inputDesconto");
    const valorRecebidoInput = document.getElementById("valorRecebido");

    if (descontoInput) descontoInput.value = "";
    if (valorRecebidoInput) valorRecebidoInput.value = "";

    await carregarProdutos();

    renderProdutosRapidos();
    renderCarrinho();
    atualizarInfobar();
    renderHistorico();

    logVenda("Venda salva no Supabase.", "success");

  } catch (err) {
    if (vendaCriadaId) {
      try {
        await sb
          .from("vendas_itens")
          .delete()
          .eq("venda_id", vendaCriadaId)
          .eq("empresa_id", obterEmpresaId());

        await sb
          .from("vendas")
          .delete()
          .eq("id", vendaCriadaId)
          .eq("empresa_id", obterEmpresaId());
      } catch (rollbackErr) {
        logVenda("Falha ao desfazer venda incompleta: " + rollbackErr.message, "error");
      }
    }

    logVenda("Erro ao finalizar venda: " + err.message, "error");
    alert("Erro ao finalizar venda: " + err.message);

  } finally {
    vendaEmProcessamento = false;
    bloquearBotaoFinalizar(false);
  }
}

async function baixarEstoqueProdutos() {
  const itensComProduto = carrinho.filter(item => {
    return !item.produto_manual && item.id;
  });

  const quantidadesPorProduto = {};

  itensComProduto.forEach(item => {
    if (!quantidadesPorProduto[item.id]) {
      quantidadesPorProduto[item.id] = {
        id: item.id,
        nome: item.nome,
        quantidade: 0
      };
    }

    quantidadesPorProduto[item.id].quantidade += Number(item.quantidade || 0);
  });

  for (const item of Object.values(quantidadesPorProduto)) {
    const produtoOriginal = produtos.find(produto => produto.id === item.id);

    if (!produtoOriginal) {
      throw new Error(`Produto não encontrado para baixar estoque: ${item.nome}`);
    }

    const estoqueAtual = Number(produtoOriginal.estoque || 0);
    const quantidadeVendida = Number(item.quantidade || 0);

    if (estoqueAtual < quantidadeVendida) {
      throw new Error(`Estoque insuficiente para ${item.nome}. Disponível: ${estoqueAtual}`);
    }

    const novoEstoque = estoqueAtual - quantidadeVendida;

    const { error } = await sb
      .from("produtos")
      .update({
        estoque: novoEstoque,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .eq("empresa_id", obterEmpresaId());

    if (error) {
      throw new Error("Não foi possível atualizar estoque de " + item.nome + ": " + error.message);
    }

    produtoOriginal.estoque = novoEstoque;
  }
}

function exibirModalSucesso(total, troco) {
  const modal = document.getElementById("modalSucesso");
  const msg = document.getElementById("sucessoMsg");
  const trocoBox = document.getElementById("sucessoTroco");

  if (msg) {
    msg.textContent = `Total recebido: ${fmt(total)}`;
  }

  if (trocoBox) {
    if (metodoPagamento === "dinheiro" && troco > 0) {
      trocoBox.style.display = "block";
      trocoBox.innerHTML = `Troco: <strong>${fmt(troco)}</strong>`;
    } else {
      trocoBox.style.display = "none";
      trocoBox.innerHTML = "";
    }
  }

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function novaVenda() {
  const modal = document.getElementById("modalSucesso");

  if (modal) {
    modal.style.display = "none";
  }

  const inputBusca = document.getElementById("inputBusca");

  if (inputBusca) {
    inputBusca.focus();
  }
}

// ======================================================
// HISTÓRICO
// ======================================================
function renderHistorico() {
  const box = document.getElementById("historicoList");
  const badge = document.getElementById("badgeVendas");

  if (!box) return;

  if (badge) {
    badge.textContent = `${vendas.length} registros`;
  }

  if (!vendas.length) {
    box.innerHTML = `
      <div class="empty-state" style="padding:16px;">
        <p>Nenhuma movimentação ainda</p>
      </div>
    `;
    return;
  }

  box.innerHTML = "";

  vendas.forEach(venda => {
    const origem = String(venda.origem || "pdv").toLowerCase();

    const icon =
      origem === "comanda"
        ? "ticket"
        : origem === "agenda"
          ? "calendar-check"
          : "shopping-cart";

    const classe =
      origem === "comanda"
        ? "comanda"
        : origem === "agenda"
          ? "agenda"
          : "venda";

    const titulo =
      origem === "comanda"
        ? (venda.descricao || "Comanda fechada")
        : origem === "agenda"
          ? (venda.descricao || "Jogo pago")
          : (venda.descricao || "Venda finalizada");

    const detalhe =
      `${String(venda.forma_pagamento || "—").toUpperCase()} · ${formatarDataHoraBrasil(venda.data)}`;

    const item = document.createElement("div");

    item.className = "historico-item";

    item.innerHTML = `
      <div class="historico-item-icon ${classe}">
        <i data-lucide="${icon}" width="16" height="16"></i>
      </div>

      <div class="historico-item-content">
        <span class="historico-pagto">
          ${titulo}
        </span>

        <small class="historico-hora">
          ${detalhe}
        </small>
      </div>

      <div class="historico-valor">
        ${fmt(Number(venda.total || 0))}
      </div>

      <div class="historico-item-action">
        <i data-lucide="chevron-right" width="15" height="15"></i>
      </div>
    `;

    box.appendChild(item);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// INPUTS / ATALHOS
// ======================================================
function setupInputs() {
  const desconto = document.getElementById("inputDesconto");

  if (desconto) {
    desconto.addEventListener("input", atualizarTotais);
  }

  const valorRecebido = document.getElementById("valorRecebido");

  if (valorRecebido) {
    valorRecebido.addEventListener("input", calcularTroco);
  }

  const trocoBox = document.getElementById("cartTroco");

  if (trocoBox) {
    trocoBox.style.display = metodoPagamento === "dinheiro" ? "block" : "none";
  }
    aplicarMascaraMoedaCaixa(
    document.getElementById("manualPreco")
  );

  aplicarMascaraMoedaCaixa(
    document.getElementById("inputDesconto"),
    atualizarTotais
  );

  aplicarMascaraMoedaCaixa(
    document.getElementById("valorRecebido"),
    calcularTroco
  );

  aplicarMascaraMoedaCaixa(
    document.getElementById("valorInicial")
  );

  aplicarMascaraMoedaCaixa(
    document.getElementById("valorFechamento"),
    calcularDiferenca
  );
}

function setupAtalhos() {
  document.addEventListener("keydown", event => {
    if (event.key === "F2") {
      event.preventDefault();

      const inputBusca = document.getElementById("inputBusca");

      if (inputBusca) inputBusca.focus();
    }

    if (event.key === "F4") {
      event.preventDefault();
      finalizarVenda();
    }

    if (event.key === "Escape") {
      const modalSucesso = document.getElementById("modalSucesso");
      const modalFechamento = document.getElementById("modalFechamento");

      if (modalSucesso && modalSucesso.style.display === "flex") {
        modalSucesso.style.display = "none";
      }

      if (modalFechamento && modalFechamento.style.display === "flex") {
        modalFechamento.style.display = "none";
      }
    }
  });
}

// ======================================================
// MODO PDV
// ======================================================
function setupModoPDV() {

  const btnVenda = document.getElementById("btnModoVenda");
  const btnComanda = document.getElementById("btnModoComanda");
  const btnJogos = document.getElementById("btnModoJogos");

  if (btnVenda) {
    btnVenda.onclick = async () => {
      await alterarModoPDV("venda");
    };
  }

  if (btnComanda) {
    btnComanda.onclick = async () => {
      await alterarModoPDV("comanda");
    };
  }

  if (btnJogos) {
    btnJogos.onclick = async () => {
      await alterarModoPDV("jogos");
    };
  }

  aplicarVisibilidadeBotaoJogos();
  atualizarInterfaceModoPDV();
}

async function alterarModoPDV(modo) {

  if (modo === "jogos" && !caixaPermiteJogos()) {
    await alertaCaixa(
      "Módulo indisponível",
      "O atalho de jogos aparece apenas para arenas e quadras esportivas."
    );
    return;
  }

  modoPDV = modo;

  const btnVenda = document.getElementById("btnModoVenda");
  const btnComanda = document.getElementById("btnModoComanda");
  const btnJogos = document.getElementById("btnModoJogos");

  btnVenda?.classList.remove("active");
  btnComanda?.classList.remove("active");
  btnJogos?.classList.remove("active");

  if (modo === "venda") {
    btnVenda?.classList.add("active");

    comandaAtiva = null;
    jogoSelecionadoCaixa = null;
    carrinho = [];

    renderCarrinho();
    atualizarInterfaceModoPDV();
    return;
  }

  if (modo === "comanda") {
    btnComanda?.classList.add("active");

    jogoSelecionadoCaixa = null;

    atualizarInterfaceModoPDV();

    await abrirModalSelecionarComanda();
    return;
  }

  if (modo === "jogos") {
    btnJogos?.classList.add("active");

    comandaAtiva = null;
    jogoSelecionadoCaixa = null;
    carrinho = [];

    renderCarrinho();
    atualizarInterfaceModoPDV();

    await abrirModalSelecionarJogo();
  }
}

function atualizarInterfaceModoPDV() {

  const inputBusca = document.getElementById("inputBusca");
  const comandaCard = document.getElementById("comandaCard");
  const btnFinalizar = document.getElementById("btnFinalizar");

  if (!inputBusca) return;

  // =========================
  // VENDA RÁPIDA
  // =========================

  if (modoPDV === "venda") {
      if (btnFinalizar) {
      btnFinalizar.onclick = finalizarVenda;

      const span = btnFinalizar.querySelector("span");

      if (span) {
        span.textContent = "Finalizar Venda";
      }
    }

    if (comandaCard) {
      comandaCard.style.display = "none";
    }

    inputBusca.placeholder =
      "Buscar produto ou código de barras...";

    inputBusca.focus();

    return;
  }

  // =========================
  // JOGOS
  // =========================

  if (modoPDV === "jogos") {
    if (comandaCard) {
      comandaCard.style.display = "none";
    }

    if (btnFinalizar) {
      btnFinalizar.onclick = null;

      const span = btnFinalizar.querySelector("span");

      if (span) {
        span.textContent = "Selecione um jogo";
      }
    }

    inputBusca.placeholder =
      "Use o botão Jogos para buscar cobranças da agenda...";

    inputBusca.focus();

    return;
  }

  // =========================
  // COMANDA SEM ATIVA
  // =========================

  if (!comandaAtiva) {
      if (btnFinalizar) {
      btnFinalizar.onclick = null;

      const span = btnFinalizar.querySelector("span");

      if (span) {
        span.textContent = "Abra uma comanda";
      }
    }

    if (comandaCard) {
      comandaCard.style.display = "none";
    }

    inputBusca.placeholder =
      "Ler ou digitar código da comanda...";

    inputBusca.focus();

    return;
  }

  // =========================
  // COMANDA ATIVA
  // =========================

  if (comandaCard) {
    comandaCard.style.display = "flex";
  }

  const codigo = document.getElementById("comandaCodigo");
  const total = document.getElementById("comandaTotal");
  const status = document.getElementById("comandaStatus");

  if (codigo) {
    codigo.textContent = comandaAtiva.codigo || "—";
  }

  if (status) {
    status.textContent = comandaAtiva.status || "aberta";
  }

  if (total) {
    total.textContent = fmt(comandaAtiva.total || 0);
  }

    if (btnFinalizar) {
    btnFinalizar.onclick = fecharComanda;

    const span = btnFinalizar.querySelector("span");

    if (span) {
      span.textContent = "Fechar Comanda";
    }
  }

  inputBusca.placeholder =
    "Ler produto para adicionar na comanda...";

  inputBusca.focus();
}

// ======================================================
// MODAL SELECIONAR JOGO NO CAIXA
// ======================================================

function setupModalSelecionarJogo() {
  const btnFechar = document.getElementById("btnFecharSelecionarJogo");
  const inputBusca = document.getElementById("inputBuscaModalJogo");

  const btnFecharFinalizar = document.getElementById("btnFecharFinalizarJogo");
  const btnCancelarFinalizar = document.getElementById("btnCancelarFinalizarJogo");
  const btnConfirmarFinalizar = document.getElementById("btnConfirmarFinalizarJogo");

  if (btnFechar) {
    btnFechar.onclick = fecharModalSelecionarJogo;
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", () => {
      filtrarJogosCaixa();
    });
  }

  document.querySelectorAll(".jogo-filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".jogo-filtro-btn")
        .forEach(item => item.classList.remove("active"));

      btn.classList.add("active");

      filtroStatusJogosCaixa = btn.dataset.status || "todos";

      filtrarJogosCaixa();
    });
  });

  if (btnFecharFinalizar) {
    btnFecharFinalizar.onclick = fecharModalFinalizarJogoCaixa;
  }

  if (btnCancelarFinalizar) {
    btnCancelarFinalizar.onclick = fecharModalFinalizarJogoCaixa;
  }

  if (btnConfirmarFinalizar) {
    btnConfirmarFinalizar.onclick = confirmarPagamentoJogoCaixa;
  }
}

async function abrirModalSelecionarJogo() {
  if (!caixaPermiteJogos()) {
    await alertaCaixa(
      "Módulo indisponível",
      "Jogos ficam disponíveis apenas para arenas e quadras esportivas."
    );
    return;
  }

  const modal = document.getElementById("modalSelecionarJogo");
  const inputBusca = document.getElementById("inputBuscaModalJogo");

  if (modal) {
    modal.style.display = "flex";
  }

  if (inputBusca) {
    inputBusca.value = "";
  }

  await carregarJogosCaixa();
  filtrarJogosCaixa();

  setTimeout(() => {
    inputBusca?.focus();
  }, 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalSelecionarJogo() {
  const modal = document.getElementById("modalSelecionarJogo");

  if (modal) {
    modal.style.display = "none";
  }

  const inputBusca = document.getElementById("inputBusca");

  if (inputBusca) {
    inputBusca.focus();
  }
}

async function carregarJogosCaixa() {
  const lista = document.getElementById("listaJogosCaixa");

  if (lista) {
    lista.innerHTML = `
      <div class="empty-state">
        <p>Carregando jogos...</p>
      </div>
    `;
  }

  try {
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: jogos, error: erroJogos } = await sb
      .from("agenda")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .gte("data_agendamento", hoje)
      .order("data_agendamento", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (erroJogos) throw erroJogos;

    const idsAgenda = (jogos || []).map(jogo => jogo.id);

    let jogadores = [];

    if (idsAgenda.length) {
      const { data: jogadoresData, error: erroJogadores } = await sb
        .from("agenda_jogadores")
        .select("*")
        .eq("empresa_id", obterEmpresaId())
        .in("agenda_id", idsAgenda);

      if (erroJogadores) throw erroJogadores;

      jogadores = jogadoresData || [];
    }

    jogosCaixa = Array.isArray(jogos) ? jogos : [];
    jogadoresCaixaPorAgenda = agruparJogadoresCaixa(jogadores);

  } catch (err) {
    jogosCaixa = [];
    jogadoresCaixaPorAgenda = {};

    await alertaCaixa(
      "Erro ao carregar jogos",
      "Não foi possível carregar os jogos da agenda."
    );

    console.error(err);
  }
}

function agruparJogadoresCaixa(lista) {
  const grupos = {};

  (lista || []).forEach(jogador => {
    if (!grupos[jogador.agenda_id]) {
      grupos[jogador.agenda_id] = [];
    }

    grupos[jogador.agenda_id].push(jogador);
  });

  return grupos;
}

function filtrarJogosCaixa() {
  const termo = String(
    document.getElementById("inputBuscaModalJogo")?.value || ""
  ).toLowerCase().trim();

  jogosCaixaFiltrados = jogosCaixa.filter(jogo => {
    const status = calcularStatusJogoCaixa(jogo);

    const jogadores = jogadoresCaixaPorAgenda[jogo.id] || [];

    const textoJogadores = jogadores
      .map(jogador => jogador.nome || "")
      .join(" ")
      .toLowerCase();

    const textoBusca = [
      jogo.cliente_nome,
      jogo.local_recurso,
      jogo.tipo_jogo,
      jogo.observacoes,
      textoJogadores
    ]
      .join(" ")
      .toLowerCase();

    const bateStatus =
      filtroStatusJogosCaixa === "todos" ||
      status === filtroStatusJogosCaixa;

    const bateBusca =
      !termo ||
      textoBusca.includes(termo);

    return bateStatus && bateBusca;
  });

  renderJogosCaixa();
}

function calcularStatusJogoCaixa(jogo) {
  if (jogo.status_jogo === "cancelado") return "cancelado";
  if (jogo.status_jogo === "fechado") return "fechado";

  const hoje = new Date().toISOString().slice(0, 10);
  const dataJogo = String(jogo.data_agendamento || "").slice(0, 10);

  if (dataJogo > hoje) return "agendado";
  if (dataJogo < hoje) return "cobranca";

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const inicio = horaParaMinutosCaixa(jogo.hora_inicio);
  const fim = horaParaMinutosCaixa(jogo.hora_fim || jogo.hora_inicio);

  if (minutosAgora < inicio) return "agendado";
  if (minutosAgora >= inicio && minutosAgora < fim) return "andamento";

  return "cobranca";
}

function horaParaMinutosCaixa(hora) {
  if (!hora) return 0;

  const [h, m] = String(hora).split(":");

  return Number(h || 0) * 60 + Number(m || 0);
}

function formatarHoraCaixa(hora) {
  if (!hora) return "--:--";

  return String(hora).slice(0, 5);
}

function formatarDataCaixa(data) {
  if (!data) return "—";

  const partes = String(data).slice(0, 10).split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function renderJogosCaixa() {
  const lista = document.getElementById("listaJogosCaixa");

  if (!lista) return;

  if (!jogosCaixaFiltrados.length) {
    lista.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="calendar-x" width="28" height="28"></i>
        <p>Nenhum jogo encontrado.</p>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  lista.innerHTML = "";

  jogosCaixaFiltrados.forEach(jogo => {
    const status = calcularStatusJogoCaixa(jogo);
    const jogadores = jogadoresCaixaPorAgenda[jogo.id] || [];

    const recebido = jogadores
      .filter(jogador => jogador.pago)
      .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

    const pendente = jogadores
      .filter(jogador => !jogador.pago)
      .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

    const btn = document.createElement("button");

    btn.className = "jogo-caixa-item";
    btn.type = "button";

    btn.innerHTML = `
      <div class="jogo-caixa-top">
        <div>
          <div class="jogo-caixa-horario">
            ${formatarHoraCaixa(jogo.hora_inicio)}
            -
            ${formatarHoraCaixa(jogo.hora_fim)}
          </div>

          <div class="jogo-caixa-local">
            ${formatarDataCaixa(jogo.data_agendamento)}
            ·
            ${jogo.local_recurso || "Quadra/Campo"}
          </div>
        </div>

        <span class="jogo-caixa-status ${status}">
          ${status === "cobranca" ? "cobrança" : status}
        </span>
      </div>

      <div class="jogo-caixa-responsavel">
        ${jogo.cliente_nome || "Responsável não informado"}
      </div>

      <div class="jogo-caixa-valores">
        <div>
          <span>Recebido</span>
          <strong>${fmt(recebido)}</strong>
        </div>

        <div>
          <span>Pendente</span>
          <strong>${fmt(pendente)}</strong>
        </div>
      </div>
    `;

    btn.onclick = () => abrirFinalizacaoJogoCaixa(jogo.id);

    lista.appendChild(btn);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function abrirFinalizacaoJogoCaixa(jogoId) {
  const jogo = jogosCaixa.find(item => String(item.id) === String(jogoId));

  if (!jogo) {
    alert("Jogo não encontrado.");
    return;
  }

  jogoSelecionadoCaixa = jogo;

  const jogadores = jogadoresCaixaPorAgenda[jogo.id] || [];

  const modal = document.getElementById("modalFinalizarJogoCaixa");
  const titulo = document.getElementById("finalizarJogoTitulo");
  const subtitulo = document.getElementById("finalizarJogoSubtitulo");
  const resumo = document.getElementById("jogoCaixaResumo");
  const lista = document.getElementById("jogoCaixaJogadores");

  const recebido = jogadores
    .filter(jogador => jogador.pago)
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

  const pendente = jogadores
    .filter(jogador => !jogador.pago)
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

  if (titulo) {
    titulo.textContent = `Jogo - ${jogo.local_recurso || "Quadra/Campo"}`;
  }

  if (subtitulo) {
    subtitulo.textContent =
      `${formatarDataCaixa(jogo.data_agendamento)} · ${formatarHoraCaixa(jogo.hora_inicio)} até ${formatarHoraCaixa(jogo.hora_fim)} · ${jogo.cliente_nome || "Responsável"}`;
  }

  if (resumo) {
    resumo.innerHTML = `
      <div>
        <span>Recebido</span>
        <strong>${fmt(recebido)}</strong>
      </div>

      <div>
        <span>Pendente</span>
        <strong>${fmt(pendente)}</strong>
      </div>

      <div>
        <span>Jogadores</span>
        <strong>${jogadores.length}</strong>
      </div>
    `;
  }

  if (lista) {
    if (!jogadores.length) {
      lista.innerHTML = `
        <div class="empty-state">
          <p>Nenhum jogador lançado neste jogo.</p>
        </div>
      `;
    } else {
      lista.innerHTML = jogadores.map(jogador => {
        const pago = jogador.pago === true;

        return `
          <div class="jogo-caixa-jogador-row ${pago ? "pago" : ""}" data-jogador-id="${jogador.id}">
            <input
              type="checkbox"
              class="jogo-caixa-check"
              ${pago ? "disabled" : "checked"}
            >

            <div class="jogo-caixa-jogador-nome">
              ${jogador.nome || "Jogador"}
              ${pago ? " · pago" : ""}
            </div>

            <div class="jogo-caixa-jogador-valor">
              ${fmt(jogador.valor || 0)}
            </div>

            <select class="input jogo-caixa-pagamento" ${pago ? "disabled" : ""}>
              <option value="dinheiro" ${metodoPagamento === "dinheiro" ? "selected" : ""}>Dinheiro</option>
              <option value="cartao" ${metodoPagamento === "cartao" ? "selected" : ""}>Cartão</option>
              <option value="pix" ${metodoPagamento === "pix" ? "selected" : ""}>PIX</option>
            </select>
          </div>
        `;
      }).join("");
    }
  }

  document
    .querySelectorAll(".jogo-caixa-check, .jogo-caixa-pagamento")
    .forEach(el => {
      el.addEventListener("change", atualizarTotalSelecionadoJogoCaixa);
    });

  atualizarTotalSelecionadoJogoCaixa();

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalFinalizarJogoCaixa() {
  const modal = document.getElementById("modalFinalizarJogoCaixa");

  if (modal) {
    modal.style.display = "none";
  }

  jogoSelecionadoCaixa = null;
}

function atualizarTotalSelecionadoJogoCaixa() {
  const totalEl = document.getElementById("jogoCaixaTotalSelecionado");

  const total = [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => row.querySelector(".jogo-caixa-check")?.checked)
    .reduce((acc, row) => {
      const jogadorId = row.dataset.jogadorId;

      const jogadores = jogadoresCaixaPorAgenda[jogoSelecionadoCaixa?.id] || [];

      const jogador = jogadores.find(item => String(item.id) === String(jogadorId));

      return acc + Number(jogador?.valor || 0);
    }, 0);

  if (totalEl) {
    totalEl.textContent = fmt(total);
  }

  return total;
}

async function confirmarPagamentoJogoCaixa() {
  if (vendaEmProcessamento) return;

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de finalizar cobranças da agenda."
    );
    return;
  }

  if (!jogoSelecionadoCaixa?.id) {
    await alertaCaixa(
      "Jogo não selecionado",
      "Selecione um jogo para finalizar."
    );
    return;
  }

  const jogadores = jogadoresCaixaPorAgenda[jogoSelecionadoCaixa.id] || [];

  const linhasSelecionadas = [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => row.querySelector(".jogo-caixa-check")?.checked);

  if (!linhasSelecionadas.length) {
    await alertaCaixa(
      "Nenhum pagamento selecionado",
      "Selecione pelo menos um jogador pendente."
    );
    return;
  }

  const confirmar = await abrirConfirmacaoCaixa({
    titulo: "Confirmar pagamento do jogo",
    mensagem: `
      Confirmar pagamento de
      <strong>${fmt(atualizarTotalSelecionadoJogoCaixa())}</strong>
      para este jogo?
    `,
    textoConfirmar: "Confirmar pagamento"
  });

  if (!confirmar) return;

  try {
    vendaEmProcessamento = true;

    for (const row of linhasSelecionadas) {
      const jogadorId = row.dataset.jogadorId;
      const formaPagamento = row.querySelector(".jogo-caixa-pagamento")?.value || metodoPagamento || "dinheiro";

      const { error } = await sb
        .from("agenda_jogadores")
        .update({
          pago: true,
          forma_pagamento: formaPagamento,
          pago_em: new Date().toISOString()
        })
        .eq("id", jogadorId)
        .eq("empresa_id", obterEmpresaId());

      if (error) throw error;
    }

    await atualizarVendaAgendaPeloCaixa(jogoSelecionadoCaixa);

    await carregarDadosSupabase();
    await carregarJogosCaixa();

    renderEstado();
    renderHistorico();
    atualizarInfobar();

    fecharModalFinalizarJogoCaixa();
    fecharModalSelecionarJogo();

    await alertaCaixa(
      "Jogo atualizado",
      "Pagamento do jogo lançado no caixa e nas vendas."
    );

    await alterarModoPDV("venda");

  } catch (err) {
    console.error(err);

    await alertaCaixa(
      "Erro ao finalizar jogo",
      err.message || "Não foi possível finalizar a cobrança do jogo."
    );

  } finally {
    vendaEmProcessamento = false;
  }
}

async function atualizarVendaAgendaPeloCaixa(jogo) {
  const { data: jogadoresAtualizados, error: erroJogadores } = await sb
    .from("agenda_jogadores")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("agenda_id", jogo.id);

  if (erroJogadores) throw erroJogadores;

  const jogadores = jogadoresAtualizados || [];

  const pagos = jogadores.filter(jogador => {
    return jogador.pago === true && Number(jogador.valor || 0) > 0;
  });

  const pendentes = jogadores.filter(jogador => {
    return jogador.pago !== true && Number(jogador.valor || 0) > 0;
  });

  const totalPago = pagos.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalPendente = pendentes.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const statusJogo =
    jogadores.length > 0 &&
    totalPendente === 0 &&
    totalPago > 0
      ? "fechado"
      : "cobranca";

  const formaPagamento =
    pagos.length === 1
      ? (pagos[0].forma_pagamento || metodoPagamento)
      : (
          [...new Set(pagos.map(j => j.forma_pagamento).filter(Boolean))].length === 1
            ? pagos.find(j => j.forma_pagamento)?.forma_pagamento
            : "misto"
        );

  await sb
    .from("agenda")
    .update({
      status_jogo: statusJogo,
      total_jogadores: jogadores.length,
      total_pago_jogadores: totalPago,
      total_pendente_jogadores: totalPendente,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", jogo.id)
    .eq("empresa_id", obterEmpresaId());

  const { data: vendaExistente, error: erroBuscaVenda } = await sb
    .from("vendas")
    .select("id")
    .eq("empresa_id", obterEmpresaId())
    .eq("origem", "agenda")
    .eq("origem_id", jogo.id)
    .maybeSingle();

  if (erroBuscaVenda) throw erroBuscaVenda;

  let vendaId = vendaExistente?.id || null;

  const descricao =
    `${jogo.tipo_jogo === "mensalista" ? "Jogo mensal" : "Jogo avulso"} - ${jogo.local_recurso || "Quadra/Campo"} - ${jogo.cliente_nome || "Responsável"}`;

  if (vendaId) {
    await sb
      .from("vendas_itens")
      .delete()
      .eq("empresa_id", obterEmpresaId())
      .eq("venda_id", vendaId);

    const { error: erroUpdateVenda } = await sb
      .from("vendas")
      .update({
        caixa_id: caixa.id,
        subtotal: totalPago,
        desconto: 0,
        total: totalPago,
        forma_pagamento: formaPagamento || metodoPagamento,
        troco: 0,
        descricao: descricao,
        data: new Date().toISOString()
      })
      .eq("id", vendaId)
      .eq("empresa_id", obterEmpresaId());

    if (erroUpdateVenda) throw erroUpdateVenda;
  } else {
    const { data: vendaNova, error: erroVendaNova } = await sb
      .from("vendas")
      .insert([{
        empresa_id: obterEmpresaId(),
        caixa_id: caixa.id,
        cliente_id: null,
        subtotal: totalPago,
        desconto: 0,
        total: totalPago,
        forma_pagamento: formaPagamento || metodoPagamento,
        troco: 0,
        origem: "agenda",
        origem_id: jogo.id,
        descricao: descricao,
        data: new Date().toISOString()
      }])
      .select("id")
      .single();

    if (erroVendaNova) throw erroVendaNova;

    vendaId = vendaNova.id;
  }

  const itensPayload = pagos.map(jogador => ({
    empresa_id: obterEmpresaId(),
    venda_id: vendaId,
    produto_id: null,
    nome: `Pagamento de jogo - ${jogador.nome || "Jogador"}`,
    preco: Number(jogador.valor || 0),
    preco_custo: 0,
    lucro_unitario: Number(jogador.valor || 0),
    lucro_total: Number(jogador.valor || 0),
    quantidade: 1
  }));

  if (itensPayload.length) {
    const { error: erroItens } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (erroItens) throw erroItens;
  }
}

// ======================================================
// MODAL SELECIONAR COMANDA NO CAIXA
// ======================================================

function setupModalSelecionarComanda() {
  const btnFechar = document.getElementById("btnFecharSelecionarComanda");
  const inputBusca = document.getElementById("inputBuscaModalComanda");

  if (btnFechar) {
    btnFechar.onclick = fecharModalSelecionarComanda;
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", () => {
      filtrarComandasCaixa(inputBusca.value);
    });
  }
}

async function abrirModalSelecionarComanda() {
  const modal = document.getElementById("modalSelecionarComanda");
  const inputBusca = document.getElementById("inputBuscaModalComanda");

  if (modal) {
    modal.style.display = "flex";
  }

  if (inputBusca) {
    inputBusca.value = "";
  }

  await carregarComandasCaixa();
  filtrarComandasCaixa("");

  setTimeout(() => {
    inputBusca?.focus();
  }, 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalSelecionarComanda() {
  const modal = document.getElementById("modalSelecionarComanda");

  if (modal) {
    modal.style.display = "none";
  }

  const inputBusca = document.getElementById("inputBusca");

  if (inputBusca) {
    inputBusca.focus();
  }
}

async function carregarComandasCaixa() {
  const lista = document.getElementById("listaComandasCaixa");

  if (lista) {
    lista.innerHTML = `
      <div class="empty-state">
        <p>Carregando comandas...</p>
      </div>
    `;
  }

  try {
    const { data, error } = await sb
      .from("comandas")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .in("status", ["livre", "aberta"])
      .order("codigo", { ascending: true });

    if (error) throw error;

    comandasCaixa = Array.isArray(data) ? data : [];

  } catch (err) {
    comandasCaixa = [];

    await alertaCaixa(
      "Erro ao carregar comandas",
      "Não foi possível carregar as comandas disponíveis."
    );

    console.error(err);
  }
}

function filtrarComandasCaixa(termoBusca) {
  const termo = String(termoBusca || "").toLowerCase().trim();

  comandasCaixaFiltradas = comandasCaixa.filter(comanda => {
    const codigo = String(comanda.codigo || "").toLowerCase();
    const nome = String(comanda.nome_cliente || "").toLowerCase();
    const obs = String(comanda.observacoes || "").toLowerCase();

    return (
      !termo ||
      codigo.includes(termo) ||
      nome.includes(termo) ||
      obs.includes(termo)
    );
  });

  renderComandasCaixa();
}

function renderComandasCaixa() {
  const lista = document.getElementById("listaComandasCaixa");

  if (!lista) return;

  if (!comandasCaixaFiltradas.length) {
    lista.innerHTML = `
      <div class="empty-state">
        <i data-lucide="ticket" width="28" height="28"></i>
        <p>Nenhuma comanda livre ou aberta encontrada.</p>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  lista.innerHTML = "";

  comandasCaixaFiltradas.forEach(comanda => {
    const btn = document.createElement("button");

    btn.className = "comanda-caixa-item";
    btn.type = "button";

    btn.innerHTML = `
      <div>
        <strong class="comanda-caixa-codigo">
          ${comanda.codigo || "—"}
        </strong>

        <span class="comanda-caixa-cliente">
          ${comanda.nome_cliente || "Sem identificação"}
        </span>
      </div>

      <div>
        <span class="comanda-caixa-status ${comanda.status || "livre"}">
          ${comanda.status || "livre"}
        </span>

        <div class="comanda-caixa-total">
          ${fmt(comanda.total || 0)}
        </div>
      </div>
    `;

    btn.onclick = () => selecionarComandaCaixa(comanda);

    lista.appendChild(btn);
  });
}

async function selecionarComandaCaixa(comanda) {
  if (!comanda?.id) return;

  try {
    let comandaOperacional = comanda;

    if (comanda.status === "livre") {
      const { data, error } = await sb
        .from("comandas")
        .update({
          status: "aberta",
          data_abertura: new Date().toISOString()
        })
        .eq("id", comanda.id)
        .eq("empresa_id", obterEmpresaId())
        .select("*")
        .single();

      if (error) throw error;

      comandaOperacional = data;
    }

    comandaAtiva = comandaOperacional;

    await carregarItensComanda();

    fecharModalSelecionarComanda();

    atualizarInterfaceModoPDV();

  } catch (err) {
    await alertaCaixa(
      "Erro ao abrir comanda",
      "Não foi possível abrir esta comanda no caixa."
    );

    console.error(err);
  }
}

// ======================================================
// LEITOR PRODUTO
// ======================================================
async function processarLeituraProduto(codigoLido) {

  const termo = String(codigoLido || "")
    .trim()
    .toLowerCase();

  const input =
    document.getElementById("inputBusca");

  const sugestoes =
    document.getElementById("pdvSuggestions");

  try {

    const produto = produtos.find(produto => {

      const codigo =
        String(produto.codigo || "")
        .trim()
        .toLowerCase();

      const codigoBarras =
        String(produto.codigo_barras || "")
        .trim()
        .toLowerCase();

      const nome =
        String(produto.nome || "")
        .trim()
        .toLowerCase();

      return (
        codigoBarras === termo ||
        codigo === termo ||
        nome === termo
      );
    });

    if (!produto) {

      alert(
        "Produto não encontrado."
      );

      if (input) {
        input.value = "";
        input.focus();
      }

      return;
    }

    if (produto.ativo !== true) {

      alert(
        `Produto inativo: ${produto.nome}`
      );

      return;
    }

    const estoque =
      Number(produto.estoque || 0);

    if (estoque <= 0) {

      alert(
        `Produto sem estoque: ${produto.nome}`
      );

      return;
    }

    const preco =
      Number(produto.preco || 0);

    if (preco <= 0) {

      alert(
        `Produto sem preço válido: ${produto.nome}`
      );

      return;
    }

    if (modoPDV === "comanda" && comandaAtiva) {
  await adicionarProdutoNaComanda(produto);
} else {
  adicionarCarrinho(produto);
}

    if (input) {
      input.value = "";
      input.focus();
    }

    if (sugestoes) {
      sugestoes.innerHTML = "";
      sugestoes.classList.remove("open");
    }

  } catch (err) {

    console.error(err);

    alert(
      "Erro ao processar leitura."
    );
  }
}

// ======================================================
// LEITOR COMANDA
// ======================================================
async function processarLeituraComanda(codigoLido) {

  const codigo =
    String(codigoLido || "")
    .trim();

  const input =
    document.getElementById("inputBusca");

  try {
if (!sistemaOnline()) {

  const offlineId =
    `offline-comanda-${codigo}`;

  comandaAtiva = {
    id: offlineId,
    codigo,
    status: "aberta",
    offline: true,
    total: 0
  };

  carrinho = [];

  atualizarInterfaceModoPDV();
  renderCarrinho();

  crvToast({
    titulo: "Comanda offline",
    mensagem:
      "Comanda aberta em modo offline.",
    tipo: "warn"
  });

  if (input) {
    input.value = "";
    input.focus();
  }

  return;
}
    const { data, error } = await sb
      .from("comandas")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .eq("codigo", codigo)
      .limit(1);

    if (error) {
      throw error;
    }

    let comanda =
      data?.[0] || null;

    // =========================================
    // NÃO EXISTE
    // =========================================

    if (!comanda) {

      const criar =
        confirm(
          `Comanda ${codigo} não existe.\n\nDeseja criar agora?`
        );

      if (!criar) {

        if (input) {
          input.value = "";
          input.focus();
        }

        return;
      }

      const { data: novaComanda, error: erroNova } =
        await sb
          .from("comandas")
          .insert([
            {
              empresa_id: obterEmpresaId(),
              codigo: codigo,
              status: "aberta",
              data_abertura: new Date().toISOString(),
              total: 0
            }
          ])
          .select("*")
          .single();

      if (erroNova) {
        throw erroNova;
      }

      comanda = novaComanda;
    }

    // =========================================
    // LIVRE
    // =========================================

    else if (
      comanda.status === "livre"
    ) {

      const { data: aberta, error: erroAbrir } =
        await sb
          .from("comandas")
          .update({
            status: "aberta",
            data_abertura: new Date().toISOString()
          })
          .eq("id", comanda.id)
          .eq("empresa_id", obterEmpresaId())
          .select("*")
          .single();

      if (erroAbrir) {
        throw erroAbrir;
      }

      comanda = aberta;
    }

    // =========================================
    // FECHADA
    // =========================================

    else if (
      comanda.status === "fechada"
    ) {

      alert(
        `Comanda ${codigo} já está fechada.`
      );

      if (input) {
        input.value = "";
        input.focus();
      }

      return;
    }

    // =========================================
    // ATIVA
    // =========================================

    comandaAtiva = comanda;

    await carregarItensComanda();

    atualizarInterfaceModoPDV();

    if (input) {
      input.value = "";
      input.focus();
    }

  } catch (err) {

    console.error(err);

    alert(
      "Erro ao carregar comanda."
    );
  }
}

// ======================================================
// ITENS DA COMANDA
// ======================================================

async function adicionarProdutoNaComanda(produto) {

  if (!comandaAtiva?.id) {
    alert("Nenhuma comanda ativa.");
    return;
  }

  const preco = normalizarNumero(produto.preco);
  const estoque = Number(produto.estoque || 0);

  if (preco <= 0) {
    alert(`Produto sem preço válido: ${produto.nome}`);
    return;
  }

  if (estoque <= 0) {
    await alertaCaixa(
      "Sem estoque",
      `Produto sem estoque: <strong>${produto.nome}</strong>`
    );
    return;
  }

  const empresaId = obterEmpresaId();

  const { data: itemExistente, error: erroBusca } = await sb
    .from("comanda_itens")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("comanda_id", comandaAtiva.id)
    .eq("produto_id", produto.id)
    .limit(1);

  if (erroBusca) {
    alert("Erro ao verificar item da comanda.");
    console.error(erroBusca);
    return;
  }

  const existente = itemExistente?.[0] || null;

  if (existente) {
    const novaQtd = Number(existente.quantidade || 0) + 1;

    if (novaQtd > estoque) {
      alert(`Estoque insuficiente para ${produto.nome}. Disponível: ${estoque}`);
      return;
    }

    const novoTotal = novaQtd * preco;

    const { error: erroUpdate } = await sb
      .from("comanda_itens")
      .update({
        quantidade: novaQtd,
        preco: preco,
        total: novoTotal
      })
      .eq("id", existente.id)
      .eq("empresa_id", empresaId);

    if (erroUpdate) {
      alert("Erro ao atualizar item da comanda.");
      console.error(erroUpdate);
      return;
    }
  } else {
    const { error: erroInsert } = await sb
      .from("comanda_itens")
      .insert([
        {
          empresa_id: empresaId,
          comanda_id: comandaAtiva.id,
          produto_id: produto.id,
          nome: produto.nome,
          preco: preco,
          preco_custo: Number(produto.preco_custo || 0),
          quantidade: 1,
          total: preco
        }
      ]);

    if (erroInsert) {
      alert("Erro ao adicionar item na comanda.");
      console.error(erroInsert);
      return;
    }
  }

  await carregarItensComanda();
}

async function adicionarItemManualNaComanda({
  nome,
  preco,
  quantidade
}) {
  if (!comandaAtiva?.id) {
    await alertaCaixa(
      "Comanda",
      "Nenhuma comanda ativa."
    );
    return;
  }

  try {
    const empresaId = obterEmpresaId();

    const total = Number(preco || 0) * Number(quantidade || 1);

    const { error } = await sb
      .from("comanda_itens")
      .insert([
        {
          empresa_id: empresaId,
          comanda_id: comandaAtiva.id,
          produto_id: null,
          nome: nome,
          preco: Number(preco || 0),
          preco_custo: 0,
          quantidade: Number(quantidade || 1),
          total: total
        }
      ]);

    if (error) throw error;

    await carregarItensComanda();

  } catch (err) {
    await alertaCaixa(
      "Erro na comanda",
      "Não foi possível adicionar o item manual na comanda."
    );

    console.error(err);
  }
}

async function carregarItensComanda() {

  if (!comandaAtiva?.id) return;

  const { data, error } = await sb
    .from("comanda_itens")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("comanda_id", comandaAtiva.id)
    .order("created_at", { ascending: true });

  if (error) {
    alert("Erro ao carregar itens da comanda.");
    console.error(error);
    return;
  }

  carrinho = (data || []).map(item => {
    return {
      id: item.produto_id || item.id,
      comanda_item_id: item.id,
      nome: item.nome,
      preco: Number(item.preco || 0),
      preco_custo: Number(item.preco_custo || 0),
      quantidade: Number(item.quantidade || 0),
      produto_manual: item.produto_id ? false : true
    };
  });

  const total = carrinho.reduce((acc, item) => {
    return acc + Number(item.preco || 0) * Number(item.quantidade || 0);
  }, 0);

  comandaAtiva.total = total;

  await sb
    .from("comandas")
    .update({
      total: total
    })
    .eq("id", comandaAtiva.id)
    .eq("empresa_id", obterEmpresaId());

  renderCarrinho();
  atualizarInterfaceModoPDV();
}

// ======================================================
// LIMPAR COMANDA ATIVA
// ======================================================
async function limparComandaAtiva() {
const confirmar = await abrirConfirmacaoCaixa({
  titulo: "Sair da comanda",
  mensagem: `
    Deseja sair da comanda atual?
  `,
  textoConfirmar: "Sair"
});

if (!confirmar) return;

  comandaAtiva = null;
  carrinho = [];

  renderCarrinho();
  atualizarInterfaceModoPDV();

  const input = document.getElementById("inputBusca");

  if (input) {
    input.value = "";
    input.focus();
  }
}

document.addEventListener("click", event => {
  const btnLimpar = event.target.closest("#btnCancelarComanda");

  if (btnLimpar) {
    limparComandaAtiva();
  }
});

// ======================================================
// FECHAR COMANDA
// ======================================================

document.addEventListener("click", event => {
  const btnFechar = event.target.closest("#btnFecharComanda");

  if (btnFechar) {
    fecharComanda();
  }
});

async function fecharComanda() {

  if (vendaEmProcessamento) return;

if (!sistemaOnline()) {

  const vendaOfflineId =
    "offline-" + Date.now();

  const subtotal =
    calcularSubtotalCarrinho();

  const desconto =
    calcularDesconto();

  const total =
    calcularTotalCarrinho();

  const troco =
    metodoPagamento === "dinheiro"
      ? Math.max(
          0,
          normalizarNumero(
            document.getElementById("valorRecebido")?.value || 0
          ) - total
        )
      : 0;

  const vendaPayload = {
    id: vendaOfflineId,
    empresa_id: obterEmpresaId(),
    caixa_id: caixa?.id || null,
    subtotal,
    desconto,
    total,
    forma_pagamento: metodoPagamento,
    troco,
    origem: "comanda",
    origem_id: comandaAtiva?.id || null,
    descricao:
      `Comanda ${comandaAtiva?.codigo || ""}`,
    data: new Date().toISOString(),
    offline: true
  };

  const itensPayload =
    carrinho.map(item => ({
      empresa_id: obterEmpresaId(),
      venda_id: vendaOfflineId,
      produto_id:
        item.produto_manual
          ? null
          : item.id,
      nome: item.nome,
      preco: Number(item.preco || 0),
      preco_custo:
        Number(item.preco_custo || 0),
      quantidade:
        Number(item.quantidade || 0)
    }));

  await salvarOffline({
    tabela: "vendas",
    payload: vendaPayload
  });

  await salvarOffline({
    tabela: "vendas_itens",
    payload: itensPayload
  });

  vendas.unshift(vendaPayload);

  exibirModalSucesso(total, troco);

  comandaAtiva = null;
  carrinho = [];

  renderCarrinho();
  atualizarInfobar();
  renderHistorico();
  atualizarInterfaceModoPDV();

  logVenda(
    "Comanda salva offline.",
    "warn"
  );

  return;
}

  if (!caixa || caixa.status !== "aberto") {
    alert("Abra o caixa antes de fechar uma comanda.");
    return;
  }

  if (!comandaAtiva?.id) {
    alert("Nenhuma comanda ativa.");
    return;
  }

  await carregarItensComanda();

  if (!carrinho.length) {
    await alertaCaixa(
      "Comanda vazia",
      "Esta comanda não possui itens."
    );
    return;
  }

const confirmar = await abrirConfirmacaoCaixa({
  titulo: "Fechar comanda",
  mensagem: `
    Fechar a comanda <strong>${comandaAtiva.codigo}</strong>?
  `,
  textoConfirmar: "Fechar Comanda"
});

if (!confirmar) return;

  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();
  const total = calcularTotalCarrinho();

  if (desconto > subtotal) {
    alert("O desconto não pode ser maior que o subtotal.");
    return;
  }

  if (total <= 0) {
    alert("Total da comanda inválido.");
    return;
  }

  const valorRecebido = normalizarNumero(
    document.getElementById("valorRecebido")?.value || 0
  );

  if (
    metodoPagamento === "dinheiro" &&
    valorRecebido > 0 &&
    valorRecebido < total
  ) {
    alert("Valor recebido menor que o total da comanda.");
    return;
  }

  const troco =
    metodoPagamento === "dinheiro"
      ? Math.max(0, valorRecebido - total)
      : 0;

  let vendaCriadaId = null;

  try {
    vendaEmProcessamento = true;
    bloquearBotaoFinalizar(true);

    await validarCarrinhoComEstoque();

    const empresaId = obterEmpresaId();

const vendaPayload = {
  empresa_id: empresaId,
  caixa_id: caixa.id,
  cliente_id: null,
  subtotal: subtotal,
  desconto: desconto,
  total: total,
  forma_pagamento: metodoPagamento,
  troco: troco,
  origem: "comanda",
  origem_id: comandaAtiva.id,
  descricao: `Comanda ${comandaAtiva.codigo || ""}`,
  data: new Date().toISOString()
};

    const { data: vendaData, error: vendaError } = await sb
      .from("vendas")
      .insert([vendaPayload])
      .select("*")
      .single();

    if (vendaError) throw vendaError;

    vendaCriadaId = vendaData.id;

    const itensPayload = carrinho.map(item => {

      const precoVenda = Number(item.preco || 0);
      const precoCusto = Number(item.preco_custo || 0);
      const quantidade = Number(item.quantidade || 0);

      const lucroUnitario =
        precoVenda - precoCusto;

      const lucroTotal =
        lucroUnitario * quantidade;

      return {
        empresa_id: empresaId,
        venda_id: vendaData.id,
        produto_id: item.produto_manual ? null : item.id,
        nome: item.nome,
        preco: precoVenda,
        preco_custo: precoCusto,
        lucro_unitario: lucroUnitario,
        lucro_total: lucroTotal,
        quantidade: quantidade
      };
    });

    const { error: itensError } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (itensError) throw itensError;

    await baixarEstoqueProdutos();

    const { error: erroComanda } = await sb
      .from("comandas")
      .update({
        status: "fechada",
        data_fechamento: new Date().toISOString(),
        total: total
      })
      .eq("id", comandaAtiva.id)
      .eq("empresa_id", empresaId);

    if (erroComanda) throw erroComanda;

    vendas.unshift(vendaData);

    exibirModalSucesso(total, troco);

    comandaAtiva = null;
    carrinho = [];

    const descontoInput = document.getElementById("inputDesconto");
    const valorRecebidoInput = document.getElementById("valorRecebido");

    if (descontoInput) descontoInput.value = "";
    if (valorRecebidoInput) valorRecebidoInput.value = "";

    await carregarProdutos();

    renderProdutosRapidos();
    renderCarrinho();
    atualizarInfobar();
    renderHistorico();
    atualizarInterfaceModoPDV();

    logVenda("Comanda fechada e venda salva no Supabase.", "success");

  } catch (err) {

    if (vendaCriadaId) {
      try {
        await sb
          .from("vendas_itens")
          .delete()
          .eq("venda_id", vendaCriadaId)
          .eq("empresa_id", obterEmpresaId());

        await sb
          .from("vendas")
          .delete()
          .eq("id", vendaCriadaId)
          .eq("empresa_id", obterEmpresaId());
      } catch (rollbackErr) {
        logVenda("Falha ao desfazer venda incompleta: " + rollbackErr.message, "error");
      }
    }

    logVenda("Erro ao fechar comanda: " + err.message, "error");
    alert("Erro ao fechar comanda: " + err.message);

  } finally {
    vendaEmProcessamento = false;
    bloquearBotaoFinalizar(false);
  }
}

// ======================================================
// REMOVER ITEM DO CARRINHO / COMANDA
// ======================================================

async function removerItemCarrinho(index) {

  const item = carrinho[index];

  if (!item) return;

  if (modoPDV === "comanda" && comandaAtiva) {

    if (!item.comanda_item_id) {
      alert("Item da comanda sem identificação.");
      return;
    }

    const confirmar = await abrirConfirmacaoCaixa({
  titulo: "Remover item",
  mensagem: `
    Remover
    <strong>${item.nome}</strong>
    da comanda?
  `,
  textoConfirmar: "Remover"
});

    if (!confirmar) return;

    const { error } = await sb
      .from("comanda_itens")
      .delete()
      .eq("id", item.comanda_item_id)
      .eq("empresa_id", obterEmpresaId());

    if (error) {
      alert("Erro ao remover item da comanda.");
      console.error(error);
      return;
    }

    await carregarItensComanda();

    return;
  }

  carrinho.splice(index, 1);
  renderCarrinho();
}

// ======================================================
// ALTERAR QUANTIDADE DO CARRINHO / COMANDA
// ======================================================

async function alterarQuantidadeCarrinho(index, delta) {

  const item = carrinho[index];

  if (!item) return;

  const novaQuantidade =
    Number(item.quantidade || 0) + Number(delta || 0);

  if (novaQuantidade <= 0) {
    await removerItemCarrinho(index);
    return;
  }

  if (!item.produto_manual) {

    const produto = produtos.find(produto => {
      return produto.id === item.id;
    });

    const estoqueDisponivel = Number(produto?.estoque || 0);

    if (novaQuantidade > estoqueDisponivel) {
      alert(`Estoque insuficiente para ${item.nome}. Disponível: ${estoqueDisponivel}`);
      return;
    }
  }

  if (modoPDV === "comanda" && comandaAtiva) {

    if (!item.comanda_item_id) {
      alert("Item da comanda sem identificação.");
      return;
    }

    const novoTotal =
      Number(item.preco || 0) * novaQuantidade;

    const { error } = await sb
      .from("comanda_itens")
      .update({
        quantidade: novaQuantidade,
        total: novoTotal
      })
      .eq("id", item.comanda_item_id)
      .eq("empresa_id", obterEmpresaId());

    if (error) {
      alert("Erro ao atualizar quantidade da comanda.");
      console.error(error);
      return;
    }

    await carregarItensComanda();

    return;
  }

  item.quantidade = novaQuantidade;
  renderCarrinho();
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);