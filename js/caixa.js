// ======================================================
// CRV PDV - CAIXA / PDV
// Versão operacional Supabase
// Sem produtos mockados
// Sem dependência de localDB para operação real
// ======================================================

// ===== ESTADO GLOBAL =====
let caixa = null;
let ultimoFechamentoCaixa = null;
let carrinho = [];
let vendas = [];
let produtos = [];
let caixaMovimentacoes = [];
let movimentacaoCaixaEmProcessamento = false;
let catalogoItensCaixa = [];
let produtosRapidos = [];
let filtroTipoItensCaixa = "produto";
let filtroTipoModalCaixa = "produto";
let metodoPagamento = "dinheiro";
let modoPDV = "venda";
let modoBalcaoCaixa = false;
let rapidosBalcaoOcultos = true;
let comandaAtiva = null;
let comandaOculta = false;
let caixaInicializado = false;
let vendaEmProcessamento = false;
let operacaoCaixaEmProcessamento = false;
let comandasCaixa = [];
let comandasCaixaFiltradas = [];
let carregandoComandasCaixa = false;
let ultimaCargaComandasCaixa = 0;
function invalidarCacheComandasCaixa() {
  ultimaCargaComandasCaixa = 0;
}


let tipoNegocioCaixa = "";
let jogosCaixa = [];
let jogosCaixaFiltrados = [];
let jogadoresCaixaPorAgenda = {};
let mensalidadesCaixa = [];
let cobrancasExtrasCaixa = [];
let filtroStatusJogosCaixa = "todos";
let jogoSelecionadoCaixa = null;
let avisosJogosCaixaEmitidos = new Set();
let intervaloAvisosJogosCaixa = null;
let jogosPendentesSincronizacaoCaixa = [];
let jogadorComandaPendenteCaixa = null;
let valoresTemporariosJogoCaixa = {};
let pagamentosTemporariosJogoCaixa = {};
let jogadoresSelecionadosTemporariosJogoCaixa = {};
let vinculosComandaJogadorCaixa = {};
let qtdComandasAbertasCaixa = 0;
let qtdJogosAbertosCaixa = 0;
let recebimentoAgendaCaixa = null;
const STATUS_JOGADOR_CAIXA = {
  PENDENTE: "pendente",
  EM_COBRANCA: "em_cobranca",
  EM_COMANDA: "em_comanda",
  PAGO_DIRETO: "pago_direto",
  PAGO_EM_COMANDA: "pago_em_comanda"
};

const CRV_CAIXA_MODO_BALCAO_KEY = "crv-caixa-modo-balcao";
const CRV_CAIXA_BALCAO_SIDEBAR_KEY = "crv-caixa-balcao-sidebar-anterior";
const CRV_CAIXA_MODO_RAPIDO_LEGADO_KEY = "crv-caixa-modo-rapido";
const CRV_CAIXA_SIDEBAR_LEGADO_KEY = "crv-caixa-sidebar-anterior";

function operadorCaixaRestritoAoBalcao() {
  const operadorId = sessionStorage.getItem("CRV_OPERADOR_ID");
  const perfil = String(
    sessionStorage.getItem("CRV_OPERADOR_PERFIL") || ""
  ).toLowerCase();

  return Boolean(operadorId && perfil !== "admin");
}

const TIPOS_ITEM_CAIXA = {
  produto: {
    singular: "produto",
    plural: "Produtos",
    icone: "package"
  },
  servico: {
    singular: "serviço",
    plural: "Serviços",
    icone: "wrench"
  },
  taxa: {
    singular: "taxa",
    plural: "Taxas",
    icone: "badge-dollar-sign"
  },
  outro: {
    singular: "item",
    plural: "Outros itens",
    icone: "shapes"
  }
};

// ======================================================
// MODO BALCÃO — OPERAÇÃO DIRETA NO MESMO CAIXA
// ======================================================
function migrarPreferenciasModoBalcaoCaixa() {
  const modoLegado = localStorage.getItem(CRV_CAIXA_MODO_RAPIDO_LEGADO_KEY);
  const sidebarLegada = localStorage.getItem(CRV_CAIXA_SIDEBAR_LEGADO_KEY);

  if (
    localStorage.getItem(CRV_CAIXA_MODO_BALCAO_KEY) === null &&
    modoLegado !== null
  ) {
    localStorage.setItem(CRV_CAIXA_MODO_BALCAO_KEY, modoLegado);
  }

  if (
    localStorage.getItem(CRV_CAIXA_BALCAO_SIDEBAR_KEY) === null &&
    sidebarLegada !== null
  ) {
    localStorage.setItem(CRV_CAIXA_BALCAO_SIDEBAR_KEY, sidebarLegada);
  }

  localStorage.removeItem(CRV_CAIXA_MODO_RAPIDO_LEGADO_KEY);
  localStorage.removeItem(CRV_CAIXA_SIDEBAR_LEGADO_KEY);
}

function aplicarModoBalcaoCaixa(ativo, { persistir = true } = {}) {
  const body = document.body;
  const shell = document.querySelector(".app-shell");
  const botao = document.getElementById("btnModoBalcao");

  if (!body || !shell) return;

  const operadorRestrito = operadorCaixaRestritoAoBalcao();

  const estavaAtivo = modoBalcaoCaixa;
  modoBalcaoCaixa = operadorRestrito || ativo === true;

  body.classList.toggle("caixa-modo-balcao", modoBalcaoCaixa);
  body.classList.toggle("caixa-operador-restrito", operadorRestrito);

  if (modoBalcaoCaixa && !estavaAtivo) {
    rapidosBalcaoOcultos = true;
  }

  aplicarEstadoRapidosBalcaoCaixa();
  if (botao) {
    botao.classList.toggle("active", modoBalcaoCaixa);
    botao.setAttribute("aria-pressed", String(modoBalcaoCaixa));
    botao.setAttribute("aria-disabled", String(operadorRestrito));
    botao.title = operadorRestrito
      ? "Modo balcão obrigatório para este operador"
      : modoBalcaoCaixa
        ? "Voltar ao modo completo"
        : "Ativar modo balcão";

    botao.innerHTML = modoBalcaoCaixa
      ? `<i data-lucide="layout-dashboard" width="16" height="16"></i><span>Modo completo</span>`
      : `<i data-lucide="calculator" width="16" height="16"></i><span>Modo balcão</span>`;
  }

  const podeRecolherSidebar = window.matchMedia("(min-width: 769px)").matches;

  if (modoBalcaoCaixa && podeRecolherSidebar) {
    if (
      !estavaAtivo &&
      localStorage.getItem(CRV_CAIXA_BALCAO_SIDEBAR_KEY) === null
    ) {
      localStorage.setItem(
        CRV_CAIXA_BALCAO_SIDEBAR_KEY,
        shell.classList.contains("sidebar-collapsed") ? "1" : "0"
      );
    }

    shell.classList.add("sidebar-collapsed");
  } else if (!modoBalcaoCaixa && estavaAtivo && podeRecolherSidebar) {
    const sidebarAnterior =
      localStorage.getItem(CRV_CAIXA_BALCAO_SIDEBAR_KEY) === "1";

    shell.classList.toggle("sidebar-collapsed", sidebarAnterior);
    localStorage.removeItem(CRV_CAIXA_BALCAO_SIDEBAR_KEY);
  }

  if (persistir && !operadorRestrito) {
    localStorage.setItem(
      CRV_CAIXA_MODO_BALCAO_KEY,
      modoBalcaoCaixa ? "1" : "0"
    );
  }

  if (window.lucide) {
    lucide.createIcons();
  }

  atualizarRotuloCobrancaAvulsaCaixa();

  if (modoBalcaoCaixa) {
    requestAnimationFrame(() => {
      document.getElementById("inputBusca")?.focus();
    });
  }
}

function atualizarRotuloCobrancaAvulsaCaixa() {
  const botao = document.getElementById("btnToggleCobrancaAvulsa");
  const card = document.querySelector(".pdv-manual");

  if (!botao || !card) return;

  const oculto = card.classList.contains("manual-card-oculto");

  botao.innerHTML = oculto
    ? `<i data-lucide="plus-circle"></i><span>Mostrar cobrança avulsa</span>`
    : `<i data-lucide="minus-circle"></i><span>Ocultar cobrança avulsa</span>`;

  if (window.lucide) {
    lucide.createIcons();
  }
}

function setupModoBalcaoCaixa() {
  const botao = document.getElementById("btnModoBalcao");

  if (!botao || botao.dataset.ready === "1") return;

  migrarPreferenciasModoBalcaoCaixa();

  botao.dataset.ready = "1";
  botao.addEventListener("click", async () => {
    if (operadorCaixaRestritoAoBalcao()) {
      await alertaCaixa(
        "Modo balcão obrigatório",
        "Este operador usa o Caixa somente no modo balcão. A conta principal ou um operador Admin pode acessar o modo completo."
      );
      return;
    }

    aplicarModoBalcaoCaixa(!modoBalcaoCaixa);
  });

  const modoSalvo =
    localStorage.getItem(CRV_CAIXA_MODO_BALCAO_KEY) === "1";

  aplicarModoBalcaoCaixa(
    operadorCaixaRestritoAoBalcao() ? true : modoSalvo,
    { persistir: false }
  );
}

function reaplicarAcessoOperadorCaixa() {
  const modoSalvo = localStorage.getItem(CRV_CAIXA_MODO_BALCAO_KEY) === "1";

  aplicarModoBalcaoCaixa(
    operadorCaixaRestritoAoBalcao() ? true : modoSalvo,
    { persistir: false }
  );
}

document.addEventListener("crv:operador-alterado", reaplicarAcessoOperadorCaixa);

document.addEventListener("crv:operador-alterado", aplicarVisibilidadeMovimentacoesCaixa);

function aplicarEstadoRapidosBalcaoCaixa() {
  const body = document.body;
  const botao = document.getElementById("btnToggleRapidosBalcao");

  if (!body) return;

  const ocultar = modoBalcaoCaixa && rapidosBalcaoOcultos;
  body.classList.toggle("rapidos-balcao-ocultos", ocultar);

  if (!botao) return;

  botao.setAttribute("aria-expanded", String(!ocultar));
  botao.innerHTML = ocultar
    ? `<i data-lucide="chevron-down" width="13" height="13"></i><span>Mostrar rápidos</span>`
    : `<i data-lucide="chevron-up" width="13" height="13"></i><span>Ocultar rápidos</span>`;

  if (window.lucide) {
    lucide.createIcons();
  }
}

function setupRapidosBalcaoCaixa() {
  const botao = document.getElementById("btnToggleRapidosBalcao");

  if (!botao || botao.dataset.ready === "1") return;

  botao.dataset.ready = "1";
  botao.addEventListener("click", () => {
    rapidosBalcaoOcultos = !rapidosBalcaoOcultos;
    aplicarEstadoRapidosBalcaoCaixa();
  });

  aplicarEstadoRapidosBalcaoCaixa();
}

document.addEventListener("crv:config-pronta", () => {
  aplicarVisibilidadeAtalhosContextuaisCaixa();
  aplicarVisibilidadeMovimentacoesCaixa();

  if (caixaInicializado) {
    atualizarBadgesModosCaixa();
  }
});

function statusPagamentoJogadorCaixa(jogador) {
  const status = String(jogador.status_pagamento || "").toLowerCase();

  if (status) return status;

  if (
    jogador.pago === true &&
    String(jogador.forma_pagamento || "").toLowerCase() === "comanda"
  ) {
    return STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA;
  }

  if (jogador.pago === true) {
    return STATUS_JOGADOR_CAIXA.PAGO_DIRETO;
  }

  return STATUS_JOGADOR_CAIXA.PENDENTE;
}

function jogadorPagoCaixa(jogador) {
  const status = statusPagamentoJogadorCaixa(jogador);

  return (
    status === STATUS_JOGADOR_CAIXA.PAGO_DIRETO ||
    status === STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA
  );
}

function jogadorEmComandaCaixa(jogador) {
  return statusPagamentoJogadorCaixa(jogador) === STATUS_JOGADOR_CAIXA.EM_COMANDA;
}

function jogadorPendenteCaixa(jogador) {
  return !jogadorPagoCaixa(jogador) && !jogadorEmComandaCaixa(jogador);
}

// Mensalista isento: cobrar_no_jogo === false E mensalista === true
// NÃO entram na cobrança individual do jogo.
function jogadorMensalistaIsentoCaixa(jogador) {
  return (
    jogador.mensalista === true &&
    jogador.cobrar_no_jogo === false
  );
}

function jogadoresCobraveisCaixa(lista = []) {
  return (lista || []).filter(jogador => {
    return (
      jogador.removido !== true &&
      !jogadorMensalistaIsentoCaixa(jogador)
    );
  });
}

function jogoMensalCaixa(jogo) {
  if (!jogo) return false;

  return (
    String(jogo.tipo_jogo || "").toLowerCase() === "mensalista" ||
    String(jogo.recorrencia || "").toLowerCase() === "mensal" ||
    Boolean(jogo.recorrencia_origem_id)
  );
}

function buscarMensalidadeCaixa(jogo) {
  if (!jogo || !jogoMensalCaixa(jogo)) return null;

  const origemId = jogo.recorrencia_origem_id || jogo.id;
  const dataJogo = String(
    jogo.horario_original_data || jogo.data_agendamento || ""
  ).slice(0, 10);
  const competencia = dataJogo.slice(0, 7);

  return mensalidadesCaixa.find(mensalidade => {
    if (
      String(mensalidade.agenda_origem_id || "") !== String(origemId) ||
      String(mensalidade.status || "").toLowerCase() === "cancelado"
    ) {
      return false;
    }

    const inicio = String(mensalidade.data_inicio || "").slice(0, 10);
    const fim = String(mensalidade.data_fim || "").slice(0, 10);

    if (inicio && fim && dataJogo) {
      return dataJogo >= inicio && dataJogo <= fim;
    }

    return (
      competencia &&
      String(mensalidade.competencia || "") === competencia
    );
  }) || null;
}

function mensalidadePagaCaixa(mensalidade) {
  return String(mensalidade?.status || "").toLowerCase() === "pago";
}

function buscarCobrancaQuintaSemanaCaixa(jogo) {
  if (!jogo) return null;

  return cobrancasExtrasCaixa.find(cobranca => {
    return String(cobranca.agenda_id || "") === String(jogo.id || "") &&
      cobranca.tipo === "quinta_semana" &&
      cobranca.status !== "cancelado";
  }) || null;
}

function cobrancaQuintaSemanaPagaCaixa(cobranca) {
  return String(cobranca?.status || "").toLowerCase() === "pago";
}

function jogoQuitadoCaixa(jogo) {
  const jogadores = jogadoresCobraveisCaixa(
    jogadoresCaixaPorAgenda[jogo.id] || []
  );

  if (jogoMensalCaixa(jogo)) {
    const mensalidade = buscarMensalidadeCaixa(jogo);

    if (!mensalidadePagaCaixa(mensalidade)) return false;

    const temPendente = jogadores.some(jogadorPendenteCaixa);
    const temEmComanda = jogadores.some(jogadorEmComandaCaixa);

    return !temPendente && !temEmComanda;
  }

  if (!jogadores.length) return false;

  const pendentes = jogadores.filter(jogadorPendenteCaixa).length;
  const emComanda = jogadores.filter(jogadorEmComandaCaixa).length;
  const pagos = jogadores.filter(jogadorPagoCaixa).length;

  return pagos > 0 && pendentes === 0 && emComanda === 0;
}

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
    .replace(/[^\d,.-]/g, "");

  if (!texto) return 0;

  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  }

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

function obterOperadorAtualId() {
  return sessionStorage.getItem("CRV_OPERADOR_ID") || null;
}

function escaparHTMLCaixa(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterEscopoOfflineCaixa() {
  const escopo = window.crvOfflineContext?.obterEscopo?.();

  if (!escopo?.empresa_id || !escopo?.usuario_id) {
    return null;
  }

  return {
    ...escopo,
    operador_id: obterOperadorAtualId()
  };
}

function chaveCacheCaixa(chave) {
  return window.crvOfflineContext?.chaveEscopo?.(`caixa:${chave}`) || null;
}

async function salvarCacheCaixa(chave, dados) {
  const chaveEscopo = chaveCacheCaixa(chave);

  if (!chaveEscopo || !window.crvOfflineDB) {
    return false;
  }

  return window.crvOfflineDB.salvarCache(chaveEscopo, dados);
}

async function obterCacheCaixa(chave) {
  const chaveEscopo = chaveCacheCaixa(chave);

  if (!chaveEscopo || !window.crvOfflineDB) {
    return null;
  }

  return window.crvOfflineDB.obterCache(chaveEscopo);
}

function gerarUUIDCaixa() {
  return window.crvOfflineDB?.gerarUUID?.() || window.crypto.randomUUID();
}

async function salvarOperacaoCaixaOffline({
  tipo,
  payload,
  operacaoId = null
}) {
  const escopo = obterEscopoOfflineCaixa();

  if (!escopo) {
    throw new Error(
      "O contexto seguro da empresa ainda não está disponível neste dispositivo."
    );
  }

  const id = operacaoId || gerarUUIDCaixa();

  const registro = await window.crvOfflineDB.salvarOperacaoOffline({
    operacao_id: id,
    tipo,
    payload,
    empresa_id: escopo.empresa_id,
    usuario_id: escopo.usuario_id,
    operador_id: escopo.operador_id
  });

  return registro;
}

async function registrarAuditoriaCaixa({
  modulo = "caixa",
  acao,
  tabela = null,
  registroId = null,
  descricao = null,
  dadosAntes = null,
  dadosDepois = null
}) {
  if (!sistemaOnline()) return;

  try {
    await sb.rpc("registrar_auditoria", {
      p_operador_id: obterOperadorAtualId(),
      p_modulo: modulo,
      p_acao: acao,
      p_tabela: tabela,
      p_registro_id: registroId,
      p_descricao: descricao,
      p_dados_antes: dadosAntes,
      p_dados_depois: dadosDepois
    });
  } catch (err) {
    console.warn("[CAIXA][AUDITORIA]", err);
  }
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
    const escopo = obterEscopoOfflineCaixa();

    if (!escopo) {
      throw new Error("Contexto offline da empresa não encontrado.");
    }

    const filaId = await crvOfflineDB.adicionarFilaOffline({
      tabela,
      operacao,
      payload,
      empresa_id: escopo.empresa_id,
      usuario_id: escopo.usuario_id,
      operador_id: escopo.operador_id
    });

    if (!filaId) {
      throw new Error("A operação não pôde ser gravada no dispositivo.");
    }

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
  if (navigator.onLine === false && obterEscopoOfflineCaixa()) {
    return false;
  }

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

  setupModoBalcaoCaixa();
  setupRapidosBalcaoCaixa();

  const pronto = await aguardarContextoSistema();

  if (!pronto) {
    logCaixa("Supabase/Auth não ficou pronto a tempo.", "error");

    caixa =
      await obterCacheCaixa("caixa_status") || null;

    vendas =
      await obterCacheCaixa("caixa_vendas") || [];

    caixaMovimentacoes =
      await obterCacheCaixa("caixa_movimentacoes") || [];

    if (caixa && caixa.status === "aberto") {
      crvToast({
        titulo: "Caixa mantido aberto",
        mensagem:
          "A conexão demorou, mas o caixa aberto foi recuperado do cache local.",
        tipo: "warn",
        tempo: 7000
      });
    } else {
      crvToast({
        titulo: "Caixa pronto para operação local",
        mensagem:
          "Não há caixa aberto no cache. Você pode abrir um novo caixa offline neste dispositivo.",
        tipo: "warn",
        tempo: 8000
      });
    }

    await carregarTipoNegocioCaixa();
    await carregarProdutos();
    if (caixaPermiteComandas()) {
      await carregarComandasCaixa({ forcar: true });
    }

    if (caixaPermiteJogos()) {
      await carregarJogosCaixa();
    }

    renderEstado();
    renderProdutosRapidos();
    renderCarrinho();

    setupBusca();
    setupAtalhos();
    setupInputs();
    setupModoPDV();
    setupModalSelecionarComanda();
    setupModalSelecionarJogo();
    setupModalTodosProdutosCaixa();
    setupFiltrosTiposItensCaixa();

    caixaInicializado = true;

    return;
  }

  await inicializarCaixa();

  setupBusca();
  setupAtalhos();
  setupInputs();
  setupModoPDV();
  setupModalSelecionarComanda();
  setupModalSelecionarJogo();
  setupModalTodosProdutosCaixa();
  setupFiltrosTiposItensCaixa();

caixaInicializado = true;

iniciarAvisosFimDeJogoCaixa();

await processarRecebimentoAgendaAoAbrirCaixa();

logCaixa("Tela pronta para operação.", "success");
});

function operadorPodeEspecialCaixa(permissao) {
  return typeof window.crvOperadorPodeEspecial !== "function" ||
    window.crvOperadorPodeEspecial(permissao) === true;
}

function aplicarVisibilidadeMovimentacoesCaixa() {
  const botao = document.getElementById("btnMovimentacoesCaixa");
  if (!botao) return;

  const featureAtiva = typeof window.crvFeatureAtiva === "function" &&
    window.crvFeatureAtiva("movimentacoes_caixa") === true;
  const temPermissao = operadorPodeEspecialCaixa("sangria") ||
    operadorPodeEspecialCaixa("suprimento");

  botao.style.display = featureAtiva && temPermissao ? "inline-flex" : "none";
}

function atualizarExemploMotivoMovimentacaoCaixa() {
  const select = document.getElementById("movCaixaTipo");
  const motivoInput = document.getElementById("movCaixaMotivo");

  if (!select || !motivoInput) return;

  const tipo = String(select.value || "").toLowerCase();

  motivoInput.placeholder = tipo === "suprimento"
    ? "Ex: entrada de dinheiro para reforço de troco"
    : "Ex: retirada para pagamento de fornecedor";
}

function atualizarPermissoesFormularioMovimentacoesCaixa() {
  const select = document.getElementById("movCaixaTipo");
  if (!select) return;

  const podeSangria = operadorPodeEspecialCaixa("sangria");
  const podeSuprimento = operadorPodeEspecialCaixa("suprimento");
  const opcaoSangria = select.querySelector('option[value="sangria"]');
  const opcaoSuprimento = select.querySelector('option[value="suprimento"]');

  if (opcaoSangria) opcaoSangria.disabled = !podeSangria;
  if (opcaoSuprimento) opcaoSuprimento.disabled = !podeSuprimento;

  if (!operadorPodeEspecialCaixa(select.value)) {
    select.value = podeSangria ? "sangria" : "suprimento";
  }

  atualizarExemploMotivoMovimentacaoCaixa();
}

async function abrirModalMovimentacoesCaixa() {
  if (!caixa?.id || caixa.status !== "aberto") {
    await alertaCaixa("Caixa fechado", "Abra o caixa antes de registrar uma movimentação.");
    return;
  }

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Conexão necessária",
      "Sangrias e suprimentos exigem conexão para manter o saldo e a auditoria consistentes."
    );
    return;
  }

  if (
    typeof window.crvFeatureAtiva !== "function" ||
    window.crvFeatureAtiva("movimentacoes_caixa") !== true
  ) {
    await alertaCaixa("Recurso indisponível", "As movimentações de caixa ainda não estão ativadas para esta empresa.");
    return;
  }

  atualizarPermissoesFormularioMovimentacoesCaixa();

  const modal = document.getElementById("modalMovimentacoesCaixa");
  if (modal) modal.style.display = "flex";

  await carregarMovimentacoesCaixa();

  if (window.lucide) lucide.createIcons();
}

function fecharModalMovimentacoesCaixa() {
  const modal = document.getElementById("modalMovimentacoesCaixa");
  if (modal) modal.style.display = "none";
}

async function carregarMovimentacoesCaixa() {
  if (!caixa?.id) {
    caixaMovimentacoes = [];
    renderMovimentacoesCaixa();
    return;
  }

  if (sistemaOnline()) {
    const { data, error } = await sb
      .from("caixa_movimentacoes")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .eq("caixa_id", caixa.id)
      .order("criado_em", { ascending: false });

    if (error) {
      await alertaCaixa("Erro ao carregar movimentações", error.message);
      return;
    }

    caixaMovimentacoes = data || [];
    await salvarCacheCaixa("caixa_movimentacoes", caixaMovimentacoes);
  }

  renderMovimentacoesCaixa();
  atualizarInfobar();
}

function renderMovimentacoesCaixa() {
  const lista = document.getElementById("movCaixaLista");
  const totalSuprimentos = calcularTotalMovimentacoesCaixa("suprimento");
  const totalSangrias = calcularTotalMovimentacoesCaixa("sangria");
  const totalSuprimentosEl = document.getElementById("movCaixaTotalSuprimentos");
  const totalSangriasEl = document.getElementById("movCaixaTotalSangrias");
  const impactoEl = document.getElementById("movCaixaImpactoSaldo");

  if (totalSuprimentosEl) totalSuprimentosEl.textContent = fmt(totalSuprimentos);
  if (totalSangriasEl) totalSangriasEl.textContent = fmt(totalSangrias);
  if (impactoEl) impactoEl.textContent = fmt(totalSuprimentos - totalSangrias);

  if (!lista) return;

  if (!caixaMovimentacoes.length) {
    lista.innerHTML = '<div class="empty-state"><p>Nenhuma sangria ou suprimento neste caixa.</p></div>';
    return;
  }

  lista.innerHTML = caixaMovimentacoes.map(movimentacao => {
    const tipo = String(movimentacao.tipo || "").toLowerCase();
    const cancelada = String(movimentacao.status || "ativa").toLowerCase() === "cancelada";
    const podeCancelar = !cancelada && operadorPodeEspecialCaixa(tipo);
    const rotulo = tipo === "suprimento" ? "Suprimento" : "Sangria";
    const sinal = tipo === "suprimento" ? "+" : "−";
    const motivoCancelamento = cancelada && movimentacao.motivo_cancelamento
      ? `<small>Cancelamento: ${escaparHTMLCaixa(movimentacao.motivo_cancelamento)}</small>`
      : "";

    return `
      <div class="mov-caixa-item ${cancelada ? "cancelada" : ""}">
        <div class="mov-caixa-item-info">
          <div>
            <strong>${rotulo}</strong>
            ${cancelada ? '<span class="mov-caixa-status">Cancelada</span>' : ""}
          </div>
          <span>${escaparHTMLCaixa(movimentacao.motivo || "Sem motivo")}</span>
          <small>${formatarDataHoraBrasil(movimentacao.criado_em)}</small>
          ${motivoCancelamento}
        </div>
        <div class="mov-caixa-item-lateral">
          <strong class="${tipo === "suprimento" ? "entrada" : "saida"}">${sinal} ${fmt(movimentacao.valor)}</strong>
          ${podeCancelar ? `
            <button class="btn-ghost" type="button" onclick="cancelarMovimentacaoCaixa('${movimentacao.id}')">
              Cancelar
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

async function registrarMovimentacaoCaixa() {
  if (movimentacaoCaixaEmProcessamento) return;

  const tipo = String(document.getElementById("movCaixaTipo")?.value || "").toLowerCase();
  const valor = normalizarNumero(document.getElementById("movCaixaValor")?.value || 0);
  const motivo = String(document.getElementById("movCaixaMotivo")?.value || "").trim();

  if (!caixa?.id || caixa.status !== "aberto" || !sistemaOnline()) {
    await alertaCaixa("Movimentação não registrada", "É necessário estar online e com o caixa aberto.");
    return;
  }

  if (!operadorPodeEspecialCaixa(tipo)) {
    await alertaCaixa("Sem permissão", `Este operador não possui permissão para ${tipo}.`);
    return;
  }

  if (valor <= 0 || motivo.length < 3) {
    await alertaCaixa("Revise os dados", "Informe um valor maior que zero e um motivo com pelo menos 3 caracteres.");
    return;
  }

  const botao = document.getElementById("btnRegistrarMovimentacaoCaixa");

  try {
    movimentacaoCaixaEmProcessamento = true;
    if (botao) botao.disabled = true;

    const { error } = await sb.rpc("registrar_movimentacao_caixa", {
      p_caixa_id: caixa.id,
      p_tipo: tipo,
      p_valor: valor,
      p_motivo: motivo,
      p_operador_id: obterOperadorAtualId()
    });

    if (error) throw error;

    const valorInput = document.getElementById("movCaixaValor");
    const motivoInput = document.getElementById("movCaixaMotivo");
    if (valorInput) valorInput.value = "";
    if (motivoInput) motivoInput.value = "";

    await carregarMovimentacoesCaixa();
    crvToast({
      titulo: tipo === "suprimento" ? "Suprimento registrado" : "Sangria registrada",
      mensagem: `${fmt(valor)} incorporado ao saldo esperado do caixa.`,
      tipo: "success"
    });
  } catch (err) {
    await alertaCaixa("Erro ao registrar movimentação", err.message);
  } finally {
    movimentacaoCaixaEmProcessamento = false;
    if (botao) botao.disabled = false;
  }
}

async function cancelarMovimentacaoCaixa(movimentacaoId) {
  const movimentacao = caixaMovimentacoes.find(item => String(item.id) === String(movimentacaoId));
  if (!movimentacao || String(movimentacao.status || "ativa") === "cancelada") return;

  if (!operadorPodeEspecialCaixa(movimentacao.tipo)) {
    await alertaCaixa("Sem permissão", "Este operador não pode cancelar esta movimentação.");
    return;
  }

  const confirmado = await abrirConfirmacaoCaixa({
    titulo: "Cancelar movimentação",
    mensagem: `
      <p>O registro continuará no histórico, sem impacto no saldo.</p>
      <label class="input-label" for="movCaixaMotivoCancelamento">Motivo do cancelamento *</label>
      <input class="input" id="movCaixaMotivoCancelamento" maxlength="160" autocomplete="off" />
    `,
    textoConfirmar: "Cancelar movimentação"
  });

  const motivo = String(document.getElementById("movCaixaMotivoCancelamento")?.value || "").trim();
  if (!confirmado) return;

  if (motivo.length < 3) {
    await alertaCaixa("Motivo obrigatório", "Informe um motivo com pelo menos 3 caracteres.");
    return;
  }

  const { error } = await sb.rpc("cancelar_movimentacao_caixa", {
    p_movimentacao_id: movimentacao.id,
    p_motivo: motivo,
    p_operador_id: obterOperadorAtualId()
  });

  if (error) {
    await alertaCaixa("Erro ao cancelar movimentação", error.message);
    return;
  }

  await carregarMovimentacoesCaixa();
  crvToast({ titulo: "Movimentação cancelada", mensagem: "O saldo esperado foi recalculado.", tipo: "success" });
}

document.addEventListener("crv:sync-concluido", async event => {
  if (!caixaInicializado || !sistemaOnline()) {
    return;
  }

  try {
    await carregarDadosSupabase();
    await carregarProdutos();

    renderEstado();
    renderProdutosRapidos();
    renderCarrinho();
    renderHistorico();
    atualizarInfobar();

    logCaixa(
      `${Number(event.detail?.sincronizadas || 0)} operação(ões) offline incorporada(s) ao Supabase.`,
      "success"
    );
  } catch (err) {
    logCaixa("Sincronização concluída, mas a tela não foi atualizada: " + err.message, "warn");
  }
});

async function inicializarCaixa() {
  await carregarDadosSupabase();
  await carregarProdutos();
  await carregarTipoNegocioCaixa();

  renderEstado();
  renderProdutosRapidos();
  renderCarrinho();
  aplicarVisibilidadeAtalhosContextuaisCaixa();
  await atualizarBadgesModosCaixa();
  await verificarJogosPendentesSincronizacaoCaixa();

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

    if (!caixa) {
  const { data: ultimoFechamentoData, error: ultimoFechamentoError } = await sb
    .from("caixa")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "fechado")
    .not("valor_final", "is", null)
    .order("data_fechamento", { ascending: false })
    .limit(1);

  if (ultimoFechamentoError) throw ultimoFechamentoError;

  ultimoFechamentoCaixa = ultimoFechamentoData?.[0] || null;
} else {
  ultimoFechamentoCaixa = null;
}

    if (caixa?.id) {
      const { data: vendasData, error: vendasError } = await sb
        .from("vendas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("caixa_id", caixa.id)
        .order("data", { ascending: false });

      if (vendasError) throw vendasError;

      vendas = vendasData || [];

      const { data: movimentacoesData, error: movimentacoesError } = await sb
        .from("caixa_movimentacoes")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("caixa_id", caixa.id)
        .order("criado_em", { ascending: false });

      if (movimentacoesError) throw movimentacoesError;

      caixaMovimentacoes = movimentacoesData || [];

      const idsAgendaVendas = vendas
        .filter(venda => String(venda.origem || "").toLowerCase() === "agenda")
        .map(venda => venda.origem_id)
        .filter(Boolean);

      if (idsAgendaVendas.length) {
        const { data: agendasDasVendas } = await sb
          .from("agenda")
          .select("id, status_jogo")
          .eq("empresa_id", empresaId)
          .in("id", idsAgendaVendas);

        const mapaAgendaStatus = {};

        (agendasDasVendas || []).forEach(jogo => {
          mapaAgendaStatus[String(jogo.id)] = jogo.status_jogo;
        });

        vendas = vendas.map(venda => {
          if (String(venda.origem || "").toLowerCase() !== "agenda") {
            return venda;
          }

          return {
            ...venda,
            _status_jogo: mapaAgendaStatus[String(venda.origem_id)] || null
          };
        });
      }
    } else {
      vendas = [];
      caixaMovimentacoes = [];
    }

    await salvarCacheCaixa(
  "caixa_status",
  caixa
);

await salvarCacheCaixa(
  "caixa_vendas",
  vendas
);

await salvarCacheCaixa(
  "caixa_movimentacoes",
  caixaMovimentacoes
);

    logCaixa("Dados carregados do Supabase.", "success");

  } catch (err) {

    const cacheCaixa =
      await obterCacheCaixa("caixa_status") || null;

    const cacheVendas =
      await obterCacheCaixa("caixa_vendas") || [];

    const cacheMovimentacoes =
      await obterCacheCaixa("caixa_movimentacoes") || [];

    if (cacheCaixa && cacheCaixa.status === "aberto") {
      caixa = cacheCaixa;
      vendas = cacheVendas;
      caixaMovimentacoes = cacheMovimentacoes;

      logCaixa(
        "Falha temporária no Supabase/Auth. Caixa aberto recuperado do cache local.",
        "warn"
      );

      crvToast({
        titulo: "Caixa recuperado",
        mensagem:
          "O sistema ainda está conectando, mas o caixa aberto foi mantido pela cópia local.",
        tipo: "warn",
        tempo: 7000
      });

      return;
    }

    caixa = null;
    vendas = [];
    caixaMovimentacoes = [];

    logCaixa("Erro ao carregar dados: " + err.message, "error");

    crvToast({
      titulo: "Não foi possível confirmar o caixa",
      mensagem:
        "A conexão com o Supabase ainda não confirmou o status do caixa. Aguarde alguns segundos antes de abrir um novo caixa.",
      tipo: "warn",
      tempo: 8000
    });
  }
  }

function normalizarTipoItemCaixa(valor) {
  const tipo = String(valor || "produto")
    .toLowerCase()
    .trim();

  return TIPOS_ITEM_CAIXA[tipo]
    ? tipo
    : "produto";
}

function tipoItemProdutoCaixa(produto) {
  return normalizarTipoItemCaixa(produto?.tipo_item);
}

function itemControlaEstoqueCaixa(produto) {
  if (typeof produto?.controla_estoque === "boolean") {
    return produto.controla_estoque;
  }

  return tipoItemProdutoCaixa(produto) === "produto";
}

function itemVisivelNoCaixa(produto) {
  return produto?.ativo !== false;
}

function obterItemCatalogoCaixa(id) {
  return catalogoItensCaixa.find(item => {
    return String(item.id) === String(id);
  }) || produtos.find(item => {
    return String(item.id) === String(id);
  }) || null;
}

function itemCombinaFiltroTipoCaixa(produto, filtro = filtroTipoItensCaixa) {
  const tipo = tipoItemProdutoCaixa(produto);

  if (filtro === "todos") return true;
  if (filtro === "taxa_outro") return ["taxa", "outro"].includes(tipo);

  return tipo === normalizarTipoItemCaixa(filtro);
}

function rotuloFiltroTipoCaixa(filtro) {
  if (filtro === "todos") return "Todos os tipos";
  if (filtro === "taxa_outro") return "Taxas e outros";

  return TIPOS_ITEM_CAIXA[normalizarTipoItemCaixa(filtro)].plural;
}

function atualizarProdutosRapidosCaixa() {
  produtosRapidos = produtos.filter(produto => {
    return produto.ativo === true && produto.produto_rapido === true;
  });
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
      .order("nome", { ascending: true });

    if (error) throw error;

    catalogoItensCaixa = Array.isArray(data) ? data : [];
    produtos = catalogoItensCaixa.filter(produto => {
      return produto.ativo === true;
    });

    await salvarCacheCaixa(
      "caixa_catalogo_itens",
      catalogoItensCaixa
    );

    await salvarCacheCaixa(
      "caixa_produtos",
      produtos
    );

    atualizarProdutosRapidosCaixa();

    logCaixa(`${produtos.length} itens carregados do Supabase.`, "success");

  } catch (err) {
    const cacheCatalogo =
      await obterCacheCaixa("caixa_catalogo_itens");

    const cacheProdutos = cacheCatalogo ||
      await obterCacheCaixa("caixa_produtos") || [];

    catalogoItensCaixa = Array.isArray(cacheProdutos) ? cacheProdutos : [];
    produtos = catalogoItensCaixa.filter(produto => {
      return produto.ativo === true && itemVisivelNoCaixa(produto);
    });

    atualizarProdutosRapidosCaixa();

    logCaixa("Erro ao carregar itens: " + err.message, "error");
  }
}

async function carregarTipoNegocioCaixa() {
  try {
    const empresaId = obterEmpresaId();

    if (!empresaId) {
      throw new Error("empresa_id não encontrado.");
    }

    const { data, error } = await sb
      .from("empresas")
      .select("tipo_negocio")
      .eq("id", empresaId)
      .maybeSingle();

    if (error) throw error;

    tipoNegocioCaixa = String(data?.tipo_negocio || "");

    await salvarCacheCaixa(
      "caixa_tipo_negocio",
      tipoNegocioCaixa
    );

  } catch (err) {
    tipoNegocioCaixa =
      await obterCacheCaixa("caixa_tipo_negocio") || "";

    console.warn("[CAIXA][TIPO_NEGOCIO CACHE]", err);
  }
}

function caixaPermiteJogos() {
  const moduloAgendaAtivo = typeof window.crvModuloAtivo === "function"
    ? window.crvModuloAtivo("agenda")
    : window.CRV_MODULOS?.agenda === true;

  if (!moduloAgendaAtivo) return false;

  if (typeof window.crvSegmentoArena === "function") {
    return window.crvSegmentoArena();
  }

  const tipo = String(tipoNegocioCaixa || "")
    .toLowerCase()
    .trim();

  return [
    "arena_quadras",
    "arena",
    "arena_esportiva",
    "arena_beach",
    "arena_society",
    "quadra",
    "quadras",
    "quadras_esportivas",
    "society",
    "beach_sports",
    "beach_tennis",
    "futvolei",
    "futevolei",
    "volei_areia",
    "esportes"
  ].includes(tipo);
}

function caixaPermiteComandas() {
  if (typeof window.crvModuloAtivo === "function") {
    return window.crvModuloAtivo("comandas");
  }

  return window.CRV_MODULOS?.comandas === true;
}

function aplicarVisibilidadeAtalhosContextuaisCaixa() {
  const seletorModos = document.querySelector(".pdv-mode-switch");
  const btnComanda = document.getElementById("btnModoComanda");
  const btnJogos = document.getElementById("btnModoJogos");
  const permiteComandas = caixaPermiteComandas();
  const permiteJogos = caixaPermiteJogos();

  if (btnComanda) {
    btnComanda.style.display = permiteComandas
      ? "inline-flex"
      : "none";
  }

  if (btnJogos) {
    btnJogos.style.display = permiteJogos
      ? "inline-flex"
      : "none";
  }

  if (seletorModos) {
    seletorModos.style.display = permiteComandas || permiteJogos
      ? "flex"
      : "none";
  }

  if (
    (modoPDV === "comanda" && !permiteComandas) ||
    (modoPDV === "jogos" && !permiteJogos)
  ) {
    modoPDV = "venda";
    atualizarInterfaceModoPDV();
  }
}

function aplicarVisibilidadeBotaoJogos() {
  aplicarVisibilidadeAtalhosContextuaisCaixa();
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
    renderUltimoFechamentoCaixa();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderUltimoFechamentoCaixa() {
  const boxCheck = document.getElementById("boxUsarUltimoFechamento");
  const info = document.getElementById("ultimoFechamentoInfo");
  const valorEl = document.getElementById("ultimoFechamentoValor");
  const dataEl = document.getElementById("ultimoFechamentoData");
  const inputValor = document.getElementById("valorInicial");
  const check = document.getElementById("chkUsarUltimoFechamento");

  if (!boxCheck || !info || !inputValor || !check) return;

  if (!ultimoFechamentoCaixa?.valor_final) {
    boxCheck.style.display = "none";
    info.style.display = "none";
    inputValor.disabled = false;
    return;
  }

  const valorFinal = Number(ultimoFechamentoCaixa.valor_final || 0);

  boxCheck.style.display = "flex";
  info.style.display = "flex";

  if (valorEl) valorEl.textContent = fmt(valorFinal);
  if (dataEl) {
    dataEl.textContent = ultimoFechamentoCaixa.data_fechamento
      ? formatarDataHoraBrasil(ultimoFechamentoCaixa.data_fechamento)
      : "Data não informada";
  }

  check.checked = true;
  inputValor.value = valorFinal.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  inputValor.disabled = true;
}

// ======================================================
// ABRIR CAIXA
// ======================================================
async function abrirCaixa() {
  const inputValor = document.getElementById("valorInicial");
  const valor = normalizarNumero(inputValor?.value || 0);

  if (!sistemaOnline()) {
    if (operacaoCaixaEmProcessamento) return;

    if (caixa && caixa.status === "aberto") {
      await alertaCaixa(
        "Caixa já aberto",
        "Já existe um caixa aberto neste dispositivo."
      );
      return;
    }

    try {
      operacaoCaixaEmProcessamento = true;

      const escopo = obterEscopoOfflineCaixa();

      if (!escopo) {
        throw new Error(
          "Faça ao menos um acesso online neste dispositivo antes de abrir o Caixa offline."
        );
      }

      const caixaId = gerarUUIDCaixa();
      const agora = new Date().toISOString();
      const payload = {
        id: caixaId,
        valor_inicial: valor,
        valor_final: null,
        status: "aberto",
        data_abertura: agora,
        data_fechamento: null,
        observacoes: null,
        usuario_abertura: escopo.usuario_id,
        usuario_fechamento: null,
        operador_abertura_id: escopo.operador_id,
        operador_fechamento_id: null
      };

      const operacao = await salvarOperacaoCaixaOffline({
        tipo: "caixa_abertura",
        payload
      });

      caixa = {
        ...payload,
        empresa_id: escopo.empresa_id,
        _offline: true,
        _operacao_id: operacao.operacao_id
      };

      vendas = [];
      caixaMovimentacoes = [];
      carrinho = [];

      await salvarCacheCaixa("caixa_status", caixa);
      await salvarCacheCaixa("caixa_vendas", vendas);
      await salvarCacheCaixa("caixa_movimentacoes", caixaMovimentacoes);

      if (inputValor) inputValor.value = "";

      renderEstado();
      renderCarrinho();
      renderHistorico();

      crvToast({
        titulo: "Caixa aberto offline",
        mensagem: "A abertura foi salva neste dispositivo e será sincronizada depois.",
        tipo: "warn",
        tempo: 6500
      });

      logCaixa("Caixa aberto e persistido offline.", "warn");
    } catch (err) {
      await alertaCaixa("Não foi possível abrir o Caixa", err.message);
    } finally {
      operacaoCaixaEmProcessamento = false;
    }

    return;
  }

  if (caixa && caixa.status === "aberto") {
    await alertaCaixa(
  "Caixa já aberto",
  "Já existe um caixa aberto."
);
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
      usuario_fechamento: null,
      operador_abertura_id: obterOperadorAtualId(),
      operador_fechamento_id: null
    };

    const { data, error } = await sb
      .from("caixa")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    caixa = data;
    await registrarAuditoriaCaixa({
  acao: "abrir_caixa",
  tabela: "caixa",
  registroId: data.id,
  descricao: "Caixa aberto",
  dadosDepois: data
});
    vendas = [];
    caixaMovimentacoes = [];
    carrinho = [];

    await salvarCacheCaixa("caixa_status", caixa);
    await salvarCacheCaixa("caixa_vendas", vendas);
    await salvarCacheCaixa("caixa_movimentacoes", caixaMovimentacoes);

    if (inputValor) inputValor.value = "";

    renderEstado();
    renderCarrinho();
    renderHistorico();

    logCaixa("Caixa aberto no Supabase.", "success");

  } catch (err) {
    logCaixa("Erro ao abrir: " + err.message, "error");
    await alertaCaixa(
  "Erro ao abrir caixa",
  err.message
);
  }
}

// ======================================================
// FECHAR CAIXA
// ======================================================
async function confirmarFechamento() {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Nenhum caixa aberto para fechar."
    );
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
  const qtdVendas = vendasAtivasCaixa().length;
  const valorInicial = Number(caixa?.valor_inicial || 0);
  const totalSuprimentos = calcularTotalMovimentacoesCaixa("suprimento");
  const totalSangrias = calcularTotalMovimentacoesCaixa("sangria");
  const saldoEsperado = calcularSaldoEsperadoCaixa();

  const fechDataAbertura = document.getElementById("fechDataAbertura");
  const fechValorInicial = document.getElementById("fechValorInicial");
  const fechTotalVendido = document.getElementById("fechTotalVendido");
  const fechTotalDinheiro = document.getElementById("fechTotalDinheiro");
  const fechQtdVendas = document.getElementById("fechQtdVendas");
  const fechSaldoEsperado = document.getElementById("fechSaldoEsperado");
  const fechLinhaSuprimentos = document.getElementById("fechLinhaSuprimentos");
  const fechTotalSuprimentos = document.getElementById("fechTotalSuprimentos");
  const fechLinhaSangrias = document.getElementById("fechLinhaSangrias");
  const fechTotalSangrias = document.getElementById("fechTotalSangrias");
  const valorFechamento = document.getElementById("valorFechamento");
  const fechDiferenca = document.getElementById("fechDiferenca");

  if (fechDataAbertura) fechDataAbertura.textContent = formatarDataHoraBrasil(caixa?.data_abertura);
  if (fechValorInicial) fechValorInicial.textContent = fmt(valorInicial);
  if (fechTotalVendido) fechTotalVendido.textContent = fmt(totalVendido);
  if (fechTotalDinheiro) fechTotalDinheiro.textContent = fmt(totalDinheiro);
  if (fechQtdVendas) fechQtdVendas.textContent = qtdVendas;
  if (fechLinhaSuprimentos) fechLinhaSuprimentos.style.display = totalSuprimentos > 0 ? "flex" : "none";
  if (fechTotalSuprimentos) fechTotalSuprimentos.textContent = fmt(totalSuprimentos);
  if (fechLinhaSangrias) fechLinhaSangrias.style.display = totalSangrias > 0 ? "flex" : "none";
  if (fechTotalSangrias) fechTotalSangrias.textContent = fmt(totalSangrias);
  if (fechSaldoEsperado) fechSaldoEsperado.textContent = fmt(saldoEsperado);
  if (valorFechamento) valorFechamento.value = saldoEsperado.toFixed(2);
  if (fechDiferenca) fechDiferenca.innerHTML = "";

  calcularDiferenca();
}

function calcularDiferenca() {
  const valorFisico = normalizarNumero(
    document.getElementById("valorFechamento")?.value || 0
  );

  const saldoEsperado = calcularSaldoEsperadoCaixa();

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
    if (operacaoCaixaEmProcessamento) return;

    if (!caixa?.id || caixa.status !== "aberto") {
      await alertaCaixa("Caixa fechado", "Nenhum caixa aberto.");
      return;
    }

    try {
      operacaoCaixaEmProcessamento = true;

      const escopo = obterEscopoOfflineCaixa();

      if (!escopo) {
        throw new Error("Contexto offline da empresa não encontrado.");
      }

      const valorFinal = normalizarNumero(
        document.getElementById("valorFechamento")?.value || 0
      );
      const dataFechamento = new Date().toISOString();
      const caixaFechado = {
        ...caixa,
        status: "fechado",
        valor_final: valorFinal,
        data_fechamento: dataFechamento,
        usuario_fechamento: escopo.usuario_id,
        operador_fechamento_id: escopo.operador_id
      };

      await salvarOperacaoCaixaOffline({
        tipo: "caixa_fechamento",
        payload: {
          caixa_id: caixa.id,
          valor_final: valorFinal,
          data_fechamento: dataFechamento,
          usuario_fechamento: escopo.usuario_id,
          operador_fechamento_id: escopo.operador_id
        }
      });

      ultimoFechamentoCaixa = caixaFechado;
      caixa = null;
      vendas = [];
      caixaMovimentacoes = [];
      carrinho = [];

      await salvarCacheCaixa("caixa_status", null);
      await salvarCacheCaixa("caixa_vendas", []);
      await salvarCacheCaixa("caixa_movimentacoes", []);

      fecharModal();
      renderEstado();
      renderCarrinho();
      renderHistorico();

      crvToast({
        titulo: "Caixa fechado offline",
        mensagem: "O fechamento foi salvo e será sincronizado na ordem correta.",
        tipo: "warn",
        tempo: 6500
      });

      logCaixa("Caixa fechado e persistido offline.", "warn");
    } catch (err) {
      await alertaCaixa("Não foi possível fechar o Caixa", err.message);
    } finally {
      operacaoCaixaEmProcessamento = false;
    }

    return;
  }

  if (!caixa?.id) {
    await alertaCaixa(
      "Caixa fechado",
      "Nenhum caixa aberto."
    );
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
        usuario_fechamento: usuarioId,
        operador_fechamento_id: obterOperadorAtualId()
      })
      .eq("id", caixa.id)
      .eq("empresa_id", obterEmpresaId());

    if (error) throw error;

    await registrarAuditoriaCaixa({
      acao: "fechar_caixa",
      tabela: "caixa",
      registroId: caixa.id,
      descricao: `Caixa fechado com valor final de ${fmt(valorFinal)}`,
      dadosAntes: caixa,
      dadosDepois: {
        status: "fechado",
        valor_final: valorFinal
      }
    });

    caixa = null;
    vendas = [];
    caixaMovimentacoes = [];
    carrinho = [];

    await salvarCacheCaixa("caixa_status", null);
    await salvarCacheCaixa("caixa_vendas", []);
    await salvarCacheCaixa("caixa_movimentacoes", []);

    fecharModal();
    renderEstado();
    renderCarrinho();
    renderHistorico();

    logCaixa("Caixa fechado no Supabase.", "success");

  } catch (err) {
    logCaixa("Erro ao fechar: " + err.message, "error");
    await alertaCaixa(
      "Erro ao fechar caixa",
      err.message
    );
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
  const tipoAtual = document.getElementById("tipoItensRapidosAtual");
  const itensRapidosFiltrados = produtosRapidos.filter(produto => {
    return itemCombinaFiltroTipoCaixa(produto, filtroTipoItensCaixa);
  });

  if (!grid) return;

  grid.innerHTML = "";

  if (tipoAtual) {
    tipoAtual.textContent = rotuloFiltroTipoCaixa(filtroTipoItensCaixa);
  }

  if (!itensRapidosFiltrados.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:22px;">
        <i data-lucide="package-search" width="28" height="28"></i>
        <p>Nenhum item rápido neste tipo.</p>
        <small style="color:var(--text-muted);">
          Cadastre o item e marque como item rápido.
        </small>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  itensRapidosFiltrados.forEach(produto => {
    const item = document.createElement("div");
    const tipoItem = tipoItemProdutoCaixa(produto);
    const tipoConfig = TIPOS_ITEM_CAIXA[tipoItem];

    item.className = `quick-item tipo-${tipoItem}`;

    item.innerHTML = `
      <div class="quick-item-type">
        ${tipoConfig.singular}
      </div>

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
// MODAL TODOS PRODUTOS
// ======================================================

function setupModalTodosProdutosCaixa() {
  const btnAbrir = document.getElementById("btnVerTodosProdutos");
  const btnFechar = document.getElementById("btnFecharProdutosCaixa");
  const inputBusca = document.getElementById("inputBuscaProdutosCaixa");

  if (btnAbrir) {
    btnAbrir.onclick = abrirModalTodosProdutosCaixa;
  }

  if (btnFechar) {
    btnFechar.onclick = fecharModalTodosProdutosCaixa;
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", () => {
      renderTodosProdutosCaixa(inputBusca.value);
    });
  }
}

function atualizarBotoesFiltroTipoCaixa() {
  document.querySelectorAll("[data-tipo-item-caixa]").forEach(botao => {
    botao.classList.toggle(
      "active",
      botao.dataset.tipoItemCaixa === filtroTipoItensCaixa
    );
  });

  document.querySelectorAll("[data-tipo-modal-caixa]").forEach(botao => {
    botao.classList.toggle(
      "active",
      botao.dataset.tipoModalCaixa === filtroTipoModalCaixa
    );
  });
}

function setupFiltrosTiposItensCaixa() {
  const botaoTipos = document.getElementById("btnTiposItensCaixa");
  const menuTipos = document.getElementById("menuTiposItensCaixa");

  if (botaoTipos && menuTipos) {
    botaoTipos.addEventListener("click", event => {
      event.stopPropagation();

      const abrir = menuTipos.style.display !== "block";
      menuTipos.style.display = abrir ? "block" : "none";
      botaoTipos.setAttribute("aria-expanded", abrir ? "true" : "false");

      if (abrir && window.lucide) {
        lucide.createIcons();
      }
    });

    menuTipos.addEventListener("click", event => {
      const botao = event.target.closest("[data-tipo-item-caixa]");
      if (!botao) return;

      filtroTipoItensCaixa = botao.dataset.tipoItemCaixa || "produto";
      filtroTipoModalCaixa = filtroTipoItensCaixa;

      atualizarBotoesFiltroTipoCaixa();
      renderProdutosRapidos();

      menuTipos.style.display = "none";
      botaoTipos.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("click", event => {
      if (event.target.closest(".tipo-itens-caixa-wrap")) return;

      menuTipos.style.display = "none";
      botaoTipos.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelectorAll("[data-tipo-modal-caixa]").forEach(botao => {
    botao.addEventListener("click", () => {
      filtroTipoModalCaixa = botao.dataset.tipoModalCaixa || "produto";
      atualizarBotoesFiltroTipoCaixa();

      const busca = document.getElementById("inputBuscaProdutosCaixa");
      renderTodosProdutosCaixa(busca?.value || "");
    });
  });

  atualizarBotoesFiltroTipoCaixa();
}

function abrirModalTodosProdutosCaixa() {
  const modal = document.getElementById("modalProdutosCaixa");
  const inputBusca = document.getElementById("inputBuscaProdutosCaixa");

  if (!modal) return;

  modal.style.display = "flex";

  if (inputBusca) {
    inputBusca.value = "";
  }

  filtroTipoModalCaixa = filtroTipoItensCaixa;
  atualizarBotoesFiltroTipoCaixa();

  renderTodosProdutosCaixa("");

  setTimeout(() => {
    inputBusca?.focus();
  }, 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalTodosProdutosCaixa() {
  const modal = document.getElementById("modalProdutosCaixa");

  if (modal) {
    modal.style.display = "none";
  }

  const inputBusca = document.getElementById("inputBusca");

  if (inputBusca) {
    inputBusca.focus();
  }
}

function renderTodosProdutosCaixa(termoBusca = "") {
  const lista = document.getElementById("listaProdutosCaixa");
  const titulo = document.getElementById("tituloModalItensCaixa");

  if (!lista) return;

  const termo = String(termoBusca || "").toLowerCase().trim();

  if (titulo) {
    titulo.textContent = filtroTipoModalCaixa === "todos"
      ? "Todos os Itens"
      : rotuloFiltroTipoCaixa(filtroTipoModalCaixa);
  }

  const filtrados = produtos.filter(produto => {
    const nome = String(produto.nome || "").toLowerCase();
    const codigo = String(produto.codigo || "").toLowerCase();
    const codigoBarras = String(produto.codigo_barras || "").toLowerCase();
    const categoria = String(produto.categoria || "").toLowerCase();
    const passaTipo = itemCombinaFiltroTipoCaixa(produto, filtroTipoModalCaixa);

    return (
      passaTipo &&
      (
        !termo ||
        nome.includes(termo) ||
        codigo.includes(termo) ||
        codigoBarras.includes(termo) ||
        categoria.includes(termo)
      )
    );
  });

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="package-x" width="28" height="28"></i>
        <p>Nenhum item encontrado.</p>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  lista.innerHTML = filtrados.map(produto => {
    const estoque = Number(produto.estoque || 0);
    const tipoItem = tipoItemProdutoCaixa(produto);
    const tipoConfig = TIPOS_ITEM_CAIXA[tipoItem];
    const controlaEstoque = itemControlaEstoqueCaixa(produto);

    const classeEstoque =
      estoque <= 0
        ? "zero"
        : estoque <= 5
          ? "baixo"
          : "";

    return `
      <button
        type="button"
        class="produto-caixa-item"
        data-produto-id="${produto.id}"
      >
        <div>
          <div class="produto-caixa-nome">
            ${produto.nome || "Item"}
          </div>

          <div class="produto-caixa-meta">
            <span class="produto-caixa-tipo">
              <i data-lucide="${tipoConfig.icone}" width="10" height="10"></i>
              ${tipoConfig.singular}
            </span>

            <span class="produto-caixa-categoria">
              ${produto.categoria || "Sem categoria"}
            </span>
          </div>
        </div>

        <div class="produto-caixa-bottom">
          <span class="produto-caixa-preco">
            ${fmt(produto.preco || 0)}
          </span>

          ${
            controlaEstoque
              ? `<span class="produto-caixa-estoque ${classeEstoque}">
                   Est: ${estoque}
                 </span>`
              : `<span class="produto-caixa-sem-estoque">
                   Sem estoque
                 </span>`
          }
        </div>
      </button>
    `;
  }).join("");

  lista.querySelectorAll(".produto-caixa-item").forEach(btn => {
    btn.onclick = async () => {
      const produtoId = btn.dataset.produtoId;

      const produto = produtos.find(item => {
        return String(item.id) === String(produtoId);
      });

      if (!produto) {
        await alertaCaixa(
          "Item não encontrado",
          "Não foi possível localizar este item."
        );
        return;
      }

      if (modoPDV === "comanda" && !comandaAtiva) {
        await alertaCaixa(
          "Comanda não selecionada",
          "Abra ou selecione uma comanda antes de adicionar itens."
        );
        return;
      }

      if (modoPDV === "comanda" && comandaAtiva) {
        await adicionarProdutoNaComanda(produto);
      } else {
        await adicionarCarrinho(produto);
      }

      fecharModalTodosProdutosCaixa();
    };
  });

  if (window.lucide) {
    lucide.createIcons();
  }
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
    ativo.tagName === "TEXTAREA" ||
    ativo.tagName === "SELECT" ||
    ativo.isContentEditable
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

item.onclick = async () => {
  if (modoPDV === "comanda" && comandaAtiva) {
    await adicionarProdutoNaComanda(produto);
  } else {
    await adicionarCarrinho(produto);
  }

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
      "Item inválido",
      "Item inválido."
    );
    return;
  }

  const preco = normalizarNumero(produto.preco);

  if (preco <= 0) {
    await alertaCaixa(
      "Preço inválido",
      "Item sem preço válido."
    );
    return;
  }

  const estoqueDisponivel = Number(produto.estoque || 0);
  const controlaEstoque = itemControlaEstoqueCaixa(produto);

  if (controlaEstoque && estoqueDisponivel <= 0) {
    await alertaCaixa(
      "Sem estoque",
      `Item sem estoque: <strong>${produto.nome}</strong>`
    );
    return;
  }

  const existente = carrinho.find(item => item.id === produto.id);

  if (existente) {
    const novaQuantidade = Number(existente.quantidade || 0) + 1;

    if (controlaEstoque && novaQuantidade > estoqueDisponivel) {
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
      produto_manual: false,
      tipo_item: tipoItemProdutoCaixa(produto),
      controla_estoque: controlaEstoque
    });
  }

  renderCarrinho();
}

function normalizarTextoCaixa(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obterTokensProdutoCaixa(texto) {
  const ignorar = new Set([
    "de", "da", "do", "das", "dos", "com", "sem", "para",
    "ml", "l", "lt", "kg", "g", "un", "und", "pct", "cx",
    "300", "350", "500", "600", "1000", "1", "2", "3"
  ]);

  return normalizarTextoCaixa(texto)
    .split(" ")
    .filter(token => token.length >= 3 && !ignorar.has(token));
}

function montarMapaProdutosBloqueadosCaixa() {
  const mapa = [];
  const itensCadastrados = catalogoItensCaixa.length
    ? catalogoItensCaixa
    : produtos;

  itensCadastrados.forEach(produto => {
    const nome = String(produto.nome || "");
    const categoria = String(produto.categoria || "");

    const tokens = [
      ...obterTokensProdutoCaixa(nome),
      ...obterTokensProdutoCaixa(categoria)
    ];

    const textoBase = normalizarTextoCaixa(`${nome} ${categoria}`);

    mapa.push({
      produto,
      nomeNormalizado: normalizarTextoCaixa(nome),
      textoBase,
      tokens: [...new Set(tokens)]
    });
  });

  return mapa;
}

function validarDescricaoCobrancaAvulsa(descricao) {
  const texto = normalizarTextoCaixa(descricao);
  const tokensDescricao = obterTokensProdutoCaixa(descricao);

  if (!texto || !tokensDescricao.length) {
    return {
      permitido: false,
      produto: "Descrição inválida"
    };
  }

  const mapaProdutos = montarMapaProdutosBloqueadosCaixa();

  for (const item of mapaProdutos) {
    if (
      item.nomeNormalizado &&
      (
        texto.includes(item.nomeNormalizado) ||
        item.nomeNormalizado.includes(texto)
      )
    ) {
      return {
        permitido: false,
        produto: item.produto.nome || "Item cadastrado"
      };
    }

    const tokensEncontrados = item.tokens.filter(token => {
      return tokensDescricao.includes(token);
    });

    if (tokensEncontrados.length >= 1) {
      return {
        permitido: false,
        produto: item.produto.nome || "Item cadastrado"
      };
    }
  }

  return {
    permitido: true,
    produto: null
  };
}

async function adicionarManual() {
  if (operadorCaixaRestritoAoBalcao()) {
    await alertaCaixa(
      "Ação restrita",
      "Cobranças avulsas ficam disponíveis somente para a conta principal ou para operadores Admin."
    );
    return;
  }

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de vender."
    );
    return;
  }

  const tipoInput = document.getElementById("manualTipo");
  const descricaoInput = document.getElementById("manualDescricao");
  const precoInput = document.getElementById("manualPreco");
  const qtdInput = document.getElementById("manualQtd");

  const tipo = String(tipoInput?.value || "outros").trim();
  const descricao = String(descricaoInput?.value || "").trim();
  const preco = normalizarNumero(precoInput?.value || 0);
  const quantidade = Math.max(1, parseInt(qtdInput?.value || "1", 10));

  if (!descricao || descricao.length < 5) {
    await alertaCaixa(
      "Cobrança avulsa",
      "Informe uma descrição clara para a cobrança avulsa."
    );
    return;
  }

  const validacao = validarDescricaoCobrancaAvulsa(descricao);

  if (!validacao.permitido) {
    await alertaCaixa(
      "Item já cadastrado",
      `
        Esta cobrança parece estar relacionada a um item do catálogo:<br><br>
        <strong>${validacao.produto}</strong><br><br>
        Use a busca, os itens rápidos ou o botão <strong>Ver todos</strong> para vender pela forma correta.
      `
    );
    return;
  }

  if (preco <= 0) {
    await alertaCaixa(
      "Cobrança avulsa",
      "Informe um preço válido."
    );
    return;
  }

  const nomeFinal = `[${tipo.toUpperCase()}] ${descricao}`;

  if (modoPDV === "comanda" && comandaAtiva) {
    await adicionarItemManualNaComanda({
      nome: nomeFinal,
      preco,
      quantidade
    });

    if (descricaoInput) descricaoInput.value = "";
    if (precoInput) precoInput.value = "";
    if (qtdInput) qtdInput.value = "1";

    return;
  }

  carrinho.push({
    id: "manual-" + Date.now(),
    nome: nomeFinal,
    preco: preco,
    quantidade: quantidade,
    produto_manual: true
  });

  if (descricaoInput) descricaoInput.value = "";
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
    const itemAgendaIndividual = Boolean(item.agenda_jogador_id);

    div.className = "cart-item";

    div.innerHTML = `
      <div class="cart-item-name">
        ${item.nome}
      </div>

    <div class="cart-item-qty">
      ${
        itemAgendaIndividual
          ? `<span class="qty-num" title="Cobrança individual vinculada à Agenda">1 jogador</span>`
          : `
              <button class="qty-btn qty-minus" type="button">−</button>
              <span class="qty-num">${item.quantidade}</span>
              <button class="qty-btn qty-plus" type="button">+</button>
            `
      }
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
      "Para sair sem fechar a comanda, use o botão <strong>Sair da comanda</strong> no card da comanda ativa."
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

function vendaCanceladaCaixa(venda) {
  return String(venda?.status_operacional || "concluida").toLowerCase() === "cancelada";
}

function vendasAtivasCaixa() {
  return vendas.filter(venda => !vendaCanceladaCaixa(venda));
}

function movimentacoesAtivasCaixa() {
  return caixaMovimentacoes.filter(movimentacao => {
    return String(movimentacao?.status || "ativa").toLowerCase() !== "cancelada";
  });
}

function calcularTotalMovimentacoesCaixa(tipo) {
  const tipoNormalizado = String(tipo || "").toLowerCase();

  return movimentacoesAtivasCaixa().reduce((total, movimentacao) => {
    if (String(movimentacao.tipo || "").toLowerCase() !== tipoNormalizado) {
      return total;
    }

    return total + Number(movimentacao.valor || 0);
  }, 0);
}

function calcularSaldoEsperadoCaixa() {
  return Number(caixa?.valor_inicial || 0) +
    calcularTotalVendidoDinheiro() +
    calcularTotalMovimentacoesCaixa("suprimento") -
    calcularTotalMovimentacoesCaixa("sangria");
}

function calcularTotalVendido() {
  return vendasAtivasCaixa().reduce((acc, venda) => {
    return acc + Number(venda.total || 0);
  }, 0);
}

function calcularTotalVendidoDinheiro() {
  return vendasAtivasCaixa().reduce((acc, venda) => {
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

  if (infoQtdVendas) {
    infoQtdVendas.textContent = vendasAtivasCaixa().length;
  }

  const saldo = calcularSaldoEsperadoCaixa();

  if (infoSaldo) {
    infoSaldo.textContent = fmt(saldo);
  }
}

// ======================================================
// PAGAMENTO / TROCO
// ======================================================
function selecionarPagamento(botao) {
  const metodo = botao.dataset.method || "dinheiro";

  if (metodo === "cartao") {
    aplicarMetodoPagamentoCaixa(botao, "debito");
    abrirSubopcoesCartaoCaixa("debito");
    return;
  }

  fecharSubopcoesCartaoCaixa();
  aplicarMetodoPagamentoCaixa(botao, metodo);
}

function aplicarMetodoPagamentoCaixa(botao, metodo) {
  document
    .querySelectorAll(".pay-btn")
    .forEach(btn => btn.classList.remove("active"));

  botao.classList.add("active");

  metodoPagamento = metodo;

  const trocoBox = document.getElementById("cartTroco");

  if (trocoBox) {
    trocoBox.style.display = metodoPagamento === "dinheiro" ? "block" : "none";
  }

  calcularTroco();
}

function abrirSubopcoesCartaoCaixa(tipoAtivo = "debito") {
  const box = document.getElementById("cartaoSubopcoes");

  if (!box) return;

  box.classList.add("open");

  box.querySelectorAll("button").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.cardType === tipoAtivo
    );
  });
}

function fecharSubopcoesCartaoCaixa() {
  const box = document.getElementById("cartaoSubopcoes");

  if (!box) return;

  box.classList.remove("open");

  box.querySelectorAll("button").forEach(btn => {
    btn.classList.remove("active");
  });
}

function selecionarTipoCartaoRapido(botao) {
  const tipo = botao.dataset.cardType || "debito";
  const botaoCartao = document.querySelector('.pay-btn[data-method="cartao"]');

  if (!botaoCartao) return;

  aplicarMetodoPagamentoCaixa(botaoCartao, tipo);
  abrirSubopcoesCartaoCaixa(tipo);
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
    .select("id, nome, preco, estoque, ativo, tipo_item, controla_estoque, exibir_caixa")
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
      throw new Error("Um item do carrinho não foi encontrado no Supabase.");
    }

    if (produtoBanco.ativo !== true) {
      throw new Error(`Item inativo no caixa: ${produtoBanco.nome}`);
    }

    if (!itemVisivelNoCaixa(produtoBanco)) {
      throw new Error(`Item indisponível no caixa: ${produtoBanco.nome}`);
    }

    const quantidadeCarrinho = carrinho
      .filter(item => item.id === id)
      .reduce((acc, item) => acc + Number(item.quantidade || 0), 0);

    if (itemControlaEstoqueCaixa(produtoBanco)) {
      const estoqueAtual = Number(produtoBanco.estoque || 0);

      if (estoqueAtual < quantidadeCarrinho) {
        throw new Error(`Estoque insuficiente para ${produtoBanco.nome}. Disponível: ${estoqueAtual}`);
      }
    }

    const produtoLocal = obterItemCatalogoCaixa(id);

    if (produtoLocal) {
      produtoLocal.preco = produtoBanco.preco;
      produtoLocal.estoque = produtoBanco.estoque;
      produtoLocal.ativo = produtoBanco.ativo;
      produtoLocal.tipo_item = tipoItemProdutoCaixa(produtoBanco);
      produtoLocal.controla_estoque = itemControlaEstoqueCaixa(produtoBanco);
      produtoLocal.exibir_caixa = itemVisivelNoCaixa(produtoBanco);
    }
  }

  return true;
}

function limparRecebimentoAgendaStorage() {
  sessionStorage.removeItem("crv_recebimento_agenda_caixa");
  localStorage.removeItem("crv_recebimento_agenda_caixa");
  recebimentoAgendaCaixa = null;
}

function obterRecebimentoAgendaStorage() {
  try {
    const bruto =
      sessionStorage.getItem("crv_recebimento_agenda_caixa") ||
      localStorage.getItem("crv_recebimento_agenda_caixa");

    if (!bruto) return null;

    const dados = JSON.parse(bruto);

    const tipo = String(dados?.tipo || "").trim();

    if (!["agenda_mensalidade", "agenda_avulso", "agenda_quinta_semana"].includes(tipo)) {
      limparRecebimentoAgendaStorage();
      return null;
    }

    if (tipo === "agenda_mensalidade") {
      if (!dados.mensalidade_id || !dados.agenda_id || Number(dados.valor || 0) <= 0) {
        limparRecebimentoAgendaStorage();
        return null;
      }
    }

    if (tipo === "agenda_avulso") {
      if (!dados.agenda_id && !dados.origem_id) {
        limparRecebimentoAgendaStorage();
        return null;
      }
    }

    if (tipo === "agenda_quinta_semana") {
      if (!dados.cobranca_id || !dados.agenda_id || Number(dados.valor || 0) <= 0) {
        limparRecebimentoAgendaStorage();
        return null;
      }
    }

    return dados;

  } catch (err) {
    console.warn("[CAIXA][RECEBIMENTO AGENDA]", err);
    limparRecebimentoAgendaStorage();
    return null;
  }
}

function formatarCompetenciaCaixa(comp) {
  if (!comp) return "-";

  const [ano, mes] =
    String(comp).split("-").map(Number);

  const meses = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  return `${meses[mes]} de ${ano}`;
}

async function processarRecebimentoAgendaAoAbrirCaixa() {
  const recebimento = obterRecebimentoAgendaStorage();

  if (!recebimento) return;

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Abra o caixa",
      "Existe um recebimento enviado pela Agenda. Abra o caixa primeiro e depois volte para receber."
    );

    return;
  }

  if (recebimento.tipo === "agenda_mensalidade") {
    await prepararRecebimentoMensalidadeAgendaCaixa(recebimento);
    return;
  }

  if (recebimento.tipo === "agenda_quinta_semana") {
    await prepararRecebimentoQuintaSemanaAgendaCaixa(recebimento);
    return;
  }

  if (recebimento.tipo === "agenda_avulso") {
    await prepararRecebimentoAvulsoAgendaCaixa(recebimento);
  }
}

async function prepararRecebimentoMensalidadeAgendaCaixa(recebimento) {
  const { data: mensalidade, error } = await sb
    .from("agenda_mensalidades")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("id", recebimento.mensalidade_id)
    .maybeSingle();

  if (error) throw error;

  if (!mensalidade) {
    limparRecebimentoAgendaStorage();

    crvToast({
      titulo: "Mensalidade não encontrada",
      mensagem: "O recebimento enviado pela Agenda não existe mais.",
      tipo: "warn"
    });

    return;
  }

  if (String(mensalidade.status || "").toLowerCase() === "pago") {
    limparRecebimentoAgendaStorage();

    crvToast({
      titulo: "Mensalidade já paga",
      mensagem: "Este recebimento já foi baixado anteriormente.",
      tipo: "info"
    });

    return;
  }

  recebimentoAgendaCaixa = {
    ...recebimento,
    valor: Number(mensalidade.valor || recebimento.valor || 0),
    competencia: mensalidade.competencia || recebimento.competencia
  };

  modoPDV = "venda";
  comandaAtiva = null;
  comandaOculta = false;
  jogoSelecionadoCaixa = null;

  carrinho = [
    {
      id: `agenda-mensalidade-${mensalidade.id}`,
      nome: recebimento.descricao || `Mensalidade - ${recebimento.cliente_nome || "Mensalista"}`,
      preco: Number(mensalidade.valor || 0),
      preco_custo: 0,
      quantidade: 1,
      produto_manual: true,
      origem: "agenda_mensalidade",
      origem_id: mensalidade.id,
      agenda_id: recebimento.agenda_id || mensalidade.agenda_origem_id,
      mensalidade_id: mensalidade.id
    }
  ];

  atualizarInterfaceModoPDV();
  renderCarrinho();

  await abrirConfirmacaoCaixa({
    titulo: "Receber mensalidade",
    mensagem: `
      <strong>${recebimento.cliente_nome || "Mensalista"}</strong><br>
      ${recebimento.local_recurso || "Quadra/Campo"}
      ${recebimento.hora_inicio ? ` · ${formatarHoraCaixa(recebimento.hora_inicio)} às ${formatarHoraCaixa(recebimento.hora_fim)}` : ""}<br><br>
      Mensalidade referente a
      <strong>${formatarCompetenciaCaixa(mensalidade.competencia)}</strong><br><br>
      Valor:
      <strong>${fmt(mensalidade.valor)}</strong><br><br>
      Escolha a forma de pagamento no Caixa e finalize a venda.
    `,
    textoConfirmar: "Ir para pagamento",
    mostrarCancelar: false
  });

  document.querySelector(".pay-btn")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function prepararRecebimentoQuintaSemanaAgendaCaixa(recebimento) {
  const { data: cobranca, error } = await sb
    .from("agenda_cobrancas_extras")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("id", recebimento.cobranca_id)
    .maybeSingle();

  if (error) throw error;

  if (!cobranca || cobranca.status === "cancelado") {
    limparRecebimentoAgendaStorage();
    crvToast({
      titulo: "Cobrança não encontrada",
      mensagem: "A cobrança da 5ª semana não está mais disponível.",
      tipo: "warn"
    });
    return;
  }

  if (cobrancaQuintaSemanaPagaCaixa(cobranca)) {
    limparRecebimentoAgendaStorage();
    crvToast({
      titulo: "5ª semana já paga",
      mensagem: "Esta cobrança já foi recebida anteriormente.",
      tipo: "info"
    });
    return;
  }

  recebimentoAgendaCaixa = {
    ...recebimento,
    valor: Number(cobranca.valor || 0)
  };

  modoPDV = "venda";
  comandaAtiva = null;
  comandaOculta = false;
  jogoSelecionadoCaixa = null;

  carrinho = [{
    id: `agenda-quinta-semana-${cobranca.id}`,
    nome: recebimento.descricao || cobranca.descricao || "5ª semana do plano mensal",
    preco: Number(cobranca.valor || 0),
    preco_custo: 0,
    quantidade: 1,
    produto_manual: true,
    origem: "agenda_quinta_semana",
    origem_id: cobranca.id,
    agenda_id: cobranca.agenda_id,
    cobranca_id: cobranca.id
  }];

  atualizarInterfaceModoPDV();
  renderCarrinho();

  await abrirConfirmacaoCaixa({
    titulo: "Receber 5ª semana",
    mensagem: `
      <strong>${recebimento.cliente_nome || "Mensalista"}</strong><br>
      ${recebimento.local_recurso || "Quadra/Campo"}<br><br>
      Cobrança extra da 5ª semana:<br>
      <strong>${fmt(cobranca.valor)}</strong><br><br>
      Escolha a forma de pagamento e finalize separadamente.
    `,
    textoConfirmar: "Ir para pagamento",
    mostrarCancelar: false
  });

  document.querySelector(".pay-btn")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function receberMensalidadeJogoCaixa(jogoId, mensalidadeId) {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de receber a mensalidade do horário."
    );
    return;
  }

  const jogo = jogosCaixa.find(item => {
    return String(item.id) === String(jogoId);
  });

  const mensalidade = mensalidadesCaixa.find(item => {
    return String(item.id) === String(mensalidadeId);
  });

  if (!jogo || !mensalidade) {
    await alertaCaixa(
      "Mensalidade não encontrada",
      "Atualize os jogos e tente novamente."
    );
    return;
  }

  if (mensalidadePagaCaixa(mensalidade)) {
    await alertaCaixa(
      "Mensalidade já paga",
      "A mensalidade deste horário já foi recebida."
    );
    return;
  }

  const agendaOrigemId =
    mensalidade.agenda_origem_id ||
    jogo.recorrencia_origem_id ||
    jogo.id;

  const recebimento = {
    tipo: "agenda_mensalidade",
    mensalidade_id: mensalidade.id,
    agenda_id: agendaOrigemId,
    origem_id: mensalidade.id,
    cliente_nome: jogo.cliente_nome || "Mensalista",
    local_recurso: jogo.local_recurso || "",
    hora_inicio: jogo.hora_inicio || "",
    hora_fim: jogo.hora_fim || "",
    competencia: mensalidade.competencia || "",
    valor: Number(mensalidade.valor || jogo.valor_mensal || 0),
    descricao:
      `Mensalidade ${jogo.cliente_nome || "Mensalista"} - ` +
      formatarCompetenciaCaixa(mensalidade.competencia)
  };

  fecharModalFinalizarJogoCaixa();
  fecharModalSelecionarJogo();

  try {
    await prepararRecebimentoMensalidadeAgendaCaixa(recebimento);
  } catch (err) {
    console.error("[CAIXA][RECEBER MENSALIDADE]", err);

    await alertaCaixa(
      "Erro ao preparar mensalidade",
      err?.message || "Não foi possível abrir o recebimento da mensalidade."
    );
  }
}

async function receberQuintaSemanaJogoCaixa(jogoId, cobrancaId) {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de receber a 5ª semana."
    );
    return;
  }

  const jogo = jogosCaixa.find(item => String(item.id) === String(jogoId));
  const cobranca = cobrancasExtrasCaixa.find(item => {
    return String(item.id) === String(cobrancaId);
  });

  if (!jogo || !cobranca || cobranca.status === "cancelado") {
    await alertaCaixa(
      "Cobrança não encontrada",
      "Atualize os jogos e tente novamente."
    );
    return;
  }

  if (cobrancaQuintaSemanaPagaCaixa(cobranca)) {
    await alertaCaixa("5ª semana já paga", "Esta cobrança já foi recebida.");
    return;
  }

  fecharModalFinalizarJogoCaixa();
  fecharModalSelecionarJogo();

  try {
    await prepararRecebimentoQuintaSemanaAgendaCaixa({
      tipo: "agenda_quinta_semana",
      cobranca_id: cobranca.id,
      agenda_id: jogo.id,
      origem_id: cobranca.id,
      cliente_nome: jogo.cliente_nome || "Mensalista",
      local_recurso: jogo.local_recurso || "",
      data_agendamento: jogo.data_agendamento || "",
      hora_inicio: jogo.hora_inicio || "",
      hora_fim: jogo.hora_fim || "",
      valor: Number(cobranca.valor || 0),
      descricao: cobranca.descricao || `5ª semana - ${jogo.cliente_nome || "Mensalista"}`
    });
  } catch (err) {
    console.error("[CAIXA][RECEBER 5A SEMANA]", err);
    await alertaCaixa(
      "Erro ao preparar 5ª semana",
      err?.message || "Não foi possível abrir esta cobrança."
    );
  }
}

async function prepararRecebimentoAvulsoAgendaCaixa(recebimento) {
  const agendaId = recebimento.agenda_id || recebimento.origem_id;

  const { data: jogadores, error } = await sb
    .from("agenda_jogadores")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("agenda_id", agendaId)
    .neq("removido", true);

  if (error) throw error;

  const jogadoresCobraveis = (jogadores || []).filter(jogador => {
    if (jogadorPagoCaixa(jogador)) return false;
    if (jogadorEmComandaCaixa(jogador)) return false;

    return (
      jogador.cobrar_no_jogo === true &&
      String(jogador.origem_jogador || "").toLowerCase() === "avulso"
    );
  });

  if (!jogadoresCobraveis.length) {
    limparRecebimentoAgendaStorage();

    crvToast({
      titulo: "Sem cobrança pendente",
      mensagem: "Este jogo não possui jogadores avulsos pendentes para receber.",
      tipo: "info"
    });

    return;
  }

  recebimentoAgendaCaixa = recebimento;

  modoPDV = "venda";
  comandaAtiva = null;
  comandaOculta = false;
  jogoSelecionadoCaixa = null;

  carrinho = jogadoresCobraveis.map(jogador => ({
    id: `agenda-avulso-${jogador.id}`,
    nome: `Jogo avulso - ${jogador.nome || "Jogador"}`,
    preco: Number(jogador.valor || 0),
    preco_custo: 0,
    quantidade: 1,
    produto_manual: true,
    origem: "agenda_avulso",
    origem_id: agendaId,
    agenda_id: agendaId,
    agenda_jogador_id: jogador.id
  })).filter(item => Number(item.preco || 0) > 0);

  if (!carrinho.length) {
    limparRecebimentoAgendaStorage();

    await alertaCaixa(
      "Valores não informados",
      "Os jogadores avulsos deste jogo estão sem valor de cobrança."
    );

    return;
  }

  atualizarInterfaceModoPDV();
  renderCarrinho();

  await abrirConfirmacaoCaixa({
    titulo: "Receber jogo avulso",
    mensagem: `
      <strong>${recebimento.cliente_nome || "Jogo avulso"}</strong><br>
      ${recebimento.local_recurso || "Quadra/Campo"}
      ${recebimento.hora_inicio ? ` · ${formatarHoraCaixa(recebimento.hora_inicio)} às ${formatarHoraCaixa(recebimento.hora_fim)}` : ""}<br><br>
      Jogadores cobrados:
      <strong>${carrinho.length}</strong><br><br>
      Total:
      <strong>${fmt(calcularTotalCarrinho())}</strong><br><br>
      Escolha a forma de pagamento no Caixa e finalize a venda.
    `,
    textoConfirmar: "Ir para pagamento",
    mostrarCancelar: false
  });

  document.querySelector(".pay-btn")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

// ======================================================
// FINALIZAR VENDA
// ======================================================
async function finalizarVenda() {
  if (vendaEmProcessamento) {
    return;
  }

if (!sistemaOnline()) {
  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de finalizar uma venda."
    );
    return;
  }

  if (modoPDV !== "venda") {
    await alertaCaixa(
      "Recurso online",
      "Durante a falta de conexão, utilize a Venda rápida. Comandas e jogos serão sincronizados em uma etapa própria."
    );
    return;
  }

  if (!carrinho.length) {
    await alertaCaixa(
      "Carrinho vazio",
      "Adicione itens ao carrinho."
    );
    return;
  }

  if (carrinho.some(item => String(item.origem || "pdv") !== "pdv")) {
    await alertaCaixa(
      "Recebimento online",
      "Cobranças originadas da Agenda precisam de conexão. Produtos, serviços, taxas e cobranças avulsas continuam disponíveis offline."
    );
    return;
  }

  const subtotal = calcularSubtotalCarrinho();
  const desconto = calcularDesconto();
  const total = calcularTotalCarrinho();

  if (desconto > subtotal) {
    await alertaCaixa(
      "Desconto inválido",
      "O desconto não pode ser maior que o subtotal."
    );
    return;
  }

  if (total <= 0) {
    await alertaCaixa("Total inválido", "Total da venda inválido.");
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
    await alertaCaixa(
      "Pagamento insuficiente",
      "O valor recebido é menor que o total da venda."
    );
    return;
  }

  const troco = metodoPagamento === "dinheiro"
    ? Math.max(0, valorRecebido - total)
    : 0;

  try {
    vendaEmProcessamento = true;
    bloquearBotaoFinalizar(true);

    const escopo = obterEscopoOfflineCaixa();

    if (!escopo) {
      throw new Error(
        "O contexto seguro da empresa não foi encontrado neste dispositivo."
      );
    }

    const operacaoId = gerarUUIDCaixa();
    const dataVenda = new Date().toISOString();
    const vendaServidor = {
      caixa_id: caixa.id,
      cliente_id: null,
      subtotal,
      desconto,
      total,
      forma_pagamento: metodoPagamento,
      troco,
      origem: "pdv",
      origem_id: null,
      descricao: "Venda rápida",
      data: dataVenda,
      operador_id: escopo.operador_id,
      venda_manual: carrinho.some(item => item.produto_manual === true)
    };

    const itensServidor = carrinho.map(item => {
      const preco = Number(item.preco || 0);
      const precoCusto = Number(item.preco_custo || 0);
      const quantidade = Number(item.quantidade || 0);

      return {
        produto_id: item.produto_manual ? null : item.id,
        nome: item.nome,
        preco,
        preco_custo: precoCusto,
        lucro_unitario: preco - precoCusto,
        lucro_total: (preco - precoCusto) * quantidade,
        quantidade,
        origem: "pdv",
        origem_id: null,
        item_manual: item.produto_manual === true
      };
    });

    const operacao = await salvarOperacaoCaixaOffline({
      tipo: "venda",
      operacaoId,
      payload: {
        venda: vendaServidor,
        itens: itensServidor
      }
    });

    carrinho.forEach(item => {
      if (
        item.produto_manual ||
        !item.id ||
        !itemControlaEstoqueCaixa(item)
      ) return;

      const produtoLocal = obterItemCatalogoCaixa(item.id);

      if (produtoLocal) {
        produtoLocal.estoque = Math.max(
          0,
          Number(produtoLocal.estoque || 0) - Number(item.quantidade || 0)
        );
      }
    });

    await salvarCacheCaixa("caixa_produtos", produtos);
    await salvarCacheCaixa("caixa_catalogo_itens", catalogoItensCaixa);

    atualizarProdutosRapidosCaixa();

    const vendaLocal = {
      id: `offline-${operacaoId}`,
      empresa_id: escopo.empresa_id,
      ...vendaServidor,
      _offline: true,
      _operacao_id: operacao.operacao_id
    };

    vendas.unshift(vendaLocal);
    await salvarCacheCaixa("caixa_vendas", vendas);

    exibirModalSucesso(total, troco);
    carrinho = [];

    const descontoInput = document.getElementById("inputDesconto");
    const valorRecebidoInput = document.getElementById("valorRecebido");

    if (descontoInput) descontoInput.value = "";
    if (valorRecebidoInput) valorRecebidoInput.value = "";

    renderCarrinho();
    atualizarInfobar();
    renderHistorico();

    crvToast({
      titulo: "Venda registrada offline",
      mensagem: "A venda foi salva neste dispositivo e entrará na sincronização automática.",
      tipo: "warn",
      tempo: 6500
    });

    logVenda(`Venda offline salva com operação ${operacaoId}.`, "warn");
  } catch (err) {
    logVenda("Erro ao salvar venda offline: " + err.message, "error");
    await alertaCaixa("Venda não salva", err.message);
  } finally {
    vendaEmProcessamento = false;
    bloquearBotaoFinalizar(false);
  }

  return;
}

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
  "Caixa fechado",
  "Abra o caixa antes de finalizar uma venda."
);
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
    await alertaCaixa(
  "Desconto inválido",
  "O desconto não pode ser maior que o subtotal."
);
    return;
  }

  if (total <= 0) {
    await alertaCaixa(
  "Total inválido",
  "Total da venda inválido."
);
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

const itemMensalidadeAgenda =
  carrinho.find(item => String(item.origem || "") === "agenda_mensalidade") || null;

const itemQuintaSemanaAgenda =
  carrinho.find(item => String(item.origem || "") === "agenda_quinta_semana") || null;

const itensAgendaAvulso =
  carrinho.filter(item => String(item.origem || "") === "agenda_avulso");

const itemAgendaAvulso =
  itensAgendaAvulso[0] || null;

const itemAgenda = itemMensalidadeAgenda || itemQuintaSemanaAgenda || itemAgendaAvulso;

if (
  itemAgenda &&
  carrinho.some(item => {
    const origem = String(item.origem || "");
    return itemMensalidadeAgenda
      ? origem !== "agenda_mensalidade"
      : itemQuintaSemanaAgenda
        ? origem !== "agenda_quinta_semana"
        : origem !== "agenda_avulso";
  })
) {
  await alertaCaixa(
    "Finalize separadamente",
    "Recebimentos da Agenda devem ser finalizados separadamente de produtos ou outras cobranças."
  );
  return;
}

if (itemAgenda && desconto > 0) {
  await alertaCaixa(
    "Desconto indisponível",
    "As cobranças da Agenda usam os valores definidos na própria Agenda e devem ser recebidas sem desconto no Caixa."
  );
  return;
}

if (itemAgenda) {
  const formaPagamentoRpc = normalizarFormaPagamentoAgendaRpcCaixa(
    metodoPagamento
  );

  let resultadoRecebimento = null;

  if (itemMensalidadeAgenda) {
    const { data, error } = await sb.rpc("receber_mensalidade_agenda", {
      p_mensalidade_id: itemMensalidadeAgenda.mensalidade_id,
      p_caixa_id: caixa.id,
      p_forma_pagamento: formaPagamentoRpc,
      p_operador_id: obterOperadorAtualId(),
      p_valor_recebido: metodoPagamento === "dinheiro"
        ? (valorRecebido || total)
        : total
    });

    if (error) throw error;
    resultadoRecebimento = data;
  } else if (itemQuintaSemanaAgenda) {
    const { data, error } = await sb.rpc("receber_cobranca_extra_agenda", {
      p_cobranca_id: itemQuintaSemanaAgenda.cobranca_id,
      p_caixa_id: caixa.id,
      p_forma_pagamento: formaPagamentoRpc,
      p_operador_id: obterOperadorAtualId(),
      p_valor_recebido: metodoPagamento === "dinheiro"
        ? (valorRecebido || total)
        : total
    });

    if (error) throw error;
    resultadoRecebimento = data;
  } else {
    const idsJogadores = itensAgendaAvulso
      .map(item => item.agenda_jogador_id)
      .filter(Boolean);

    if (!idsJogadores.length) {
      throw new Error("Os jogadores avulsos deste recebimento não foram identificados.");
    }

    const { data, error } = await sb.rpc("receber_avulsos_agenda", {
      p_agenda_id: itemAgendaAvulso.agenda_id,
      p_jogadores_ids: idsJogadores,
      p_caixa_id: caixa.id,
      p_forma_pagamento: formaPagamentoRpc,
      p_operador_id: obterOperadorAtualId(),
      p_valor_recebido: metodoPagamento === "dinheiro"
        ? (valorRecebido || total)
        : total
    });

    if (error) throw error;
    resultadoRecebimento = data;
  }

  limparRecebimentoAgendaStorage();

  const totalRecebidoAgenda = Number(
    resultadoRecebimento?.valor || total
  );
  const trocoAgenda = Number(resultadoRecebimento?.troco || 0);

  carrinho = [];

  const descontoInput = document.getElementById("inputDesconto");
  const valorRecebidoInput = document.getElementById("valorRecebido");

  if (descontoInput) descontoInput.value = "";
  if (valorRecebidoInput) valorRecebidoInput.value = "";

  await carregarDadosSupabase();
  await carregarProdutos();
  await carregarJogosCaixa();

  renderProdutosRapidos();
  renderCarrinho();
  renderHistorico();
  renderJogosAtivosNoCaixa();
  atualizarInfobar();

  exibirModalSucesso(totalRecebidoAgenda, trocoAgenda);

  logVenda(
    itemMensalidadeAgenda
      ? "Mensalidade recebida pela transação protegida da Agenda."
      : itemQuintaSemanaAgenda
        ? "5ª semana recebida pela transação protegida da Agenda."
        : "Avulsos recebidos em uma única transação protegida da Agenda.",
    "success"
  );

  return;
}

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
  agenda_id: null,
  descricao: "Venda rápida",

  data: new Date().toISOString(),
  operador_id: obterOperadorAtualId(),
  venda_manual: carrinho.some(item => item.produto_manual === true)
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
  quantidade: quantidade,

  origem: "pdv",
  origem_id: null,
  agenda_id: null,
  agenda_jogador_id: null
};
    });

    const { error: itensError } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (itensError) throw itensError;

    await baixarEstoqueProdutos(vendaData.id);

    vendas.unshift(vendaData);

    await salvarCacheCaixa("caixa_vendas", vendas);

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
    await alertaCaixa(
  "Erro ao finalizar venda",
  err.message
);

  } finally {
    vendaEmProcessamento = false;
    bloquearBotaoFinalizar(false);
  }
}

async function baixarEstoqueProdutos(vendaId = null) {
  const itensComProduto = carrinho.filter(item => {
    return (
      !item.produto_manual &&
      item.id &&
      itemControlaEstoqueCaixa(item)
    );
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

  const movimentacoesConcluidas = [];

  try {
    for (const item of Object.values(quantidadesPorProduto)) {
      const produtoOriginal = obterItemCatalogoCaixa(item.id);

      if (!produtoOriginal) {
        throw new Error(`Item não encontrado para baixar estoque: ${item.nome}`);
      }

      const estoqueAtual = Number(produtoOriginal.estoque || 0);
      const quantidadeVendida = Number(item.quantidade || 0);

      if (estoqueAtual < quantidadeVendida) {
        throw new Error(`Estoque insuficiente para ${item.nome}. Disponível: ${estoqueAtual}`);
      }

      const { data, error } = await sb.rpc("movimentar_estoque_produto", {
        p_produto_id: item.id,
        p_tipo: "venda",
        p_quantidade: quantidadeVendida,
        p_motivo: "Baixa automática por venda",
        p_operador_id: obterOperadorAtualId(),
        p_referencia_tipo: "venda",
        p_referencia_id: vendaId,
        p_venda_id: vendaId,
        p_caixa_id: caixa?.id || null
      });

      if (error) {
        throw new Error("Não foi possível atualizar estoque de " + item.nome + ": " + error.message);
      }

      produtoOriginal.estoque = Number(data?.estoque_posterior ?? estoqueAtual - quantidadeVendida);
      movimentacoesConcluidas.push({ ...item, quantidade: quantidadeVendida });
    }
  } catch (erroBaixa) {
    for (const item of movimentacoesConcluidas.reverse()) {
      try {
        const { error: erroEstornoRpc } = await sb.rpc("movimentar_estoque_produto", {
          p_produto_id: item.id,
          p_tipo: "cancelamento_venda",
          p_quantidade: item.quantidade,
          p_motivo: "Estorno automático de venda não concluída",
          p_operador_id: obterOperadorAtualId(),
          p_referencia_tipo: "venda",
          p_referencia_id: vendaId,
          p_venda_id: vendaId,
          p_caixa_id: caixa?.id || null
        });

        if (erroEstornoRpc) throw erroEstornoRpc;
      } catch (erroEstorno) {
        logVenda(`Falha ao estornar estoque de ${item.nome}: ${erroEstorno.message}`, "error");
      }
    }

    throw erroBaixa;
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

function limparTituloJogoHistoricoCaixa(descricao) {
  let texto = String(descricao || "Jogo pago").trim();

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

  return texto.trim() || "Jogo pago";
}

// ======================================================
// HISTÓRICO
// ======================================================
function renderHistorico() {
  const box = document.getElementById("historicoList");
  const badge = document.getElementById("badgeVendas");

  if (!box) return;

  if (badge) {
    badge.textContent = `${vendasAtivasCaixa().length} vendas ativas`;
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

    vendas
    .filter(venda => {
      const origem = String(venda.origem || "").toLowerCase();

if (origem !== "agenda") {
  return true;
}

return Number(venda.total || 0) > 0;
    })
    .forEach(venda => {
    const origem = String(venda.origem || "pdv").toLowerCase();
    const cancelada = vendaCanceladaCaixa(venda);

    const origemEhAgenda =
      origem === "agenda" ||
      origem === "agenda_avulso" ||
      origem === "agenda_mensalidade" ||
      origem === "agenda_quinta_semana";

    const icon =
      origem === "comanda"
        ? "ticket"
        : origemEhAgenda
          ? "calendar-check"
          : "shopping-cart";

    const classe =
      origem === "comanda"
        ? "comanda"
        : origemEhAgenda
          ? "agenda"
          : "venda";

    const titulo =
      origem === "comanda"
        ? (venda.descricao || "Comanda fechada")
        : origemEhAgenda
          ? limparTituloJogoHistoricoCaixa(venda.descricao)
          : (venda.descricao || "Venda finalizada");

    const detalhe =
      `${cancelada ? "CANCELADA · " : ""}${String(venda.forma_pagamento || "—").toUpperCase()} · ${formatarDataHoraBrasil(venda.data)}`;

    const item = document.createElement("div");

    item.className = `historico-item${cancelada ? " historico-item-cancelado" : ""}`;

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

  aplicarMascaraMoedaCaixa(
    document.getElementById("movCaixaValor")
  );

document.getElementById("movCaixaTipo")?.addEventListener(
  "change",
  () => {
    atualizarPermissoesFormularioMovimentacoesCaixa();
    atualizarExemploMotivoMovimentacaoCaixa();
  }
);
  const chkUltimoFechamento = document.getElementById("chkUsarUltimoFechamento");
const inputValorInicial = document.getElementById("valorInicial");

if (chkUltimoFechamento && inputValorInicial) {
  chkUltimoFechamento.addEventListener("change", () => {
    if (chkUltimoFechamento.checked && ultimoFechamentoCaixa?.valor_final) {
      const valorFinal = Number(ultimoFechamentoCaixa.valor_final || 0);

      inputValorInicial.value = valorFinal.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      inputValorInicial.disabled = true;
    } else {
      inputValorInicial.disabled = false;
      inputValorInicial.value = "";
      inputValorInicial.focus();
    }
  });
}
  setupCobrancaAvulsaToggle();
  setupAtividadesRecentesToggle();
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

  if (modoPDV === "comanda" && comandaAtiva) {
    fecharComanda();
    return;
  }

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

async function atualizarBadgesModosCaixa() {
  if (!sistemaOnline()) return;

  try {
    const empresaId = obterEmpresaId();
    const permiteComandas = caixaPermiteComandas();
    const permiteJogos = caixaPermiteJogos();

    if (permiteComandas) {
      const { data: comandasAbertas, error: erroComandas } = await sb
        .from("comandas")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("status", "aberta");

      if (erroComandas) throw erroComandas;

      qtdComandasAbertasCaixa = comandasAbertas?.length || 0;
    } else {
      qtdComandasAbertasCaixa = 0;
    }

    if (permiteJogos) {
      await carregarJogosCaixa();

      qtdJogosAbertosCaixa = (jogosCaixa || []).filter(jogo => {
        if (jogoQuitadoCaixa(jogo)) return false;

        const status = calcularStatusJogoCaixa(jogo);

        return status === "andamento" || status === "cobranca";
      }).length;
    } else {
      qtdJogosAbertosCaixa = 0;
    }

    aplicarBadgeModoCaixa("btnModoComanda", qtdComandasAbertasCaixa);
    aplicarBadgeModoCaixa("btnModoJogos", qtdJogosAbertosCaixa);

  } catch (err) {
    console.warn("[CAIXA][BADGES]", err);
  }
}

function aplicarBadgeModoCaixa(botaoId, quantidade) {
  const botao = document.getElementById(botaoId);

  if (!botao) return;

  let badge = botao.querySelector(".modo-alerta-badge");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "modo-alerta-badge";
    botao.appendChild(badge);
  }

  if (quantidade > 0) {
    badge.textContent = quantidade;
    badge.style.display = "flex";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
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

  aplicarVisibilidadeAtalhosContextuaisCaixa();
  atualizarInterfaceModoPDV();
}

async function alterarModoPDV(modo) {

  if (!sistemaOnline() && modo !== "venda") {
    await alertaCaixa(
      "Disponível com conexão",
      "Comandas e jogos ficam temporariamente protegidos durante o modo offline. A Venda rápida continua funcionando normalmente."
    );
    return;
  }

  if (modo === "comanda" && !caixaPermiteComandas()) {
    await alertaCaixa(
      "Módulo indisponível",
      "O atalho de comandas aparece apenas para negócios com esse módulo ativo."
    );
    return;
  }

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
  comandaOculta = false;
  jogoSelecionadoCaixa = null;
  carrinho = [];

    renderCarrinho();
    atualizarInterfaceModoPDV();
    return;
  }

  if (modo === "comanda") {
    btnComanda?.classList.add("active");

    jogoSelecionadoCaixa = null;

    await carregarComandasCaixa({
  forcar: true
});

    atualizarInterfaceModoPDV();

    return;
  }

if (modo === "jogos") {
  btnJogos?.classList.add("active");

  comandaAtiva = null;
  comandaOculta = false;
  jogoSelecionadoCaixa = null;
  carrinho = [];

  renderCarrinho();

  await carregarJogosCaixa();

  atualizarInterfaceModoPDV();
  renderJogosAtivosNoCaixa();

  return;
}
}

function atualizarInterfaceModoPDV() {

  const inputBusca = document.getElementById("inputBusca");
  const comandaCard = document.getElementById("comandaCard");
  const btnFinalizar = document.getElementById("btnFinalizar");

  if (!inputBusca) return;

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

    inputBusca.placeholder = "Buscar produto ou código de barras...";
    inputBusca.focus();

    renderComandasAbertasNoCaixa();
    renderJogosAtivosNoCaixa();

    return;
  }

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

    inputBusca.placeholder = "Selecione um jogo em andamento ou em cobrança...";
    inputBusca.focus();

    renderComandasAbertasNoCaixa();
    renderJogosAtivosNoCaixa();

    return;
  }

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

    inputBusca.placeholder = "Ler ou digitar código da comanda...";
    inputBusca.focus();

    renderComandasAbertasNoCaixa();
    renderJogosAtivosNoCaixa();

    return;
  }

  if (comandaOculta) {
    if (comandaCard) {
      comandaCard.style.display = "none";
    }

    renderComandasAbertasNoCaixa();
    renderJogosAtivosNoCaixa();

    return;
  }

  if (comandaCard) {
    comandaCard.style.display = "flex";
  }

  const codigo = document.getElementById("comandaCodigo");
  const status = document.getElementById("comandaStatus");
  const meta = document.getElementById("comandaMeta");

  if (codigo) {
    codigo.textContent = comandaAtiva.codigo || "—";
  }

  if (status) {
    status.textContent = comandaAtiva.status || "aberta";
  }

  if (meta) {
    const nomeCliente = String(comandaAtiva.nome_cliente || "").trim();
    const observacoes = String(comandaAtiva.observacoes || "").trim();

    if (nomeCliente || observacoes) {
      meta.style.display = "block";

      meta.innerHTML = `
        ${nomeCliente ? `<span><strong>Responsável:</strong> ${nomeCliente}</span>` : ""}
        ${observacoes ? `<span><strong>Origem:</strong> ${observacoes}</span>` : ""}
        <span><strong>Situação:</strong> comanda aberta para consumo</span>
      `;
    } else {
      meta.style.display = "none";
      meta.innerHTML = "";
    }
  }

  if (btnFinalizar) {
    btnFinalizar.onclick = fecharComanda;

    const span = btnFinalizar.querySelector("span");

    if (span) {
      span.textContent = "Fechar Comanda";
    }
  }

  inputBusca.placeholder = "Ler produto para adicionar na comanda...";
  inputBusca.focus();

  renderComandasAbertasNoCaixa();
  renderJogosAtivosNoCaixa();
}

// ======================================================
// RECONCILIAÇÃO DE FALHAS DE JOGOS NO CAIXA ATUAL
// ======================================================
async function verificarJogosPendentesSincronizacaoCaixa() {
  jogosPendentesSincronizacaoCaixa = [];
  removerAvisoSincronizacaoJogosCaixa();

  if (!caixaPermiteJogos()) return;
  if (!caixa || caixa.status !== "aberto" || !sistemaOnline()) return;

  const aberturaCaixa = new Date(caixa.data_abertura || 0);

  if (Number.isNaN(aberturaCaixa.getTime())) return;

  try {
    const { data: jogadoresFalhos, error: erroJogadores } = await sb
      .from("agenda_jogadores")
      .select("id, agenda_id, valor, forma_pagamento, status_pagamento, pago, pago_em, venda_id, removido")
      .eq("empresa_id", obterEmpresaId())
      .eq("pago", true)
      .eq("status_pagamento", STATUS_JOGADOR_CAIXA.PAGO_DIRETO)
      .is("venda_id", null)
      .gte("pago_em", aberturaCaixa.toISOString())
      .limit(1000);

    if (erroJogadores) throw erroJogadores;

    const recebimentosSemVenda = (jogadoresFalhos || []).filter(jogador => {
      return (
        jogador.removido !== true &&
        Boolean(jogador.agenda_id) &&
        Number(jogador.valor || 0) > 0 &&
        String(jogador.forma_pagamento || "").toLowerCase() !== "comanda"
      );
    });

    if (!recebimentosSemVenda.length) {
      return;
    }

    const idsJogos = [
      ...new Set(recebimentosSemVenda.map(jogador => jogador.agenda_id))
    ];

    const { data: jogos, error: erroJogos } = await sb
      .from("agenda")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .in("id", idsJogos);

    if (erroJogos) throw erroJogos;

    jogosPendentesSincronizacaoCaixa = (jogos || []).filter(jogo => {
      return String(jogo.status_jogo || "").toLowerCase() !== "cancelado";
    });

    renderAvisoSincronizacaoJogosCaixa();

  } catch (err) {
    jogosPendentesSincronizacaoCaixa = [];
    removerAvisoSincronizacaoJogosCaixa();
    console.error("[CAIXA][SYNC JOGOS]", err);
  }
}

function renderAvisoSincronizacaoJogosCaixa() {
  removerAvisoSincronizacaoJogosCaixa();

  if (!jogosPendentesSincronizacaoCaixa.length) return;

  const pdvLeft = document.querySelector(".pdv-left");

  if (!pdvLeft) return;

  const aviso = document.createElement("div");
  const quantidade = jogosPendentesSincronizacaoCaixa.length;
  const rotuloCobranca = quantidade === 1
    ? "1 cobrança de jogo precisa"
    : `${quantidade} cobranças de jogos precisam`;

  aviso.className = "card aviso-sync-jogos-caixa";
  aviso.id = "avisoSyncJogosCaixa";

  aviso.innerHTML = `
    <div class="aviso-sync-jogos-caixa-conteudo">
      <i data-lucide="triangle-alert" width="18" height="18"></i>
      <div>
        <strong>
          ${rotuloCobranca} de reconciliação
        </strong>

        <span>
          Uma baixa feita durante este caixa não concluiu a integração com vendas. Nenhum histórico anterior foi considerado.
        </span>
      </div>
    </div>

    <button class="btn-secondary" type="button" id="btnSincronizarJogosPendentes">
      <i data-lucide="refresh-cw" width="15" height="15"></i>
      <span>Reprocessar agora</span>
    </button>
  `;

  pdvLeft.prepend(aviso);

  document
    .getElementById("btnSincronizarJogosPendentes")
    ?.addEventListener("click", sincronizarJogosPendentesCaixa);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function removerAvisoSincronizacaoJogosCaixa() {
  document.getElementById("avisoSyncJogosCaixa")?.remove();
}

async function sincronizarJogosPendentesCaixa() {
  if (!jogosPendentesSincronizacaoCaixa.length) return;

  const confirmar = await abrirConfirmacaoCaixa({
    titulo: "Reprocessar cobranças de jogos",
    mensagem: `
      Reprocessar com segurança
      <strong>${jogosPendentesSincronizacaoCaixa.length}</strong>
      cobrança(s) feita(s) depois da abertura deste caixa?<br><br>
      O processo confere vendas existentes antes de criar ou atualizar os lançamentos.
    `,
    textoConfirmar: "Reprocessar"
  });

  if (!confirmar) return;

  try {
    vendaEmProcessamento = true;

    for (const jogo of jogosPendentesSincronizacaoCaixa) {
      await atualizarVendaAgendaPeloCaixa(jogo);
    }

await carregarDadosSupabase();
await carregarJogosCaixa();
await verificarJogosPendentesSincronizacaoCaixa();
await atualizarBadgesModosCaixa();

renderEstado();
renderHistorico();
renderJogosAtivosNoCaixa();
atualizarInfobar();

    await alertaCaixa(
      "Sincronização concluída",
      "As cobranças foram reconciliadas com caixa, vendas e relatórios."
    );

  } catch (err) {
    console.error(err);

    await alertaCaixa(
      "Erro ao sincronizar",
      err.message || "Não foi possível sincronizar os jogos pendentes."
    );

  } finally {
    vendaEmProcessamento = false;
  }
}

// ======================================================
// AVISO DE FIM DE JOGO NO CAIXA
// ======================================================
function iniciarAvisosFimDeJogoCaixa() {
  if (!caixaPermiteJogos()) {
    return;
  }

  verificarAvisosFimDeJogoCaixa();

  if (intervaloAvisosJogosCaixa) {
    clearInterval(intervaloAvisosJogosCaixa);
  }

intervaloAvisosJogosCaixa = setInterval(async () => {
  if (!caixaPermiteJogos()) return;

  await carregarJogosCaixa();
  verificarAvisosFimDeJogoCaixa();
  await atualizarBadgesModosCaixa();

  if (modoPDV === "jogos") {
    renderJogosAtivosNoCaixa();
  }

}, 15000);
}

function verificarAvisosFimDeJogoCaixa() {
  if (!caixaPermiteJogos()) return;

  const agora = new Date();
  const hoje = new Date().toISOString().slice(0, 10);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  jogosCaixa.forEach(jogo => {
    if (String(jogo.data_agendamento || "").slice(0, 10) !== hoje) return;
    if (jogo.status_jogo === "cancelado") return;

    const inicioMinutos = horaParaMinutosCaixa(jogo.hora_inicio);
    const fimMinutos = horaParaMinutosCaixa(jogo.hora_fim);

    if (!inicioMinutos || !fimMinutos) return;

    if (minutosAgora >= inicioMinutos && minutosAgora <= inicioMinutos + 1) {
      const chave = `${jogo.id}-inicio-caixa`;

      if (!avisosJogosCaixaEmitidos.has(chave)) {
        avisosJogosCaixaEmitidos.add(chave);

        crvToast({
          titulo: "Jogo iniciado",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} começou agora.`,
          tipo: "info",
          tempo: 8000
        });
      }
    }

    const faltam = fimMinutos - minutosAgora;

    if (
      minutosAgora >= inicioMinutos &&
      faltam > 0 &&
      faltam <= 5 &&
      jogo.status_jogo !== "fechado"
    ) {
      const chave = `${jogo.id}-fim-5min-caixa`;

      if (!avisosJogosCaixaEmitidos.has(chave)) {
        avisosJogosCaixaEmitidos.add(chave);

        crvToast({
          titulo: "Jogo quase finalizando",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} termina em ${faltam} minuto(s).`,
          tipo: "warn",
          tempo: 8000
        });
      }
    }

    if (minutosAgora >= fimMinutos && minutosAgora <= fimMinutos + 1 && jogo.status_jogo !== "fechado") {
      const chave = `${jogo.id}-finalizado-caixa`;

      if (!avisosJogosCaixaEmitidos.has(chave)) {
        avisosJogosCaixaEmitidos.add(chave);

        crvToast({
          titulo: "Jogo finalizado",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} finalizou. Verifique a cobrança.`,
          tipo: "warn",
          tempo: 9000
        });
      }
    }
  });
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
  const btnAdicionarAvulso = document.getElementById("btnAdicionarAvulsoJogoCaixa");
  const inputValorAvulso = document.getElementById("novoAvulsoJogoValor");
  const inputValorTotalJogo = document.getElementById("valorTotalJogoCaixa");

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

  if (btnAdicionarAvulso) {
    btnAdicionarAvulso.onclick = async () => {
      try {
        await adicionarAvulsoJogoCaixa();
      } catch (err) {
        console.error("[CAIXA][ADICIONAR AVULSO]", err);
        await alertaCaixa(
          "Não foi possível adicionar",
          err.message || "O jogador não foi incluído."
        );
      }
    };
  }

  if (inputValorAvulso && inputValorAvulso.dataset.mascaraAplicada !== "true") {
    aplicarMascaraMoedaCaixa(inputValorAvulso);
    inputValorAvulso.dataset.mascaraAplicada = "true";
  }

  if (
    inputValorTotalJogo &&
    inputValorTotalJogo.dataset.mascaraAplicada !== "true"
  ) {
    aplicarMascaraMoedaCaixa(inputValorTotalJogo);
    inputValorTotalJogo.dataset.mascaraAplicada = "true";
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

function obterHojeISOCaixa() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

async function gerarOcorrenciasMensaisCaixa(dataAlvo) {
  if (!dataAlvo || !caixaPermiteJogos() || !sistemaOnline()) return;

  const dataReferencia = String(dataAlvo).slice(0, 10);
  const { data: ciclos, error: erroCiclos } = await sb
    .from("agenda_mensalidades")
    .select("id, status, renovacao_status, data_inicio, data_fim")
    .eq("empresa_id", obterEmpresaId())
    .lte("data_inicio", dataReferencia)
    .gte("data_fim", dataReferencia);

  if (erroCiclos) throw erroCiclos;

  for (const ciclo of ciclos || []) {
    if (
      ciclo.status === "cancelado" ||
      ciclo.renovacao_status === "cancelada"
    ) {
      continue;
    }

    const { error } = await sb.rpc("materializar_ciclo_mensal_agenda", {
      p_mensalidade_id: ciclo.id
    });

    if (error) {
      console.warn("[CAIXA][MATERIALIZAR CICLO]", error);
    }
  }

  const { error: erroQuintas } = await sb.rpc(
    "sincronizar_quintas_semanas_agenda"
  );

  if (erroQuintas) {
    console.warn("[CAIXA][5A SEMANA] Sincronizacao indisponivel.", erroQuintas);
  }
}

async function carregarJogosCaixa() {
  const lista = document.getElementById("listaJogosCaixa");

  const modalJogosAberto =
    document.getElementById("modalSelecionarJogo")?.style.display === "flex";

  if (lista && modalJogosAberto) {
    lista.innerHTML = `
      <div class="empty-state">
        <p>Carregando jogos...</p>
      </div>
    `;
  }

  try {
    if (!sistemaOnline()) {
      throw new Error("Sistema offline.");
    }

    await gerarOcorrenciasMensaisCaixa(obterHojeISOCaixa());

    const { data: jogos, error: erroJogos } = await sb
      .from("agenda")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .neq("status_jogo", "cancelado")
      .order("data_agendamento", { ascending: true })
      .order("hora_inicio", { ascending: true })
      .limit(300);

    if (erroJogos) throw erroJogos;

    const { data: mensalidades, error: erroMensalidades } = await sb
      .from("agenda_mensalidades")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .neq("status", "cancelado")
      .order("criado_em", { ascending: false });

    if (erroMensalidades) throw erroMensalidades;

    const { data: cobrancasExtras, error: erroCobrancasExtras } = await sb
      .from("agenda_cobrancas_extras")
      .select("*")
      .eq("empresa_id", obterEmpresaId())
      .eq("tipo", "quinta_semana")
      .neq("status", "cancelado");

    if (erroCobrancasExtras) throw erroCobrancasExtras;

    const idsAgenda = (jogos || []).map(jogo => jogo.id);

    let jogadores = [];

    if (idsAgenda.length) {
      const { data: jogadoresData, error: erroJogadores } = await sb
        .from("agenda_jogadores")
        .select("*")
        .eq("empresa_id", obterEmpresaId())
        .in("agenda_id", idsAgenda)
        .neq("removido", true);

      if (erroJogadores) throw erroJogadores;

      jogadores = jogadoresData || [];
    }

    jogosCaixa = Array.isArray(jogos) ? jogos : [];
    mensalidadesCaixa =
      Array.isArray(mensalidades) ? mensalidades : [];
    cobrancasExtrasCaixa =
      Array.isArray(cobrancasExtras) ? cobrancasExtras : [];
    jogadoresCaixaPorAgenda = agruparJogadoresCaixa(jogadores);

    vinculosComandaJogadorCaixa = {};

    await salvarCacheCaixa("caixa_jogos", jogosCaixa);
    await salvarCacheCaixa("caixa_jogadores_agenda", jogadores);
    await salvarCacheCaixa(
      "caixa_mensalidades_agenda",
      mensalidadesCaixa
    );
    await salvarCacheCaixa(
      "caixa_cobrancas_extras_agenda",
      cobrancasExtrasCaixa
    );

    const idsJogadores = jogadores.map(jogador => jogador.id);

    if (idsJogadores.length) {
      const { data: vinculos, error: erroVinculos } = await sb
        .from("comanda_itens")
        .select(`
          agenda_jogador_id,
          comanda_id,
          comandas (
            codigo,
            status,
            nome_cliente,
            total
          )
        `)
        .eq("empresa_id", obterEmpresaId())
        .in("agenda_jogador_id", idsJogadores);

      if (!erroVinculos) {
        (vinculos || []).forEach(vinculo => {
          if (vinculo.agenda_jogador_id) {
            vinculosComandaJogadorCaixa[vinculo.agenda_jogador_id] = {
              comanda_id: vinculo.comanda_id,
              codigo: vinculo.comandas?.codigo || "—",
              status: vinculo.comandas?.status || "aberta",
              nome_cliente: vinculo.comandas?.nome_cliente || "",
              total: Number(vinculo.comandas?.total || 0)
            };
          }
        });

        await salvarCacheCaixa(
          "caixa_vinculos_comanda_jogador",
          vinculosComandaJogadorCaixa
        );
      }
    }

    if (modalJogosAberto) {
      filtrarJogosCaixa();
    }

  } catch (err) {
    const cacheJogos =
      await obterCacheCaixa("caixa_jogos") || [];

    const cacheJogadores =
      await obterCacheCaixa("caixa_jogadores_agenda") || [];

    const cacheMensalidades =
      await obterCacheCaixa("caixa_mensalidades_agenda") || [];

    const cacheCobrancasExtras =
      await obterCacheCaixa("caixa_cobrancas_extras_agenda") || [];

    const cacheVinculos =
      await obterCacheCaixa("caixa_vinculos_comanda_jogador") || {};

    jogosCaixa = cacheJogos;
    mensalidadesCaixa = cacheMensalidades;
    cobrancasExtrasCaixa = cacheCobrancasExtras;
    jogadoresCaixaPorAgenda = agruparJogadoresCaixa(cacheJogadores);
    vinculosComandaJogadorCaixa = cacheVinculos;

    if (modalJogosAberto) {
      filtrarJogosCaixa();
    }

    if (cacheJogos.length) {
      crvToast({
        titulo: "Jogos offline",
        mensagem: "Os jogos foram carregados do cache local.",
        tipo: "warn"
      });
    } else if (modalJogosAberto) {
      await alertaCaixa(
        "Erro ao carregar jogos",
        "Não foi possível carregar os jogos da agenda."
      );
    }

    console.warn("[CAIXA][JOGOS CACHE]", err);
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
    <div class="empty-state jogo-caixa-empty">
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
    const jogadores =
      jogadoresCobraveisCaixa(jogadoresCaixaPorAgenda[jogo.id] || []);
    const mensalidade = buscarMensalidadeCaixa(jogo);
    const valorMensalidade = Number(mensalidade?.valor || 0);

    const recebido = jogadores
      .filter(jogadorPagoCaixa)
      .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0) +
      (mensalidadePagaCaixa(mensalidade) ? valorMensalidade : 0);

    const pendente = jogadores
      .filter(jogadorPendenteCaixa)
      .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0) +
      (
        mensalidade && !mensalidadePagaCaixa(mensalidade)
          ? valorMensalidade
          : 0
      );

    const textoMensalidade = mensalidade
      ? `Mensalidade ${mensalidadePagaCaixa(mensalidade) ? "paga" : "pendente"}`
      : jogoMensalCaixa(jogo)
        ? "Mensalidade não localizada"
        : "";

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
        ${
          textoMensalidade
            ? `<small>${textoMensalidade}</small>`
            : ""
        }
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

function capturarValoresJogoAtualCaixa() {
  if (!jogoSelecionadoCaixa?.id) return;

  if (!valoresTemporariosJogoCaixa[jogoSelecionadoCaixa.id]) {
    valoresTemporariosJogoCaixa[jogoSelecionadoCaixa.id] = {};
  }

  if (!pagamentosTemporariosJogoCaixa[jogoSelecionadoCaixa.id]) {
    pagamentosTemporariosJogoCaixa[jogoSelecionadoCaixa.id] = {};
  }

  if (!jogadoresSelecionadosTemporariosJogoCaixa[jogoSelecionadoCaixa.id]) {
    jogadoresSelecionadosTemporariosJogoCaixa[jogoSelecionadoCaixa.id] = {};
  }

  document
    .querySelectorAll(".jogo-caixa-jogador-row")
    .forEach(row => {
      const jogadorId = row.dataset.jogadorId;
      const inputValor = row.querySelector(".jogo-caixa-valor-input");
      const selectPagamento = row.querySelector(".jogo-caixa-pagamento");
      const check = row.querySelector(".jogo-caixa-check");

      if (!jogadorId) return;

      if (inputValor) {
        valoresTemporariosJogoCaixa[jogoSelecionadoCaixa.id][jogadorId] =
          normalizarNumero(inputValor.value);
      }

      if (selectPagamento) {
        pagamentosTemporariosJogoCaixa[jogoSelecionadoCaixa.id][jogadorId] =
          selectPagamento.value || "dinheiro";
      }

      if (check && !check.disabled) {
        jogadoresSelecionadosTemporariosJogoCaixa[jogoSelecionadoCaixa.id][jogadorId] =
          check.checked === true;
      }
    });
}

function obterSelecionadoTemporarioJogadorCaixa(jogador) {
  const mapaJogo =
    jogadoresSelecionadosTemporariosJogoCaixa[jogoSelecionadoCaixa?.id] || {};

  return mapaJogo[jogador.id] === true;
}

function obterValorTemporarioJogadorCaixa(jogador) {
  const mapaJogo =
    valoresTemporariosJogoCaixa[jogoSelecionadoCaixa?.id] || {};

  const valorTemporario = mapaJogo[jogador.id];

  if (valorTemporario !== undefined && valorTemporario !== null) {
    return Number(valorTemporario || 0);
  }

  return Number(jogador.valor || 0);
}

function obterPagamentoTemporarioJogadorCaixa(jogador) {
  const mapaJogo =
    pagamentosTemporariosJogoCaixa[jogoSelecionadoCaixa?.id] || {};

  const pagamentoTemporario = mapaJogo[jogador.id];

  if (pagamentoTemporario) {
    return pagamentoTemporario;
  }

  return jogador.forma_pagamento || metodoPagamento || "dinheiro";
}

function montarRateioPendenteJogoCaixa() {
  return [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => {
      const check = row.querySelector(".jogo-caixa-check");
      return check && !check.disabled;
    })
    .map(row => ({
      id: row.dataset.jogadorId,
      valor: normalizarNumero(
        row.querySelector(".jogo-caixa-valor-input")?.value || 0
      ),
      forma_pagamento:
        row.querySelector(".jogo-caixa-pagamento")?.value || "dinheiro"
    }));
}

function validarRateioPendenteJogoCaixa(rateio) {
  if (!Array.isArray(rateio) || !rateio.length) {
    throw new Error("Nenhum jogador pendente foi localizado para o rateio.");
  }

  if (rateio.some(item => !item.id || Number(item.valor || 0) <= 0)) {
    throw new Error(
      "Defina um valor maior que zero para todos os jogadores pendentes."
    );
  }
}

function atualizarRateioLocalJogoCaixa(rateio) {
  const jogoId = jogoSelecionadoCaixa?.id;
  if (!jogoId) return;

  const porId = new Map(
    rateio.map(item => [String(item.id), item])
  );

  (jogadoresCaixaPorAgenda[jogoId] || []).forEach(jogador => {
    const item = porId.get(String(jogador.id));
    if (!item) return;

    jogador.valor = Number(item.valor || 0);
    jogador.forma_pagamento = item.forma_pagamento || "dinheiro";
  });
}

async function salvarRateioPendenteJogoCaixa(rateio = null) {
  if (!jogoSelecionadoCaixa?.id) {
    throw new Error("Jogo não selecionado para salvar o rateio.");
  }

  const rateioAtual = rateio || montarRateioPendenteJogoCaixa();
  validarRateioPendenteJogoCaixa(rateioAtual);

  const { error } = await sb.rpc("salvar_rateio_avulsos_agenda", {
    p_agenda_id: jogoSelecionadoCaixa.id,
    p_rateio: rateioAtual
  });

  if (error) throw error;

  atualizarRateioLocalJogoCaixa(rateioAtual);
  capturarValoresJogoAtualCaixa();

  return rateioAtual;
}

function montarDescricaoJogoComandaCaixa(jogo, jogador) {
  return [
    `Jogo vinculado`,
    jogo.local_recurso || "Quadra/Campo",
    `${formatarDataCaixa(jogo.data_agendamento)} ${formatarHoraCaixa(jogo.hora_inicio)}-${formatarHoraCaixa(jogo.hora_fim)}`,
    jogador.nome || "Jogador"
  ].join(" · ");
}

function normalizarFormaPagamentoAgendaRpcCaixa(formaPagamento) {
  const forma = String(formaPagamento || "dinheiro").toLowerCase();

  if (["debito", "credito", "cartao"].includes(forma)) {
    return "cartao";
  }

  if (["dinheiro", "pix", "misto"].includes(forma)) {
    return forma;
  }

  return "dinheiro";
}

function normalizarNomeJogadorCaixa(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function jogadorResponsavelCaixa(jogador, jogo) {
  const nomeJogador = normalizarNomeJogadorCaixa(jogador?.nome);
  const nomeResponsavel = normalizarNomeJogadorCaixa(jogo?.cliente_nome);

  return Boolean(nomeJogador && nomeResponsavel && nomeJogador === nomeResponsavel);
}

function ordenarJogadoresCobrancaCaixa(jogadores, jogo) {
  return [...jogadores].sort((a, b) => {
    const aResponsavel = jogadorResponsavelCaixa(a, jogo);
    const bResponsavel = jogadorResponsavelCaixa(b, jogo);

    if (aResponsavel && !bResponsavel) return -1;
    if (!aResponsavel && bResponsavel) return 1;

    return String(a?.nome || "").localeCompare(
      String(b?.nome || ""),
      "pt-BR",
      { numeric: true, sensitivity: "base" }
    );
  });
}

async function adicionarAvulsoJogoCaixa() {
  if (!sistemaOnline()) {
    await alertaCaixa(
      "Adição disponível com conexão",
      "Nenhum jogador foi adicionado. Tente novamente quando o sistema estiver online."
    );
    return;
  }

  if (!jogoSelecionadoCaixa?.id) {
    await alertaCaixa("Jogo não selecionado", "Abra um jogo antes de adicionar o avulso.");
    return;
  }

  if (["fechado", "cancelado"].includes(String(jogoSelecionadoCaixa.status_jogo || ""))) {
    await alertaCaixa(
      "Jogo encerrado",
      "Jogadores não podem ser adicionados pelo Caixa depois do fechamento ou cancelamento."
    );
    return;
  }

  const inputNome = document.getElementById("novoAvulsoJogoNome");
  const inputValor = document.getElementById("novoAvulsoJogoValor");
  const selectTime = document.getElementById("novoAvulsoJogoTime");

  const nome = formatarNomeComandaCaixa(inputNome?.value.trim() || "");
  const valor = normalizarNumero(inputValor?.value || 0);
  const timeJogador = selectTime?.value || null;

  if (!nome) {
    await alertaCaixa("Nome obrigatório", "Informe o nome do jogador avulso.");
    inputNome?.focus();
    return;
  }

  if (valor <= 0) {
    await alertaCaixa("Valor obrigatório", "Informe um valor de cobrança maior que zero.");
    inputValor?.focus();
    return;
  }

  const jogadoresAtuais = (jogadoresCaixaPorAgenda[jogoSelecionadoCaixa.id] || [])
    .filter(jogador => jogador.removido !== true);

  if (jogadoresAtuais.some(jogador => {
    return String(jogador.nome || "").trim().toLowerCase() === nome.toLowerCase();
  })) {
    await alertaCaixa(
      "Jogador já listado",
      "Já existe um jogador ativo com esse nome neste jogo."
    );
    return;
  }

  const jogoId = jogoSelecionadoCaixa.id;
  const { error } = await sb
    .from("agenda_jogadores")
    .insert([{
      empresa_id: obterEmpresaId(),
      agenda_id: jogoId,
      nome,
      time_jogador: timeJogador,
      valor,
      pago: false,
      forma_pagamento: null,
      status_pagamento: STATUS_JOGADOR_CAIXA.PENDENTE,
      pago_em: null,
      removido: false,
      origem_jogador: "avulso",
      mensalista: false,
      cobrar_no_jogo: true
    }]);

  if (error) throw error;

  if (inputNome) inputNome.value = "";
  if (inputValor) inputValor.value = "";
  if (selectTime) selectTime.value = "";

  await carregarJogosCaixa();
  abrirFinalizacaoJogoCaixa(jogoId);

  crvToast({
    titulo: "Avulso adicionado",
    mensagem: `${nome} entrou somente neste jogo e já está disponível para cobrança.`,
    tipo: "success"
  });
}

async function removerAvulsoJogoCaixa(jogadorId) {
  const jogoId = jogoSelecionadoCaixa?.id;
  const jogador = (jogadoresCaixaPorAgenda[jogoId] || []).find(item => {
    return String(item.id) === String(jogadorId);
  });

  if (!jogoId || !jogador) return;

  if (
    jogadorPagoCaixa(jogador) ||
    jogadorEmComandaCaixa(jogador) ||
    jogador.venda_id ||
    jogador.comanda_id
  ) {
    await alertaCaixa(
      "Jogador já vinculado",
      "Este avulso possui pagamento ou comanda e não pode ser removido."
    );
    return;
  }

  const confirmou = await abrirConfirmacaoCaixa({
    titulo: "Remover avulso",
    mensagem: `Remover <strong>${jogador.nome || "este jogador"}</strong> somente deste jogo?`,
    textoConfirmar: "Remover jogador"
  });

  if (!confirmou) return;

  const { error } = await sb
    .from("agenda_jogadores")
    .update({
      removido: true,
      removido_em: new Date().toISOString(),
      motivo_remocao: "Removido pelo Caixa antes da cobrança",
      atualizado_em: new Date().toISOString()
    })
    .eq("id", jogador.id)
    .eq("agenda_id", jogoId)
    .eq("empresa_id", obterEmpresaId());

  if (error) throw error;

  await carregarJogosCaixa();
  abrirFinalizacaoJogoCaixa(jogoId);

  crvToast({
    titulo: "Avulso removido",
    mensagem: "A remoção afetou somente esta ocorrência.",
    tipo: "info"
  });
}

function abrirFinalizacaoJogoCaixa(jogoId) {
  const jogo = jogosCaixa.find(item => String(item.id) === String(jogoId));

  if (!jogo) {
    alertaCaixa(
      "Jogo não encontrado",
      "Não foi possível localizar este jogo."
    );
    return;
  }

  jogoSelecionadoCaixa = jogo;

  const todosJogadores = ordenarJogadoresCobrancaCaixa(
    (jogadoresCaixaPorAgenda[jogo.id] || [])
      .filter(jogador => jogador.removido !== true),
    jogo
  );

  const jogadores = jogadoresCobraveisCaixa(todosJogadores);
  const mensalistasIncluidos =
    todosJogadores.filter(jogadorMensalistaIsentoCaixa);
  const qtdMensalistas = mensalistasIncluidos.length;
  const mensalidade = buscarMensalidadeCaixa(jogo);
  const cobrancaQuinta = buscarCobrancaQuintaSemanaCaixa(jogo);
  const ehMensal = jogoMensalCaixa(jogo);
  const mensalidadePaga = mensalidadePagaCaixa(mensalidade);
  const quintaPaga = cobrancaQuintaSemanaPagaCaixa(cobrancaQuinta);
  const valorMensalidade = Number(mensalidade?.valor || 0);
  const valorQuinta = Number(cobrancaQuinta?.valor || 0);
  const jogadoresPendentes = jogadores.filter(jogadorPendenteCaixa);
  const temCobrancaIndividualPendente = jogadoresPendentes.length > 0;

  const modal = document.getElementById("modalFinalizarJogoCaixa");
  const titulo = document.getElementById("finalizarJogoTitulo");
  const subtitulo = document.getElementById("finalizarJogoSubtitulo");
  const painelMensalidade = document.getElementById("jogoCaixaMensalidade");
  const painelQuinta = document.getElementById("jogoCaixaQuintaSemana");
  const painelMensalistas = document.getElementById("jogoCaixaMensalistasIncluidos");
  const painelAdicionarAvulso = document.getElementById("jogoCaixaAdicionarAvulso");
  const resumo = document.getElementById("jogoCaixaResumo");
  const lista = document.getElementById("jogoCaixaJogadores");
  const rateio = document.querySelector(
    "#modalFinalizarJogoCaixa .jogo-caixa-rateio"
  );
  const totalizador = document.querySelector(
    "#modalFinalizarJogoCaixa .jogo-caixa-totalizador"
  );
  const btnConfirmar = document.getElementById("btnConfirmarFinalizarJogo");

  const recebido = jogadores
    .filter(jogadorPagoCaixa)
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0) +
    (mensalidadePaga ? valorMensalidade : 0) +
    (quintaPaga ? valorQuinta : 0);

  const pendente = jogadores
    .filter(jogadorPendenteCaixa)
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0) +
    (mensalidade && !mensalidadePaga ? valorMensalidade : 0) +
    (cobrancaQuinta && !quintaPaga ? valorQuinta : 0);

  if (titulo) {
    titulo.textContent = `Jogo - ${jogo.local_recurso || "Quadra/Campo"}`;
  }

  if (subtitulo) {
    subtitulo.textContent = ehMensal
      ? `${formatarDataCaixa(jogo.data_agendamento)} · ${formatarHoraCaixa(jogo.hora_inicio)} até ${formatarHoraCaixa(jogo.hora_fim)} · ${jogo.cliente_nome || "Responsável"} · Receba a mensalidade do horário e, separadamente, apenas convidados ou suplentes avulsos.`
      : `${formatarDataCaixa(jogo.data_agendamento)} · ${formatarHoraCaixa(jogo.hora_inicio)} até ${formatarHoraCaixa(jogo.hora_fim)} · ${jogo.cliente_nome || "Responsável"} · Marque apenas quem está pagando agora.`;
  }

  if (painelMensalidade) {
    if (!ehMensal) {
      painelMensalidade.style.display = "none";
      painelMensalidade.innerHTML = "";
    } else if (!mensalidade) {
      painelMensalidade.style.display = "flex";
      painelMensalidade.className =
        "jogo-caixa-mensalidade mensalidade-nao-localizada";
      painelMensalidade.innerHTML = `
        <div class="jogo-caixa-mensalidade-info">
          <span class="jogo-caixa-mensalidade-rotulo">
            Mensalidade do horário
          </span>
          <strong>Registro mensal não localizado</strong>
          <small>
            Confira a mensalidade deste mês na Agenda. Nenhum valor foi criado
            ou alterado pelo Caixa.
          </small>
        </div>
      `;
    } else {
      painelMensalidade.style.display = "flex";
      painelMensalidade.className =
        `jogo-caixa-mensalidade ${mensalidadePaga ? "mensalidade-paga" : "mensalidade-pendente"}`;
      painelMensalidade.innerHTML = `
        <div class="jogo-caixa-mensalidade-info">
          <span class="jogo-caixa-mensalidade-rotulo">
            Mensalidade do horário · ${formatarCompetenciaCaixa(mensalidade.competencia)}
          </span>
          <strong>${fmt(valorMensalidade)}</strong>
          <small>
            ${qtdMensalistas}
            mensalista${qtdMensalistas !== 1 ? "s" : ""}
            · responsável: ${jogo.cliente_nome || "não informado"}
          </small>
        </div>

        <div class="jogo-caixa-mensalidade-acao">
          <span class="jogo-caixa-mensalidade-status">
            ${mensalidadePaga ? "Pago" : "Pendente"}
          </span>

          ${
            mensalidadePaga
              ? ""
              : `
                <button
                  class="btn-secondary"
                  type="button"
                  id="btnReceberMensalidadeJogo"
                >
                  <i data-lucide="wallet-cards" width="15" height="15"></i>
                  <span>Receber mensalidade</span>
                </button>
              `
          }
        </div>
      `;

      document
        .getElementById("btnReceberMensalidadeJogo")
        ?.addEventListener("click", () => {
          receberMensalidadeJogoCaixa(jogo.id, mensalidade.id);
        });
    }
  }

  if (painelQuinta) {
    if (!cobrancaQuinta) {
      painelQuinta.style.display = "none";
      painelQuinta.innerHTML = "";
    } else {
      painelQuinta.style.display = "flex";
      painelQuinta.className =
        `jogo-caixa-mensalidade jogo-caixa-quinta-semana ${quintaPaga ? "mensalidade-paga" : "mensalidade-pendente"}`;
      painelQuinta.innerHTML = `
        <div class="jogo-caixa-mensalidade-info">
          <span class="jogo-caixa-mensalidade-rotulo">5ª semana · cobrança separada</span>
          <strong>${fmt(valorQuinta)}</strong>
          <small>Este valor não altera a mensalidade nem a cobrança dos avulsos.</small>
        </div>
        <div class="jogo-caixa-mensalidade-acao">
          <span class="jogo-caixa-mensalidade-status">
            ${quintaPaga ? "Pago" : "Pendente"}
          </span>
          ${
            quintaPaga
              ? ""
              : `
                <button class="btn-secondary" type="button" id="btnReceberQuintaSemanaJogo">
                  <i data-lucide="wallet-cards" width="15" height="15"></i>
                  <span>Receber 5ª semana</span>
                </button>
              `
          }
        </div>
      `;

      document
        .getElementById("btnReceberQuintaSemanaJogo")
        ?.addEventListener("click", () => {
          receberQuintaSemanaJogoCaixa(jogo.id, cobrancaQuinta.id);
        });
    }
  }

  if (painelMensalistas) {
    if (!ehMensal || !mensalistasIncluidos.length) {
      painelMensalistas.style.display = "none";
      painelMensalistas.innerHTML = "";
    } else {
      painelMensalistas.style.display = "block";
      painelMensalistas.innerHTML = `
        <div class="jogo-caixa-mensalistas-header">
          <div>
            <strong>Mensalistas incluídos neste horário</strong>
            <small>
              ${mensalidadePaga
                ? "Mensalidade do ciclo paga: nenhuma nova cobrança nestes jogadores."
                : "A lista está incluída no ciclo; receba a mensalidade uma única vez acima."}
            </small>
          </div>
          <span>${qtdMensalistas} jogador${qtdMensalistas !== 1 ? "es" : ""}</span>
        </div>
        <div class="jogo-caixa-mensalistas-lista">
          ${mensalistasIncluidos.map(jogador => `
            <span class="jogo-caixa-mensalista-chip ${mensalidadePaga ? "pago" : "pendente"}">
              <i data-lucide="${mensalidadePaga ? "badge-check" : "clock-3"}" width="13" height="13"></i>
              ${jogador.nome || "Mensalista"}
            </span>
          `).join("")}
        </div>
      `;
    }
  }

  if (painelAdicionarAvulso) {
    const jogoEncerrado = ["fechado", "cancelado"].includes(
      String(jogo.status_jogo || "").toLowerCase()
    );
    painelAdicionarAvulso.style.display = jogoEncerrado ? "none" : "block";
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
        <span>${ehMensal ? "Avulsos extras" : "Jogadores"}</span>
        <strong>${jogadores.length}</strong>
      </div>
    `;
  }

  const inputRateio = document.getElementById("valorTotalJogoCaixa");
  const btnRateio = document.getElementById("btnAplicarRateioJogo");

  if (rateio) {
    rateio.style.display = temCobrancaIndividualPendente ? "grid" : "none";
  }

  if (totalizador) {
    totalizador.style.display =
      temCobrancaIndividualPendente ? "flex" : "none";
  }

  if (btnConfirmar) {
    btnConfirmar.style.display =
      temCobrancaIndividualPendente ? "inline-flex" : "none";
  }

  if (inputRateio) {
    const totalPendenteRateio = jogadoresPendentes.reduce((acc, item) => {
      return acc + Number(item.valor || 0);
    }, 0);

    // Depois que o rateio foi salvo, o campo passa a refletir somente o
    // saldo dos jogadores ainda pendentes. Isso impede redistribuir o valor
    // integral do jogo novamente após um pagamento parcial ou uma comanda.
    const totalPrevisto = totalPendenteRateio > 0
      ? totalPendenteRateio
      : Number(jogo.valor_total || jogo.valor_previsto || 0);

    inputRateio.value = totalPrevisto > 0
      ? totalPrevisto.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      : "";
  }

  if (btnRateio) {
    btnRateio.onclick = aplicarRateioJogoCaixa;
  }

  if (lista) {
    if (!jogadores.length) {
      lista.innerHTML = `
        <div class="empty-state jogo-caixa-sem-avulsos">
          <i data-lucide="${ehMensal ? "users-round" : "user-x"}" width="22" height="22"></i>
          <p>
            ${
              ehMensal
                ? "Nenhum convidado ou suplente avulso foi lançado. A mensalidade do horário é recebida acima."
                : "Nenhum jogador lançado neste jogo."
            }
          </p>
        </div>
      `;
    } else {
      lista.innerHTML = jogadores.map(jogador => {
        const statusPagamento = statusPagamentoJogadorCaixa(jogador);
        const pago = jogadorPagoCaixa(jogador);
        const emComanda = jogadorEmComandaCaixa(jogador);
        const bloqueado = pago || emComanda;

        const valorAtual = obterValorTemporarioJogadorCaixa(jogador);
        const formaAtual = obterPagamentoTemporarioJogadorCaixa(jogador);
        const vinculoComanda = vinculosComandaJogadorCaixa[jogador.id] || null;

        let textoStatus = "";

        if (statusPagamento === STATUS_JOGADOR_CAIXA.EM_COMANDA) {
          textoStatus = ` · em comanda ${vinculoComanda?.codigo || "—"}`;
        }

        if (statusPagamento === STATUS_JOGADOR_CAIXA.PAGO_DIRETO) {
          textoStatus = ` · pago direto`;
        }

        if (statusPagamento === STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA) {
          textoStatus = ` · pago em comanda ${vinculoComanda?.codigo || "—"}`;
        }

        const ehResponsavel = jogadorResponsavelCaixa(jogador, jogo);

        return `
          <div class="jogo-caixa-jogador-row ${bloqueado ? "pago" : ""}" data-jogador-id="${jogador.id}">
            <input
              type="checkbox"
              class="jogo-caixa-check"
              ${bloqueado ? "disabled" : ""}
              ${!bloqueado && obterSelecionadoTemporarioJogadorCaixa(jogador) ? "checked" : ""}
            >

            <div class="jogo-caixa-jogador-nome">
              <span class="jogo-caixa-jogador-texto">
                ${jogador.nome || "Jogador"}${textoStatus}
              </span>
              ${ehResponsavel ? `<span class="jogo-caixa-responsavel-badge">Responsável</span>` : ""}
            </div>

            <input
              class="input jogo-caixa-valor-input"
              value="${Number(valorAtual || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}"
              ${bloqueado ? "disabled" : ""}
            >

            <select class="input jogo-caixa-pagamento" ${bloqueado ? "disabled" : ""}>
              <option value="dinheiro" ${formaAtual === "dinheiro" ? "selected" : ""}>Dinheiro</option>
              <option value="debito" ${formaAtual === "debito" || formaAtual === "cartao" ? "selected" : ""}>Débito</option>
              <option value="credito" ${formaAtual === "credito" ? "selected" : ""}>Crédito</option>
              <option value="pix" ${formaAtual === "pix" ? "selected" : ""}>PIX</option>
              ${formaAtual === "misto" ? `<option value="misto" selected>Misto</option>` : ""}
              ${formaAtual === "comanda" ? `<option value="comanda" selected>Comanda</option>` : ""}
            </select>

            <button
              class="btn-ghost jogo-caixa-btn-comanda ${emComanda || statusPagamento === STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA ? "vinculado" : ""}"
              type="button"
              data-jogador-id="${jogador.id}"
              ${bloqueado ? "disabled" : ""}
            >
              <i data-lucide="ticket" width="14" height="14"></i>
              <span>${emComanda || statusPagamento === STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA ? "Vinculado" : "Comanda"}</span>
            </button>

            <button
              class="btn-ghost jogo-caixa-btn-remover"
              type="button"
              data-jogador-id="${jogador.id}"
              title="Remover avulso deste jogo"
              aria-label="Remover ${jogador.nome || "jogador"} deste jogo"
              ${bloqueado ? "disabled" : ""}
            >
              <i data-lucide="trash-2" width="14" height="14"></i>
            </button>
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

  document
    .querySelectorAll(".jogo-caixa-valor-input")
    .forEach(input => {
      aplicarMascaraMoedaCaixa(input, atualizarTotalSelecionadoJogoCaixa);
    });

  document
    .querySelectorAll(".jogo-caixa-btn-comanda")
    .forEach(btn => {
      btn.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        await prepararEnvioJogadorParaComandaCaixa(btn.dataset.jogadorId);
      });
    });

  document
    .querySelectorAll(".jogo-caixa-btn-remover")
    .forEach(btn => {
      btn.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        try {
          await removerAvulsoJogoCaixa(btn.dataset.jogadorId);
        } catch (err) {
          console.error("[CAIXA][REMOVER AVULSO]", err);
          await alertaCaixa(
            "Não foi possível remover",
            err.message || "O jogador não foi alterado."
          );
        }
      });
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
  const painelMensalidade = document.getElementById("jogoCaixaMensalidade");
  const painelMensalistas = document.getElementById("jogoCaixaMensalistasIncluidos");

  if (modal) {
    modal.style.display = "none";
  }

  if (painelMensalidade) {
    painelMensalidade.style.display = "none";
    painelMensalidade.innerHTML = "";
  }

  if (painelMensalistas) {
    painelMensalistas.style.display = "none";
    painelMensalistas.innerHTML = "";
  }

  jogoSelecionadoCaixa = null;
}

async function aplicarRateioJogoCaixa() {
  const inputRateio = document.getElementById("valorTotalJogoCaixa");
  const btnRateio = document.getElementById("btnAplicarRateioJogo");
  const btnConfirmar = document.getElementById("btnConfirmarFinalizarJogo");

  const totalJogo = normalizarNumero(inputRateio?.value || 0);

  const totalParaRatear = totalJogo;

  const linhasPendentes = [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => {
      const check = row.querySelector(".jogo-caixa-check");
      return check && !check.disabled;
    });

  if (totalJogo <= 0 || !linhasPendentes.length) {
    await alertaCaixa(
      "Rateio inválido",
      "Informe o valor total do jogo e mantenha pelo menos um jogador pendente."
    );
    return;
  }

  if (totalParaRatear <= 0) {
    await alertaCaixa(
      "Rateio concluído",
      "Todo o valor do jogo já foi enviado para comanda ou recebido."
    );
    return;
  }

  const totalCentavos = Math.round(totalParaRatear * 100);
  // As linhas exibidas já contêm somente cobranças individuais válidas.
  const qtd = linhasPendentes.length;

  const baseCentavos = Math.floor(totalCentavos / qtd);
  let restoCentavos = totalCentavos - (baseCentavos * qtd);

  linhasPendentes.forEach(row => {
    const inputValor = row.querySelector(".jogo-caixa-valor-input");
    const check = row.querySelector(".jogo-caixa-check");

    let valorCentavos = baseCentavos;

    if (restoCentavos > 0) {
      valorCentavos += 1;
      restoCentavos -= 1;
    }

    const valorFinal = valorCentavos / 100;

    if (inputValor) {
      inputValor.value = valorFinal.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (check) {
      check.checked = true;
    }
  });

  atualizarTotalSelecionadoJogoCaixa();

  if (btnRateio) btnRateio.disabled = true;
  if (btnConfirmar) btnConfirmar.disabled = true;

  try {
    await salvarRateioPendenteJogoCaixa();

    crvToast({
      titulo: "Rateio salvo",
      mensagem: "Os valores individuais permanecerão no jogo até a quitação.",
      tipo: "success",
      tempo: 5000
    });
  } catch (err) {
    console.error("[CAIXA][RATEIO JOGO]", err);
    await alertaCaixa(
      "Não foi possível salvar o rateio",
      err.message || "Os valores individuais não foram alterados."
    );
  } finally {
    if (btnRateio) btnRateio.disabled = false;
    if (btnConfirmar) btnConfirmar.disabled = false;
  }
}

function atualizarTotalSelecionadoJogoCaixa() {
  const totalEl = document.getElementById("jogoCaixaTotalSelecionado");

  const total = [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => row.querySelector(".jogo-caixa-check")?.checked)
    .reduce((acc, row) => {
      const valorInput = row.querySelector(".jogo-caixa-valor-input");

      return acc + normalizarNumero(valorInput?.value || 0);
    }, 0);

  if (totalEl) {
    totalEl.textContent = fmt(total);
  }

  return total;
}

async function prepararEnvioJogadorParaComandaCaixa(jogadorId) {
  const painelMensalistas = document.getElementById(
    "jogoCaixaMensalistasIncluidos"
  );

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Jogos disponíveis com conexão",
      "O envio para comanda não foi realizado. Use a Venda rápida enquanto estiver offline."
    );
    return;
  }

  if (painelMensalistas) {
    painelMensalistas.style.display = "none";
    painelMensalistas.innerHTML = "";
  }

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Caixa fechado",
      "Abra o caixa antes de enviar jogador para comanda."
    );
    return;
  }

  if (!jogoSelecionadoCaixa?.id) {
    await alertaCaixa(
      "Jogo não selecionado",
      "Selecione um jogo para vincular o jogador à comanda."
    );
    return;
  }

  capturarValoresJogoAtualCaixa();

  const row = document.querySelector(
    `.jogo-caixa-jogador-row[data-jogador-id="${jogadorId}"]`
  );

  if (!row) {
    await alertaCaixa(
      "Jogador não encontrado",
      "Não foi possível localizar a linha do jogador."
    );
    return;
  }

  const jogadores = jogadoresCaixaPorAgenda[jogoSelecionadoCaixa.id] || [];

  const jogador = jogadores.find(item => {
    return String(item.id) === String(jogadorId);
  });

  if (!jogador) {
    await alertaCaixa(
      "Jogador não encontrado",
      "Não foi possível localizar este jogador na agenda."
    );
    return;
  }

  const vinculoExistente = vinculosComandaJogadorCaixa[jogador.id];

  if (vinculoExistente) {
    await alertaCaixa(
      "Jogador já vinculado",
      `
        <strong>${jogador.nome || "Jogador"}</strong> já está vinculado à
        comanda <strong>${vinculoExistente.codigo || "—"}</strong>.
      `
    );
    return;
  }

  if (jogador.pago === true) {
    await alertaCaixa(
      "Jogador já pago",
      "Este jogador já foi marcado como pago."
    );
    return;
  }

  const valorCobrado = normalizarNumero(
    row.querySelector(".jogo-caixa-valor-input")?.value || jogador.valor || 0
  );

  if (valorCobrado <= 0) {
    await alertaCaixa(
      "Valor inválido",
      "Informe um valor válido antes de enviar para comanda."
    );
    return;
  }

  try {
    await salvarRateioPendenteJogoCaixa();
  } catch (err) {
    console.error("[CAIXA][RATEIO ANTES DA COMANDA]", err);
    await alertaCaixa(
      "Rateio não salvo",
      err.message ||
        "Os valores individuais precisam ser salvos antes de vincular a comanda."
    );
    return;
  }

  jogadorComandaPendenteCaixa = {
    jogo: jogoSelecionadoCaixa,
    jogador,
    valorCobrado
  };

  const modalFinalizarJogo = document.getElementById("modalFinalizarJogoCaixa");

  if (modalFinalizarJogo) {
    modalFinalizarJogo.style.display = "none";
  }

  const modalComanda = document.getElementById("modalSelecionarComanda");

  if (modalComanda) {
    modalComanda.style.zIndex = "650";
  }

  await abrirModalSelecionarComanda();
}

async function finalizarEnvioJogadorParaComandaCaixa(comanda) {
  if (!sistemaOnline()) {
    await alertaCaixa(
      "Jogos disponíveis com conexão",
      "O envio para comanda não foi realizado. A operação online foi preservada."
    );
    return;
  }

  if (!jogadorComandaPendenteCaixa?.jogo?.id || !jogadorComandaPendenteCaixa?.jogador?.id) {
    jogadorComandaPendenteCaixa = null;
    return;
  }

  const empresaId = obterEmpresaId();
  const jogo = jogadorComandaPendenteCaixa.jogo;
  const jogador = jogadorComandaPendenteCaixa.jogador;
  const valorCobrado = Number(jogadorComandaPendenteCaixa.valorCobrado || 0);

  const descricaoJogo = montarDescricaoJogoComandaCaixa(jogo, jogador);
  const itemNome = `Jogo - ${jogador.nome || "Jogador"}`;

  const { data: itemDuplicado, error: erroBuscaItem } = await sb
    .from("comanda_itens")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("agenda_jogador_id", jogador.id)
    .limit(1);

  if (erroBuscaItem) throw erroBuscaItem;

  if (itemDuplicado?.length) {
    jogadorComandaPendenteCaixa = null;

    await carregarJogosCaixa();

    await alertaCaixa(
      "Item já enviado",
      "Este jogador já está vinculado a uma comanda."
    );

    return;
  }

  const { data: itemComandaCriado, error: erroItem } = await sb
    .from("comanda_itens")
    .insert([
      {
        empresa_id: empresaId,
        comanda_id: comanda.id,
        produto_id: null,
        nome: itemNome,
        preco: valorCobrado,
        preco_custo: 0,
        quantidade: 1,
        total: valorCobrado,
        origem: "agenda",
        origem_id: jogo.id,
        agenda_id: jogo.id,
        agenda_jogador_id: jogador.id,
        operador_id: obterOperadorAtualId()
      }
    ])
    .select("id")
    .single();

  if (erroItem) throw erroItem;

  const { error: erroJogador } = await sb
    .from("agenda_jogadores")
.update({
  valor: valorCobrado,
  pago: false,
  forma_pagamento: "comanda",
  status_pagamento: STATUS_JOGADOR_CAIXA.EM_COMANDA,
  comanda_id: comanda.id,
  pago_em: null,
  atualizado_em: new Date().toISOString()
})
    .eq("id", jogador.id)
    .eq("empresa_id", empresaId);

  if (erroJogador) {
    await sb
      .from("comanda_itens")
      .delete()
      .eq("id", itemComandaCriado.id)
      .eq("empresa_id", empresaId);

    throw erroJogador;
  }

  await atualizarResumoAgendaAposComandaCaixa(jogo.id);

  const { data: itensComanda, error: erroItensComanda } = await sb
    .from("comanda_itens")
    .select("total")
    .eq("empresa_id", empresaId)
    .eq("comanda_id", comanda.id);

  if (erroItensComanda) throw erroItensComanda;

  const totalComanda = (itensComanda || []).reduce((acc, item) => {
    return acc + Number(item.total || 0);
  }, 0);

  const { data: comandaAtualizada, error: erroAtualizarComanda } = await sb
    .from("comandas")
    .update({
      status: "aberta",
      nome_cliente: comanda.nome_cliente || jogador.nome || null,
      observacoes: descricaoJogo,
      total: totalComanda,
      data_abertura: comanda.data_abertura || new Date().toISOString()
    })
    .eq("id", comanda.id)
    .eq("empresa_id", empresaId)
    .select("*")
    .single();

  if (erroAtualizarComanda) throw erroAtualizarComanda;

  vinculosComandaJogadorCaixa[jogador.id] = {
    comanda_id: comandaAtualizada.id,
    codigo: comandaAtualizada.codigo || "—",
    status: comandaAtualizada.status || "aberta",
    nome_cliente: comandaAtualizada.nome_cliente || "",
    total: Number(comandaAtualizada.total || 0)
  };

  if (jogadoresSelecionadosTemporariosJogoCaixa[jogo.id]) {
    jogadoresSelecionadosTemporariosJogoCaixa[jogo.id][jogador.id] = false;
  }

  jogadorComandaPendenteCaixa = null;

  const modalComanda = document.getElementById("modalSelecionarComanda");

  if (modalComanda) {
    modalComanda.style.display = "none";
    modalComanda.style.zIndex = "";
  }

  await carregarComandasCaixa({ forcar: true });
  await carregarJogosCaixa();
  await verificarJogosPendentesSincronizacaoCaixa();
  await atualizarBadgesModosCaixa();

  jogoSelecionadoCaixa =
    jogosCaixa.find(item => String(item.id) === String(jogo.id)) || jogo;

  const modalFinalizarJogo = document.getElementById("modalFinalizarJogoCaixa");

  if (modalFinalizarJogo) {
    modalFinalizarJogo.style.display = "flex";
  }

  abrirFinalizacaoJogoCaixa(jogo.id);

  await alertaCaixa(
    "Jogador vinculado à comanda",
    `
      <strong>${jogador.nome || "Jogador"}</strong> foi vinculado à
      comanda <strong>${comandaAtualizada.codigo || "—"}</strong>.<br><br>
      A comanda ficou aberta para consumo.
    `
  );
}

async function atualizarResumoAgendaAposComandaCaixa(agendaId) {
  const { data: jogadores, error } = await sb
    .from("agenda_jogadores")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("agenda_id", agendaId);

  if (error) throw error;

  const lista = jogadores || [];

  // Mensalistas isentos não entram na contagem de cobrança
  const listaCobravel = jogadoresCobraveisCaixa(lista);

  const pagos = listaCobravel.filter(jogador => jogadorPagoCaixa(jogador));
  const emComanda = listaCobravel.filter(jogador => jogadorEmComandaCaixa(jogador));
  const pendentes = listaCobravel.filter(jogador => jogadorPendenteCaixa(jogador));

  const totalPago = pagos.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalPendente = pendentes.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  // Jogo fecha quando todos os cobráveis pagaram (mensalistas isentos ignorados)
  const statusJogo =
    listaCobravel.length > 0 &&
    pendentes.length === 0 &&
    (totalPago > 0 || emComanda.length > 0)
      ? "fechado"
      : "cobranca";

  const { error: erroAgenda } = await sb
    .from("agenda")
    .update({
      status_jogo: statusJogo,
      total_jogadores: lista.length,
      quantidade_pendente_jogadores: pendentes.length,
      quantidade_paga_jogadores: pagos.length,
      quantidade_comanda_jogadores: emComanda.length,
      total_pago_jogadores: totalPago,
      total_pendente_jogadores: totalPendente,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", agendaId)
    .eq("empresa_id", obterEmpresaId());

  if (erroAgenda) throw erroAgenda;
}

async function confirmarPagamentoJogoCaixa() {
  if (!sistemaOnline()) {
    await alertaCaixa(
      "Jogos disponíveis com conexão",
      "O recebimento do jogo não foi alterado. Use a Venda rápida para vendas comuns offline."
    );
    return;
  }

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

  const jogadores =
    jogadoresCaixaPorAgenda[jogoSelecionadoCaixa.id] || [];

  const linhasSelecionadas =
    [...document.querySelectorAll(".jogo-caixa-jogador-row")]
      .filter(row => row.querySelector(".jogo-caixa-check")?.checked);

  if (!linhasSelecionadas.length) {
    await alertaCaixa(
      "Nenhum pagamento selecionado",
      "Selecione pelo menos um jogador pendente."
    );
    return;
  }

  const pagamentos = linhasSelecionadas.map(row => {
    const jogadorId = row.dataset.jogadorId;

    const formaPagamento =
      row.querySelector(".jogo-caixa-pagamento")?.value ||
      metodoPagamento ||
      "dinheiro";

    const valorCobrado = normalizarNumero(
      row.querySelector(".jogo-caixa-valor-input")?.value || 0
    );

    return {
      jogadorId,
      formaPagamento,
      valorCobrado
    };
  });

  if (pagamentos.some(pagamento => pagamento.valorCobrado <= 0)) {
    await alertaCaixa(
      "Valor inválido",
      "Informe um valor maior que zero para todos os jogadores selecionados."
    );
    return;
  }

  let rateioPendente;

  try {
    rateioPendente = montarRateioPendenteJogoCaixa();
    validarRateioPendenteJogoCaixa(rateioPendente);
  } catch (err) {
    await alertaCaixa(
      "Rateio incompleto",
      err.message || "Revise os valores individuais antes de confirmar."
    );
    return;
  }

const totalSelecionado = atualizarTotalSelecionadoJogoCaixa();

// Mensalistas isentos não entram na contagem de cobrança
const jogadoresCobrarveis = jogadores.filter(j => !jogadorMensalistaIsentoCaixa(j));

const jogadoresEmComanda = jogadoresCobrarveis.filter(jogador => {
  return jogadorEmComandaCaixa(jogador);
}).length;

const jogadoresPendentesAposPagamento =
  jogadoresCobrarveis.length -
  linhasSelecionadas.length -
  jogadoresEmComanda -
  jogadoresCobrarveis.filter(jogador => jogadorPagoCaixa(jogador)).length;

const pagamentoParcial =
  jogadoresPendentesAposPagamento > 0 || jogadoresEmComanda > 0;

const confirmar = await abrirConfirmacaoCaixa({
  titulo: pagamentoParcial
    ? "Confirmar pagamento parcial"
    : "Confirmar pagamento final do jogo",

  mensagem: pagamentoParcial
    ? `
      Confirmar pagamento parcial de
      <strong>${fmt(totalSelecionado)}</strong>
      para este jogo?<br><br>

      ${linhasSelecionadas.length} jogador(es) serão marcados como pagos agora.<br>
      ${jogadoresEmComanda} jogador(es) estão em comanda.<br>
      ${Math.max(0, jogadoresPendentesAposPagamento)} jogador(es) continuarão pendentes.<br><br>

      O jogo continuará em cobrança até todos pagarem ou as comandas vinculadas serem fechadas.
    `
    : `
      Confirmar pagamento final de
      <strong>${fmt(totalSelecionado)}</strong>
      para este jogo?<br><br>

      Após confirmar, o jogo será finalizado e entrará nas atividades recentes.
    `,

  textoConfirmar: pagamentoParcial
    ? "Confirmar parcial"
    : "Confirmar pagamento"
});

  if (!confirmar) return;

  try {
    vendaEmProcessamento = true;

    // A RPC detalhada salva o rateio completo e recebe apenas os marcados
    // na mesma transação. Pendentes mantêm o valor e cada pago mantém sua
    // própria forma, enquanto a venda agregada continua alimentando caixa,
    // atividades, vendas e relatórios como antes.
    const { data: recebimento, error: erroRecebimento } = await sb.rpc(
      "receber_avulsos_agenda_detalhado",
      {
        p_agenda_id: jogoSelecionadoCaixa.id,
        p_rateio: rateioPendente,
        p_jogadores_ids: pagamentos.map(pagamento => pagamento.jogadorId),
        p_caixa_id: caixa.id,
        p_operador_id: obterOperadorAtualId(),
        p_valor_recebido: totalSelecionado
      }
    );

    if (erroRecebimento) throw erroRecebimento;

    await carregarDadosSupabase();
    await carregarJogosCaixa();

    renderEstado();
    renderHistorico();
    atualizarInfobar();

const jogoIdFinalizado = jogoSelecionadoCaixa.id;

fecharModalFinalizarJogoCaixa();
fecharModalSelecionarJogo();

const jogadoresAtualizados = jogadoresCobraveisCaixa(
  jogadoresCaixaPorAgenda[jogoIdFinalizado] || []
);

const pendentesAgora = jogadoresAtualizados.filter(jogador =>
  jogadorPendenteCaixa(jogador)
).length;

const emComandaAgora = jogadoresAtualizados.filter(jogador =>
  jogadorEmComandaCaixa(jogador)
).length;

if (pendentesAgora > 0 || emComandaAgora > 0) {
  await alertaCaixa(
    "Pagamento parcial confirmado",
    `
      Pagamento parcial lançado.<br><br>
      Ainda falta(m) <strong>${pendentesAgora}</strong> jogador(es) pendente(s).<br>
      <strong>${emComandaAgora}</strong> jogador(es) seguem em comanda.<br><br>
      O jogo continuará em cobrança até a quitação total.
    `
  );
} else {
  await alertaCaixa(
    "Jogo finalizado",
    `Pagamento de <strong>${fmt(Number(recebimento?.valor || totalSelecionado))}</strong> lançado no caixa, vendas e relatórios.`
  );
}

    await alterarModoPDV("jogos");

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

  const jogadores = jogadoresCobraveisCaixa(jogadoresAtualizados || []);

  const pagosDiretos = jogadores.filter(jogador => {
    return (
      statusPagamentoJogadorCaixa(jogador) === STATUS_JOGADOR_CAIXA.PAGO_DIRETO &&
      Number(jogador.valor || 0) > 0
    );
  });

  const pagosComanda = jogadores.filter(jogador => {
    return (
      statusPagamentoJogadorCaixa(jogador) === STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA &&
      Number(jogador.valor || 0) > 0
    );
  });

  const emComanda = jogadores.filter(jogador => {
    return (
      statusPagamentoJogadorCaixa(jogador) === STATUS_JOGADOR_CAIXA.EM_COMANDA &&
      Number(jogador.valor || 0) > 0
    );
  });

  const pendentes = jogadores.filter(jogador => jogadorPendenteCaixa(jogador));

  const totalPagoDireto = pagosDiretos.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalPagoComanda = pagosComanda.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalEmComanda = emComanda.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalPendente = pendentes.reduce((acc, jogador) => {
    return acc + Number(jogador.valor || 0);
  }, 0);

  const totalPagoAgenda = totalPagoDireto + totalPagoComanda;

  const statusJogo =
    jogadores.length > 0 &&
    pendentes.length === 0 &&
    (totalPagoAgenda > 0 || totalEmComanda > 0)
      ? "fechado"
      : "cobranca";

  const { error: erroAgenda } = await sb
    .from("agenda")
    .update({
      status_jogo: statusJogo,
      total_jogadores: jogadores.length,
      quantidade_pendente_jogadores: pendentes.length,
      quantidade_paga_jogadores: pagosDiretos.length + pagosComanda.length,
      quantidade_comanda_jogadores: emComanda.length,
      total_pago_jogadores: totalPagoAgenda,
      total_pendente_jogadores: totalPendente,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", jogo.id)
    .eq("empresa_id", obterEmpresaId());

  if (erroAgenda) throw erroAgenda;

  if (!pagosDiretos.length) {
    return;
  }

  const formasUnicas = [
    ...new Set(
      pagosDiretos
        .map(jogador => jogador.forma_pagamento)
        .filter(Boolean)
    )
  ];

  const formaPagamento =
    formasUnicas.length === 1
      ? formasUnicas[0]
      : "misto";

const { data: vendaExistente, error: erroBuscaVenda } = await sb
  .from("vendas")
  .select("id")
  .eq("empresa_id", obterEmpresaId())
  .eq("agenda_id", jogo.id)
  .in("origem", ["agenda", "agenda_avulso"])
  .order("data", { ascending: false })
  .limit(1)
  .maybeSingle();

  if (erroBuscaVenda) throw erroBuscaVenda;

  let vendaId = vendaExistente?.id || null;

  const textoComanda =
    emComanda.length || pagosComanda.length
      ? ` · Comanda: ${[...emComanda, ...pagosComanda].map(jogador => {
          return `${jogador.nome || "Jogador"} ${fmt(jogador.valor || 0)}`;
        }).join(", ")}`
      : "";

const descricao =
`${jogo.tipo_jogo === "mensalista" ? "Jogo mensal" : "Jogo avulso"} - ${jogo.local_recurso || "Quadra/Campo"} - ${jogo.cliente_nome || "Responsável"} | Direto: ${pagosDiretos.length} jogador${pagosDiretos.length !== 1 ? "es" : ""} · Comanda: ${(emComanda.length + pagosComanda.length)} jogador${(emComanda.length + pagosComanda.length) !== 1 ? "es" : ""}`;

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
        subtotal: totalPagoAgenda,
        desconto: 0,
        total: totalPagoAgenda,
        forma_pagamento: formaPagamento || metodoPagamento,
        troco: 0,
        origem: "agenda",
        origem_id: jogo.id,
        agenda_id: jogo.id,
        descricao: descricao,
        data: new Date().toISOString(),
        operador_id: obterOperadorAtualId()
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
        subtotal: totalPagoAgenda,
        desconto: 0,
        total: totalPagoAgenda,
        forma_pagamento: formaPagamento || metodoPagamento,
        troco: 0,
        origem: "agenda",
        origem_id: jogo.id,
        agenda_id: jogo.id,
        descricao: descricao,
        data: new Date().toISOString(),
        operador_id: obterOperadorAtualId()
      }])
      .select("id")
      .single();

    if (erroVendaNova) throw erroVendaNova;

    vendaId = vendaNova.id;
  }

  const jogadoresParaVenda = [
  ...pagosDiretos,
  ...pagosComanda
];

const itensPayload = jogadoresParaVenda.map(jogador => ({
    empresa_id: obterEmpresaId(),
    venda_id: vendaId,
    produto_id: null,
    nome: `Pagamento direto jogo - ${jogador.nome || "Jogador"}`,
    preco: Number(jogador.valor || 0),
    preco_custo: 0,
    lucro_unitario: Number(jogador.valor || 0),
    lucro_total: Number(jogador.valor || 0),
    quantidade: 1,
    origem: "agenda",
    origem_id: jogo.id,
    agenda_id: jogo.id,
    agenda_jogador_id: jogador.id
  }));

  if (itensPayload.length) {
    const { error: erroItens } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (erroItens) throw erroItens;
  }

const { error: erroMarcarVendaJogadores } = await sb
  .from("agenda_jogadores")
  .update({
    venda_id: vendaId,
    atualizado_em: new Date().toISOString()
  })
  .eq("empresa_id", obterEmpresaId())
  .eq("agenda_id", jogo.id)
  .in("status_pagamento", [
    STATUS_JOGADOR_CAIXA.PAGO_DIRETO,
    STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA
  ]);

  if (erroMarcarVendaJogadores) {
    throw erroMarcarVendaJogadores;
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

function renderComandasAbertasNoCaixa() {
  let box = document.getElementById("comandasAbertasCaixa");

  const comandaCard = document.getElementById("comandaCard");

  if (!comandaCard) return;

  if (!box) {
    box = document.createElement("div");
    box.id = "comandasAbertasCaixa";
    box.className = "comandas-abertas-caixa";
    comandaCard.insertAdjacentElement("beforebegin", box);
  }

  if (modoPDV !== "comanda") {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const abertas = comandasCaixa.filter(comanda => {
    return String(comanda.status || "").toLowerCase() === "aberta";
  });

  if (!abertas.length) {
    box.style.display = "block";

    box.innerHTML = `
      <div class="comandas-abertas-header">
        <span>Comandas abertas</span>

        <div class="comandas-abertas-actions">
          <small>0 abertas</small>

          <button
            type="button"
            class="btn-abrir-modal-comandas"
            id="btnAbrirModalComandasCaixa"
          >
            Ver todas
          </button>
        </div>
      </div>

      <div class="comandas-abertas-lista">
        <div class="comandas-abertas-empty">
          Nenhuma comanda aberta no momento.
        </div>
      </div>
    `;

    document
      .getElementById("btnAbrirModalComandasCaixa")
      ?.addEventListener("click", async () => {
        await abrirModalSelecionarComanda();
      });

    return;
  }

  box.style.display = "block";

  box.innerHTML = `
    <div class="comandas-abertas-header">
      <span>Comandas abertas</span>

      <div class="comandas-abertas-actions">
        <small>${abertas.length} aberta${abertas.length === 1 ? "" : "s"}</small>

        <button
          type="button"
          class="btn-abrir-modal-comandas"
          id="btnAbrirModalComandasCaixa"
        >
          Ver todas
        </button>
      </div>
    </div>

    <div class="comandas-abertas-lista">
      ${abertas.map(comanda => `
        <button
          type="button"
          class="comanda-aberta-item ${comandaAtiva?.id === comanda.id ? "active" : ""}"
          data-comanda-id="${comanda.id}"
        >
          <strong class="comanda-aberta-codigo">
            ${comanda.codigo || "—"}
          </strong>

          <span class="comanda-aberta-cliente">
            ${comanda.nome_cliente || "Sem identificação"}
          </span>

          <span class="comanda-aberta-total">
            ${fmt(comanda.total || 0)}
          </span>
        </button>
      `).join("")}
    </div>
  `;

  box.querySelectorAll(".comanda-aberta-item").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.comandaId;

      const comanda = abertas.find(item => {
        return String(item.id) === String(id);
      });

      if (!comanda) return;

      comandaAtiva = comanda;
      comandaOculta = false;

      await carregarItensComanda();

      atualizarInterfaceModoPDV();
      renderComandasAbertasNoCaixa();
    };
  });

    document
    .getElementById("btnAbrirModalComandasCaixa")
    ?.addEventListener("click", async () => {
      await abrirModalSelecionarComanda();
    });
}

function renderJogosAtivosNoCaixa() {
  const box = document.getElementById("jogosAtivosCaixa");

  if (!box) return;

  if (modoPDV !== "jogos") {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

const jogosAtivos = jogosCaixa.filter(jogo => {
  if (jogoQuitadoCaixa(jogo)) return false;

  const status = calcularStatusJogoCaixa(jogo);

  return (
    status === "andamento" ||
    status === "cobranca"
  );
});

  box.style.display = "block";

  if (!jogosAtivos.length) {
    box.innerHTML = `
      <div class="jogos-ativos-header">
        <span>Jogos em andamento / cobrança</span>

        <div class="jogos-ativos-actions">
          <small>0 ativos</small>

          <button
            type="button"
            class="btn-abrir-modal-comandas"
            id="btnAbrirModalJogosCaixa"
          >
            Ver todos
          </button>
        </div>
      </div>

      <div class="jogos-ativos-lista">
        <div class="jogos-ativos-empty">
          Nenhum jogo em andamento ou cobrança.
        </div>
      </div>
    `;

    document
      .getElementById("btnAbrirModalJogosCaixa")
      ?.addEventListener("click", abrirModalSelecionarJogo);

    return;
  }

  box.innerHTML = `
    <div class="jogos-ativos-header">
      <span>Jogos em andamento / cobrança</span>

      <div class="jogos-ativos-actions">
        <small>
          ${jogosAtivos.length}
          ativo${jogosAtivos.length > 1 ? "s" : ""}
        </small>

        <button
          type="button"
          class="btn-abrir-modal-comandas"
          id="btnAbrirModalJogosCaixa"
        >
          Ver todos
        </button>
      </div>
    </div>

    <div class="jogos-ativos-lista">

      ${jogosAtivos.map(jogo => {

        const status = calcularStatusJogoCaixa(jogo);
        const todosJogadores =
          jogadoresCaixaPorAgenda[jogo.id] || [];
        const jogadores =
          jogadoresCobraveisCaixa(todosJogadores);
        const qtdMensalistas =
          todosJogadores.filter(jogadorMensalistaIsentoCaixa).length;
        const mensalidade = buscarMensalidadeCaixa(jogo);
        const ehMensal = jogoMensalCaixa(jogo);
        const mensalidadePaga = mensalidadePagaCaixa(mensalidade);
        const valorMensalidade = Number(mensalidade?.valor || 0);

        const pagos = jogadores.filter(jogadorPagoCaixa);
        const emComanda = jogadores.filter(jogadorEmComandaCaixa);
        const pendentes = jogadores.filter(jogadorPendenteCaixa);

        const valorPendente =
          pendentes.reduce((acc, j) => {
            return acc + Number(j.valor || 0);
          }, 0) +
          (
            mensalidade && !mensalidadePaga
              ? valorMensalidade
              : 0
          );

        let statusVisual = status;
        let textoStatus = status;

        if (ehMensal && !mensalidade) {
          statusVisual = "cobranca";
          textoStatus = "mensalidade não localizada";
        } else if (ehMensal && !mensalidadePaga) {
          statusVisual = pagos.length > 0 ? "parcial" : "cobranca";
          textoStatus = "mensalidade pendente";
        } else if (ehMensal && pendentes.length > 0) {
          statusVisual = "parcial";
          textoStatus = "avulsos pendentes";
        } else if (ehMensal && emComanda.length > 0) {
          statusVisual = "parcial";
          textoStatus = "avulsos em comanda";
        } else if (
          status === "cobranca" &&
          pagos.length > 0 &&
          pendentes.length > 0
        ) {
          statusVisual = "parcial";
          textoStatus = "pagamento parcial";
        }

        const detalhesPagamento = ehMensal
          ? `
              <span>
                ${qtdMensalistas}
                mensalista${qtdMensalistas !== 1 ? "s" : ""}
              </span>

              <span>
                ${pendentes.length}
                avulso${pendentes.length !== 1 ? "s" : ""} pendente${pendentes.length !== 1 ? "s" : ""}
              </span>

              <span>
                Mensalidade ${mensalidadePaga ? "paga" : "pendente"}
              </span>
            `
          : `
              <span>
                ${pagos.length} pago${pagos.length !== 1 ? "s" : ""}
              </span>

              <span>
                ${pendentes.length} pendente${pendentes.length !== 1 ? "s" : ""}
              </span>

              <span>
                ${emComanda.length} comanda
              </span>
            `;

        return `
          <button
            type="button"
            class="jogo-ativo-item ${statusVisual}"
            data-jogo-id="${jogo.id}"
          >

            <div class="jogo-ativo-top">
              <strong>
                ${jogo.local_recurso || "Quadra"}
              </strong>

              <span class="jogo-ativo-status ${statusVisual}">
                ${textoStatus}
              </span>
            </div>

            <div class="jogo-ativo-middle">
              ${jogo.cliente_nome || "Responsável"}
            </div>

            <div class="jogo-ativo-bottom">

              ${detalhesPagamento}

              <strong>
                ${fmt(valorPendente)}
              </strong>

            </div>

          </button>
        `;
      }).join("")}

    </div>
  `;

  box.querySelectorAll(".jogo-ativo-item")
    .forEach(btn => {

      btn.addEventListener("click", () => {
        abrirFinalizacaoJogoCaixa(
          btn.dataset.jogoId
        );
      });

    });

  document
    .getElementById("btnAbrirModalJogosCaixa")
    ?.addEventListener("click", abrirModalSelecionarJogo);
}

async function abrirModalSelecionarComanda() {
  if (!sistemaOnline()) {
    await alertaCaixa(
      "Comandas disponíveis com conexão",
      "As comandas não serão abertas ou alteradas no modo offline nesta etapa."
    );
    return;
  }

  const modal = document.getElementById("modalSelecionarComanda");
  const inputBusca = document.getElementById("inputBuscaModalComanda");

  if (modal) {
    modal.style.display = "flex";
  }

  if (inputBusca) {
    inputBusca.value = "";
  }

await carregarComandasCaixa({
  forcar: true,
  mostrarLoading: true
});

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
    modal.style.zIndex = "";
  }

  if (jogadorComandaPendenteCaixa) {
    const modalFinalizarJogo = document.getElementById("modalFinalizarJogoCaixa");

    if (modalFinalizarJogo) {
      modalFinalizarJogo.style.display = "flex";
    }

    jogadorComandaPendenteCaixa = null;
  }

  const inputBusca = document.getElementById("inputBusca");

  if (inputBusca) {
    inputBusca.focus();
  }
}

async function carregarComandasCaixa(opcoes = {}) {
  const forcar = opcoes.forcar === true;
  const mostrarLoading = opcoes.mostrarLoading === true;

  const agora = Date.now();

  if (
    !forcar &&
    comandasCaixa.length &&
    agora - ultimaCargaComandasCaixa < 2500
  ) {
    return;
  }

  if (carregandoComandasCaixa) {
    return;
  }

  carregandoComandasCaixa = true;

  const lista = document.getElementById("listaComandasCaixa");

  if (lista && mostrarLoading) {
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
    ultimaCargaComandasCaixa = Date.now();

    await salvarCacheCaixa(
      "caixa_comandas",
      comandasCaixa
    );

  } catch (err) {
    const cacheComandas =
      await obterCacheCaixa("caixa_comandas") || [];

    comandasCaixa = cacheComandas;
    ultimaCargaComandasCaixa = Date.now();

    if (!comandasCaixa.length) {
      await alertaCaixa(
        "Erro ao carregar comandas",
        "Não foi possível carregar as comandas disponíveis."
      );
    } else {
      crvToast({
        titulo: "Comandas offline",
        mensagem: "As comandas foram carregadas do cache local.",
        tipo: "warn"
      });
    }

    console.error(err);

  } finally {
    carregandoComandasCaixa = false;
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

${comanda.observacoes ? `
  <span class="comanda-caixa-origem">
    ${comanda.observacoes}
  </span>
` : ""}
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

function formatarNomeComandaCaixa(valor) {
  const manterMinusculo = ["da", "de", "do", "das", "dos", "e"];

  return String(valor || "")
    .toLowerCase()
    .split(" ")
    .map((parte, index) => {
      if (!parte) return "";

      if (index > 0 && manterMinusculo.includes(parte)) {
        return parte;
      }

      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(" ");
}

function abrirModalIdentificacaoComandaCaixa(comanda) {
  return new Promise(resolve => {
    let modal = document.getElementById("modalIdentificarComandaCaixa");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modalIdentificarComandaCaixa";
      modal.className = "modal-overlay";
      modal.style.display = "none";

      modal.innerHTML = `
        <div class="modal modal-identificar-comanda">
          <div class="modal-header">
            <div>
              <h2 id="tituloIdentificarComanda">Identificar Comanda</h2>
              <p class="modal-subtitle">
                Informe um nome, apelido ou referência para localizar rápido depois.
              </p>
            </div>

            <button class="modal-close" type="button" id="btnFecharIdentificarComanda">
              <i data-lucide="x" width="20" height="20"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="input-group">
              <label class="input-label">Identificação</label>
              <input
                type="text"
                class="input"
                id="inputIdentificacaoComanda"
                placeholder="Ex: André, Mesa 3, Camisa azul..."
                autocomplete="off"
              >
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" type="button" id="btnAbrirSemIdentificacao">
              Abrir sem identificação
            </button>

            <button class="btn-primary" type="button" id="btnConfirmarIdentificacaoComanda">
              Abrir Comanda
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    }

    const titulo = document.getElementById("tituloIdentificarComanda");
    const input = document.getElementById("inputIdentificacaoComanda");
    const btnFechar = document.getElementById("btnFecharIdentificarComanda");
    const btnSemIdentificacao = document.getElementById("btnAbrirSemIdentificacao");
    const btnConfirmar = document.getElementById("btnConfirmarIdentificacaoComanda");

    if (titulo) {
      titulo.textContent = `Abrir Comanda ${comanda?.codigo || "—"}`;
    }

if (input) {
  input.value = "";

  input.oninput = () => {
    const posicao = input.selectionStart;
    input.value = formatarNomeComandaCaixa(input.value);
    input.setSelectionRange(posicao, posicao);
  };
}

    modal.style.display = "flex";

    const fechar = valor => {
      modal.style.display = "none";

      btnFechar.onclick = null;
      btnSemIdentificacao.onclick = null;
      btnConfirmar.onclick = null;
      input.oninput = null;

      resolve(valor);
    };

    btnFechar.onclick = () => fechar(null);
    btnSemIdentificacao.onclick = () => fechar("");
    btnConfirmar.onclick = () => fechar(String(input?.value || "").trim());

    input.onkeydown = event => {
      if (event.key === "Enter") {
        event.preventDefault();
        fechar(String(input.value || "").trim());
      }
    };

    setTimeout(() => {
      input?.focus();
    }, 80);

    if (window.lucide) {
      lucide.createIcons();
    }
  });
}

async function selecionarComandaCaixa(comanda) {
  if (!comanda?.id) return;

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "As comandas não serão alteradas até a conexão voltar. Use a Venda rápida."
    );
    return;
  }

  try {
    let comandaOperacional = comanda;

    if (!sistemaOnline()) {
      if (comanda.status === "livre") {
        let identificacao = "";

        if (!jogadorComandaPendenteCaixa) {
          identificacao = await abrirModalIdentificacaoComandaCaixa(comanda);

          if (identificacao === null) {
            return;
          }
        }

        comandaOperacional = {
          ...comanda,
          status: "aberta",
          nome_cliente: identificacao || null,
          data_abertura: new Date().toISOString(),
          total: Number(comanda.total || 0),
          offline: true
        };

        const index = comandasCaixa.findIndex(item => {
          return String(item.id) === String(comanda.id);
        });

        if (index >= 0) {
          comandasCaixa[index] = comandaOperacional;
        }

        await salvarCacheCaixa("caixa_comandas", comandasCaixa);

        await salvarOffline({
          tabela: "comandas",
          operacao: "update",
          payload: comandaOperacional
        });
      }

      if (jogadorComandaPendenteCaixa) {
        await finalizarEnvioJogadorParaComandaCaixa(comandaOperacional);
        return;
      }

      comandaAtiva = comandaOperacional;
      comandaOculta = false;

      await carregarItensComanda();

      fecharModalSelecionarComanda();

      atualizarInterfaceModoPDV();
      renderComandasAbertasNoCaixa();

      return;
    }

    if (comanda.status === "livre") {
      let identificacao = "";

      if (!jogadorComandaPendenteCaixa) {
        identificacao = await abrirModalIdentificacaoComandaCaixa(comanda);

        if (identificacao === null) {
          return;
        }
      }

      const { data, error } = await sb
        .from("comandas")
        .update({
          status: "aberta",
          nome_cliente: identificacao || null,
          data_abertura: new Date().toISOString()
        })
        .eq("id", comanda.id)
        .eq("empresa_id", obterEmpresaId())
        .select("*")
        .single();

      if (error) throw error;

      comandaOperacional = data;
    }

    if (jogadorComandaPendenteCaixa) {
      await finalizarEnvioJogadorParaComandaCaixa(comandaOperacional);
      return;
    }

    comandaAtiva = comandaOperacional;
    comandaOculta = false;

    await carregarItensComanda();

    fecharModalSelecionarComanda();

    atualizarInterfaceModoPDV();
    await atualizarBadgesModosCaixa();

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
      await alertaCaixa(
        "Item não encontrado",
        "Item não encontrado."
      );

      if (input) {
        input.value = "";
        input.focus();
      }

      return;
    }

    if (produto.ativo !== true) {
      await alertaCaixa(
        "Item inativo",
        `Item inativo: <strong>${produto.nome}</strong>`
      );

      return;
    }

    const estoque = Number(produto.estoque || 0);

    if (itemControlaEstoqueCaixa(produto) && estoque <= 0) {
      await alertaCaixa(
        "Sem estoque",
        `Item sem estoque: <strong>${produto.nome}</strong>`
      );

      return;
    }

    const preco =
      Number(produto.preco || 0);

    if (preco <= 0) {
      await alertaCaixa(
        "Preço inválido",
        `Item sem preço válido: <strong>${produto.nome}</strong>`
      );

      return;
    }

    if (modoPDV === "comanda" && comandaAtiva) {
      await adicionarProdutoNaComanda(produto);
    } else {
      await adicionarCarrinho(produto);
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

    await alertaCaixa(
      "Erro na leitura",
      "Erro ao processar leitura."
    );
  }
}

// ======================================================
// LEITOR COMANDA
// ======================================================
async function processarLeituraComanda(codigoLido) {

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "A comanda não foi aberta. Use a Venda rápida enquanto estiver sem conexão."
    );
    return;
  }

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
        await abrirConfirmacaoCaixa({
          titulo: "Criar comanda",
          mensagem: `
            Comanda <strong>${codigo}</strong> não existe.<br><br>
            Deseja criar agora?
          `,
          textoConfirmar: "Criar comanda"
        });

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

const identificacao = await abrirModalIdentificacaoComandaCaixa(comanda);

if (identificacao === null) {
  if (input) {
    input.value = "";
    input.focus();
  }

  return;
}

const { data: aberta, error: erroAbrir } =
  await sb
    .from("comandas")
    .update({
      status: "aberta",
      nome_cliente: identificacao || null,
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

      await alertaCaixa(
        "Comanda fechada",
        `Comanda <strong>${codigo}</strong> já está fechada.`
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
    comandaOculta = false;

    await carregarItensComanda();

    atualizarInterfaceModoPDV();

    if (input) {
      input.value = "";
      input.focus();
    }

  } catch (err) {

    console.error(err);

    await alertaCaixa(
      "Erro ao carregar comanda",
      "Erro ao carregar comanda."
    );
  }
}

// ======================================================
// ITENS DA COMANDA
// ======================================================
async function adicionarProdutoNaComanda(produto) {
  if (!comandaAtiva?.id) {
    await alertaCaixa(
      "Comanda",
      "Nenhuma comanda ativa."
    );
    return;
  }

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "Este item não foi adicionado à comanda. Use a Venda rápida enquanto estiver sem conexão."
    );
    return;
  }

  const preco = normalizarNumero(produto.preco);
  const estoque = Number(produto.estoque || 0);
  const controlaEstoque = itemControlaEstoqueCaixa(produto);

  if (preco <= 0) {
    await alertaCaixa(
      "Preço inválido",
      `Item sem preço válido: <strong>${produto.nome}</strong>`
    );
    return;
  }

  if (controlaEstoque && estoque <= 0) {
    await alertaCaixa(
      "Sem estoque",
      `Item sem estoque: <strong>${produto.nome}</strong>`
    );
    return;
  }

  if (!sistemaOnline()) {
    const existente = carrinho.find(item => {
      return String(item.id) === String(produto.id);
    });

    if (existente) {
      const novaQtd = Number(existente.quantidade || 0) + 1;

      if (controlaEstoque && novaQtd > estoque) {
        await alertaCaixa(
          "Estoque insuficiente",
          `Estoque insuficiente para <strong>${produto.nome}</strong>.<br><br>Disponível: ${estoque}`
        );
        return;
      }

      existente.quantidade = novaQtd;
    } else {
      carrinho.push({
        id: produto.id,
        comanda_item_id: "offline-item-" + Date.now(),
        nome: produto.nome,
        preco: preco,
        preco_custo: Number(produto.preco_custo || 0),
        quantidade: 1,
        produto_manual: false,
        tipo_item: tipoItemProdutoCaixa(produto),
        controla_estoque: controlaEstoque,
        origem: "pdv",
        origem_id: null,
        agenda_jogador_id: null,
        offline: true
      });
    }

    const total = calcularSubtotalCarrinho();

    comandaAtiva = {
      ...comandaAtiva,
      status: "aberta",
      total: total
    };

    const indexComanda = comandasCaixa.findIndex(item => {
      return String(item.id) === String(comandaAtiva.id);
    });

    if (indexComanda >= 0) {
      comandasCaixa[indexComanda] = {
        ...comandasCaixa[indexComanda],
        ...comandaAtiva
      };
    }

    await salvarCacheCaixa(
      `caixa_comanda_itens_${comandaAtiva.id}`,
      carrinho
    );

    await salvarCacheCaixa("caixa_comandas", comandasCaixa);

    await salvarOffline({
      tabela: "comanda_itens",
      operacao: "insert",
      payload: carrinho.map(item => ({
        empresa_id: obterEmpresaId(),
        comanda_id: comandaAtiva.id,
        produto_id: item.produto_manual ? null : item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        preco_custo: Number(item.preco_custo || 0),
        quantidade: Number(item.quantidade || 0),
        total: Number(item.preco || 0) * Number(item.quantidade || 0),
        origem: item.origem || "pdv",
        origem_id: item.origem_id || null,
        agenda_jogador_id: item.agenda_jogador_id || null
      }))
    });

    renderCarrinho();
    atualizarInterfaceModoPDV();
    renderComandasAbertasNoCaixa();

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
    await alertaCaixa(
      "Erro na comanda",
      "Erro ao verificar item da comanda."
    );
    console.error(erroBusca);
    return;
  }

  const existente = itemExistente?.[0] || null;

  if (existente) {
    const novaQtd = Number(existente.quantidade || 0) + 1;

    if (controlaEstoque && novaQtd > estoque) {
      await alertaCaixa(
        "Estoque insuficiente",
        `Estoque insuficiente para <strong>${produto.nome}</strong>.<br><br>Disponível: ${estoque}`
      );
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
      await alertaCaixa(
        "Erro na comanda",
        "Erro ao atualizar item da comanda."
      );
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
          total: preco,
          origem: "pdv",
          origem_id: null,
          agenda_jogador_id: null,
          operador_id: obterOperadorAtualId()
        }
      ]);

    if (erroInsert) {
      await alertaCaixa(
        "Erro na comanda",
        "Erro ao adicionar item na comanda."
      );
      console.error(erroInsert);
      return;
    }
  }

  await carregarItensComanda({
    atualizarTotalBanco: true
  });

  renderComandasAbertasNoCaixa();
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

  if (!sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "A cobrança não foi adicionada à comanda. Use a Venda rápida enquanto estiver sem conexão."
    );
    return;
  }

  try {
    const total = Number(preco || 0) * Number(quantidade || 1);

    if (!sistemaOnline()) {
      carrinho.push({
        id: "manual-" + Date.now(),
        comanda_item_id: "offline-item-" + Date.now(),
        nome,
        preco: Number(preco || 0),
        preco_custo: 0,
        quantidade: Number(quantidade || 1),
        produto_manual: true,
        origem: "pdv",
        origem_id: null,
        agenda_jogador_id: null,
        operador_id: obterOperadorAtualId(),
        offline: true
      });

      comandaAtiva.total = calcularSubtotalCarrinho();

      await salvarCacheCaixa(
        `caixa_comanda_itens_${comandaAtiva.id}`,
        carrinho
      );

      await salvarCacheCaixa("caixa_comandas", comandasCaixa);

      renderCarrinho();
      atualizarInterfaceModoPDV();
      renderComandasAbertasNoCaixa();

      return;
    }

    const empresaId = obterEmpresaId();

    const { error } = await sb
      .from("comanda_itens")
      .insert([{
        empresa_id: empresaId,
        comanda_id: comandaAtiva.id,
        produto_id: null,
        nome,
        preco: Number(preco || 0),
        preco_custo: 0,
        quantidade: Number(quantidade || 1),
        total,
        origem: "pdv",
        origem_id: null,
        agenda_jogador_id: null
      }]);

    if (error) throw error;

    await carregarItensComanda({
      atualizarTotalBanco: true
    });

    renderComandasAbertasNoCaixa();

  } catch (err) {
    await alertaCaixa(
      "Erro na comanda",
      "Não foi possível adicionar o item manual na comanda."
    );

    console.error(err);
  }
}

async function carregarItensComanda(opcoes = {}) {
  if (!comandaAtiva?.id) return;

  const atualizarTotalBanco = opcoes.atualizarTotalBanco === true;

  if (!sistemaOnline()) {
    const cacheItens =
      await obterCacheCaixa(`caixa_comanda_itens_${comandaAtiva.id}`) || [];

    carrinho = cacheItens;

    const total = carrinho.reduce((acc, item) => {
      return acc + Number(item.preco || 0) * Number(item.quantidade || 0);
    }, 0);

    comandaAtiva.total = total;

    const indexComanda = comandasCaixa.findIndex(item => {
      return String(item.id) === String(comandaAtiva.id);
    });

    if (indexComanda >= 0) {
      comandasCaixa[indexComanda] = {
        ...comandasCaixa[indexComanda],
        ...comandaAtiva,
        total,
        status: "aberta"
      };
    }

    await salvarCacheCaixa("caixa_comandas", comandasCaixa);

    renderCarrinho();
    atualizarInterfaceModoPDV();

    return;
  }

  const { data, error } = await sb
    .from("comanda_itens")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("comanda_id", comandaAtiva.id)
    .order("created_at", { ascending: true });

  if (error) {
    await alertaCaixa(
      "Erro na comanda",
      "Erro ao carregar itens da comanda."
    );
    console.error(error);
    return;
  }

  carrinho = (data || []).map(item => {
    const produtoCatalogo = item.produto_id
      ? obterItemCatalogoCaixa(item.produto_id)
      : null;

    return {
      id: item.produto_id || item.id,
      comanda_item_id: item.id,
      nome: item.nome,
      preco: Number(item.preco || 0),
      preco_custo: Number(item.preco_custo || 0),
      quantidade: Number(item.quantidade || 0),
      produto_manual: item.produto_id ? false : true,
      tipo_item: produtoCatalogo
        ? tipoItemProdutoCaixa(produtoCatalogo)
        : "produto",
      controla_estoque: produtoCatalogo
        ? itemControlaEstoqueCaixa(produtoCatalogo)
        : false,
      origem: item.origem || "pdv",
      origem_id: item.origem_id || null,
      agenda_jogador_id: item.agenda_jogador_id || null
    };
  });

  await salvarCacheCaixa(
    `caixa_comanda_itens_${comandaAtiva.id}`,
    carrinho
  );

  const total = carrinho.reduce((acc, item) => {
    return acc + Number(item.preco || 0) * Number(item.quantidade || 0);
  }, 0);

  comandaAtiva.total = total;

  const indexComanda = comandasCaixa.findIndex(item => {
    return String(item.id) === String(comandaAtiva.id);
  });

  if (indexComanda >= 0) {
    comandasCaixa[indexComanda] = {
      ...comandasCaixa[indexComanda],
      ...comandaAtiva,
      total: total,
      status: "aberta"
    };
  }

  await salvarCacheCaixa("caixa_comandas", comandasCaixa);

  if (atualizarTotalBanco) {
    await sb
      .from("comandas")
      .update({
        total: total,
        status: "aberta"
      })
      .eq("id", comandaAtiva.id)
      .eq("empresa_id", obterEmpresaId());
  }

  renderCarrinho();
  atualizarInterfaceModoPDV();
}

// ======================================================
// LIMPAR COMANDA ATIVA
// ======================================================
async function limparComandaAtiva() {
  if (!comandaAtiva?.id) {
    comandaAtiva = null;
    carrinho = [];
    renderCarrinho();
    atualizarInterfaceModoPDV();
    return;
  }

  try {
    await carregarItensComanda();
  } catch (err) {
    console.warn("[CAIXA][SAIR COMANDA]", err);
  }

  const quantidadeItens = carrinho.reduce((total, item) => {
    return total + Number(item.quantidade || 0);
  }, 0);

  const possuiItens = carrinho.length > 0;
  const codigoComanda = comandaAtiva.codigo || "—";

  const textoPermanencia = quantidadeItens === 1
    ? "O item permanecerá salvo"
    : `Os ${quantidadeItens} itens permanecerão salvos`;

  const confirmar = await abrirConfirmacaoCaixa({
    titulo: "Sair da comanda",
    mensagem: possuiItens
      ? `
        Você vai sair da comanda <strong>${codigoComanda}</strong>.<br><br>
        <strong>${textoPermanencia}</strong> e a comanda continuará aberta.
      `
      : `
        Você vai sair da comanda <strong>${codigoComanda}</strong>.<br><br>
        Ela está vazia e continuará aberta. Para liberá-la sem gerar venda,
        use <strong>Fechar comanda</strong>.
      `,
    textoConfirmar: "Sair e manter aberta"
  });

  if (!confirmar) return;

  comandaAtiva = null;
  comandaOculta = false;
  carrinho = [];

  renderCarrinho();
  atualizarInterfaceModoPDV();

  const input = document.getElementById("inputBusca");

  if (input) {
    input.value = "";
    input.focus();
  }

  await carregarComandasCaixa({
    forcar: true
  });

  filtrarComandasCaixa("");

  await atualizarBadgesModosCaixa();

  renderComandasAbertasNoCaixa();
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
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "Para evitar itens duplicados ou fechamento incompleto, comandas serão liberadas offline em uma etapa específica. Use a Venda rápida enquanto estiver sem conexão."
    );
    return;
  }

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
  "Caixa fechado",
  "Abra o caixa antes de fechar uma comanda."
);
    return;
  }

  if (!comandaAtiva?.id) {
    await alertaCaixa(
  "Comanda",
  "Nenhuma comanda ativa."
);
    return;
  }

  await carregarItensComanda();

  if (!carrinho.length) {
    const confirmarVazia = await abrirConfirmacaoCaixa({
      titulo: "Fechar comanda vazia",
      mensagem: `
        Esta comanda não possui itens.<br><br>
        Deseja liberar a comanda <strong>${comandaAtiva.codigo || "—"}</strong> sem gerar venda?
      `,
      textoConfirmar: "Liberar comanda"
    });

    if (!confirmarVazia) return;

    await sb
      .from("comandas")
      .update({
        status: "livre",
        nome_cliente: null,
        observacoes: null,
        data_abertura: null,
        data_fechamento: null,
        total: 0
      })
      .eq("id", comandaAtiva.id)
      .eq("empresa_id", obterEmpresaId());

comandaAtiva = null;
carrinho = [];

await carregarComandasCaixa({
  forcar: true
});

filtrarComandasCaixa("");

renderCarrinho();
atualizarInterfaceModoPDV();

await atualizarBadgesModosCaixa();

renderComandasAbertasNoCaixa();

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
  await alertaCaixa(
    "Desconto inválido",
    "O desconto não pode ser maior que o subtotal."
  );
  return;
}

  if (total <= 0) {
    await alertaCaixa(
  "Total inválido",
  "Total da comanda inválido."
);
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
    await alertaCaixa(
  "Pagamento insuficiente",
  "Valor recebido menor que o total da comanda."
);
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

let vendaData = null;

// A comanda gera uma única venda com tudo que foi efetivamente recebido:
// consumos comuns e jogadores avulsos. Os itens de jogo preservam seus
// vínculos para aparecer corretamente em Vendas e Relatórios.
if (carrinho.length > 0) {
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
    descricao: `Comanda ${comandaAtiva.codigo || ""} fechada`,
    data: new Date().toISOString(),
    operador_id: obterOperadorAtualId()
  };

  const { data: vendaComandaData, error: vendaError } = await sb
    .from("vendas")
    .insert([vendaPayload])
    .select("*")
    .single();

  if (vendaError) throw vendaError;

  vendaData = vendaComandaData;
  vendaCriadaId = vendaData.id;

  const itensPayload = carrinho.map(item => {
    const precoVenda = Number(item.preco || 0);
    const precoCusto = Number(item.preco_custo || 0);
    const quantidade = Number(item.quantidade || 0);

    const lucroUnitario = precoVenda - precoCusto;
    const lucroTotal = lucroUnitario * quantidade;

    return {
      empresa_id: empresaId,
      venda_id: vendaData.id,
      produto_id: item.produto_manual ? null : item.id,
      nome: item.nome,
      preco: precoVenda,
      preco_custo: precoCusto,
      lucro_unitario: lucroUnitario,
      lucro_total: lucroTotal,
      quantidade: quantidade,
      origem: item.agenda_jogador_id
        ? "agenda_avulso"
        : item.origem || "pdv",
      origem_id: item.origem_id || null,
      agenda_id: item.agenda_jogador_id
        ? item.origem_id || null
        : null,
      agenda_jogador_id: item.agenda_jogador_id || null
    };
  });

  const { error: itensError } = await sb
    .from("vendas_itens")
    .insert(itensPayload);

  if (itensError) throw itensError;
}

    const jogadoresDaComanda = carrinho.filter(item => {
      return item.agenda_jogador_id;
    });

    if (jogadoresDaComanda.length) {
      const idsJogadoresAgenda = jogadoresDaComanda.map(item => {
        return item.agenda_jogador_id;
      });

      const { error: erroAtualizarJogadoresComanda } = await sb
        .from("agenda_jogadores")
        .update({
          pago: true,
          status_pagamento: STATUS_JOGADOR_CAIXA.PAGO_EM_COMANDA,
          forma_pagamento: metodoPagamento || "dinheiro",
          comanda_id: null,
          venda_id: vendaData?.id || null,
          pago_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .eq("empresa_id", empresaId)
        .in("id", idsJogadoresAgenda);

      if (erroAtualizarJogadoresComanda) {
        throw erroAtualizarJogadoresComanda;
      }

      const agendaIds = [
        ...new Set(
          jogadoresDaComanda
            .map(item => item.origem_id)
            .filter(Boolean)
        )
      ];

        for (const agendaId of agendaIds) {
          await atualizarResumoAgendaAposComandaCaixa(agendaId);
        }
    }

    await baixarEstoqueProdutos(vendaData?.id || null);

const { error: erroRemoverItensComanda } = await sb
  .from("comanda_itens")
  .delete()
  .eq("empresa_id", empresaId)
  .eq("comanda_id", comandaAtiva.id);

if (erroRemoverItensComanda) throw erroRemoverItensComanda;

const { error: erroComanda } = await sb
  .from("comandas")
  .update({
    status: "livre",
    nome_cliente: null,
    observacoes: null,
    data_abertura: null,
    data_fechamento: null,
    total: 0
  })
  .eq("id", comandaAtiva.id)
  .eq("empresa_id", empresaId);

    if (erroComanda) throw erroComanda;

if (vendaData) {
  vendas.unshift(vendaData);

  exibirModalSucesso(total, troco);
} else {
  await alertaCaixa(
    "Comanda fechada",
    "Comanda fechada sem venda extra. O valor do jogo foi mantido na cobrança da agenda."
  );
}

    comandaAtiva = null;
    comandaOculta = false;
    carrinho = [];

    const descontoInput = document.getElementById("inputDesconto");
    const valorRecebidoInput = document.getElementById("valorRecebido");

    if (descontoInput) descontoInput.value = "";
    if (valorRecebidoInput) valorRecebidoInput.value = "";

    await carregarComandasCaixa();
    await atualizarBadgesModosCaixa();

    renderCarrinho();
    atualizarInfobar();
    renderHistorico();
    atualizarInterfaceModoPDV();
    renderComandasAbertasNoCaixa();

    await carregarProdutos();
    renderProdutosRapidos();

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
    await alertaCaixa(
  "Erro ao fechar comanda",
  err.message
);

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

  if (modoPDV === "comanda" && !sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "A comanda não foi alterada. Aguarde a conexão para remover itens."
    );
    return;
  }

  if (modoPDV === "comanda" && comandaAtiva) {

    if (!item.comanda_item_id) {
      await alertaCaixa(
        "Item inválido",
        "Item da comanda sem identificação."
      );
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

    if (item.agenda_jogador_id) {
      const { error: erroLiberarJogador } = await sb
        .from("agenda_jogadores")
        .update({
          pago: false,
          forma_pagamento: null,
          status_pagamento: STATUS_JOGADOR_CAIXA.PENDENTE,
          comanda_id: null,
          pago_em: null,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", item.agenda_jogador_id)
        .eq("empresa_id", obterEmpresaId());

      if (erroLiberarJogador) {
        await alertaCaixa(
          "Erro na comanda",
          "Não foi possível liberar o jogador vinculado a este item."
        );
        console.error(erroLiberarJogador);
        return;
      }
    }

    const { error } = await sb
      .from("comanda_itens")
      .delete()
      .eq("id", item.comanda_item_id)
      .eq("empresa_id", obterEmpresaId());

    if (error) {
      if (item.agenda_jogador_id) {
        await sb
          .from("agenda_jogadores")
          .update({
            forma_pagamento: "comanda",
            status_pagamento: STATUS_JOGADOR_CAIXA.EM_COMANDA,
            comanda_id: comandaAtiva.id,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", item.agenda_jogador_id)
          .eq("empresa_id", obterEmpresaId());
      }

      await alertaCaixa(
        "Erro na comanda",
        "Erro ao remover item da comanda."
      );
      console.error(error);
      return;
    }

    if (item.agenda_jogador_id && item.origem_id) {
      await atualizarResumoAgendaAposComandaCaixa(item.origem_id);
    }

    await carregarItensComanda({
  atualizarTotalBanco: true
});

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

  if (modoPDV === "comanda" && !sistemaOnline()) {
    await alertaCaixa(
      "Comanda protegida no modo offline",
      "A comanda não foi alterada. Aguarde a conexão para mudar quantidades."
    );
    return;
  }

  if (item.agenda_jogador_id) {
    await alertaCaixa(
      "Cobrança individual",
      "Uma cobrança de jogador sempre corresponde a uma pessoa. Para retirá-la, remova o item da comanda."
    );
    return;
  }

  const novaQuantidade =
    Number(item.quantidade || 0) + Number(delta || 0);

  if (novaQuantidade <= 0) {
    await removerItemCarrinho(index);
    return;
  }

  if (!item.produto_manual && itemControlaEstoqueCaixa(item)) {

    const produto = obterItemCatalogoCaixa(item.id);

    const estoqueDisponivel = Number(produto?.estoque || 0);

    if (novaQuantidade > estoqueDisponivel) {
      await alertaCaixa(
        "Estoque insuficiente",
        `Estoque insuficiente para <strong>${item.nome}</strong>.<br><br>Disponível: ${estoqueDisponivel}`
      );
      return;
    }
  }

  if (modoPDV === "comanda" && comandaAtiva) {

    if (!item.comanda_item_id) {
      await alertaCaixa(
        "Item inválido",
        "Item da comanda sem identificação."
      );
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
      await alertaCaixa(
        "Erro na comanda",
        "Erro ao atualizar quantidade da comanda."
      );
      console.error(error);
      return;
    }

    await carregarItensComanda({
  atualizarTotalBanco: true
});

    return;
  }

  item.quantidade = novaQuantidade;
  renderCarrinho();
}

function setupCobrancaAvulsaToggle() {
  const cardManual = document.querySelector(".pdv-manual");

  if (!cardManual || document.getElementById("btnToggleCobrancaAvulsa")) {
    return;
  }

  cardManual.classList.add("manual-card-oculto");

  const btn = document.createElement("button");

  btn.id = "btnToggleCobrancaAvulsa";
  btn.type = "button";
  btn.className = "btn-secondary btn-toggle-manual";

  cardManual.insertAdjacentElement("beforebegin", btn);
  atualizarRotuloCobrancaAvulsaCaixa();

  btn.onclick = () => {
    cardManual.classList.toggle("manual-card-oculto");

    atualizarRotuloCobrancaAvulsaCaixa();

    if (window.lucide) {
      lucide.createIcons();
    }
  };

  if (window.lucide) {
    lucide.createIcons();
  }
}

function atualizarRotuloAtividadesRecentesCaixa() {
  const botao = document.getElementById("btnToggleAtividadesRecentes");
  const card = document.querySelector(".pdv-atividade");

  if (!botao || !card) return;

  const oculto = card.classList.contains("atividade-card-oculto");

  botao.innerHTML = oculto
    ? `<i data-lucide="plus-circle"></i><span>Mostrar atividades recentes</span>`
    : `<i data-lucide="minus-circle"></i><span>Ocultar atividades recentes</span>`;

  botao.setAttribute("aria-expanded", String(!oculto));

  if (window.lucide) {
    lucide.createIcons();
  }
}

function setupAtividadesRecentesToggle() {
  const card = document.querySelector(".pdv-atividade");

  if (!card || document.getElementById("btnToggleAtividadesRecentes")) {
    return;
  }

  card.classList.add("atividade-card-oculto");

  const botao = document.createElement("button");

  botao.id = "btnToggleAtividadesRecentes";
  botao.type = "button";
  botao.className =
    "btn-secondary btn-toggle-manual btn-toggle-atividade";
  botao.setAttribute("aria-controls", "historicoList");

  card.insertAdjacentElement("beforebegin", botao);
  atualizarRotuloAtividadesRecentesCaixa();

  botao.addEventListener("click", () => {
    card.classList.toggle("atividade-card-oculto");
    atualizarRotuloAtividadesRecentesCaixa();
  });
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);
