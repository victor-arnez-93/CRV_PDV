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
let caixaInicializado = false;
let vendaEmProcessamento = false;

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

    logCaixa("Dados carregados do Supabase.", "success");

  } catch (err) {
    caixa = null;
    vendas = [];

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

    produtosRapidos = produtos.filter(produto => {
      return produto.produto_rapido === true;
    });

    logCaixa(`${produtos.length} produtos carregados do Supabase.`, "success");

  } catch (err) {
    produtos = [];
    produtosRapidos = [];

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

    item.onclick = () => adicionarCarrinho(produto);

    grid.appendChild(item);
  });
}

// ======================================================
// BUSCA
// ======================================================
function setupBusca() {
  const input = document.getElementById("inputBusca");

  if (!input) return;

  input.addEventListener("input", () => {
    const termo = input.value.toLowerCase().trim();
    const sugestoes = document.getElementById("pdvSuggestions");

    if (!sugestoes) return;

    if (!termo) {
      sugestoes.innerHTML = "";
      sugestoes.classList.remove("open");
      return;
    }

    const encontrados = produtos.filter(produto => {
      const nome = String(produto.nome || "").toLowerCase();
      const codigo = String(produto.codigo || "").toLowerCase();
      const codigoBarras = String(produto.codigo_barras || "").toLowerCase();

      return (
        nome.includes(termo) ||
        codigo.includes(termo) ||
        codigoBarras.includes(termo)
      );
    });

    renderSugestoes(encontrados);
  });

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    const termo = input.value.toLowerCase().trim();

    if (!termo) return;

    const produtoExato = produtos.find(produto => {
      const codigo = String(produto.codigo || "").toLowerCase();
      const codigoBarras = String(produto.codigo_barras || "").toLowerCase();
      const nome = String(produto.nome || "").toLowerCase();

      return (
        codigo === termo ||
        codigoBarras === termo ||
        nome === termo
      );
    });

    if (produtoExato) {
      adicionarCarrinho(produtoExato);

      input.value = "";

      const sugestoes = document.getElementById("pdvSuggestions");

      if (sugestoes) {
        sugestoes.innerHTML = "";
        sugestoes.classList.remove("open");
      }
    }
  });
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
function adicionarCarrinho(produto) {
  if (!caixa || caixa.status !== "aberto") {
    alert("Abra o caixa antes de vender.");
    return;
  }

  if (!produto || !produto.id) {
    alert("Produto inválido.");
    return;
  }

  const preco = normalizarNumero(produto.preco);

  if (preco <= 0) {
    alert("Produto sem preço válido.");
    return;
  }

  const estoqueDisponivel = Number(produto.estoque || 0);

  if (estoqueDisponivel <= 0) {
    alert(`Produto sem estoque: ${produto.nome}`);
    return;
  }

  const existente = carrinho.find(item => item.id === produto.id);

  if (existente) {
    const novaQuantidade = Number(existente.quantidade || 0) + 1;

    if (novaQuantidade > estoqueDisponivel) {
      alert(`Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}`);
      return;
    }

    existente.quantidade = novaQuantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: preco,
      codigo: produto.codigo || null,
      codigo_barras: produto.codigo_barras || null,
      quantidade: 1,
      produto_manual: false
    });
  }

  renderCarrinho();
}

function adicionarManual() {
  if (!caixa || caixa.status !== "aberto") {
    alert("Abra o caixa antes de vender.");
    return;
  }

  const nomeInput = document.getElementById("manualNome");
  const precoInput = document.getElementById("manualPreco");
  const qtdInput = document.getElementById("manualQtd");

  const nome = String(nomeInput?.value || "").trim();
  const preco = normalizarNumero(precoInput?.value || 0);
  const quantidade = Math.max(1, parseInt(qtdInput?.value || "1", 10));

  if (!nome) {
    alert("Informe o nome do item manual.");
    return;
  }

  if (preco <= 0) {
    alert("Informe um preço válido.");
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
        x${item.quantidade}
      </div>

      <div class="cart-item-price">
        ${fmt(item.preco * item.quantidade)}
      </div>

      <button class="cart-item-remove" type="button">
        ✕
      </button>
    `;

    const remover = div.querySelector(".cart-item-remove");

    if (remover) {
      remover.onclick = () => {
        carrinho.splice(index, 1);
        renderCarrinho();
      };
    }

    box.appendChild(div);
  });

  atualizarTotais();
}

function limparCarrinho() {
  if (!carrinho.length) return;

  const confirmar = confirm("Deseja limpar o carrinho atual?");

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
    alert("Sistema sem conexão com Supabase.");
    return;
  }

  if (!caixa || caixa.status !== "aberto") {
    alert("Abra o caixa antes de finalizar uma venda.");
    return;
  }

  if (!carrinho.length) {
    alert("Adicione itens ao carrinho.");
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
    alert("Valor recebido menor que o total da venda.");
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
      return {
        empresa_id: empresaId,
        venda_id: vendaData.id,
        produto_id: item.produto_manual ? null : item.id,
        nome: item.nome,
        preco: item.preco,
        quantidade: item.quantidade
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
          ${venda.forma_pagamento || "Venda"}
        </span>
        <small style="display:block;color:var(--text-muted);font-size:0.68rem;margin-top:3px;">
          ${formatarDataHoraBrasil(venda.data)}
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