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
  const numero = Number(valor);

  if (Number.isNaN(numero) || numero < 0) {
    return 0;
  }

  return numero;
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

  caixaInicializado = true;

  logCaixa("Tela pronta para operação.", "success");
});

async function inicializarCaixa() {
  await carregarDadosSupabase();
  await carregarProdutos();

  renderEstado();
  renderProdutosRapidos();
  renderCarrinho();

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
    badge.textContent = `${vendas.length} vendas`;
  }

  if (!vendas.length) {
    box.innerHTML = `
      <div class="empty-state" style="padding:16px;">
        <p>Nenhuma venda ainda</p>
      </div>
    `;
    return;
  }

  box.innerHTML = "";

  vendas.forEach(venda => {
    const item = document.createElement("div");

    item.className = "historico-item";

    item.innerHTML = `
      <div class="historico-item-left">
        <span class="historico-pagto">
          ${
            venda.origem === "agenda"
              ? (venda.descricao || "Pagamento de jogo")
              : (venda.forma_pagamento || "Venda")
          }
        </span>
        <small style="display:block;color:var(--text-muted);font-size:0.68rem;margin-top:3px;">
          ${
  venda.origem === "agenda"
    ? `${String(venda.forma_pagamento || "").toUpperCase()} · ${formatarDataHoraBrasil(venda.data)}`
    : formatarDataHoraBrasil(venda.data)
}
        </small>
      </div>

      <div class="historico-valor">
        ${fmt(Number(venda.total || 0))}
      </div>
    `;

    box.appendChild(item);
  });
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

  atualizarInterfaceModoPDV();
}

async function alterarModoPDV(modo) {

  modoPDV = modo;

  const btnVenda = document.getElementById("btnModoVenda");
  const btnComanda = document.getElementById("btnModoComanda");

  btnVenda?.classList.remove("active");
  btnComanda?.classList.remove("active");

  if (modo === "venda") {
    btnVenda?.classList.add("active");
    comandaAtiva = null;
    carrinho = [];
    renderCarrinho();
    atualizarInterfaceModoPDV();
    return;
  }

  btnComanda?.classList.add("active");

  atualizarInterfaceModoPDV();

  await abrirModalSelecionarComanda();
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

      <span class="comanda-caixa-status ${comanda.status || "livre"}">
        ${comanda.status || "livre"}
      </span>
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