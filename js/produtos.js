// ======================================================
// CRV PDV - PRODUTOS
// Supabase real + empresa_id + produto_rapido
// ======================================================

// ===== ESTADO =====
const fmt = valor => {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

let produtos = [];
let filtroAtivo = "todos";
let idExcluir = null;
let comboItensTemporarios = [];
let tipoNegocioProdutos = "";
const LIMITE_DIGITOS_MOEDA = 9;
const LIMITE_DIGITOS_ESTOQUE = 6;
const LIMITE_DIGITOS_CODIGO_BARRAS = 13;

const categoriaLabel = {
  bebidas: "Bebidas",
  bebidas_alcoolicas: "Bebidas alcoólicas",
  refrigerantes: "Refrigerantes",
  alimentos: "Alimentos",
  lanches: "Lanches",
  salgados: "Salgados",
  doces: "Doces",
  bolos: "Bolos",
  paes: "Pães",
  frios: "Frios",
  laticinios: "Laticínios",
  pratos: "Pratos",
  porcoes: "Porções",
  petiscos: "Petiscos",
  sobremesas: "Sobremesas",
  cafes: "Cafés",
  bebidas_quentes: "Bebidas quentes",
  higiene: "Higiene",
  limpeza: "Limpeza",
  congelados: "Congelados",
  mercearia: "Mercearia",
  tabacaria: "Tabacaria",
  utilidades: "Utilidades",
  combos: "Combos",
  servicos: "Serviços",
  produtos: "Produtos",
  pacotes: "Pacotes",
  mensalidades: "Mensalidades",
  outros: "Outros",
  "": "—",
  null: "—"
};

const categoriasInteligentesProdutos = {
  bebidas: [
    "bebida", "agua", "água", "mineral", "gatorade", "guaravita",
    "energetico", "energético", "red bull", "monster", "suco"
  ],

  bebidas_alcoolicas: [
    "cerveja", "skol", "brahma", "brhama", "antarctica", "heineken",
    "amstel", "original", "corona", "vinho", "vodka", "whisky", "gin",
    "destilado"
  ],

  refrigerantes: [
    "refrigerante", "coca", "coca-cola", "pepsi", "guarana", "guaraná",
    "fanta", "sprite"
  ],

  alimentos: [
    "alimento", "salgadinho", "salgado", "lanche", "doce", "petisco",
    "porcao", "porção", "bolo", "pao", "pão"
  ],

  salgados: ["salgado", "coxinha", "pastel", "risoles", "kibe", "esfiha"],
  doces: ["doce", "brigadeiro", "beijinho", "chocolate", "trufa", "bombom"],
  lanches: ["lanche", "hamburguer", "hambúrguer", "x-burger", "x-salada"],
  porcoes: ["porcao", "porção", "batata", "frango", "calabresa", "mandioca"],
  petiscos: ["petisco", "amendoim", "torresmo", "batata", "isca"]
};

const categoriasPorSegmento = {
  comercio_geral: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "produtos", "servicos", "combos", "outros"],

  padaria: ["paes", "salgados", "doces", "bolos", "bebidas", "refrigerantes", "frios", "laticinios", "alimentos", "combos", "outros"],

  restaurante: ["pratos", "porcoes", "sobremesas", "bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "combos", "outros"],

  bar_adega: ["bebidas_alcoolicas", "bebidas", "refrigerantes", "alimentos", "petiscos", "combos", "outros"],

  lanchonete: ["lanches", "salgados", "porcoes", "bebidas", "refrigerantes", "sobremesas", "alimentos", "combos", "outros"],

  cafeteria_doceria: ["cafes", "bebidas_quentes", "bebidas", "doces", "bolos", "salgados", "alimentos", "combos", "outros"],

  mercado_mercearia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "higiene", "limpeza", "congelados", "frios", "mercearia", "combos", "outros"],

  loja_conveniencia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "salgados", "doces", "tabacaria", "utilidades", "combos", "outros"],

  arena_esportiva: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  arena_beach: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  quadras_esportivas: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  servicos: ["servicos", "pacotes", "mensalidades", "produtos", "outros"]
};

// ======================================================
// HELPERS
// ======================================================
function logProdutos(mensagem, tipo = "info") {
  if (typeof logSistema === "function") {
    logSistema("PRODUTOS", mensagem, tipo);
  } else {
    console.log(`[CRV PDV][PRODUTOS] ${mensagem}`);
  }
}

function abrirAlertaProduto({
  titulo = "Aviso",
  mensagem = "Verifique as informações.",
  textoConfirmar = "OK",
  mostrarCancelar = false
}) {
  return new Promise(resolve => {
    let modal = document.getElementById("modalAlertaProduto");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modalAlertaProduto";
      modal.className = "modal-overlay";

      modal.innerHTML = `
        <div class="modal card modal-alerta-produto">
          <div class="modal-header">
            <h3 id="alertaProdutoTitulo">Aviso</h3>

            <button class="btn-ghost" id="btnFecharAlertaProduto" type="button" style="padding:6px;">
              <i data-lucide="x" width="16" height="16"></i>
            </button>
          </div>

          <div class="modal-body">
            <p id="alertaProdutoMensagem" class="alerta-produto-texto"></p>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" id="btnCancelarAlertaProduto" type="button">
              Cancelar
            </button>

            <button class="btn-secondary" id="btnOkAlertaProduto" type="button">
              OK
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    }

    const tituloEl = document.getElementById("alertaProdutoTitulo");
    const mensagemEl = document.getElementById("alertaProdutoMensagem");
    const btnFechar = document.getElementById("btnFecharAlertaProduto");
    const btnCancelar = document.getElementById("btnCancelarAlertaProduto");
    const btnOk = document.getElementById("btnOkAlertaProduto");

    if (tituloEl) tituloEl.textContent = titulo;
    if (mensagemEl) mensagemEl.innerHTML = mensagem;
    if (btnOk) btnOk.textContent = textoConfirmar;

    if (btnCancelar) {
      btnCancelar.style.display = mostrarCancelar ? "inline-flex" : "none";
    }

    modal.style.display = "flex";

    const fechar = resposta => {
      modal.style.display = "none";

      if (btnOk) btnOk.onclick = null;
      if (btnCancelar) btnCancelar.onclick = null;
      if (btnFechar) btnFechar.onclick = null;

      resolve(resposta);
    };

    if (btnOk) btnOk.onclick = () => fechar(true);
    if (btnCancelar) btnCancelar.onclick = () => fechar(false);
    if (btnFechar) btnFechar.onclick = () => fechar(false);

    if (window.lucide) {
      lucide.createIcons();
    }
  });
}

function obterEmpresaId() {
  return window.APP_EMPRESA_ID || APP_EMPRESA_ID || null;
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

function formatarNomeProduto(valor) {
  const texto = String(valor || "").replace(/\s+/g, " ");

  if (!texto.trim()) return "";

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizarPreco(valor) {
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
  let somenteNumeros = String(valor || "").replace(/\D/g, "");

  if (!somenteNumeros) {
    return "";
  }

  somenteNumeros = somenteNumeros.slice(0, LIMITE_DIGITOS_MOEDA);

  while (somenteNumeros.length < 3) {
    somenteNumeros = "0" + somenteNumeros;
  }

  const centavos = somenteNumeros.slice(-2);
  const reais = somenteNumeros.slice(0, -2);

  const reaisFormatado = Number(reais).toLocaleString("pt-BR");

  return `${reaisFormatado},${centavos}`;
}

function aplicarMascaraMoedaInput(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = formatarMoedaInput(input.value);
    atualizarPreviewMargemProduto();
  });

  input.addEventListener("blur", () => {
    input.value = formatarMoedaInput(input.value);
    atualizarPreviewMargemProduto();
  });
}

function formatarEstoqueInput(valor) {
  let numeros = String(valor || "")
    .replace(/\D/g, "")
    .slice(0, LIMITE_DIGITOS_ESTOQUE);

  if (!numeros) {
    return "";
  }

  return Number(numeros).toLocaleString("pt-BR");
}

function aplicarMascaraEstoqueInput(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = formatarEstoqueInput(input.value);
  });

  input.addEventListener("blur", () => {
    input.value = formatarEstoqueInput(input.value);
  });
}

function aplicarMascaraCodigoBarrasInput(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = String(input.value || "")
      .replace(/\D/g, "")
      .slice(0, LIMITE_DIGITOS_CODIGO_BARRAS);
  });
}

function valorParaInputMoeda(valor) {
  const numero = Number(valor || 0);

  if (Number.isNaN(numero) || numero <= 0) {
    return "";
  }

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizarEstoque(valor) {
  const numero = parseInt(
    String(valor || "").replace(/\D/g, ""),
    10
  );

  if (Number.isNaN(numero) || numero < 0) {
    return 0;
  }

  return numero;
}

function toggleCategoriaOutros() {
  const categoria = document.getElementById("produtoCategoria");
  const wrap = document.getElementById("categoriaOutrosWrap");
  const input = document.getElementById("produtoCategoriaOutros");

  if (!categoria || !wrap) return;

  if (categoria.value === "outros") {
    wrap.style.display = "flex";
    setTimeout(() => input?.focus(), 60);
  } else {
    wrap.style.display = "none";
    if (input) input.value = "";
  }
}

function obterCategoriaProduto() {
  const categoria = String(document.getElementById("produtoCategoria")?.value || "").trim();
  const categoriaOutros = String(document.getElementById("produtoCategoriaOutros")?.value || "").trim();

  if (categoria === "outros" && categoriaOutros) {
    return categoriaOutros;
  }

  return categoria;
}

async function aguardarContextoSistema() {
  const limite = 40;
  let tentativa = 0;

  while (tentativa < limite) {
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
  logProdutos("Inicializando...");

  setupMascarasProdutos();

  const pronto = await aguardarContextoSistema();

  if (!pronto) {
  logProdutos("Modo offline/cache ativado para produtos.", "warn");

  produtos =
    await crvOfflineDB.obterCache(
      "produtos_lista"
    ) || [];

  renderProdutos();
  atualizarStatusCaixa();

  return;
}

  await carregarTipoNegocioProdutos();
  preencherFiltrosCategoriaProduto();
  await carregarProdutos();

  renderProdutos();
  verificarEstoqueBaixo();
  atualizarStatusCaixa();

  if (window.lucide) {
    lucide.createIcons();
  }
});

// ======================================================
// CARREGAR TIPO NEGÓCIO PRODUTO
// ======================================================
async function carregarTipoNegocioProdutos() {
  try {
    if (!sistemaOnline()) return;

    const { data, error } = await sb
      .from("empresas")
      .select("tipo_negocio")
      .eq("id", obterEmpresaId())
      .maybeSingle();

    if (error) throw error;

    tipoNegocioProdutos = String(data?.tipo_negocio || "comercio_geral");

  } catch (err) {
    tipoNegocioProdutos = "comercio_geral";
    logProdutos("Erro ao carregar segmento: " + err.message, "warn");
  }
}

function obterCategoriasDoSegmento() {
  return categoriasPorSegmento[tipoNegocioProdutos] ||
    categoriasPorSegmento.comercio_geral;
}

function categoriaDisponivelNoSegmento(categoria) {
  const valor = String(categoria || "");

  return (
    valor === "" ||
    valor === "outros" ||
    obterCategoriasDoSegmento().includes(valor)
  );
}

function preencherFiltrosCategoriaProduto() {
  const filtroCategoria = document.getElementById("filtroCategoriaProduto");
  const selectCategoria = document.getElementById("produtoCategoria");

  const categorias = obterCategoriasDoSegmento();

  if (filtroCategoria) {
    filtroCategoria.innerHTML = `
      <option value="todas">Todas as categorias</option>
      ${categorias.map(categoria => `
        <option value="${categoria}">
          ${categoriaLabel[categoria] || categoria}
        </option>
      `).join("")}
    `;
  }

  if (selectCategoria) {
    const valorAtual = selectCategoria.value;

    selectCategoria.innerHTML = `
      <option value="">Sem categoria</option>
      ${categorias.map(categoria => `
        <option value="${categoria}">
          ${categoriaLabel[categoria] || categoria}
        </option>
      `).join("")}
    `;

    if ([...selectCategoria.options].some(option => option.value === valorAtual)) {
      selectCategoria.value = valorAtual;
    }
  }
}

// ======================================================
// CARREGAR PRODUTOS
// ======================================================
async function carregarProdutos() {
  try {
    if (!sistemaOnline()) {
      throw new Error("Sistema sem conexão com Supabase.");
    }

    const empresaId = obterEmpresaId();

    logProdutos("Buscando produtos do Supabase...");

    const { data, error } = await sb
      .from("produtos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    produtos = Array.isArray(data)
      ? data.map(produto => ({
          id: produto.id,
          empresa_id: produto.empresa_id,
          nome: produto.nome || "",
          preco: Number(produto.preco || 0),
          preco_custo: Number(produto.preco_custo || 0),
          estoque: Number(produto.estoque || 0),
          codigo: produto.codigo || "",
          codigo_barras: produto.codigo_barras || produto.codigo || "",
          categoria: produto.categoria || "",
          ativo: produto.ativo !== false,
          produto_rapido: produto.produto_rapido === true,
          created_at: produto.created_at || null,
          updated_at: produto.updated_at || null
        }))
      : [];

    await crvOfflineDB.salvarCache(
  "caixa_produtos",
  produtos
);

await crvOfflineDB.salvarCache(
  "produtos_lista",
  produtos
);

    logProdutos(`${produtos.length} produto(s) carregado(s).`, "success");

  } catch (err) {
    produtos =
  await crvOfflineDB.obterCache(
    "produtos_lista"
  ) || [];

logProdutos(
  produtos.length
    ? "Produtos carregados do cache offline."
    : "Erro ao carregar produtos: " + err.message,
  produtos.length ? "warn" : "error"
);
  }
}

// ======================================================
// FILTROS
// ======================================================
function setFiltro(btn, filtro) {
  document
    .querySelectorAll(".filtro-btn")
    .forEach(botao => botao.classList.remove("active"));

  if (btn) {
    btn.classList.add("active");
  }

  filtroAtivo = filtro;
  renderProdutos();
}

function produtoCombinaComCategoria(produto, categoriaFiltro) {
  if (categoriaFiltro === "todas") return true;

  const categoria = String(produto.categoria || "").toLowerCase();

  if (categoria === categoriaFiltro) return true;

  const nome = String(produto.nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const termos = categoriasInteligentesProdutos[categoriaFiltro] || [];

  return termos.some(termo => {
    const termoNormalizado = String(termo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return nome.includes(termoNormalizado);
  });
}

function getProdutosFiltrados() {
  const texto = String(
    document.getElementById("filtroTexto")?.value || ""
  )
    .toLowerCase()
    .trim();

  const categoriaFiltro = String(
    document.getElementById("filtroCategoriaProduto")?.value || "todas"
  );

  const ordenacao = String(
    document.getElementById("ordenarProdutos")?.value || "az"
  );

  let lista = produtos.filter(produto => {
    const passaFiltro =
      filtroAtivo === "todos" ||
      (filtroAtivo === "ativos" && produto.ativo) ||
      (filtroAtivo === "inativos" && !produto.ativo);

    const categoria = String(produto.categoria || "");

    const passaCategoria =
      produtoCombinaComCategoria(produto, categoriaFiltro);

    const nome = String(produto.nome || "").toLowerCase();
    const codigo = String(produto.codigo || "").toLowerCase();
    const codigoBarras = String(produto.codigo_barras || "").toLowerCase();

    const passaTexto =
      !texto ||
      nome.includes(texto) ||
      codigo.includes(texto) ||
      codigoBarras.includes(texto) ||
      String(categoriaLabel[categoria] || categoria).toLowerCase().includes(texto);

    return passaFiltro && passaCategoria && passaTexto;
  });

  lista.sort((a, b) => {
    const nomeA = String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    const nomeB = String(b.nome || "").localeCompare(String(a.nome || ""), "pt-BR");

    if (ordenacao === "az") return nomeA;
    if (ordenacao === "za") return nomeB;

    if (ordenacao === "menor_preco") {
      return Number(a.preco || 0) - Number(b.preco || 0);
    }

    if (ordenacao === "maior_preco") {
      return Number(b.preco || 0) - Number(a.preco || 0);
    }

    if (ordenacao === "menor_estoque") {
      return Number(a.estoque || 0) - Number(b.estoque || 0);
    }

    if (ordenacao === "maior_estoque") {
      return Number(b.estoque || 0) - Number(a.estoque || 0);
    }

    if (ordenacao === "recentes") {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }

    if (ordenacao === "antigos") {
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    }

    return nomeA;
  });

  return lista;
}

// ======================================================
// RENDER
// ======================================================
function renderProdutos() {
  const grid = document.getElementById("produtosGrid");
  const subtitle = document.getElementById("subtitleProdutos");

  if (!grid) return;

  const lista = getProdutosFiltrados();

  const total = produtos.length;
  const ativos = produtos.filter(produto => produto.ativo).length;
  const rapidos = produtos.filter(produto => produto.produto_rapido).length;

  if (subtitle) {
    subtitle.textContent =
      `${total} produto(s) cadastrado(s) · ${ativos} ativo(s) · ${rapidos} rápido(s)`;
  }

  if (!lista.length) {
    grid.innerHTML = `
      <div class="produtos-empty">
        <i data-lucide="package" width="40" height="40" style="opacity:0.3;"></i>
        <p>Nenhum produto encontrado</p>
        <button class="btn-ghost" onclick="abrirModalNovo()">
          <i data-lucide="plus" width="14" height="14"></i>
          Adicionar produto
        </button>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  grid.innerHTML = lista.map(produto => {
    const estoque = Number(produto.estoque || 0);

    const estoqueClass =
      estoque === 0
        ? "estoque-zero"
        : estoque <= 5
          ? "estoque-low"
          : "estoque-ok";

    const estoqueIcon =
      estoque === 0
        ? "alert-circle"
        : estoque <= 5
          ? "alert-triangle"
          : "check-circle";

    const categoria = produto.categoria || "";

    return `
      <div class="produto-card ${produto.ativo ? "" : "inativo"}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="produto-badges">
            ${
              categoria
                ? `<span class="produto-categoria">${categoriaLabel[categoria] || categoria}</span>`
                : `<span></span>`
            }

            ${
              produto.produto_rapido
                ? `<span class="badge-rapido">
                     <i data-lucide="zap" width="11" height="11"></i>
                     Rápido
                   </span>`
                : ""
            }
          </div>

          ${!produto.ativo ? `<span class="badge badge-danger">Inativo</span>` : ""}
        </div>

        <div class="produto-nome">${produto.nome}</div>

        ${
          produto.codigo
            ? `<span class="produto-codigo">${produto.codigo}</span>`
            : ""
        }

        <div class="produto-preco">${fmt(produto.preco)}</div>

        <div class="produto-custo-info">
          Custo: ${fmt(produto.preco_custo || 0)}
          · Lucro un.: ${fmt(Number(produto.preco || 0) - Number(produto.preco_custo || 0))}
        </div>

        <div class="produto-footer">
          <div class="produto-estoque ${estoqueClass}">
            <i data-lucide="${estoqueIcon}" width="13" height="13"></i>
            ${estoque} em estoque
          </div>

<div class="produto-actions">

  <button
    class="produto-btn"
    onclick="abrirModalEditar('${produto.id}')"
    title="Editar"
  >
    <i data-lucide="pencil" width="13" height="13"></i>
  </button>

  <button
    class="produto-btn"
    onclick="duplicarProduto('${produto.id}')"
    title="Duplicar"
  >
    <i data-lucide="copy" width="13" height="13"></i>
  </button>

  <button
    class="produto-btn danger"
    onclick="confirmarExcluir('${produto.id}')"
    title="Excluir"
  >
    <i data-lucide="trash-2" width="13" height="13"></i>
  </button>

</div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// MODAL NOVO
// ======================================================
function abrirModalNovo() {
  const titulo = document.getElementById("modalProdutoTitulo");

  if (titulo) {
    titulo.textContent = "Novo Produto";
  }

  document.getElementById("produtoId").value = "";
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoPreco").value = "";
  document.getElementById("produtoPrecoCusto").value = "";
  document.getElementById("produtoEstoque").value = "";
  atualizarPreviewMargemProduto();
  document.getElementById("produtoCodigo").value = "";
  document.getElementById("produtoCategoria").value = "";
  document.getElementById("produtoCategoriaOutros").value = "";
  toggleCategoriaOutros();
  document.getElementById("produtoAtivo").checked = true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = false;
  }

  comboItensTemporarios = [];
  renderComboProdutos();
  toggleComboProdutos();

  const modal = document.getElementById("modalProduto");

  if (modal) {
    modal.style.display = "flex";
  }

  setTimeout(() => {
    document.getElementById("produtoNome")?.focus();
  }, 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// MODAL EDITAR
// ======================================================
async function abrirModalEditar(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    abrirAlertaProduto({
      titulo: "Produto não encontrado",
      mensagem: "Não foi possível localizar este produto.",
      textoConfirmar: "Fechar"
    });
    return;
  }

  document.getElementById("modalProdutoTitulo").textContent = "Editar Produto";

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("produtoNome").value = produto.nome;
  document.getElementById("produtoPreco").value = valorParaInputMoeda(produto.preco);
  document.getElementById("produtoPrecoCusto").value = valorParaInputMoeda(produto.preco_custo || 0);
  document.getElementById("produtoEstoque").value = produto.estoque;
  atualizarPreviewMargemProduto();
  document.getElementById("produtoCodigo").value = produto.codigo || "";

if (categoriaDisponivelNoSegmento(produto.categoria)) {
  document.getElementById("produtoCategoria").value = produto.categoria || "";
  document.getElementById("produtoCategoriaOutros").value = "";
} else {
  document.getElementById("produtoCategoria").value = "outros";
  document.getElementById("produtoCategoriaOutros").value = produto.categoria || "";
}

toggleCategoriaOutros();
  document.getElementById("produtoAtivo").checked = produto.ativo === true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = produto.produto_rapido === true;
  }

  await carregarItensComboProduto(produto.id);
  toggleComboProdutos();

  document.getElementById("modalProduto").style.display = "flex";

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function duplicarProduto(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    return;
  }

  document.getElementById("modalProdutoTitulo").textContent =
    "Duplicar Produto";

  document.getElementById("produtoId").value = "";

  document.getElementById("produtoNome").value =
    `${produto.nome} (Cópia)`;

  document.getElementById("produtoPreco").value =
    valorParaInputMoeda(produto.preco);

  document.getElementById("produtoPrecoCusto").value =
    valorParaInputMoeda(produto.preco_custo || 0);

  document.getElementById("produtoEstoque").value =
    produto.estoque || 0;

  atualizarPreviewMargemProduto();

  document.getElementById("produtoCodigo").value = "";

if (categoriaDisponivelNoSegmento(produto.categoria)) {
    document.getElementById("produtoCategoria").value =
      produto.categoria || "";

    document.getElementById("produtoCategoriaOutros").value = "";
  } else {
    document.getElementById("produtoCategoria").value = "outros";

    document.getElementById("produtoCategoriaOutros").value =
      produto.categoria || "";
  }

  toggleCategoriaOutros();

  document.getElementById("produtoAtivo").checked =
    produto.ativo === true;

  document.getElementById("produtoRapido").checked =
    produto.produto_rapido === true;

  await carregarItensComboProduto(produto.id);
  toggleComboProdutos();

  document.getElementById("modalProduto").style.display = "flex";

  setTimeout(() => {
    document.getElementById("produtoNome")?.focus();
  }, 100);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function toggleComboProdutos() {
  const categoria = document.getElementById("produtoCategoria");
  const wrap = document.getElementById("comboProdutosWrap");

  if (!categoria || !wrap) return;

  if (categoria.value === "combos") {
    wrap.style.display = "block";

    if (!comboItensTemporarios.length) {
      adicionarLinhaComboProduto();
    } else {
      renderComboProdutos();
    }
  } else {
    wrap.style.display = "none";
  }
}

function obterProdutosDisponiveisParaCombo() {
  const idAtual = String(document.getElementById("produtoId")?.value || "");

  return produtos.filter(produto => {
    return (
      produto.ativo === true &&
      produto.categoria !== "combos" &&
      String(produto.id) !== idAtual
    );
  });
}

function adicionarLinhaComboProduto(item = null) {
  comboItensTemporarios.push({
    produto_id: item?.produto_id || "",
    quantidade: Number(item?.quantidade || 1)
  });

  renderComboProdutos();
}

function removerLinhaComboProduto(index) {
  comboItensTemporarios.splice(index, 1);
  renderComboProdutos();
}

function atualizarLinhaComboProduto(index, campo, valor) {
  if (!comboItensTemporarios[index]) return;

  if (campo === "quantidade") {
    comboItensTemporarios[index][campo] = Math.max(1, Number(valor || 1));
  } else {
    comboItensTemporarios[index][campo] = valor;
  }
}

function renderComboProdutos() {
  const lista = document.getElementById("comboProdutosLista");

  if (!lista) return;

  const produtosDisponiveis = obterProdutosDisponiveisParaCombo();

  if (!produtosDisponiveis.length) {
    lista.innerHTML = `
      <div class="combo-produtos-empty">
        Cadastre produtos comuns antes de montar um combo.
      </div>
    `;
    return;
  }

  lista.innerHTML = comboItensTemporarios.map((item, index) => {
    return `
      <div class="combo-produto-row">
        <select
          class="input"
          onchange="atualizarLinhaComboProduto(${index}, 'produto_id', this.value)"
        >
          <option value="">Selecione um produto</option>

          ${produtosDisponiveis.map(produto => `
            <option value="${produto.id}" ${String(item.produto_id) === String(produto.id) ? "selected" : ""}>
              ${produto.nome} · ${fmt(produto.preco)}
            </option>
          `).join("")}
        </select>

        <input
          class="input"
          type="number"
          min="1"
          step="1"
          value="${item.quantidade || 1}"
          onchange="atualizarLinhaComboProduto(${index}, 'quantidade', this.value)"
        >

        <button
          class="produto-btn danger"
          type="button"
          onclick="removerLinhaComboProduto(${index})"
        >
          <i data-lucide="trash-2" width="13" height="13"></i>
        </button>
      </div>
    `;
  }).join("");

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function carregarItensComboProduto(comboId) {
  comboItensTemporarios = [];

  if (!comboId || !sistemaOnline()) return;

  const { data, error } = await sb
    .from("produto_combo_itens")
    .select("*")
    .eq("empresa_id", obterEmpresaId())
    .eq("combo_id", comboId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  comboItensTemporarios = (data || []).map(item => ({
    produto_id: item.produto_id,
    quantidade: Number(item.quantidade || 1)
  }));
}

async function salvarItensComboProduto(comboId) {
  const categoria = obterCategoriaProduto();

  await sb
    .from("produto_combo_itens")
    .delete()
    .eq("empresa_id", obterEmpresaId())
    .eq("combo_id", comboId);

  if (categoria !== "combos") return;

  const itensValidos = comboItensTemporarios.filter(item => {
    return item.produto_id && Number(item.quantidade || 0) > 0;
  });

  if (!itensValidos.length) {
    throw new Error("Combo precisa ter pelo menos um produto cadastrado selecionado.");
  }

  const idsUnicos = new Set();

  for (const item of itensValidos) {
    if (idsUnicos.has(item.produto_id)) {
      throw new Error("O mesmo produto não pode aparecer duas vezes no combo.");
    }

    idsUnicos.add(item.produto_id);
  }

  const payload = itensValidos.map(item => ({
    empresa_id: obterEmpresaId(),
    combo_id: comboId,
    produto_id: item.produto_id,
    quantidade: Number(item.quantidade || 1)
  }));

  const { error } = await sb
    .from("produto_combo_itens")
    .insert(payload);

  if (error) throw error;
}

// ======================================================
// SALVAR
// ======================================================
async function salvarProduto() {
  const id = String(document.getElementById("produtoId")?.value || "").trim();
  const nome = formatarNomeProduto(
  document.getElementById("produtoNome")?.value
);

  const nomeExistente = produtos.find(produto => {
    return (
      String(produto.nome || "").trim().toLowerCase() === nome.trim().toLowerCase() &&
      String(produto.id) !== String(id)
    );
  });

if (nomeExistente) {
  await abrirAlertaProduto({
    titulo: "Produto duplicado",
    mensagem: "Já existe um produto com este nome cadastrado."
  });

  return;
}
  const preco = normalizarPreco(document.getElementById("produtoPreco")?.value);
  const precoCusto = normalizarPreco(document.getElementById("produtoPrecoCusto")?.value);
  const estoque = normalizarEstoque(document.getElementById("produtoEstoque")?.value);
  const codigo = String(document.getElementById("produtoCodigo")?.value || "").trim();
  const categoria = obterCategoriaProduto();
  const ativo = document.getElementById("produtoAtivo")?.checked === true;
  const produtoRapido = document.getElementById("produtoRapido")?.checked === true;

  if (!nome) {
    await abrirAlertaProduto({
  titulo: "Nome obrigatório",
  mensagem: "Informe o nome do produto."
});
return;
    return;
  }

  if (preco <= 0) {
    await abrirAlertaProduto({
  titulo: "Preço inválido",
  mensagem: "Informe um preço maior que zero."
});
return;
    return;
  }

  if (!sistemaOnline()) {
    await abrirAlertaProduto({
  titulo: "Sistema offline",
  mensagem: "Sistema sem conexão com Supabase. Aguarde e tente novamente."
});
return;
    return;
  }

  try {
    const empresaId = obterEmpresaId();

    const payload = {
      empresa_id: empresaId,
      nome: nome,
      preco: preco,
      preco_custo: precoCusto,
      estoque: estoque,
      codigo: codigo || null,
      codigo_barras: codigo || null,
      categoria: categoria || null,
      ativo: ativo,
      produto_rapido: produtoRapido,
      updated_at: new Date().toISOString()
    };

    if (id) {
      const { error } = await sb
        .from("produtos")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      await salvarItensComboProduto(id);

      logProdutos("Produto atualizado.", "success");

    } else {
      const { data: produtoCriado, error } = await sb
        .from("produtos")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      await salvarItensComboProduto(produtoCriado.id);

      logProdutos("Produto criado.", "success");
    }

    fecharModal();

    await carregarProdutos();
    renderProdutos();

  } catch (err) {
    logProdutos("Erro ao salvar: " + err.message, "error");
      await abrirAlertaProduto({
      titulo: "Erro ao salvar produto",
      mensagem:
  err.message?.includes("duplicate") ||
  err.message?.includes("unique")
    ? "Já existe um produto com este nome ou código cadastrado."
    : err.message || "Não foi possível salvar o produto."
    });
  }
}

// ======================================================
// EXCLUIR
// ======================================================
async function confirmarExcluir(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    await abrirAlertaProduto({
      titulo: "Produto não encontrado",
      mensagem: "Não foi possível localizar este produto.",
      textoConfirmar: "Fechar"
    });

    return;
  }

  idExcluir = id;

  const msg = document.getElementById("msgExcluir");

  if (msg) {
    msg.textContent = `"${produto.nome}" será removido permanentemente.`;
  }

  const btn = document.getElementById("btnConfirmarExcluir");

  if (btn) {
    btn.onclick = () => excluirProduto(id);
  }

  const modal = document.getElementById("modalExcluir");

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function excluirProduto(id) {
  if (!sistemaOnline()) {
    await abrirAlertaProduto({
      titulo: "Sistema offline",
      mensagem: "Sistema sem conexão com Supabase. Aguarde e tente novamente.",
      textoConfirmar: "Fechar"
    });

    return;
  }

  try {
    const empresaId = obterEmpresaId();

    const { error } = await sb
      .from("produtos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;

    logProdutos("Produto excluído.", "success");

    idExcluir = null;

    fecharModal();

    await carregarProdutos();
    renderProdutos();

  } catch (err) {
    logProdutos("Erro ao excluir: " + err.message, "error");

    await abrirAlertaProduto({
      titulo: "Erro ao excluir produto",
      mensagem: err.message || "Não foi possível excluir o produto.",
      textoConfirmar: "Fechar"
    });
  }
}

// ======================================================
// MODAL
// ======================================================
function fecharModal() {
  const modalProduto = document.getElementById("modalProduto");
  const modalExcluir = document.getElementById("modalExcluir");

  if (modalProduto) {
    modalProduto.style.display = "none";
  }

  if (modalExcluir) {
    modalExcluir.style.display = "none";
  }
}

// ======================================================
// STATUS CAIXA NO TOPO
// ======================================================
async function atualizarStatusCaixa() {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!dot || !text || !sistemaOnline()) return;

  try {
    const { data, error } = await sb
      .from("caixa")
      .select("id,status")
      .eq("empresa_id", obterEmpresaId())
      .eq("status", "aberto")
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      dot.classList.remove("closed");
      dot.classList.add("open");
      text.textContent = "Caixa aberto";
      text.style.color = "var(--crv-green)";
    } else {
      dot.classList.remove("open");
      dot.classList.add("closed");
      text.textContent = "Caixa fechado";
      text.style.color = "";
    }

  } catch (err) {
    logProdutos("Erro ao atualizar status do caixa: " + err.message, "error");
  }
}

// ======================================================
// PREVIEW DE MARGEM / LUCRO
// ======================================================

function atualizarPreviewMargemProduto() {
  const precoVenda = normalizarPreco(
    document.getElementById("produtoPreco")?.value
  );

  const precoCusto = normalizarPreco(
    document.getElementById("produtoPrecoCusto")?.value
  );

  const preview = document.getElementById("produtoMargemPreview");

  if (!preview) return;

  if (precoVenda <= 0) {
    preview.textContent = "Informe venda e custo";
    preview.classList.remove("lucro-negativo", "lucro-positivo");
    return;
  }

  const lucro = precoVenda - precoCusto;
  const margem = precoVenda > 0
    ? (lucro / precoVenda) * 100
    : 0;

  preview.textContent =
    `Lucro un.: ${fmt(lucro)} · Margem: ${margem.toFixed(1)}%`;

  preview.classList.remove("lucro-negativo", "lucro-positivo");

  if (lucro < 0) {
    preview.classList.add("lucro-negativo");
  } else {
    preview.classList.add("lucro-positivo");
  }
}

document.addEventListener("input", event => {
  if (
    event.target &&
    (
      event.target.id === "produtoPreco" ||
      event.target.id === "produtoPrecoCusto"
    )
  ) {
    atualizarPreviewMargemProduto();
  }
});

// ======================================================
// MÁSCARAS DO FORMULÁRIO DE PRODUTOS
// ======================================================
function setupMascarasProdutos() {
  aplicarMascaraMoedaInput(document.getElementById("produtoPreco"));
  aplicarMascaraMoedaInput(document.getElementById("produtoPrecoCusto"));
  aplicarMascaraEstoqueInput(document.getElementById("produtoEstoque"));
  aplicarMascaraCodigoBarrasInput(document.getElementById("produtoCodigo"));

const produtoNome = document.getElementById("produtoNome");

if (produtoNome) {
  produtoNome.addEventListener("input", () => {
    const cursor = produtoNome.selectionStart;

    produtoNome.value = formatarNomeProduto(produtoNome.value);

    produtoNome.setSelectionRange(cursor, cursor);
  });

  produtoNome.addEventListener("blur", () => {
    produtoNome.value = formatarNomeProduto(produtoNome.value).trim();
  });
}
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);

// ======================================================
// ALERTA ESTOQUE BAIXO
// ======================================================

function verificarEstoqueBaixo() {
  if (!Array.isArray(produtos) || !produtos.length) {
    return;
  }

  const baixos = produtos.filter(produto => {
    return Number(produto.estoque || 0) > 0 &&
           Number(produto.estoque || 0) <= 5 &&
           produto.ativo !== false;
  });

  if (!baixos.length) {
    return;
  }

  const primeiro = baixos[0];

  if (typeof mostrarToast === "function") {
    mostrarToast({
      tipo: "warn",
      titulo: "Estoque baixo",
      mensagem:
        `${primeiro.nome} está com apenas ${primeiro.estoque} unidade(s).`
    });

    return;
  }

  console.warn(
    `[CRV PDV] Estoque baixo: ${primeiro.nome}`
  );
}