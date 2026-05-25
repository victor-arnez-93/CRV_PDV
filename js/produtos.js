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

const categoriaLabel = {
  bebidas: "Bebidas",
  alimentos: "Alimentos",
  combos: "Combos",
  servicos: "Serviços",
  outros: "Outros",
  "": "—",
  null: "—"
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
  const numero = parseInt(valor, 10);

  if (Number.isNaN(numero) || numero < 0) {
    return 0;
  }

  return numero;
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

  await carregarProdutos();

  renderProdutos();
  atualizarStatusCaixa();

  if (window.lucide) {
    lucide.createIcons();
  }
});

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

function getProdutosFiltrados() {
  const texto = String(
    document.getElementById("filtroTexto")?.value || ""
  )
    .toLowerCase()
    .trim();

  return produtos.filter(produto => {
    const passaFiltro =
      filtroAtivo === "todos" ||
      (filtroAtivo === "ativos" && produto.ativo) ||
      (filtroAtivo === "inativos" && !produto.ativo);

    const nome = String(produto.nome || "").toLowerCase();
    const codigo = String(produto.codigo || "").toLowerCase();
    const codigoBarras = String(produto.codigo_barras || "").toLowerCase();

    const passaTexto =
      !texto ||
      nome.includes(texto) ||
      codigo.includes(texto) ||
      codigoBarras.includes(texto);

    return passaFiltro && passaTexto;
  });
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
            <button class="produto-btn" onclick="abrirModalEditar('${produto.id}')">
              <i data-lucide="pencil" width="13" height="13"></i>
            </button>

            <button class="produto-btn danger" onclick="confirmarExcluir('${produto.id}')">
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
  document.getElementById("produtoAtivo").checked = true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = false;
  }

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
function abrirModalEditar(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    alert("Produto não encontrado.");
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
  document.getElementById("produtoCategoria").value = produto.categoria || "";
  document.getElementById("produtoAtivo").checked = produto.ativo === true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = produto.produto_rapido === true;
  }

  document.getElementById("modalProduto").style.display = "flex";

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// SALVAR
// ======================================================
async function salvarProduto() {
  const nome = String(document.getElementById("produtoNome")?.value || "").trim();
  const preco = normalizarPreco(document.getElementById("produtoPreco")?.value);
  const precoCusto = normalizarPreco(document.getElementById("produtoPrecoCusto")?.value);
  const estoque = normalizarEstoque(document.getElementById("produtoEstoque")?.value);
  const codigo = String(document.getElementById("produtoCodigo")?.value || "").trim();
  const categoria = String(document.getElementById("produtoCategoria")?.value || "");
  const ativo = document.getElementById("produtoAtivo")?.checked === true;
  const produtoRapido = document.getElementById("produtoRapido")?.checked === true;
  const id = String(document.getElementById("produtoId")?.value || "").trim();

  if (!nome) {
    alert("Informe o nome do produto.");
    return;
  }

  if (preco <= 0) {
    alert("Informe um preço maior que zero.");
    return;
  }

  if (!sistemaOnline()) {
    alert("Sistema sem conexão com Supabase. Aguarde e tente novamente.");
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

      logProdutos("Produto atualizado.", "success");

    } else {
      const { error } = await sb
        .from("produtos")
        .insert([payload]);

      if (error) throw error;

      logProdutos("Produto criado.", "success");
    }

    fecharModal();

    await carregarProdutos();
    renderProdutos();

  } catch (err) {
    logProdutos("Erro ao salvar: " + err.message, "error");
    alert("Erro ao salvar produto: " + err.message);
  }
}

// ======================================================
// EXCLUIR
// ======================================================
function confirmarExcluir(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    alert("Produto não encontrado.");
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
    alert("Sistema sem conexão com Supabase.");
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
    alert("Erro ao excluir produto: " + err.message);
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
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);