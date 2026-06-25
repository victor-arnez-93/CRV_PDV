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
let produtosRapidos = [];
let metodoPagamento = "dinheiro";
let modoPDV = "venda";
let comandaAtiva = null;
let comandaOculta = false;
let caixaInicializado = false;
let vendaEmProcessamento = false;
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

    caixa =
      await crvOfflineDB.obterCache("caixa_status") || null;

    vendas =
      await crvOfflineDB.obterCache("caixa_vendas") || [];

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
        titulo: "Status do caixa não confirmado",
        mensagem:
          "Aguarde a conexão finalizar antes de abrir um novo caixa.",
        tipo: "warn",
        tempo: 8000
      });
    }

    await carregarTipoNegocioCaixa();
    await carregarProdutos();
    await carregarComandasCaixa({ forcar: true });
    await carregarJogosCaixa();

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

caixaInicializado = true;

iniciarAvisosFimDeJogoCaixa();

await processarRecebimentoAgendaAoAbrirCaixa();

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

    const cacheCaixa =
      await crvOfflineDB.obterCache("caixa_status") || null;

    const cacheVendas =
      await crvOfflineDB.obterCache("caixa_vendas") || [];

    if (cacheCaixa && cacheCaixa.status === "aberto") {
      caixa = cacheCaixa;
      vendas = cacheVendas;

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

    await crvOfflineDB.salvarCache(
      "caixa_tipo_negocio",
      tipoNegocioCaixa
    );

  } catch (err) {
    tipoNegocioCaixa =
      await crvOfflineDB.obterCache("caixa_tipo_negocio") || "";

    console.warn("[CAIXA][TIPO_NEGOCIO CACHE]", err);
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
    await alertaCaixa(
  "Sistema conectando",
  "Sistema ainda não está conectado ao Supabase. Aguarde alguns segundos e tente novamente."
);
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
    carrinho = [];

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
    await alertaCaixa(
      "Sistema offline",
      "Sistema sem conexão com Supabase."
    );
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
    carrinho = [];

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

function abrirModalTodosProdutosCaixa() {
  const modal = document.getElementById("modalProdutosCaixa");
  const inputBusca = document.getElementById("inputBuscaProdutosCaixa");

  if (!modal) return;

  modal.style.display = "flex";

  if (inputBusca) {
    inputBusca.value = "";
  }

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

  if (!lista) return;

  const termo = String(termoBusca || "").toLowerCase().trim();

  const filtrados = produtos.filter(produto => {
    const nome = String(produto.nome || "").toLowerCase();
    const codigo = String(produto.codigo || "").toLowerCase();
    const codigoBarras = String(produto.codigo_barras || "").toLowerCase();
    const categoria = String(produto.categoria || "").toLowerCase();

    return (
      !termo ||
      nome.includes(termo) ||
      codigo.includes(termo) ||
      codigoBarras.includes(termo) ||
      categoria.includes(termo)
    );
  });

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="package-x" width="28" height="28"></i>
        <p>Nenhum produto encontrado.</p>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  lista.innerHTML = filtrados.map(produto => {
    const estoque = Number(produto.estoque || 0);

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
            ${produto.nome || "Produto"}
          </div>

          <div class="produto-caixa-categoria">
            ${produto.categoria || "Sem categoria"}
          </div>
        </div>

        <div class="produto-caixa-bottom">
          <span class="produto-caixa-preco">
            ${fmt(produto.preco || 0)}
          </span>

          <span class="produto-caixa-estoque ${classeEstoque}">
            Est: ${estoque}
          </span>
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
          "Produto não encontrado",
          "Não foi possível localizar este produto."
        );
        return;
      }

      if (modoPDV === "comanda" && !comandaAtiva) {
        await alertaCaixa(
          "Comanda não selecionada",
          "Abra ou selecione uma comanda antes de adicionar produtos."
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

  produtos.forEach(produto => {
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
        produto: item.produto.nome || "Produto cadastrado"
      };
    }

    const tokensEncontrados = item.tokens.filter(token => {
      return tokensDescricao.includes(token);
    });

    if (tokensEncontrados.length >= 1) {
      return {
        permitido: false,
        produto: item.produto.nome || "Produto cadastrado"
      };
    }
  }

  return {
    permitido: true,
    produto: null
  };
}

async function adicionarManual() {
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
      "Produto já cadastrado",
      `
        Esta cobrança parece estar relacionada a um produto cadastrado:<br><br>
        <strong>${validacao.produto}</strong><br><br>
        Use a busca, os produtos rápidos ou o botão <strong>Ver todos</strong> para vender pela forma correta.
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

function obterRecebimentoAgendaStorage() {
  try {
    const bruto =
      sessionStorage.getItem("crv_recebimento_agenda_caixa");

    if (!bruto) return null;

    const dados = JSON.parse(bruto);

    if (
      dados?.tipo !== "agenda_mensalidade" ||
      !dados.mensalidade_id ||
      !dados.valor
    ) {
      return null;
    }

    return dados;

  } catch (err) {
    console.warn("[CAIXA][RECEBIMENTO AGENDA]", err);
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
  const recebimento =
    obterRecebimentoAgendaStorage();

  if (!recebimento) return;

  if (!caixa || caixa.status !== "aberto") {
    await alertaCaixa(
      "Abra o caixa",
      "Existe uma mensalidade enviada pela Agenda para receber. Abra o caixa primeiro e depois volte para receber."
    );

    return;
  }

  recebimentoAgendaCaixa = recebimento;

  modoPDV = "venda";
  comandaAtiva = null;
  comandaOculta = false;
  jogoSelecionadoCaixa = null;

  carrinho = [
    {
      id: `agenda-mensalidade-${recebimento.mensalidade_id}`,
      nome: recebimento.descricao,
      preco: Number(recebimento.valor || 0),
      preco_custo: 0,
      quantidade: 1,
      produto_manual: true,

      origem: "agenda_mensalidade",
      origem_id: recebimento.mensalidade_id,
      agenda_id: recebimento.agenda_id,
      mensalidade_id: recebimento.mensalidade_id
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
      <strong>${formatarCompetenciaCaixa(recebimento.competencia)}</strong><br><br>
      Valor:
      <strong>${fmt(recebimento.valor)}</strong><br><br>
      Escolha a forma de pagamento no Caixa e finalize a venda.
    `,
    textoConfirmar: "Ir para pagamento",
    mostrarCancelar: false
  });

  const primeiroPagamento =
    document.querySelector(".pay-btn");

  if (primeiroPagamento) {
    primeiroPagamento.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

async function atualizarMensalidadeAgendaAposVenda(vendaId) {
  const recebimento =
    recebimentoAgendaCaixa || obterRecebimentoAgendaStorage();

  if (!recebimento?.mensalidade_id) return;

  const { error } = await sb
    .from("agenda_mensalidades")
    .update({
      status: "pago",
      forma_pagamento: metodoPagamento,
      pago_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    })
    .eq("id", recebimento.mensalidade_id)
    .eq("empresa_id", obterEmpresaId());

  if (error) throw error;

  sessionStorage.removeItem("crv_recebimento_agenda_caixa");
  recebimentoAgendaCaixa = null;
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

  if (!carrinho.length) {
    await alertaCaixa(
      "Carrinho vazio",
      "Adicione itens ao carrinho."
    );
    return;
  }

  const subtotalTeste = calcularSubtotalCarrinho();
  const descontoTeste = calcularDesconto();

  if (descontoTeste > subtotalTeste) {
    await alertaCaixa(
      "Desconto inválido",
      "O desconto não pode ser maior que o subtotal."
    );
    return;
  }

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
    offline: true,
    operador_id: obterOperadorAtualId(),
    venda_manual: carrinho.some(item => item.produto_manual === true)
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

  carrinho.forEach(item => {
    if (item.produto_manual || !item.id) return;

    const produtoLocal = produtos.find(produto => {
      return String(produto.id) === String(item.id);
    });

    if (produtoLocal) {
      produtoLocal.estoque =
        Math.max(
          0,
          Number(produtoLocal.estoque || 0) -
          Number(item.quantidade || 0)
        );
    }
  });

  await crvOfflineDB.salvarCache(
    "caixa_produtos",
    produtos
  );

  produtosRapidos = produtos.filter(produto => {
    return produto.produto_rapido === true;
  });

  vendas.unshift(vendaPayload);

  await crvOfflineDB.salvarCache(
    "caixa_vendas",
    vendas
  );

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
  carrinho.find(item => {
    return String(item.origem || "") === "agenda_mensalidade";
  }) || null;

const vendaPayload = {
  empresa_id: empresaId,
  caixa_id: caixa.id,
  cliente_id: null,
  subtotal: subtotal,
  desconto: desconto,
  total: total,
  forma_pagamento: metodoPagamento,
  troco: troco,

  origem: itemMensalidadeAgenda
    ? "agenda_mensalidade"
    : "pdv",

  origem_id: itemMensalidadeAgenda
    ? itemMensalidadeAgenda.mensalidade_id
    : null,

  agenda_id: itemMensalidadeAgenda
    ? itemMensalidadeAgenda.agenda_id
    : null,

  descricao: itemMensalidadeAgenda
    ? itemMensalidadeAgenda.nome
    : "Venda rápida",

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

  origem: item.origem || "pdv",
  origem_id: item.origem_id || null,
  agenda_id: item.agenda_id || null,
  agenda_jogador_id: item.agenda_jogador_id || null
};
    });

    const { error: itensError } = await sb
      .from("vendas_itens")
      .insert(itensPayload);

    if (itensError) throw itensError;

    if (itemMensalidadeAgenda) {
  await atualizarMensalidadeAgendaAposVenda(vendaData.id);
}

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
    await alertaCaixa(
  "Erro ao finalizar venda",
  err.message
);

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

    vendas
    .filter(venda => {
      if (String(venda.origem || "").toLowerCase() !== "agenda") {
        return true;
      }

      return venda._status_jogo === "fechado";
    })
    .forEach(venda => {
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
          ? limparTituloJogoHistoricoCaixa(venda.descricao)
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

    const { data: comandasAbertas, error: erroComandas } = await sb
      .from("comandas")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("status", "aberta");

    if (erroComandas) throw erroComandas;

const { data: jogos, error: erroJogos } = await sb
  .from("agenda")
  .select("*")
  .eq("empresa_id", empresaId)
  .neq("status_jogo", "cancelado")
  .neq("status_jogo", "fechado");

    if (erroJogos) throw erroJogos;

    qtdComandasAbertasCaixa = comandasAbertas?.length || 0;

    qtdJogosAbertosCaixa = (jogos || []).filter(jogo => {
      const status = calcularStatusJogoCaixa(jogo);
      return status === "andamento" || status === "cobranca";
    }).length;

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
// SINCRONIZAÇÃO AUTOMÁTICA DE JOGOS PAGOS SEM VENDA
// ======================================================
async function verificarJogosPendentesSincronizacaoCaixa() {
  if (!caixaPermiteJogos()) return;
  if (!caixa || caixa.status !== "aberto") return;

  try {
    await carregarJogosCaixa();

    const jogosComRecebimento = jogosCaixa.filter(jogo => {
      const jogadores = jogadoresCaixaPorAgenda[jogo.id] || [];

const totalPago = jogadores
  .filter(jogador => {
    return (
      jogador.pago === true &&
      String(jogador.forma_pagamento || "").toLowerCase() !== "comanda"
    );
  })
  .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

      return totalPago > 0;
    });

    if (!jogosComRecebimento.length) {
      jogosPendentesSincronizacaoCaixa = [];
      removerAvisoSincronizacaoJogosCaixa();
      return;
    }

    const idsJogos = jogosComRecebimento.map(jogo => jogo.id);

    const { data: vendasAgenda, error } = await sb
      .from("vendas")
      .select("origem_id")
      .eq("empresa_id", obterEmpresaId())
      .eq("origem", "agenda")
      .in("origem_id", idsJogos);

    if (error) throw error;

    const idsComVenda = new Set(
      (vendasAgenda || []).map(venda => String(venda.origem_id))
    );

    jogosPendentesSincronizacaoCaixa = jogosComRecebimento.filter(jogo => {
      return !idsComVenda.has(String(jogo.id));
    });

    renderAvisoSincronizacaoJogosCaixa();

  } catch (err) {
    console.error("[CAIXA][SYNC JOGOS]", err);
  }
}

function renderAvisoSincronizacaoJogosCaixa() {
  removerAvisoSincronizacaoJogosCaixa();

  if (!jogosPendentesSincronizacaoCaixa.length) return;

  const pdvLeft = document.querySelector(".pdv-left");

  if (!pdvLeft) return;

  const aviso = document.createElement("div");

  aviso.className = "card aviso-sync-jogos-caixa";
  aviso.id = "avisoSyncJogosCaixa";

  aviso.innerHTML = `
    <div>
      <strong>
        ${jogosPendentesSincronizacaoCaixa.length} jogo(s) pago(s) sem venda
      </strong>

      <span>
        Existem cobranças da agenda que ainda não entraram no caixa.
      </span>
    </div>

    <button class="btn-secondary" type="button" id="btnSincronizarJogosPendentes">
      <i data-lucide="refresh-cw" width="15" height="15"></i>
      <span>Sincronizar tudo</span>
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
    titulo: "Sincronizar jogos pendentes",
    mensagem: `
      Sincronizar
      <strong>${jogosPendentesSincronizacaoCaixa.length}</strong>
      jogo(s) já pago(s) que ainda não entraram no caixa?
    `,
    textoConfirmar: "Sincronizar tudo"
  });

  if (!confirmar) return;

  try {
    vendaEmProcessamento = true;

    for (const jogo of jogosPendentesSincronizacaoCaixa) {
      await atualizarVendaAgendaPeloCaixa(jogo);
    }

    await carregarDadosSupabase();
    await verificarJogosPendentesSincronizacaoCaixa();

    renderEstado();
    renderHistorico();
    atualizarInfobar();

    await alertaCaixa(
      "Sincronização concluída",
      "Jogos pendentes foram lançados no caixa, vendas e relatórios."
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

    if (faltam > 0 && faltam <= 5 && jogo.status_jogo !== "fechado") {
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

function obterHojeISOCaixa() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterDiaSemanaCaixa(dataISO) {
  if (!dataISO) return null;

  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);

  return data.getDay();
}

function jogoMensalModeloCaixa(jogo) {
  return (
    (
      String(jogo.recorrencia || "") === "mensal" ||
      String(jogo.tipo_jogo || "") === "mensalista"
    ) &&
    !jogo.recorrencia_origem_id &&
    jogo.status_jogo !== "cancelado" &&
    jogo.status_jogo !== "fechado"
  );
}

async function gerarOcorrenciasMensaisCaixa(dataAlvo) {
  if (!dataAlvo) return;
  if (!caixaPermiteJogos()) return;
  if (!sistemaOnline()) return;

  const empresaId = obterEmpresaId();

  const { data: jogosBase, error: erroBase } = await sb
    .from("agenda")
    .select("*")
    .eq("empresa_id", empresaId)
    .neq("status_jogo", "cancelado")
    .neq("status_jogo", "fechado");

  if (erroBase) {
    console.warn("[CAIXA][RECORRÊNCIA]", erroBase);
    return;
  }

  const modelos = (jogosBase || []).filter(jogo => {
    if (!jogoMensalModeloCaixa(jogo)) return false;

    const dataBase = String(jogo.data_agendamento || "").slice(0, 10);

    if (!dataBase) return false;
    if (dataAlvo <= dataBase) return false;

    return obterDiaSemanaCaixa(dataBase) === obterDiaSemanaCaixa(dataAlvo);
  });

  for (const modelo of modelos) {
    const jaExiste = (jogosBase || []).some(jogo => {
      return (
        String(jogo.recorrencia_origem_id || "") === String(modelo.id) &&
        String(jogo.data_agendamento || "").slice(0, 10) === dataAlvo
      );
    });

    if (jaExiste) continue;

    const { data: novaOcorrencia, error: erroInsert } = await sb
      .from("agenda")
      .insert([{
        empresa_id: empresaId,
        cliente_nome: modelo.cliente_nome,
        cliente_telefone: modelo.cliente_telefone || null,
        data_agendamento: dataAlvo,
        hora_inicio: modelo.hora_inicio,
        hora_fim: modelo.hora_fim,
        local_recurso: modelo.local_recurso,
        tipo_jogo: modelo.tipo_jogo || "mensalista",
        status_jogo: "agendado",
        recorrencia: "avulso",
        recorrencia_origem_id: modelo.id,
        ocorrencia_gerada: true,
        valor_previsto: modelo.valor_previsto || 0,
        valor_mensal: modelo.valor_mensal || 0,
        dia_pagamento_mensal: modelo.dia_pagamento_mensal || null,
        observacoes: modelo.observacoes || null,
        usar_times: modelo.usar_times === true,
        time_a: modelo.time_a || null,
        time_b: modelo.time_b || null,
        atualizado_em: new Date().toISOString()
      }])
      .select("id")
      .single();

    if (erroInsert) {
      console.warn("[CAIXA][GERAR OCORRÊNCIA]", erroInsert);
      continue;
    }

    const { data: jogadoresModelo, error: erroJogadores } = await sb
      .from("agenda_jogadores")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("agenda_id", modelo.id)
      .neq("removido", true);

    if (erroJogadores) {
      console.warn("[CAIXA][COPIAR JOGADORES]", erroJogadores);
      continue;
    }

    if (jogadoresModelo?.length) {
      await sb
        .from("agenda_jogadores")
        .insert(
          jogadoresModelo.map(jogador => ({
            empresa_id: empresaId,
            agenda_id: novaOcorrencia.id,
            nome: jogador.nome,
            time_jogador: jogador.time_jogador || null,
            valor: 0,
            forma_pagamento: null,
            pago: false,
            status_pagamento: STATUS_JOGADOR_CAIXA.PENDENTE,
            pago_em: null,
            removido: false,
            origem_jogador: jogador.origem_jogador || "mensalista",
            mensalista: jogador.mensalista !== undefined ? jogador.mensalista : true,
            cobrar_no_jogo: jogador.cobrar_no_jogo !== undefined ? jogador.cobrar_no_jogo : false
          }))
        );
    }
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
      .neq("status_jogo", "fechado")
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
    // Buscar mensalidades do mês atual para recalcular cobrar_no_jogo
const competenciaHoje = obterHojeISOCaixa().slice(0, 7); // "2026-06"
const { data: mensalidadesCaixa } = await sb
  .from('agenda_mensalidades')
  .select('agenda_origem_id, competencia, status')
  .eq('empresa_id', obterEmpresaId())
  .eq('competencia', competenciaHoje);

// Recalcular cobrar_no_jogo para cada jogador mensalista
if (mensalidadesCaixa?.length) {
  Object.keys(jogadoresCaixaPorAgenda).forEach(agendaId => {
    const jogo = jogosCaixa.find(j => String(j.id) === String(agendaId));
    if (!jogo) return;
    const origemId = jogo.recorrencia_origem_id || jogo.id;

    jogadoresCaixaPorAgenda[agendaId] = jogadoresCaixaPorAgenda[agendaId].map(j => {
      if (!j.mensalista) return j; // avulsos não mudam
      const mensalidade = mensalidadesCaixa.find(m =>
        String(m.agenda_origem_id) === String(origemId) &&
        String(m.competencia) === String(competenciaHoje)
      );
      // Pago = isento. Pendente ou sem mensalidade = cobrar
      const mensalidadePaga = mensalidade?.status === 'pago';
      return {
        ...j,
        cobrar_no_jogo: !mensalidadePaga
      };
    });
  });
}
    vinculosComandaJogadorCaixa = {};

    await crvOfflineDB.salvarCache("caixa_jogos", jogosCaixa);
    await crvOfflineDB.salvarCache("caixa_jogadores_agenda", jogadores);

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

        await crvOfflineDB.salvarCache(
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
      await crvOfflineDB.obterCache("caixa_jogos") || [];

    const cacheJogadores =
      await crvOfflineDB.obterCache("caixa_jogadores_agenda") || [];

    const cacheVinculos =
      await crvOfflineDB.obterCache("caixa_vinculos_comanda_jogador") || {};

    jogosCaixa = cacheJogos;
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
    const jogadores = jogadoresCaixaPorAgenda[jogo.id] || [];

    const recebido = jogadores
      .filter(jogador => jogador.pago)
      .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

    const pendente = jogadores
      .filter(jogador => !jogador.pago && !jogadorMensalistaIsentoCaixa(jogador))
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

function montarDescricaoJogoComandaCaixa(jogo, jogador) {
  return [
    `Jogo vinculado`,
    jogo.local_recurso || "Quadra/Campo",
    `${formatarDataCaixa(jogo.data_agendamento)} ${formatarHoraCaixa(jogo.hora_inicio)}-${formatarHoraCaixa(jogo.hora_fim)}`,
    jogador.nome || "Jogador"
  ].join(" · ");
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

  const jogadores = (jogadoresCaixaPorAgenda[jogo.id] || [])
    .filter(jogador => jogador.removido !== true)
    .sort((a, b) => {
      const statusA = statusPagamentoJogadorCaixa(a);
      const statusB = statusPagamentoJogadorCaixa(b);

      const peso = {
        pendente: 1,
        em_cobranca: 1,
        em_comanda: 2,
        pago_direto: 3,
        pago_em_comanda: 4
      };

      return (peso[statusA] || 9) - (peso[statusB] || 9);
    });

  const modal = document.getElementById("modalFinalizarJogoCaixa");
  const titulo = document.getElementById("finalizarJogoTitulo");
  const subtitulo = document.getElementById("finalizarJogoSubtitulo");
  const resumo = document.getElementById("jogoCaixaResumo");
  const lista = document.getElementById("jogoCaixaJogadores");

  const recebido = jogadores
    .filter(jogador => jogadorPagoCaixa(jogador) && !jogadorMensalistaIsentoCaixa(jogador))
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

  const pendente = jogadores
    .filter(jogador => jogadorPendenteCaixa(jogador) && !jogadorMensalistaIsentoCaixa(jogador))
    .reduce((acc, jogador) => acc + Number(jogador.valor || 0), 0);

  if (titulo) {
    titulo.textContent = `Jogo - ${jogo.local_recurso || "Quadra/Campo"}`;
  }

  if (subtitulo) {
    subtitulo.textContent =
  `${formatarDataCaixa(jogo.data_agendamento)} · ${formatarHoraCaixa(jogo.hora_inicio)} até ${formatarHoraCaixa(jogo.hora_fim)} · ${jogo.cliente_nome || "Responsável"} · Marque apenas quem está pagando agora.`;
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

  const inputRateio = document.getElementById("valorTotalJogoCaixa");
const btnRateio = document.getElementById("btnAplicarRateioJogo");

if (inputRateio) {
  const totalPrevisto = Number(jogo.valor_total || jogo.valor_previsto || 0);

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
        <div class="empty-state">
          <p>Nenhum jogador lançado neste jogo.</p>
        </div>
      `;
    } else {
      lista.innerHTML = jogadores.map(jogador => {
        // Mensalista isento: exibe como linha informativa sem cobrança
        if (jogadorMensalistaIsentoCaixa(jogador)) {
          return `
            <div class="jogo-caixa-jogador-row mensalista-isento" data-jogador-id="${jogador.id}" style="opacity:.6;pointer-events:none;">
              <span class="jogo-caixa-jogador-nome" style="grid-column:1/-1;font-style:italic;">
                <i data-lucide="user-check" width="13" height="13" style="display:inline;margin-right:4px;"></i>
                ${jogador.nome || "Jogador"} &mdash; <small>mensalista (isento de cobran&ccedil;a individual)</small>
              </span>
            </div>
          `;
        }

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

        return `
            <div class="jogo-caixa-jogador-row ${bloqueado ? "pago" : ""}" data-jogador-id="${jogador.id}">
            <input
              type="checkbox"
              class="jogo-caixa-check"
              ${bloqueado ? "disabled" : ""}
              ${!bloqueado && obterSelecionadoTemporarioJogadorCaixa(jogador) ? "checked" : ""}
            >

            <div class="jogo-caixa-jogador-nome">
              ${jogador.nome || "Jogador"}
              ${textoStatus}
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

function aplicarRateioJogoCaixa() {
  const inputRateio = document.getElementById("valorTotalJogoCaixa");

  const totalJogo = normalizarNumero(inputRateio?.value || 0);

  const jogadores =
    jogadoresCaixaPorAgenda[jogoSelecionadoCaixa?.id] || [];

  const jogadoresValidos = jogadores.filter(jogador => {
    return jogador.removido !== true;
  });

  const totalParaRatear = totalJogo;

  const linhasPendentes = [...document.querySelectorAll(".jogo-caixa-jogador-row")]
    .filter(row => {
      const check = row.querySelector(".jogo-caixa-check");
      return check && !check.disabled;
    });

  if (totalJogo <= 0 || !linhasPendentes.length) {
    alertaCaixa(
      "Rateio inválido",
      "Informe o valor total do jogo e mantenha pelo menos um jogador pendente."
    );
    return;
  }

  if (totalParaRatear <= 0) {
    alertaCaixa(
      "Rateio concluído",
      "Todo o valor do jogo já foi enviado para comanda ou recebido."
    );
    return;
  }

  const totalCentavos = Math.round(totalParaRatear * 100);
    // Rateio somente entre jogadores cobráveis (exclui mensalistas isentos)
    const jogadoresCobrarveisRateio = jogadoresValidos.filter(j => !jogadorMensalistaIsentoCaixa(j));
    const qtd = jogadoresCobrarveisRateio.length;

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

  const { error: erroItem } = await sb
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
    ]);

  if (erroItem) throw erroItem;

  const { error: erroJogador } = await sb
    .from("agenda_jogadores")
.update({
  valor: valorCobrado,
  pago: false,
  forma_pagamento: "comanda",
  status_pagamento: STATUS_JOGADOR_CAIXA.EM_COMANDA,
  pago_em: null,
  atualizado_em: new Date().toISOString()
})
    .eq("id", jogador.id)
    .eq("empresa_id", empresaId);

  if (erroJogador) throw erroJogador;

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
  const listaCobravel = lista.filter(j => !jogadorMensalistaIsentoCaixa(j));

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

  const jogadoresJaPagosDireto =
    jogadores.filter(jogador => {
      return (
        jogador.pago === true &&
        Number(jogador.valor || 0) > 0 &&
        String(jogador.forma_pagamento || "").toLowerCase() !== "comanda"
      );
    });

  const jogadoresPagosComanda =
    jogadores.filter(jogador => {
      return (
        jogador.pago === true &&
        Number(jogador.valor || 0) > 0 &&
        String(jogador.forma_pagamento || "").toLowerCase() === "comanda"
      );
    });

    if (!linhasSelecionadas.length && jogadoresJaPagosDireto.length) {
    const confirmarSync = await abrirConfirmacaoCaixa({
      titulo: "Sincronizar venda do jogo",
      mensagem: `
        Este jogo já está marcado como pago na agenda, mas pode não ter sido lançado no caixa.<br><br>
        Deseja sincronizar a venda agora?
      `,
      textoConfirmar: "Sincronizar venda"
    });

    if (!confirmarSync) return;

    try {
      vendaEmProcessamento = true;

      await atualizarVendaAgendaPeloCaixa(jogoSelecionadoCaixa);

      await carregarDadosSupabase();
      await carregarJogosCaixa();
      await verificarJogosPendentesSincronizacaoCaixa();

      renderEstado();
      renderHistorico();
      atualizarInfobar();

      fecharModalFinalizarJogoCaixa();
      fecharModalSelecionarJogo();

      await alertaCaixa(
        "Venda sincronizada",
        "O pagamento do jogo foi lançado no caixa, vendas e relatórios."
      );

      await alterarModoPDV("jogos");

    } catch (err) {
      console.error(err);

      await alertaCaixa(
        "Erro ao sincronizar jogo",
        err.message || "Não foi possível sincronizar a venda do jogo."
      );

    } finally {
      vendaEmProcessamento = false;
    }

    return;
  }

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

    if (valorCobrado <= 0) {
      throw new Error("Informe um valor válido para todos os jogadores selecionados.");
    }

    return {
      jogadorId,
      formaPagamento,
      valorCobrado
    };
  });

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

    for (const pagamento of pagamentos) {
      const { error } = await sb
        .from("agenda_jogadores")
.update({
  valor: pagamento.valorCobrado,
  pago: true,
  forma_pagamento: pagamento.formaPagamento,
  status_pagamento: STATUS_JOGADOR_CAIXA.PAGO_DIRETO,
  pago_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString()
})
        .eq("id", pagamento.jogadorId)
        .eq("empresa_id", obterEmpresaId());

      if (error) throw error;
    }

    await atualizarVendaAgendaPeloCaixa(jogoSelecionadoCaixa);

    await carregarDadosSupabase();
    await carregarJogosCaixa();

    renderEstado();
    renderHistorico();
    atualizarInfobar();

const jogoIdFinalizado = jogoSelecionadoCaixa.id;

fecharModalFinalizarJogoCaixa();
fecharModalSelecionarJogo();

const jogadoresAtualizados = jogadoresCaixaPorAgenda[jogoIdFinalizado] || [];

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
    "Pagamento total lançado no caixa, vendas, relatórios e atividades recentes."
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

  const jogadores = jogadoresAtualizados || [];

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
    .eq("origem", "agenda")
    .eq("origem_id", jogo.id)
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

        const jogadores =
          jogadoresCaixaPorAgenda[jogo.id] || [];

        const pagos = jogadores.filter(jogador =>
          jogadorPagoCaixa(jogador)
        );

        const emComanda = jogadores.filter(jogador =>
          jogadorEmComandaCaixa(jogador)
        );

        const pendentes = jogadores.filter(jogador =>
          jogadorPendenteCaixa(jogador)
        );

        const valorPendente =
          pendentes.reduce((acc, j) => {
            return acc + Number(j.valor || 0);
          }, 0);

        let statusVisual = status;
        let textoStatus = status;

        if (
          status === "cobranca" &&
          pagos.length > 0 &&
          pendentes.length > 0
        ) {
          statusVisual = "parcial";
          textoStatus = "pagamento parcial";
        }

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

              <span>
                ${pagos.length} pago${pagos.length !== 1 ? "s" : ""}
              </span>

              <span>
                ${pendentes.length} pendente${pendentes.length !== 1 ? "s" : ""}
              </span>

              <span>
                ${emComanda.length} comanda
              </span>

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

    await crvOfflineDB.salvarCache(
      "caixa_comandas",
      comandasCaixa
    );

  } catch (err) {
    const cacheComandas =
      await crvOfflineDB.obterCache("caixa_comandas") || [];

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

        await crvOfflineDB.salvarCache("caixa_comandas", comandasCaixa);

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
        "Produto não encontrado",
        "Produto não encontrado."
      );

      if (input) {
        input.value = "";
        input.focus();
      }

      return;
    }

    if (produto.ativo !== true) {
      await alertaCaixa(
        "Produto inativo",
        `Produto inativo: <strong>${produto.nome}</strong>`
      );

      return;
    }

    const estoque =
      Number(produto.estoque || 0);

    if (estoque <= 0) {
      await alertaCaixa(
        "Sem estoque",
        `Produto sem estoque: <strong>${produto.nome}</strong>`
      );

      return;
    }

    const preco =
      Number(produto.preco || 0);

    if (preco <= 0) {
      await alertaCaixa(
        "Preço inválido",
        `Produto sem preço válido: <strong>${produto.nome}</strong>`
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

  const preco = normalizarNumero(produto.preco);
  const estoque = Number(produto.estoque || 0);

  if (preco <= 0) {
    await alertaCaixa(
      "Preço inválido",
      `Produto sem preço válido: <strong>${produto.nome}</strong>`
    );
    return;
  }

  if (estoque <= 0) {
    await alertaCaixa(
      "Sem estoque",
      `Produto sem estoque: <strong>${produto.nome}</strong>`
    );
    return;
  }

  if (!sistemaOnline()) {
    const existente = carrinho.find(item => {
      return String(item.id) === String(produto.id);
    });

    if (existente) {
      const novaQtd = Number(existente.quantidade || 0) + 1;

      if (novaQtd > estoque) {
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

    await crvOfflineDB.salvarCache(
      `caixa_comanda_itens_${comandaAtiva.id}`,
      carrinho
    );

    await crvOfflineDB.salvarCache("caixa_comandas", comandasCaixa);

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

    if (novaQtd > estoque) {
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

      await crvOfflineDB.salvarCache(
        `caixa_comanda_itens_${comandaAtiva.id}`,
        carrinho
      );

      await crvOfflineDB.salvarCache("caixa_comandas", comandasCaixa);

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
      await crvOfflineDB.obterCache(`caixa_comanda_itens_${comandaAtiva.id}`) || [];

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

    await crvOfflineDB.salvarCache("caixa_comandas", comandasCaixa);

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
    return {
      id: item.produto_id || item.id,
      comanda_item_id: item.id,
      nome: item.nome,
      preco: Number(item.preco || 0),
      preco_custo: Number(item.preco_custo || 0),
      quantidade: Number(item.quantidade || 0),
      produto_manual: item.produto_id ? false : true,
      origem: item.origem || "pdv",
      origem_id: item.origem_id || null,
      agenda_jogador_id: item.agenda_jogador_id || null
    };
  });

  await crvOfflineDB.salvarCache(
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

  await crvOfflineDB.salvarCache("caixa_comandas", comandasCaixa);

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

  const confirmar = await abrirConfirmacaoCaixa({
    titulo: "Sair da comanda",
    mensagem: `
      Deseja sair da comanda <strong>${comandaAtiva.codigo || "—"}</strong>?
    `,
    textoConfirmar: "Sair"
  });

  if (!confirmar) return;

  try {
    await carregarItensComanda();

    if (!carrinho.length && sistemaOnline()) {
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
    }

  } catch (err) {
    console.warn("[CAIXA][LIMPAR COMANDA]", err);
  }

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

document.addEventListener("click", event => {
  const btnOcultar = event.target.closest("#btnOcultarComanda");

  if (btnOcultar) {
    comandaOculta = true;

    atualizarInterfaceModoPDV();
    renderComandasAbertasNoCaixa();
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
    operador_id: obterOperadorAtualId(),
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
  comandaOculta = false;
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

  const itensAgendaComanda = carrinho.filter(item => item.agenda_jogador_id);
const itensExtrasComanda = carrinho.filter(item => !item.agenda_jogador_id);

const subtotalComandaExtra = itensExtrasComanda.reduce((acc, item) => {
  return acc + Number(item.preco || 0) * Number(item.quantidade || 0);
}, 0);

const totalComandaExtra = Math.max(0, subtotalComandaExtra - desconto);

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

if (itensExtrasComanda.length > 0) {
  const vendaPayload = {
    empresa_id: empresaId,
    caixa_id: caixa.id,
    cliente_id: null,
    subtotal: subtotalComandaExtra,
    desconto: desconto,
    total: totalComandaExtra,
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

  const itensPayload = itensExtrasComanda.map(item => {
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
      origem: item.origem || "pdv",
      origem_id: item.origem_id || null,
      agenda_jogador_id: null
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
          forma_pagamento: "comanda",
          venda_id: null,
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

          const jogoRelacionado =
            jogosCaixa.find(jogo => String(jogo.id) === String(agendaId)) ||
            { id: agendaId };

          await atualizarVendaAgendaPeloCaixa(jogoRelacionado);
        }
    }

    await baixarEstoqueProdutos();

await sb
  .from("comanda_itens")
  .delete()
  .eq("empresa_id", empresaId)
  .eq("comanda_id", comandaAtiva.id);

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

  exibirModalSucesso(totalComandaExtra, troco);
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

    const { error } = await sb
      .from("comanda_itens")
      .delete()
      .eq("id", item.comanda_item_id)
      .eq("empresa_id", obterEmpresaId());

    if (error) {
      await alertaCaixa(
        "Erro na comanda",
        "Erro ao remover item da comanda."
      );
      console.error(error);
      return;
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

  btn.innerHTML = `
    <i data-lucide="plus-circle"></i>
    <span>Mostrar cobrança avulsa</span>
  `;

  cardManual.insertAdjacentElement("beforebegin", btn);

  btn.onclick = () => {
    const oculto = cardManual.classList.toggle("manual-card-oculto");

    btn.innerHTML = oculto
      ? `<i data-lucide="plus-circle"></i><span>Mostrar cobrança avulsa</span>`
      : `<i data-lucide="minus-circle"></i><span>Ocultar cobrança avulsa</span>`;

    if (window.lucide) {
      lucide.createIcons();
    }
  };

  if (window.lucide) {
    lucide.createIcons();
  }
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);