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
let tipoAbaAtivo = "produto";
let idExcluir = null;
let comboItensTemporarios = [];
let tipoNegocioProdutos = "";
let categoriasPersonalizadasProdutos = [];
let produtoEstoqueOriginal = null;
let produtoMovimentacaoSelecionado = null;
let movimentacaoEstoqueEmProcessamento = false;
let visualizacaoProdutos = "cards";
const produtosSelecionadosLista = new Set();
try {
  visualizacaoProdutos = localStorage.getItem("crv-produtos-visualizacao") === "lista" ? "lista" : "cards";
} catch (_) {
  // Mantém a visualização padrão quando o armazenamento não está disponível.
}

function setVisualizacaoProdutos(tipo) {
  visualizacaoProdutos = tipo === "lista" ? "lista" : "cards";
  try {
    localStorage.setItem("crv-produtos-visualizacao", visualizacaoProdutos);
  } catch (_) {
    // O alternador continua funcional nesta sessão.
  }
  renderProdutos();
}

function podeEditarProdutosEmMassa() {
  return typeof crvOperadorPodeModulo === "function"
    && typeof crvOperadorPodeEspecial === "function"
    && crvOperadorPodeModulo("produtos", "editar")
    && crvOperadorPodeEspecial("editar_produtos_em_massa");
}

async function confirmarPermissaoAtualProdutos(acao, especiais = []) {
  const operadorId = sessionStorage.getItem("CRV_OPERADOR_ID");
  if (!sistemaOnline()) return false;
  if (!operadorId) return true;

  const empresaId = obterEmpresaId();
  if (!empresaId) return false;

  try {
    const { data: operador, error: erroOperador } = await sb
      .from("operadores_internos")
      .select("id, perfil, ativo")
      .eq("id", operadorId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (erroOperador || !operador?.ativo) return false;
    if (operador.perfil === "admin") return true;

    const { data: modulo, error: erroModulo } = await sb
      .from("operador_permissoes")
      .select("pode_criar, pode_editar, pode_excluir")
      .eq("empresa_id", empresaId)
      .eq("operador_id", operadorId)
      .eq("modulo_codigo", "produtos")
      .maybeSingle();
    if (erroModulo || modulo?.[`pode_${acao}`] !== true) return false;
    if (!especiais.length) return true;

    const { data: permissoes, error: erroEspeciais } = await sb
      .from("operador_permissoes_especiais")
      .select("permissao, permitido")
      .eq("empresa_id", empresaId)
      .eq("operador_id", operadorId)
      .in("permissao", especiais);
    if (erroEspeciais) return false;
    return especiais.every(permissao => permissoes?.some(
      item => item.permissao === permissao && item.permitido === true
    ));
  } catch (erro) {
    console.warn("[PRODUTOS] Não foi possível conferir as permissões.", erro);
    return false;
  }
}

function atualizarControlesEdicaoMassaProdutos() {
  const botao = document.getElementById("btnEdicaoMassa");
  if (botao) {
    botao.hidden = !podeEditarProdutosEmMassa();
    const texto = botao.querySelector("span");
    if (texto) texto.textContent = produtosSelecionadosLista.size
      ? `Edição em massa (${produtosSelecionadosLista.size})`
      : "Edição em massa";
  }
}

function tipoEstoqueEdicaoMassa(tipo) {
  return ["entrada", "saida", "ajuste"].includes(tipo);
}

function resultadoEdicaoMassa(item, tipo, valor) {
  const atual = Number(tipo === "preco" ? item.preco : tipo === "preco_custo" ? item.preco_custo : item.estoque || 0);
  const proximo = tipo === "entrada" ? atual + valor : tipo === "saida" ? atual - valor : valor;
  return { atual, proximo };
}

function confirmarEdicaoMassaProdutos(resumo) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "modal-confirmacao-massa-produtos";
    modal.innerHTML = `
      <h3>Confirmar edição em massa</h3>
      <p></p>
      <div class="edicao-massa-acoes">
        <button type="button" class="btn-ghost" data-cancelar>Voltar</button>
        <button type="button" class="btn-secondary" data-confirmar>Confirmar edição</button>
      </div>`;
    modal.querySelector("p").textContent = resumo;
    document.body.appendChild(modal);
    let resposta = false;
    modal.querySelector("[data-cancelar]").onclick = () => modal.close();
    modal.querySelector("[data-confirmar]").onclick = () => {
      resposta = true;
      modal.close();
    };
    modal.addEventListener("close", () => {
      modal.remove();
      resolve(resposta);
    }, { once: true });
    modal.showModal();
  });
}

async function abrirEdicaoMassaProdutos() {
  if (!podeEditarProdutosEmMassa()) return;
  if (!sistemaOnline()) {
    await abrirAlertaProduto({ titulo: "Conexão necessária", mensagem: "A edição em massa exige conexão com o Supabase." });
    return;
  }
  await carregarProdutos();
  const idsAtuais = new Set(produtos.map(item => String(item.id)));
  const selecionados = new Set([...produtosSelecionadosLista].filter(id => idsAtuais.has(id)));
  let filtroModal = "todos";
  const categoriasModal = [...new Set(produtos.map(item => String(item.categoria || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const dialogo = document.createElement("dialog");
  dialogo.className = "modal-edicao-massa-produtos";
  dialogo.setAttribute("aria-labelledby", "edicaoMassaTitulo");
  dialogo.innerHTML = `
    <form id="edicaoMassaForm">
      <header class="edicao-massa-cabecalho">
        <div>
          <h3 id="edicaoMassaTitulo">Edição em massa</h3>
          <p>Escolha os itens e uma alteração para aplicar a todos.</p>
        </div>
        <button type="button" class="edicao-massa-fechar" data-cancelar aria-label="Fechar edição em massa"><i data-lucide="x" width="18" height="18"></i></button>
      </header>
      <div class="edicao-massa-corpo">
        <section class="edicao-massa-secao" aria-label="Selecionar itens">
          <h4>1. Itens</h4>
          <input id="edicaoMassaBusca" class="input" type="search" placeholder="Buscar por nome ou código" autocomplete="off" />
          <div class="edicao-massa-filtros" role="group" aria-label="Filtrar itens">
            <button type="button" class="active" data-filtro-massa="todos">Todos</button>
            <button type="button" data-filtro-massa="ativos">Ativos</button>
            <button type="button" data-filtro-massa="rapidos">Rápidos</button>
            <button type="button" data-filtro-massa="baixo">Baixo estoque</button>
            <button type="button" data-filtro-massa="zerado">Sem estoque</button>
          </div>
          <select id="edicaoMassaCategoria" class="input" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${categoriasModal.map(categoria => `<option value="${escaparHTMLProduto(categoria)}">${escaparHTMLProduto(categoriaLabel[categoria] || categoria)}</option>`).join("")}</select>
          <div class="edicao-massa-lista" id="edicaoMassaLista"></div>
          <div class="edicao-massa-selecao"><button type="button" class="btn-ghost" id="edicaoMassaSelecionarVisiveis">Selecionar todos</button><button type="button" class="btn-ghost" id="edicaoMassaLimpar">Limpar seleção</button></div>
        </section>
        <section class="edicao-massa-secao" aria-label="Definir alteração">
          <h4>2. Alteração</h4>
          <label for="edicaoMassaTipo">O que alterar <span class="edicao-massa-obrigatorio">*</span></label>
          <select id="edicaoMassaTipo" class="input" required>
            <option value="preco">Preço de venda</option>
            <option value="preco_custo">Preço de custo</option>
            <option value="entrada">Entrada no estoque</option>
            <option value="saida">Saída do estoque</option>
            <option value="ajuste">Definir estoque final</option>
          </select>
          <label for="edicaoMassaValor" id="edicaoMassaValorLabel">Novo preço de venda <span class="edicao-massa-obrigatorio">*</span></label>
          <input id="edicaoMassaValor" class="input input-money" inputmode="decimal" placeholder="Ex.: 7,00" autocomplete="off" required />
          <label for="edicaoMassaMotivo">Motivo <span class="edicao-massa-obrigatorio">*</span></label>
          <textarea id="edicaoMassaMotivo" class="input" rows="3" minlength="3" maxlength="240" placeholder="Ex.: reajuste do fornecedor" required></textarea>
          <p class="edicao-massa-ajuda" id="edicaoMassaAjuda">O mesmo valor será aplicado aos itens selecionados.</p>
        </section>
      </div>
      <footer class="edicao-massa-rodape">
        <div id="edicaoMassaResumo" aria-live="polite">Nenhum item selecionado.</div>
        <div class="edicao-massa-acoes"><button type="button" class="btn-ghost" data-cancelar>Cancelar</button><button type="submit" class="btn-primary">Confirmar alterações</button></div>
      </footer>
    </form>`;
  document.body.appendChild(dialogo);
  let processando = false;
  dialogo.addEventListener("close", () => dialogo.remove(), { once: true });
  dialogo.addEventListener("cancel", event => {
    if (processando) event.preventDefault();
  });
  const campo = seletor => dialogo.querySelector(seletor);
  const tipoAtual = () => campo("#edicaoMassaTipo").value;
  campo("#edicaoMassaValor").addEventListener("input", event => {
    const input = event.currentTarget;
    input.value = tipoEstoqueEdicaoMassa(tipoAtual())
      ? formatarEstoqueInput(input.value)
      : formatarMoedaInput(input.value);
  });
  const elegiveis = () => produtos.filter(item => !tipoEstoqueEdicaoMassa(tipoAtual()) || itemControlaEstoque(item));
  const filtrados = () => {
    const busca = campo("#edicaoMassaBusca").value.toLocaleLowerCase("pt-BR").trim();
    const categoria = campo("#edicaoMassaCategoria").value;
    return elegiveis().filter(item => {
      if (categoria && String(item.categoria || "") !== categoria) return false;
      if (!`${item.nome} ${item.codigo || ""}`.toLocaleLowerCase("pt-BR").includes(busca)) return false;
      if (filtroModal === "ativos") return item.ativo === true;
      if (filtroModal === "rapidos") return item.produto_rapido === true;
      if (filtroModal === "baixo") return itemControlaEstoque(item) && Number(item.estoque || 0) > 0 && Number(item.estoque || 0) <= estoqueMinimoProduto(item);
      if (filtroModal === "zerado") return itemControlaEstoque(item) && Number(item.estoque || 0) === 0;
      return true;
    });
  };
  function renderizarLista() {
    const visiveis = filtrados();
    const topoLista = campo("#edicaoMassaLista").scrollTop;
    campo("#edicaoMassaLista").innerHTML = visiveis.map(item => `
      <label class="edicao-massa-item">
        <input type="checkbox" value="${escaparHTMLProduto(item.id)}" ${selecionados.has(String(item.id)) ? "checked" : ""} />
        <span><strong>${escaparHTMLProduto(item.nome)}</strong><small>${escaparHTMLProduto(item.codigo || "Sem código")} · Venda ${fmt(item.preco)} · Custo ${fmt(item.preco_custo)}${itemControlaEstoque(item) ? ` · Estoque ${Number(item.estoque || 0)}` : ""}</small></span>
      </label>`).join("") || '<p class="edicao-massa-vazio">Nenhum item encontrado.</p>';
    campo("#edicaoMassaLista").scrollTop = topoLista;
    campo("#edicaoMassaResumo").textContent = `${selecionados.size} item(ns) selecionado(s).`;
    const todosMarcados = visiveis.length > 0 && visiveis.every(item => selecionados.has(String(item.id)));
    campo("#edicaoMassaSelecionarVisiveis").textContent = todosMarcados ? "Remover todos" : "Selecionar todos";
  }
  campo("#edicaoMassaLista").addEventListener("change", event => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.checked) selecionados.add(input.value);
    else selecionados.delete(input.value);
    renderizarLista();
  });
  campo("#edicaoMassaBusca").oninput = renderizarLista;
  campo("#edicaoMassaCategoria").onchange = renderizarLista;
  dialogo.querySelectorAll("[data-filtro-massa]").forEach(botao => botao.onclick = () => {
    filtroModal = botao.dataset.filtroMassa;
    dialogo.querySelectorAll("[data-filtro-massa]").forEach(item => item.classList.toggle("active", item === botao));
    renderizarLista();
  });
  campo("#edicaoMassaSelecionarVisiveis").onclick = () => {
    const visiveis = filtrados();
    const todosMarcados = visiveis.length > 0 && visiveis.every(item => selecionados.has(String(item.id)));
    visiveis.forEach(item => {
      if (todosMarcados) selecionados.delete(String(item.id));
      else selecionados.add(String(item.id));
    });
    renderizarLista();
  };
  campo("#edicaoMassaLimpar").onclick = () => {
    selecionados.clear();
    renderizarLista();
  };
  campo("#edicaoMassaTipo").onchange = () => {
    const tipo = tipoAtual();
    if (tipoEstoqueEdicaoMassa(tipo)) {
      produtos.filter(item => !itemControlaEstoque(item)).forEach(item => selecionados.delete(String(item.id)));
    }
    campo("#edicaoMassaValor").value = "";
    campo("#edicaoMassaValor").placeholder = tipoEstoqueEdicaoMassa(tipo) ? "Quantidade inteira" : "Ex.: 7,00";
    campo("#edicaoMassaValor").inputMode = tipoEstoqueEdicaoMassa(tipo) ? "numeric" : "decimal";
    campo("#edicaoMassaValorLabel").firstChild.textContent = ({ preco: "Novo preço de venda ", preco_custo: "Novo preço de custo ", entrada: "Quantidade a acrescentar ", saida: "Quantidade a retirar ", ajuste: "Estoque final de cada item " })[tipo];
    campo("#edicaoMassaAjuda").textContent = tipoEstoqueEdicaoMassa(tipo) ? "Somente itens com controle de estoque. Cada movimentação será registrada com este motivo." : "O preço atual de cada item será conferido antes de salvar. O motivo será registrado no histórico.";
    renderizarLista();
  };
  if (!crvOperadorPodeEspecial("movimentar_estoque")) {
    campo("#edicaoMassaTipo").querySelectorAll('option[value="entrada"], option[value="saida"], option[value="ajuste"]')
      .forEach(option => option.remove());
  }
  dialogo.querySelectorAll("[data-cancelar]").forEach(botao => botao.onclick = () => {
    if (!processando) dialogo.close();
  });
  campo("#edicaoMassaForm").onsubmit = async event => {
    event.preventDefault();
    if (processando) return;
    const tipo = tipoAtual();
    if (!podeEditarProdutosEmMassa() || (tipoEstoqueEdicaoMassa(tipo) && !crvOperadorPodeEspecial("movimentar_estoque"))) {
      campo("#edicaoMassaResumo").textContent = "Este operador não tem permissão para esta alteração.";
      return;
    }
    const textoValor = campo("#edicaoMassaValor").value.trim();
    const valor = tipoEstoqueEdicaoMassa(tipo) ? Number(textoValor.replace(/\./g, "")) : normalizarPreco(textoValor);
    const motivo = campo("#edicaoMassaMotivo").value.trim();
    const itens = produtos.filter(item => selecionados.has(String(item.id)) && (!tipoEstoqueEdicaoMassa(tipo) || itemControlaEstoque(item)));
    if (!itens.length) {
      campo("#edicaoMassaResumo").textContent = "Selecione pelo menos um item.";
      return;
    }
    if (!textoValor || !Number.isFinite(valor) || (tipoEstoqueEdicaoMassa(tipo) && (!Number.isSafeInteger(valor) || valor < 0 || (tipo !== "ajuste" && valor === 0))) || (tipo === "preco" && valor <= 0) || (tipo === "preco_custo" && valor < 0) || (tipo === "saida" && itens.some(item => Number(item.estoque || 0) < valor))) {
      campo("#edicaoMassaResumo").textContent = "Confira o valor e o estoque disponível dos itens selecionados.";
      campo("#edicaoMassaValor").focus();
      return;
    }
    if (motivo.length < 3) {
      campo("#edicaoMassaMotivo").focus();
      return;
    }
    const rotulo = campo("#edicaoMassaTipo").selectedOptions[0].textContent;
    const antesDepois = itens.slice(0, 4).map(item => {
      const { atual, proximo } = resultadoEdicaoMassa(item, tipo, valor);
      return `${item.nome}: ${tipoEstoqueEdicaoMassa(tipo) ? `${atual} → ${proximo}` : `${fmt(atual)} → ${fmt(proximo)}`}`;
    });
    const confirmado = await confirmarEdicaoMassaProdutos(
      `${rotulo} em ${itens.length} item(ns). ${antesDepois.join(" · ")}${itens.length > 4 ? ` · e mais ${itens.length - 4}` : ""}. Motivo: ${motivo}`
    );
    if (!confirmado) return;
    const especiais = ["editar_produtos_em_massa"];
    if (tipoEstoqueEdicaoMassa(tipo)) especiais.push("movimentar_estoque");
    if (!podeEditarProdutosEmMassa()
        || (tipoEstoqueEdicaoMassa(tipo) && !crvOperadorPodeEspecial("movimentar_estoque"))
        || !await confirmarPermissaoAtualProdutos("editar", especiais)) {
      campo("#edicaoMassaResumo").textContent = "Confira as permissões e a conexão antes de tentar novamente.";
      return;
    }
    const botaoConfirmar = campo('#edicaoMassaForm button[type="submit"]');
    processando = true;
    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Registrando...";
    const falhas = [];
    let alterados = 0;
    if (!tipoEstoqueEdicaoMassa(tipo)) {
      let data;
      let error;
      try {
        ({ data, error } = await sb.rpc("crv_editar_precos_em_massa", {
        p_itens: itens.map(item => ({ id: item.id, anterior: Number(item[tipo] || 0) })),
        p_campo: tipo,
        p_valor: valor,
        p_motivo: motivo
        }));
      } catch (falhaRede) {
        error = falhaRede;
      }
      if (error) {
        processando = false;
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = "Confirmar alterações";
        campo("#edicaoMassaResumo").textContent = `Preços não alterados: ${error.message || "Confira se a migração SQL foi aplicada."}`;
        return;
      }
      alterados = Number(data?.alterados ?? itens.length);
    } else {
      for (const item of itens) {
        try {
          if (!sistemaOnline() || !podeEditarProdutosEmMassa() || !crvOperadorPodeEspecial("movimentar_estoque")) throw new Error("Sessão indisponível");
          const parametros = { p_produto_id: item.id, p_motivo: motivo, p_operador_id: obterOperadorAtualIdProdutos() };
          const resposta = tipo === "ajuste"
            ? await sb.rpc("ajustar_estoque_produto", { ...parametros, p_novo_estoque: valor })
            : await sb.rpc("movimentar_estoque_produto", { ...parametros, p_tipo: tipo, p_quantidade: valor, p_referencia_tipo: "manual", p_referencia_id: null, p_venda_id: null, p_caixa_id: null });
          if (resposta.error) throw resposta.error;
          alterados++;
        } catch (_) {
          falhas.push(item.nome);
        }
      }
    }
    produtosSelecionadosLista.clear();
    await carregarProdutos();
    renderProdutos();
    dialogo.close();
    if (typeof crvToast === "function") {
      crvToast({
        titulo: falhas.length ? "Alteração parcialmente confirmada" : "Alterações confirmadas",
        mensagem: falhas.length
          ? `${alterados} item(ns) atualizado(s); ${falhas.length} não atualizado(s). Confira o estoque e tente novamente.`
          : `${alterados} item(ns) atualizado(s) com sucesso.`,
        tipo: falhas.length ? "warn" : "success",
        tempo: 6000
      });
    }
  };
  renderizarLista();
  dialogo.showModal();
  if (window.lucide) lucide.createIcons();
  campo("#edicaoMassaBusca").focus();
}
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
  jogos_lazer: "Jogos e lazer",
  locacoes: "Locações",
  taxas: "Taxas",
  multas: "Multas",
  alugueis: "Aluguéis",
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

  padaria_confeitaria: ["paes", "salgados", "doces", "bolos", "bebidas", "refrigerantes", "frios", "laticinios", "alimentos", "combos", "outros"],

  restaurante: ["pratos", "porcoes", "sobremesas", "bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "combos", "outros"],

  bar_adega: ["bebidas_alcoolicas", "bebidas", "refrigerantes", "alimentos", "petiscos", "combos", "outros"],

  lanchonete: ["lanches", "salgados", "porcoes", "bebidas", "refrigerantes", "sobremesas", "alimentos", "combos", "outros"],

  lanchonete_cafeteria: ["cafes", "bebidas_quentes", "lanches", "salgados", "doces", "bolos", "porcoes", "bebidas", "refrigerantes", "sobremesas", "alimentos", "combos", "outros"],

  cafeteria_doceria: ["cafes", "bebidas_quentes", "bebidas", "doces", "bolos", "salgados", "alimentos", "combos", "outros"],

  mercado_mercearia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "higiene", "limpeza", "congelados", "frios", "mercearia", "combos", "outros"],

  mercado_conveniencia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "higiene", "limpeza", "congelados", "laticinios", "mercearia", "salgados", "doces", "utilidades", "combos", "outros"],

  loja_conveniencia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "salgados", "doces", "tabacaria", "utilidades", "combos", "outros"],

  conveniencia: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "salgados", "doces", "tabacaria", "utilidades", "combos", "outros"],

  arena_esportiva: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  arena_beach: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  quadras_esportivas: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  arena_quadras: ["bebidas", "bebidas_alcoolicas", "refrigerantes", "alimentos", "lanches", "salgados", "combos", "outros"],

  servicos: ["servicos", "pacotes", "mensalidades", "produtos", "outros"],

  servicos_gerais: ["servicos", "pacotes", "produtos", "outros"],

  servicos_agendados: ["servicos", "pacotes", "mensalidades", "produtos", "outros"],

  assistencia_tecnica: ["servicos", "produtos", "outros"]
};

const tiposItemCatalogo = {
  produto: {
    singular: "produto",
    plural: "produtos",
    tituloNovo: "Novo Produto",
    tituloEditar: "Editar Produto",
    tituloDuplicar: "Duplicar Produto",
    icone: "package",
    placeholder: "Ex: Água Mineral 500ml"
  },
  servico: {
    singular: "serviço",
    plural: "serviços",
    tituloNovo: "Novo Serviço",
    tituloEditar: "Editar Serviço",
    tituloDuplicar: "Duplicar Serviço",
    icone: "wrench",
    placeholder: "Ex: Bilhar por ficha"
  },
  taxa: {
    singular: "taxa",
    plural: "taxas",
    tituloNovo: "Nova Taxa",
    tituloEditar: "Editar Taxa",
    tituloDuplicar: "Duplicar Taxa",
    icone: "badge-dollar-sign",
    placeholder: "Ex: Taxa de locação"
  },
  outro: {
    singular: "item",
    plural: "outros itens",
    tituloNovo: "Novo Item",
    tituloEditar: "Editar Item",
    tituloDuplicar: "Duplicar Item",
    icone: "shapes",
    placeholder: "Ex: Item comercial"
  }
};

const categoriasPorTipoItem = {
  servico: ["jogos_lazer", "locacoes", "servicos", "pacotes", "mensalidades", "outros"],
  taxa: ["taxas", "multas", "alugueis", "outros"],
  outro: ["outros"]
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

function normalizarTipoItemCatalogo(valor) {
  const tipo = String(valor || "produto")
    .toLowerCase()
    .trim();

  return tiposItemCatalogo[tipo]
    ? tipo
    : "produto";
}

function obterTipoItemProduto(produto) {
  return normalizarTipoItemCatalogo(produto?.tipo_item);
}

function itemControlaEstoque(produto) {
  if (typeof produto?.controla_estoque === "boolean") {
    return produto.controla_estoque;
  }

  return obterTipoItemProduto(produto) === "produto";
}

function escaparHTMLProduto(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obterOperadorAtualIdProdutos() {
  return sessionStorage.getItem("CRV_OPERADOR_ID") || null;
}

function estoqueMinimoProduto(produto) {
  const valor = Number(produto?.estoque_minimo);
  return Number.isFinite(valor) && valor >= 0 ? valor : 5;
}

function unidadeVendaProduto(produto) {
  return String(produto?.unidade_venda || "un").trim() || "un";
}

function labelUnidadeVendaProduto(unidade, quantidade = 1) {
  const codigo = String(unidade || "un").trim().toLowerCase();
  const plural = Number(quantidade) !== 1;
  const labels = {
    un: plural ? "unidades" : "unidade",
    garrafa: plural ? "garrafas" : "garrafa",
    lata: plural ? "latas" : "lata",
    pacote: plural ? "pacotes" : "pacote",
    caixa: plural ? "caixas" : "caixa",
    fardo: plural ? "fardos" : "fardo",
    kit: plural ? "kits" : "kit",
    porcao: plural ? "porções" : "porção"
  };

  return labels[codigo] || codigo;
}

function featureProdutosAtiva(codigo) {
  return typeof window.crvFeatureAtiva === "function" &&
    window.crvFeatureAtiva(codigo) === true;
}

function itemVisivelNoCaixa(produto) {
  return produto?.ativo !== false;
}

function tiposDaAbaCatalogo(aba = tipoAbaAtivo) {
  if (aba === "taxa_outro") {
    return ["taxa", "outro"];
  }

  return [normalizarTipoItemCatalogo(aba)];
}

function itemPertenceAbaCatalogo(produto, aba = tipoAbaAtivo) {
  return tiposDaAbaCatalogo(aba).includes(obterTipoItemProduto(produto));
}

function obterCategoriasDoTipoItem(tipo) {
  const tipoNormalizado = normalizarTipoItemCatalogo(tipo);
  const categoriasBase = tipoNormalizado === "produto"
    ? obterCategoriasDoSegmento()
    : categoriasPorTipoItem[tipoNormalizado] || ["outros"];
  const personalizadas = categoriasPersonalizadasProdutos
    .filter(categoria => {
      return categoria.ativo !== false && categoria.tipo_item === tipoNormalizado;
    })
    .map(categoria => String(categoria.nome || "").trim())
    .filter(Boolean);

  return [...new Set([
    ...categoriasBase.filter(categoria => categoria !== "outros"),
    ...personalizadas,
    "outros"
  ])];
}

function atualizarContadoresTiposCatalogo() {
  const totalProdutos = produtos.filter(produto => {
    return obterTipoItemProduto(produto) === "produto";
  }).length;

  const totalServicos = produtos.filter(produto => {
    return obterTipoItemProduto(produto) === "servico";
  }).length;

  const totalTaxasOutros = produtos.filter(produto => {
    return ["taxa", "outro"].includes(obterTipoItemProduto(produto));
  }).length;

  const contadorProduto = document.getElementById("contadorTipoProduto");
  const contadorServico = document.getElementById("contadorTipoServico");
  const contadorTaxaOutro = document.getElementById("contadorTipoTaxaOutro");

  if (contadorProduto) contadorProduto.textContent = totalProdutos;
  if (contadorServico) contadorServico.textContent = totalServicos;
  if (contadorTaxaOutro) contadorTaxaOutro.textContent = totalTaxasOutros;
}

function atualizarCabecalhoCatalogo() {
  const btnTexto = document.getElementById("btnNovoItemCatalogoTexto");
  const filtroTexto = document.getElementById("filtroTexto");
  const ordenar = document.getElementById("ordenarProdutos");

  const configuracao = tipoAbaAtivo === "taxa_outro"
    ? tiposItemCatalogo.taxa
    : tiposItemCatalogo[normalizarTipoItemCatalogo(tipoAbaAtivo)];

  if (btnTexto) {
    btnTexto.textContent = configuracao.tituloNovo;
  }

  if (filtroTexto) {
    filtroTexto.placeholder = tipoAbaAtivo === "taxa_outro"
      ? "Buscar taxa ou outro item..."
      : `Buscar ${configuracao.singular} ou código...`;
  }

  if (ordenar) {
    [...ordenar.options].forEach(option => {
      if (["menor_estoque", "maior_estoque"].includes(option.value)) {
        option.hidden = false;
      }
    });
  }
}

function setTipoCatalogo(botao, tipo) {
  tipoAbaAtivo = tipo === "taxa_outro"
    ? "taxa_outro"
    : normalizarTipoItemCatalogo(tipo);

  document.querySelectorAll(".catalogo-tab").forEach(item => {
    const ativo = item === botao;
    item.classList.toggle("active", ativo);
    item.setAttribute("aria-selected", ativo ? "true" : "false");
  });

  filtroAtivo = "todos";

  document.querySelectorAll(".filtro-btn").forEach(item => {
    item.classList.toggle("active", item.dataset.filter === "todos");
  });

  const filtroTexto = document.getElementById("filtroTexto");
  if (filtroTexto) filtroTexto.value = "";

  atualizarCabecalhoCatalogo();
  preencherFiltrosCategoriaProduto();
  renderProdutos();
}

function preencherCategoriasModalProduto(tipo, valorAtual = "") {
  const selectCategoria = document.getElementById("produtoCategoria");
  if (!selectCategoria) return;

  const categorias = obterCategoriasDoTipoItem(tipo);
  const valorNormalizado = String(valorAtual || "");
  const valorEhPadrao = categorias.includes(valorNormalizado);

  selectCategoria.innerHTML = `
    <option value="">Sem categoria</option>
    ${categorias.map(categoria => `
      <option value="${escaparHTMLProduto(categoria)}">
        ${escaparHTMLProduto(categoriaLabel[categoria] || categoria)}
      </option>
    `).join("")}
  `;

  if (valorEhPadrao || valorNormalizado === "") {
    selectCategoria.value = valorNormalizado;
    document.getElementById("produtoCategoriaOutros").value = "";
  } else {
    selectCategoria.value = "outros";
    document.getElementById("produtoCategoriaOutros").value = valorNormalizado;
  }

  toggleCategoriaOutros();
}

function atualizarFormularioPorTipoItem({
  categoriaAtual = null,
  aplicarPadraoEstoque = false
} = {}) {
  const selectTipo = document.getElementById("produtoTipoItem");
  const tipo = normalizarTipoItemCatalogo(selectTipo?.value);
  const configuracao = tiposItemCatalogo[tipo];
  const nomeLabel = document.getElementById("produtoNomeLabel");
  const nomeInput = document.getElementById("produtoNome");
  const controlaEstoqueInput = document.getElementById("produtoControlaEstoque");
  const estoqueGrupo = document.getElementById("produtoEstoqueGrupo");
  const formRow = document.querySelector(".form-row-estoque-margem");
  const detalhesEstoque = document.getElementById("produtoControleEstoqueDetalhes");

  if (aplicarPadraoEstoque && controlaEstoqueInput) {
    controlaEstoqueInput.checked = tipo === "produto";
  }

  const controlaEstoque = controlaEstoqueInput
    ? controlaEstoqueInput.checked
    : tipo === "produto";

  if (selectTipo) selectTipo.value = tipo;
  if (nomeLabel) nomeLabel.textContent = `Nome do ${configuracao.singular} *`;
  if (nomeInput) nomeInput.placeholder = configuracao.placeholder;

  if (estoqueGrupo) {
    estoqueGrupo.style.display = controlaEstoque ? "flex" : "none";
  }

  if (formRow) {
    formRow.classList.toggle("sem-controle-estoque", !controlaEstoque);
  }

  if (detalhesEstoque) {
    detalhesEstoque.style.display = controlaEstoque ? "grid" : "none";
  }

  const categoriaAnterior = categoriaAtual === null
    ? document.getElementById("produtoCategoria")?.value || ""
    : categoriaAtual;

  preencherCategoriasModalProduto(tipo, categoriaAnterior);
  toggleComboProdutos();
  atualizarMotivoAjusteProduto();
}

function atualizarMotivoAjusteProduto() {
  const grupo = document.getElementById("produtoMotivoAjusteGrupo");
  const id = String(document.getElementById("produtoId")?.value || "").trim();
  const controlaEstoque = document.getElementById("produtoControlaEstoque")?.checked === true;
  const estoqueInformado = normalizarEstoque(
    document.getElementById("produtoEstoque")?.value
  );
  const alterouEstoque = id && controlaEstoque && produtoEstoqueOriginal !== null &&
    estoqueInformado !== Number(produtoEstoqueOriginal);

  if (grupo) {
    grupo.style.display = alterouEstoque ? "flex" : "none";
  }

  if (!alterouEstoque) {
    const motivo = document.getElementById("produtoMotivoAjuste");
    if (motivo) motivo.value = "";
  }
}

function sincronizarTogglesCatalogo() {
  const ativo = document.getElementById("produtoAtivo");
  const rapido = document.getElementById("produtoRapido");

  if (!ativo || !rapido) return;

  if (!ativo.checked) {
    rapido.checked = false;
  }

  rapido.disabled = !ativo.checked;
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
  atualizarCabecalhoCatalogo();

  const pronto = await aguardarContextoSistema();

  if (!pronto) {
  logProdutos("Modo offline/cache ativado para produtos.", "warn");

  produtos =
    await crvOfflineDB.obterCache(
      "produtos_lista"
    ) || [];

  preencherFiltrosCategoriaProduto();
  renderProdutos();
  atualizarStatusCaixa();

  return;
}

  await carregarTipoNegocioProdutos();
  await carregarCategoriasPersonalizadasProdutos();
  await carregarProdutos();

  preencherFiltrosCategoriaProduto();
  renderProdutos();
  verificarEstoqueBaixo();
  atualizarStatusCaixa();
  aplicarFeaturesProdutosInterface();

  if (window.lucide) {
    lucide.createIcons();
  }
});

document.addEventListener("crv:config-pronta", () => {
  aplicarFeaturesProdutosInterface();
  renderProdutos();
});

document.addEventListener("crv:operador-alterado", () => {
  renderProdutos();
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

  const categoriasPadrao = tiposDaAbaCatalogo().flatMap(tipo => {
    return obterCategoriasDoTipoItem(tipo);
  });

  const categoriasCadastradas = produtos
    .filter(produto => itemPertenceAbaCatalogo(produto))
    .map(produto => String(produto.categoria || "").trim())
    .filter(Boolean);

  const categorias = [...new Set([
    ...categoriasPadrao,
    ...categoriasCadastradas
  ])];

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
}

function aplicarFeaturesProdutosInterface() {
  const botaoCategorias = document.getElementById("btnGerenciarCategoriasProduto");

  if (botaoCategorias) {
    botaoCategorias.style.display = featureProdutosAtiva("categorias_personalizadas")
      ? "inline-flex"
      : "none";
  }
}

async function carregarCategoriasPersonalizadasProdutos() {
  if (!sistemaOnline()) return;

  try {
    const { data, error } = await sb
      .from("categorias_catalogo_personalizadas")
      .select("id, empresa_id, tipo_item, nome, ativo, criado_em, atualizado_em")
      .eq("empresa_id", obterEmpresaId())
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) throw error;

    categoriasPersonalizadasProdutos = Array.isArray(data) ? data : [];
  } catch (err) {
    categoriasPersonalizadasProdutos = [];
    logProdutos("Categorias personalizadas indisponíveis: " + err.message, "warn");
  }
}

async function salvarCategoriaPersonalizadaProduto(nome, tipoItem) {
  const nomeLimpo = String(nome || "").trim();

  if (!nomeLimpo || !sistemaOnline()) return nomeLimpo;

  const { data, error } = await sb.rpc("salvar_categoria_catalogo", {
    p_nome: nomeLimpo,
    p_tipo_item: normalizarTipoItemCatalogo(tipoItem),
    p_operador_id: obterOperadorAtualIdProdutos()
  });

  if (error) throw error;

  const categoriaSalva = data || null;

  if (categoriaSalva?.id) {
    const indice = categoriasPersonalizadasProdutos.findIndex(item => {
      return String(item.id) === String(categoriaSalva.id);
    });

    if (indice >= 0) {
      categoriasPersonalizadasProdutos[indice] = categoriaSalva;
    } else {
      categoriasPersonalizadasProdutos.push(categoriaSalva);
    }
  }

  return String(categoriaSalva?.nome || nomeLimpo).trim();
}

function abrirModalCategoriasProduto() {
  const modal = document.getElementById("modalCategoriasProduto");
  if (!modal) return;

  renderCategoriasPersonalizadasProduto();
  modal.style.display = "flex";

  if (window.lucide) lucide.createIcons();
}

function fecharModalCategoriasProduto() {
  const modal = document.getElementById("modalCategoriasProduto");
  if (modal) modal.style.display = "none";
}

function renderCategoriasPersonalizadasProduto() {
  const lista = document.getElementById("listaCategoriasPersonalizadasProduto");
  const filtro = String(
    document.getElementById("filtroTipoCategoriaProduto")?.value || "todos"
  );

  if (!lista) return;

  const categorias = categoriasPersonalizadasProdutos.filter(categoria => {
    return categoria.ativo !== false &&
      (filtro === "todos" || categoria.tipo_item === filtro);
  });

  if (!categorias.length) {
    lista.innerHTML = `
      <div class="categorias-produto-vazio">
        <i data-lucide="tags" width="28" height="28"></i>
        <p>Nenhuma categoria personalizada cadastrada.</p>
        <small>Ela será criada automaticamente quando “Outros” for preenchido no cadastro de um item.</small>
      </div>
    `;
  } else {
    lista.innerHTML = categorias.map(categoria => `
      <div class="categoria-produto-item">
        <div>
          <strong>${escaparHTMLProduto(categoria.nome)}</strong>
          <span>${escaparHTMLProduto(tiposItemCatalogo[categoria.tipo_item]?.singular || categoria.tipo_item)}</span>
        </div>
        <button
          class="produto-btn danger"
          type="button"
          title="Desativar categoria"
          onclick="desativarCategoriaPersonalizadaProduto('${categoria.id}')"
        >
          <i data-lucide="trash-2" width="13" height="13"></i>
        </button>
      </div>
    `).join("");
  }

  if (window.lucide) lucide.createIcons();
}

async function desativarCategoriaPersonalizadaProduto(id) {
  const categoria = categoriasPersonalizadasProdutos.find(item => {
    return String(item.id) === String(id);
  });

  if (!categoria) return;

  const confirmar = await abrirAlertaProduto({
    titulo: "Desativar categoria",
    mensagem: `Desativar a categoria <strong>${escaparHTMLProduto(categoria.nome)}</strong>? Os itens já cadastrados manterão essa identificação.`,
    textoConfirmar: "Desativar",
    mostrarCancelar: true
  });

  if (!confirmar) return;

  try {
    const { error } = await sb.rpc("desativar_categoria_catalogo", {
      p_categoria_id: categoria.id,
      p_operador_id: obterOperadorAtualIdProdutos()
    });

    if (error) throw error;

    categoria.ativo = false;
    preencherCategoriasModalProduto(
      document.getElementById("produtoTipoItem")?.value || "produto",
      document.getElementById("produtoCategoria")?.value || ""
    );
    preencherFiltrosCategoriaProduto();
    renderCategoriasPersonalizadasProduto();
    logProdutos("Categoria personalizada desativada.", "success");
  } catch (err) {
    await abrirAlertaProduto({
      titulo: "Categoria não alterada",
      mensagem: escaparHTMLProduto(err.message)
    });
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
          estoque_minimo: Number(produto.estoque_minimo ?? 5),
          unidade_venda: produto.unidade_venda || "un",
          codigo: produto.codigo || "",
          codigo_barras: produto.codigo_barras || produto.codigo || "",
          categoria: produto.categoria || "",
          ativo: produto.ativo !== false,
          produto_rapido: produto.produto_rapido === true,
          tipo_item: normalizarTipoItemCatalogo(produto.tipo_item),
          controla_estoque: typeof produto.controla_estoque === "boolean"
            ? produto.controla_estoque
            : normalizarTipoItemCatalogo(produto.tipo_item) === "produto",
          exibir_caixa: produto.exibir_caixa !== false,
          created_at: produto.created_at || null,
          updated_at: produto.updated_at || null
        }))
      : [];

    const itensAtivos = produtos.filter(produto => produto.ativo === true);

    await crvOfflineDB.salvarCache(
      "caixa_catalogo_itens",
      produtos
    );

    await crvOfflineDB.salvarCache(
      "caixa_produtos",
      itensAtivos
    );

await crvOfflineDB.salvarCache(
  "produtos_lista",
  produtos
);

    logProdutos(`${produtos.length} item(ns) carregado(s).`, "success");

  } catch (err) {
    produtos =
  await crvOfflineDB.obterCache(
    "produtos_lista"
  ) || [];

logProdutos(
  produtos.length
    ? "Itens carregados do cache offline."
    : "Erro ao carregar itens: " + err.message,
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
    const passaTipo = itemPertenceAbaCatalogo(produto);

    const passaFiltro =
      filtroAtivo === "todos" ||
      (filtroAtivo === "ativos" && produto.ativo) ||
      (filtroAtivo === "inativos" && !produto.ativo) ||
      (
        filtroAtivo === "baixo_estoque" &&
        produto.ativo &&
        itemControlaEstoque(produto) &&
        Number(produto.estoque || 0) > 0 &&
        Number(produto.estoque || 0) <= estoqueMinimoProduto(produto)
      ) ||
      (
        filtroAtivo === "sem_estoque" &&
        produto.ativo &&
        itemControlaEstoque(produto) &&
        Number(produto.estoque || 0) <= 0
      ) ||
      (
        filtroAtivo === "rapidos" &&
        produto.ativo &&
        produto.produto_rapido === true
      );

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

    return passaTipo && passaFiltro && passaCategoria && passaTexto;
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
      if (itemControlaEstoque(a) !== itemControlaEstoque(b)) {
        return itemControlaEstoque(a) ? -1 : 1;
      }

      return Number(a.estoque || 0) - Number(b.estoque || 0);
    }

    if (ordenacao === "maior_estoque") {
      if (itemControlaEstoque(a) !== itemControlaEstoque(b)) {
        return itemControlaEstoque(a) ? -1 : 1;
      }

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
function alternarSelecaoProdutosLista(id, marcado) {
  if (!podeEditarProdutosEmMassa()) return;
  if (marcado) produtosSelecionadosLista.add(String(id));
  else produtosSelecionadosLista.delete(String(id));
  renderizarTabelaProdutosPreservandoScroll();
}

function alternarSelecaoTodosProdutosLista(marcado) {
  if (!podeEditarProdutosEmMassa()) return;
  getProdutosFiltrados().forEach(item => {
    if (marcado) produtosSelecionadosLista.add(String(item.id));
    else produtosSelecionadosLista.delete(String(item.id));
  });
  renderizarTabelaProdutosPreservandoScroll();
}

function renderizarTabelaProdutosPreservandoScroll() {
  const anterior = document.querySelector(".produtos-tabela-wrap");
  const topo = anterior?.scrollTop || 0;
  const esquerda = anterior?.scrollLeft || 0;
  renderProdutos();
  const atual = document.querySelector(".produtos-tabela-wrap");
  if (atual) {
    atual.scrollTop = topo;
    atual.scrollLeft = esquerda;
  }
}

function renderizarTabelaProdutos(lista, { podeCriar, podeEditar, podeExcluir }) {
  const podeSelecionar = podeEditarProdutosEmMassa();
  const todosSelecionados = lista.every(item => produtosSelecionadosLista.has(String(item.id)));
  return `
    <div class="produtos-tabela-wrap">
      <table class="produtos-tabela">
        <thead><tr>
          ${podeSelecionar ? `<th class="col-selecao"><input type="checkbox" aria-label="Selecionar todos os itens filtrados" title="Selecionar todos os itens filtrados" onchange="alternarSelecaoTodosProdutosLista(this.checked)" ${todosSelecionados ? "checked" : ""}></th>` : ""}
          <th class="col-item">Item</th><th>Código</th><th>Venda</th><th>Custo / lucro</th><th>Estoque</th><th class="col-acoes">Ações</th>
        </tr></thead>
        <tbody>${lista.map(produto => {
          const tipo = obterTipoItemProduto(produto);
          const controlaEstoque = itemControlaEstoque(produto);
          const quantidade = Number(produto.estoque || 0);
          const estoqueBaixo = controlaEstoque && quantidade <= estoqueMinimoProduto(produto);
          return `<tr class="${produto.ativo ? "" : "produto-linha-inativa"} ${produtosSelecionadosLista.has(String(produto.id)) ? "produto-linha-selecionada" : ""}">
            ${podeSelecionar ? `<td class="col-selecao"><input type="checkbox" aria-label="Selecionar ${escaparHTMLProduto(produto.nome)}" onchange="alternarSelecaoProdutosLista(this.value, this.checked)" value="${escaparHTMLProduto(produto.id)}" ${produtosSelecionadosLista.has(String(produto.id)) ? "checked" : ""}></td>` : ""}
            <td class="produto-tabela-nome"><strong>${escaparHTMLProduto(produto.nome)}</strong><small>${escaparHTMLProduto(tiposItemCatalogo[tipo].singular)} · ${escaparHTMLProduto(categoriaLabel[produto.categoria] || produto.categoria || "Sem categoria")}${produto.produto_rapido ? " · Rápido" : ""}${!produto.ativo ? " · Inativo" : ""}</small></td>
            <td><span class="produto-tabela-codigo">${escaparHTMLProduto(produto.codigo || "—")}</span></td>
            <td class="produto-tabela-preco">${fmt(produto.preco)}</td>
            <td><span class="produto-tabela-custo">${fmt(produto.preco_custo || 0)}</span><small>Lucro: ${fmt(Number(produto.preco || 0) - Number(produto.preco_custo || 0))}</small></td>
            <td>${controlaEstoque ? `<span class="produto-tabela-estoque ${estoqueBaixo ? "baixo" : ""}">${quantidade} ${escaparHTMLProduto(labelUnidadeVendaProduto(unidadeVendaProduto(produto), quantidade))}</span><small>Mín. ${estoqueMinimoProduto(produto)}</small>` : `<span class="produto-tabela-custo">Sem controle</span>`}</td>
            <td class="col-acoes"><div class="produto-actions">
              ${controlaEstoque && featureProdutosAtiva("estoque_operacional") && podeEditar && operadorPodeMovimentarEstoqueProduto() ? `<button type="button" class="produto-btn estoque" onclick="abrirModalMovimentacaoEstoque('${produto.id}')" title="Movimentar estoque" aria-label="Movimentar estoque de ${escaparHTMLProduto(produto.nome)}"><i data-lucide="package-open" width="15" height="15"></i></button>` : ""}
              ${podeEditar ? `<button type="button" class="produto-btn" onclick="abrirModalEditar('${produto.id}')" title="Editar" aria-label="Editar ${escaparHTMLProduto(produto.nome)}"><i data-lucide="pencil" width="15" height="15"></i></button>` : ""}
              ${podeCriar ? `<button type="button" class="produto-btn" onclick="duplicarProduto('${produto.id}')" title="Duplicar" aria-label="Duplicar ${escaparHTMLProduto(produto.nome)}"><i data-lucide="copy" width="15" height="15"></i></button>` : ""}
              ${podeExcluir ? `<button type="button" class="produto-btn danger" onclick="confirmarExcluir('${produto.id}')" title="Excluir" aria-label="Excluir ${escaparHTMLProduto(produto.nome)}"><i data-lucide="trash-2" width="15" height="15"></i></button>` : ""}
            </div></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}

function renderProdutos() {
  const grid = document.getElementById("produtosGrid");
  const subtitle = document.getElementById("subtitleProdutos");

  if (!grid) return;
  grid.classList.toggle("modo-lista", visualizacaoProdutos === "lista");
  ["cards", "lista"].forEach(tipo => {
    const botao = document.getElementById(tipo === "lista" ? "btnProdutosLista" : "btnProdutosCards");
    botao?.classList.toggle("active", visualizacaoProdutos === tipo);
    botao?.setAttribute("aria-pressed", String(visualizacaoProdutos === tipo));
  });
  atualizarControlesEdicaoMassaProdutos();
  const podeCriar = typeof crvOperadorPodeModulo === "function"
    && crvOperadorPodeModulo("produtos", "criar");
  const podeEditar = typeof crvOperadorPodeModulo === "function"
    && crvOperadorPodeModulo("produtos", "editar");
  const podeExcluir = typeof crvOperadorPodeModulo === "function"
    && crvOperadorPodeModulo("produtos", "excluir");
  const botaoNovo = document.getElementById("btnNovoItemCatalogo");
  if (botaoNovo) {
    botaoNovo.hidden = !podeCriar;
    botaoNovo.style.display = podeCriar ? "" : "none";
  }

  const lista = getProdutosFiltrados();

  const itensDaAba = produtos.filter(produto => {
    return itemPertenceAbaCatalogo(produto);
  });

  const total = itensDaAba.length;
  const ativos = itensDaAba.filter(produto => produto.ativo).length;
  const rapidos = itensDaAba.filter(produto => produto.produto_rapido).length;
  const rotuloAba = tipoAbaAtivo === "taxa_outro"
    ? "taxa(s) e outro(s) item(ns)"
    : `${tiposItemCatalogo[normalizarTipoItemCatalogo(tipoAbaAtivo)].singular}(s)`;

  atualizarContadoresTiposCatalogo();

  if (subtitle) {
    subtitle.textContent =
      `${total} ${rotuloAba} cadastrado(s) · ${ativos} ativo(s) · ${rapidos} rápido(s)`;
  }

  if (!lista.length) {
    const tipoNovo = tipoAbaAtivo === "taxa_outro"
      ? "taxa"
      : normalizarTipoItemCatalogo(tipoAbaAtivo);
    const configuracao = tiposItemCatalogo[tipoNovo];

    grid.innerHTML = `
      <div class="produtos-empty">
        <i data-lucide="${configuracao.icone}" width="40" height="40" style="opacity:0.3;"></i>
        <p>Nenhum ${configuracao.singular} encontrado</p>
        <small>Cadastre apenas o que o estabelecimento realmente vende.</small>
        ${podeCriar ? `<button class="btn-ghost" onclick="abrirModalNovo()">
          <i data-lucide="plus" width="14" height="14"></i>
          Adicionar ${configuracao.singular}
        </button>` : ""}
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  if (visualizacaoProdutos === "lista") {
    grid.innerHTML = renderizarTabelaProdutos(lista, { podeCriar, podeEditar, podeExcluir });
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = lista.map(produto => {
    const estoque = Number(produto.estoque || 0);
    const tipoItem = obterTipoItemProduto(produto);
    const configuracaoTipo = tiposItemCatalogo[tipoItem];
    const controlaEstoque = itemControlaEstoque(produto);
    const estoqueMinimo = estoqueMinimoProduto(produto);
    const unidadeVenda = unidadeVendaProduto(produto);

    const estoqueClass =
      estoque === 0
        ? "estoque-zero"
        : estoque <= estoqueMinimo
          ? "estoque-low"
          : "estoque-ok";

    const estoqueIcon =
      estoque === 0
        ? "alert-circle"
        : estoque <= estoqueMinimo
          ? "alert-triangle"
          : "check-circle";

    const categoria = produto.categoria || "";

    return `
      <div class="produto-card tipo-${tipoItem} ${produto.ativo ? "" : "inativo"}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="produto-badges">
            <span class="produto-tipo-badge tipo-${tipoItem}">
              <i data-lucide="${configuracaoTipo.icone}" width="11" height="11"></i>
              ${configuracaoTipo.singular}
            </span>

            ${
              categoria
                ? `<span class="produto-categoria">${escaparHTMLProduto(categoriaLabel[categoria] || categoria)}</span>`
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
          ${
            controlaEstoque
              ? `<div class="produto-estoque ${estoqueClass}">
                   <i data-lucide="${estoqueIcon}" width="13" height="13"></i>
                   <span>${estoque} ${escaparHTMLProduto(labelUnidadeVendaProduto(unidadeVenda, estoque))}</span>
                   <small>Mín. ${estoqueMinimo}</small>
                 </div>`
              : `<div class="produto-sem-estoque">
                   <i data-lucide="infinity" width="13" height="13"></i>
                   Sem controle de estoque
                 </div>`
          }

<div class="produto-actions">

  ${controlaEstoque && featureProdutosAtiva("estoque_operacional") && podeEditar && operadorPodeMovimentarEstoqueProduto() ? `
  <button
    class="produto-btn estoque"
    onclick="abrirModalMovimentacaoEstoque('${produto.id}')"
    title="Movimentar estoque"
  >
    <i data-lucide="package-open" width="13" height="13"></i>
  </button>
  ` : ""}

  ${podeEditar ? `<button
    class="produto-btn"
    onclick="abrirModalEditar('${produto.id}')"
    title="Editar"
  >
    <i data-lucide="pencil" width="13" height="13"></i>
  </button>` : ""}

  ${podeCriar ? `<button
    class="produto-btn"
    onclick="duplicarProduto('${produto.id}')"
    title="Duplicar"
  >
    <i data-lucide="copy" width="13" height="13"></i>
  </button>` : ""}

  ${podeExcluir ? `<button
    class="produto-btn danger"
    onclick="confirmarExcluir('${produto.id}')"
    title="Excluir"
  >
    <i data-lucide="trash-2" width="13" height="13"></i>
  </button>` : ""}

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
  if (typeof crvOperadorPodeModulo !== "function"
      || !crvOperadorPodeModulo("produtos", "criar")) return;
  const titulo = document.getElementById("modalProdutoTitulo");
  const tipoInicial = tipoAbaAtivo === "taxa_outro"
    ? "taxa"
    : normalizarTipoItemCatalogo(tipoAbaAtivo);

  if (titulo) {
    titulo.textContent = tiposItemCatalogo[tipoInicial].tituloNovo;
  }

  document.getElementById("produtoId").value = "";
  document.getElementById("produtoTipoItem").value = tipoInicial;
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoPreco").value = "";
  document.getElementById("produtoPrecoCusto").value = "";
  document.getElementById("produtoEstoque").value = "";
  document.getElementById("produtoEstoqueMinimo").value = "5";
  document.getElementById("produtoUnidadeVenda").value = "un";
  document.getElementById("produtoMotivoAjuste").value = "";
  produtoEstoqueOriginal = null;
  document.getElementById("produtoControlaEstoque").checked = tipoInicial === "produto";
  atualizarPreviewMargemProduto();
  document.getElementById("produtoCodigo").value = "";
  document.getElementById("produtoCategoriaOutros").value = "";
  atualizarFormularioPorTipoItem({ categoriaAtual: "" });
  document.getElementById("produtoAtivo").checked = true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = false;
  }

  sincronizarTogglesCatalogo();

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
  if (typeof crvOperadorPodeModulo !== "function"
      || !crvOperadorPodeModulo("produtos", "editar")) return;
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    abrirAlertaProduto({
      titulo: "Produto não encontrado",
      mensagem: "Não foi possível localizar este produto.",
      textoConfirmar: "Fechar"
    });
    return;
  }

  const tipoItem = obterTipoItemProduto(produto);

  document.getElementById("modalProdutoTitulo").textContent =
    tiposItemCatalogo[tipoItem].tituloEditar;

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("produtoTipoItem").value = tipoItem;
  document.getElementById("produtoNome").value = produto.nome;
  document.getElementById("produtoPreco").value = valorParaInputMoeda(produto.preco);
  document.getElementById("produtoPrecoCusto").value = valorParaInputMoeda(produto.preco_custo || 0);
  document.getElementById("produtoEstoque").value = itemControlaEstoque(produto)
    ? produto.estoque
    : 0;
  document.getElementById("produtoEstoqueMinimo").value = estoqueMinimoProduto(produto);
  document.getElementById("produtoUnidadeVenda").value = unidadeVendaProduto(produto);
  document.getElementById("produtoMotivoAjuste").value = "";
  produtoEstoqueOriginal = Number(produto.estoque || 0);
  document.getElementById("produtoControlaEstoque").checked =
    itemControlaEstoque(produto);
  atualizarPreviewMargemProduto();
  document.getElementById("produtoCodigo").value = produto.codigo || "";
  atualizarFormularioPorTipoItem({ categoriaAtual: produto.categoria || "" });
  document.getElementById("produtoAtivo").checked = produto.ativo === true;

  const produtoRapido = document.getElementById("produtoRapido");

  if (produtoRapido) {
    produtoRapido.checked = produto.produto_rapido === true;
  }

  sincronizarTogglesCatalogo();

  await carregarItensComboProduto(produto.id);
  toggleComboProdutos();

  document.getElementById("modalProduto").style.display = "flex";

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function duplicarProduto(id) {
  if (typeof crvOperadorPodeModulo !== "function"
      || !crvOperadorPodeModulo("produtos", "criar")) return;
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    return;
  }

  const tipoItem = obterTipoItemProduto(produto);

  document.getElementById("modalProdutoTitulo").textContent =
    tiposItemCatalogo[tipoItem].tituloDuplicar;

  document.getElementById("produtoId").value = "";
  document.getElementById("produtoTipoItem").value = tipoItem;

  document.getElementById("produtoNome").value =
    `${produto.nome} (Cópia)`;

  document.getElementById("produtoPreco").value =
    valorParaInputMoeda(produto.preco);

  document.getElementById("produtoPrecoCusto").value =
    valorParaInputMoeda(produto.preco_custo || 0);

  document.getElementById("produtoEstoque").value =
    itemControlaEstoque(produto) ? produto.estoque || 0 : 0;

  document.getElementById("produtoEstoqueMinimo").value = estoqueMinimoProduto(produto);
  document.getElementById("produtoUnidadeVenda").value = unidadeVendaProduto(produto);
  document.getElementById("produtoMotivoAjuste").value = "";
  produtoEstoqueOriginal = null;

  document.getElementById("produtoControlaEstoque").checked =
    itemControlaEstoque(produto);

  atualizarPreviewMargemProduto();

  document.getElementById("produtoCodigo").value = "";

  atualizarFormularioPorTipoItem({ categoriaAtual: produto.categoria || "" });

  document.getElementById("produtoAtivo").checked =
    produto.ativo === true;

  document.getElementById("produtoRapido").checked =
    produto.produto_rapido === true;

  sincronizarTogglesCatalogo();

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
  const tipoItem = normalizarTipoItemCatalogo(
    document.getElementById("produtoTipoItem")?.value
  );
  const wrap = document.getElementById("comboProdutosWrap");

  if (!categoria || !wrap) return;

  if (tipoItem === "produto" && categoria.value === "combos") {
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
      obterTipoItemProduto(produto) === "produto" &&
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
  const tipoItem = normalizarTipoItemCatalogo(
    document.getElementById("produtoTipoItem")?.value
  );

  await sb
    .from("produto_combo_itens")
    .delete()
    .eq("empresa_id", obterEmpresaId())
    .eq("combo_id", comboId);

  if (tipoItem !== "produto" || categoria !== "combos") return;

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

async function validarProdutoDuplicadoBanco({ id, nome, codigo }) {
  const empresaId = obterEmpresaId();
  const nomeNormalizado = String(nome || "").trim().toLowerCase();
  const codigoNormalizado = String(codigo || "").trim();

  if (!empresaId || !nomeNormalizado) {
    return true;
  }

  const { data: produtosMesmoNome, error: erroNome } = await sb
    .from("produtos")
    .select("id,nome")
    .eq("empresa_id", empresaId)
    .ilike("nome", nome.trim());

  if (erroNome) throw erroNome;

  const nomeDuplicado = (produtosMesmoNome || []).find(produto => {
    return (
      String(produto.id) !== String(id || "") &&
      String(produto.nome || "").trim().toLowerCase() === nomeNormalizado
    );
  });

  if (nomeDuplicado) {
    await abrirAlertaProduto({
      titulo: "Item duplicado",
      mensagem: `Já existe um item com este nome: <strong>${nome}</strong>.`
    });

    return false;
  }

  if (codigoNormalizado) {
    const { data: produtosMesmoCodigo, error: erroCodigo } = await sb
      .from("produtos")
      .select("id,nome,codigo_barras,codigo")
      .eq("empresa_id", empresaId)
      .or(`codigo_barras.eq.${codigoNormalizado},codigo.eq.${codigoNormalizado}`);

    if (erroCodigo) throw erroCodigo;

    const codigoDuplicado = (produtosMesmoCodigo || []).find(produto => {
      return String(produto.id) !== String(id || "");
    });

    if (codigoDuplicado) {
      await abrirAlertaProduto({
        titulo: "Código duplicado",
        mensagem: `Já existe um item com este código: <strong>${codigoNormalizado}</strong>.`
      });

      return false;
    }
  }

  return true;
}

// ======================================================
// SALVAR
// ======================================================
async function salvarProduto() {
  const id = String(document.getElementById("produtoId")?.value || "").trim();
  const acao = id ? "editar" : "criar";
  if (typeof crvOperadorPodeModulo !== "function"
      || !crvOperadorPodeModulo("produtos", acao)
      || !await confirmarPermissaoAtualProdutos(acao)) {
    await abrirAlertaProduto({
      titulo: "Acesso não permitido",
      mensagem: "Este operador não possui permissão para salvar este item."
    });
    return;
  }
  const nome = formatarNomeProduto(
    document.getElementById("produtoNome")?.value
  );
  const tipoItem = normalizarTipoItemCatalogo(
    document.getElementById("produtoTipoItem")?.value
  );
  const configuracaoTipo = tiposItemCatalogo[tipoItem];
  const controlaEstoque =
    document.getElementById("produtoControlaEstoque")?.checked === true;
  const preco = normalizarPreco(document.getElementById("produtoPreco")?.value);
  const precoCusto = normalizarPreco(document.getElementById("produtoPrecoCusto")?.value);
  const estoque = controlaEstoque
    ? normalizarEstoque(document.getElementById("produtoEstoque")?.value)
    : 0;
  const estoqueMinimo = controlaEstoque
    ? normalizarEstoque(document.getElementById("produtoEstoqueMinimo")?.value)
    : 0;
  const unidadeVenda = controlaEstoque
    ? String(document.getElementById("produtoUnidadeVenda")?.value || "un").trim()
    : "un";
  const codigo = String(document.getElementById("produtoCodigo")?.value || "").trim();
  let categoria = obterCategoriaProduto();
  const categoriaSelecionada = String(
    document.getElementById("produtoCategoria")?.value || ""
  ).trim();
  const motivoAjuste = String(
    document.getElementById("produtoMotivoAjuste")?.value || ""
  ).trim();
  const estoqueFoiAlterado = Boolean(
    id && controlaEstoque && produtoEstoqueOriginal !== null &&
    estoque !== Number(produtoEstoqueOriginal)
  );
  if (estoqueFoiAlterado && (!operadorPodeMovimentarEstoqueProduto()
      || !await confirmarPermissaoAtualProdutos("editar", ["movimentar_estoque"]))) {
    await abrirAlertaProduto({
      titulo: "Acesso não permitido",
      mensagem: "Este operador não possui permissão para ajustar o estoque."
    });
    return;
  }
  const ativo = document.getElementById("produtoAtivo")?.checked === true;
  const produtoRapido = ativo && document.getElementById("produtoRapido")?.checked === true;

  if (!nome) {
    await abrirAlertaProduto({
      titulo: "Nome obrigatório",
      mensagem: `Informe o nome do ${configuracaoTipo.singular}.`
    });
    return;
  }

  if (preco <= 0) {
    await abrirAlertaProduto({
      titulo: "Preço inválido",
      mensagem: "Informe um preço maior que zero."
    });
    return;
  }

  if (categoriaSelecionada === "outros" && (!categoria || categoria === "outros")) {
    await abrirAlertaProduto({
      titulo: "Informe a categoria",
      mensagem: "Digite o nome da categoria que deseja cadastrar."
    });
    return;
  }

  if (estoqueFoiAlterado && motivoAjuste.length < 3) {
    await abrirAlertaProduto({
      titulo: "Motivo obrigatório",
      mensagem: "Informe o motivo da alteração do estoque para manter o histórico correto."
    });
    return;
  }

  const nomeExistente = produtos.find(produto => {
    return (
      String(produto.nome || "").trim().toLowerCase() === nome.trim().toLowerCase() &&
      String(produto.id) !== String(id)
    );
  });

  if (nomeExistente) {
    await abrirAlertaProduto({
      titulo: "Item duplicado",
      mensagem: "Já existe um item com este nome cadastrado."
    });
    return;
  }

  if (!sistemaOnline()) {
    await abrirAlertaProduto({
      titulo: "Sistema offline",
      mensagem: "Sistema sem conexão com Supabase. Aguarde e tente novamente."
    });
    return;
  }

  try {
    const produtoValido = await validarProdutoDuplicadoBanco({
      id,
      nome,
      codigo
    });

    if (!produtoValido) return;

    const empresaId = obterEmpresaId();

    if (categoriaSelecionada === "outros") {
      categoria = await salvarCategoriaPersonalizadaProduto(categoria, tipoItem);
    }

    const payload = {
      empresa_id: empresaId,
      nome: nome,
      preco: preco,
      preco_custo: precoCusto,
      estoque: estoqueFoiAlterado ? Number(produtoEstoqueOriginal) : estoque,
      estoque_minimo: estoqueMinimo,
      unidade_venda: unidadeVenda,
      codigo: codigo || null,
      codigo_barras: codigo || null,
      categoria: categoria || null,
      ativo: ativo,
      produto_rapido: produtoRapido,
      tipo_item: tipoItem,
      controla_estoque: controlaEstoque,
      // Compatibilidade com a coluna antiga: item ativo é sempre pesquisável.
      exibir_caixa: ativo,
      updated_at: new Date().toISOString()
    };

    if (id) {
      const { error } = await sb
        .from("produtos")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      if (estoqueFoiAlterado) {
        const { error: ajusteError } = await sb.rpc("ajustar_estoque_produto", {
          p_produto_id: id,
          p_novo_estoque: estoque,
          p_motivo: motivoAjuste,
          p_operador_id: obterOperadorAtualIdProdutos()
        });

        if (ajusteError) throw ajusteError;
      }

      await salvarItensComboProduto(id);

      logProdutos(`${configuracaoTipo.singular} atualizado.`, "success");

    } else {
      const { data: produtoCriado, error } = await sb
        .from("produtos")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      await salvarItensComboProduto(produtoCriado.id);

      logProdutos(`${configuracaoTipo.singular} criado.`, "success");
    }

    fecharModal();

    await carregarProdutos();
    preencherFiltrosCategoriaProduto();
    renderProdutos();

  } catch (err) {
    logProdutos("Erro ao salvar: " + err.message, "error");
    await abrirAlertaProduto({
      titulo: "Erro ao salvar item",
      mensagem:
        err.message?.includes("duplicate") ||
        err.message?.includes("unique")
          ? "Já existe um item com este nome ou código cadastrado."
          : err.message || "Não foi possível salvar o item."
    });
  }
}

// ======================================================
// MOVIMENTAÇÃO E HISTÓRICO DE ESTOQUE
// ======================================================
function operadorPodeMovimentarEstoqueProduto() {
  return typeof window.crvOperadorPodeEspecial === "function" &&
    window.crvOperadorPodeEspecial("movimentar_estoque") === true;
}

async function abrirModalMovimentacaoEstoque(id) {
  const produto = produtos.find(item => String(item.id) === String(id));

  if (!produto || !itemControlaEstoque(produto)) return;

  if (!operadorPodeMovimentarEstoqueProduto()) {
    await abrirAlertaProduto({
      titulo: "Acesso não permitido",
      mensagem: "Este operador não possui permissão para movimentar estoque."
    });
    return;
  }

  if (!sistemaOnline()) {
    await abrirAlertaProduto({
      titulo: "Operação online",
      mensagem: "Movimentações administrativas de estoque exigem conexão com o Supabase."
    });
    return;
  }

  produtoMovimentacaoSelecionado = produto;

  document.getElementById("movEstoqueProdutoId").value = produto.id;
  document.getElementById("movEstoqueProdutoNome").textContent = produto.nome;
  document.getElementById("movEstoqueTipo").value = "entrada";
  document.getElementById("movEstoqueQuantidade").value = "";
  document.getElementById("movEstoqueNovoTotal").value = "";
  document.getElementById("movEstoqueMotivo").value = "";

  atualizarResumoMovimentacaoEstoque();
  atualizarFormularioMovimentacaoEstoque();

  const modal = document.getElementById("modalMovimentacaoEstoque");
  if (modal) modal.style.display = "flex";

  await carregarHistoricoEstoqueProduto();

  setTimeout(() => document.getElementById("movEstoqueQuantidade")?.focus(), 80);
  if (window.lucide) lucide.createIcons();
}

function fecharModalMovimentacaoEstoque() {
  const modal = document.getElementById("modalMovimentacaoEstoque");
  if (modal) modal.style.display = "none";

  produtoMovimentacaoSelecionado = null;
  movimentacaoEstoqueEmProcessamento = false;
}

function atualizarResumoMovimentacaoEstoque() {
  const produto = produtoMovimentacaoSelecionado;
  const resumo = document.getElementById("movEstoqueAtual");

  if (!produto || !resumo) return;

  const quantidade = Number(produto.estoque || 0);
  resumo.textContent = `${quantidade} ${labelUnidadeVendaProduto(
    unidadeVendaProduto(produto),
    quantidade
  )}`;
}

function atualizarFormularioMovimentacaoEstoque() {
  const tipo = String(document.getElementById("movEstoqueTipo")?.value || "entrada");
  const grupoQuantidade = document.getElementById("movEstoqueQuantidadeGrupo");
  const grupoNovoTotal = document.getElementById("movEstoqueNovoTotalGrupo");

  if (grupoQuantidade) grupoQuantidade.style.display = tipo === "ajuste" ? "none" : "flex";
  if (grupoNovoTotal) grupoNovoTotal.style.display = tipo === "ajuste" ? "flex" : "none";
}

function labelTipoMovimentacaoEstoque(tipo) {
  const labels = {
    entrada: "Entrada",
    saida: "Saída manual",
    ajuste: "Ajuste",
    perda: "Perda",
    vencimento: "Vencimento",
    devolucao: "Devolução",
    venda: "Venda",
    cancelamento_venda: "Cancelamento de venda",
    carga_inicial: "Carga inicial"
  };

  return labels[String(tipo || "")] || String(tipo || "Movimentação");
}

function formatarDataHoraEstoqueProduto(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderizarLinhaHistoricoEstoqueProduto(item) {
  const variacao = Number(item.variacao || 0);
  const anterior = Number(item.estoque_anterior || 0);
  const posterior = Number(item.estoque_posterior || 0);
  const entrada = variacao > 0;
  const sinal = variacao > 0 ? "+" : variacao < 0 ? "−" : "";
  return `
    <div class="mov-estoque-item ${entrada ? "entrada" : "saida"}">
      <div class="mov-estoque-item-main">
        <strong>${escaparHTMLProduto(labelTipoMovimentacaoEstoque(item.tipo))}</strong>
        <span>${escaparHTMLProduto(item.motivo || "Sem motivo registrado")}</span>
        <small>${escaparHTMLProduto(formatarDataHoraEstoqueProduto(item.criado_em))}</small>
      </div>
      <div class="mov-estoque-item-valores">
        <strong>${sinal}${Math.abs(variacao)} ${Math.abs(variacao) === 1 ? "unidade" : "unidades"}</strong>
        <span>Estoque: ${anterior} → ${posterior}</span>
      </div>
    </div>`;
}

async function carregarHistoricoEstoqueProduto() {
  const lista = document.getElementById("movEstoqueHistoricoLista");
  const produtoId = produtoMovimentacaoSelecionado?.id;

  if (!lista || !produtoId) return;

  lista.innerHTML = `<div class="mov-estoque-carregando">Carregando histórico...</div>`;

  try {
    const { data, error } = await sb
      .from("estoque_movimentacoes")
      .select("id, tipo, quantidade, variacao, estoque_anterior, estoque_posterior, motivo, criado_em")
      .eq("empresa_id", obterEmpresaId())
      .eq("produto_id", produtoId)
      .order("criado_em", { ascending: false })
      .limit(20);

    if (error) throw error;

    const movimentacoes = Array.isArray(data) ? data : [];

    if (!movimentacoes.length) {
      lista.innerHTML = `
        <div class="mov-estoque-vazio">
          Nenhuma movimentação registrada após a ativação do histórico.
        </div>
      `;
      return;
    }

    lista.innerHTML = movimentacoes.map(renderizarLinhaHistoricoEstoqueProduto).join("");
  } catch (err) {
    lista.innerHTML = `
      <div class="mov-estoque-vazio erro">
        Não foi possível carregar o histórico: ${escaparHTMLProduto(err.message)}
      </div>
    `;
  }
}

async function abrirHistoricoCompletoEstoqueProduto() {
  const produto = produtoMovimentacaoSelecionado;
  if (!produto || !sistemaOnline()) return;
  const dialogo = document.createElement("dialog");
  dialogo.className = "modal-historico-estoque-completo";
  dialogo.setAttribute("aria-labelledby", "historicoEstoqueCompletoTitulo");
  dialogo.innerHTML = `
    <header>
      <div><h3 id="historicoEstoqueCompletoTitulo">Todas as movimentações</h3><p>${escaparHTMLProduto(produto.nome)}</p></div>
      <button type="button" class="btn-ghost" data-fechar aria-label="Fechar histórico">✕</button>
    </header>
    <div class="historico-estoque-completo-lista" id="historicoEstoqueCompletoLista"></div>
    <footer>
      <button type="button" class="btn-ghost" id="historicoEstoqueMais" hidden>Carregar mais</button>
      <button type="button" class="btn-ghost" data-fechar>Fechar</button>
    </footer>`;
  document.body.appendChild(dialogo);
  dialogo.addEventListener("close", () => dialogo.remove(), { once: true });
  dialogo.querySelectorAll("[data-fechar]").forEach(botao => botao.onclick = () => dialogo.close());
  const lista = dialogo.querySelector("#historicoEstoqueCompletoLista");
  const mais = dialogo.querySelector("#historicoEstoqueMais");
  let pagina = 0;
  async function carregarPagina() {
    mais.disabled = true;
    if (pagina === 0) lista.innerHTML = '<p class="edicao-massa-vazio">Carregando histórico...</p>';
    try {
      const inicio = pagina * 100;
      const { data, error } = await sb.from("estoque_movimentacoes")
        .select("id, tipo, quantidade, variacao, estoque_anterior, estoque_posterior, motivo, criado_em")
        .eq("empresa_id", obterEmpresaId())
        .eq("produto_id", produto.id)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(inicio, inicio + 99);
      if (error) throw error;
      const linhas = Array.isArray(data) ? data : [];
      if (pagina === 0) lista.innerHTML = "";
      lista.insertAdjacentHTML("beforeend", linhas.map(renderizarLinhaHistoricoEstoqueProduto).join(""));
      if (!linhas.length && pagina === 0) lista.textContent = "Nenhuma movimentação registrada.";
      pagina++;
      mais.hidden = linhas.length < 100;
    } catch (erro) {
      if (pagina === 0) lista.textContent = `Não foi possível carregar o histórico: ${erro.message}`;
      mais.hidden = true;
    } finally {
      mais.disabled = false;
    }
  }
  mais.onclick = carregarPagina;
  dialogo.showModal();
  await carregarPagina();
}

async function salvarMovimentacaoEstoqueProduto() {
  if (movimentacaoEstoqueEmProcessamento || !produtoMovimentacaoSelecionado) return;
  if (!operadorPodeMovimentarEstoqueProduto()
      || !await confirmarPermissaoAtualProdutos("editar", ["movimentar_estoque"])) {
    await abrirAlertaProduto({
      titulo: "Acesso não permitido",
      mensagem: "Este operador não possui permissão para movimentar estoque."
    });
    return;
  }

  const tipo = String(document.getElementById("movEstoqueTipo")?.value || "entrada");
  const quantidade = normalizarEstoque(
    document.getElementById("movEstoqueQuantidade")?.value
  );
  const novoEstoque = normalizarEstoque(
    document.getElementById("movEstoqueNovoTotal")?.value
  );
  const motivo = String(document.getElementById("movEstoqueMotivo")?.value || "").trim();

  if (tipo !== "ajuste" && quantidade <= 0) {
    await abrirAlertaProduto({
      titulo: "Quantidade inválida",
      mensagem: "Informe uma quantidade maior que zero."
    });
    return;
  }

  if (motivo.length < 3) {
    await abrirAlertaProduto({
      titulo: "Motivo obrigatório",
      mensagem: "Informe o motivo da movimentação de estoque."
    });
    return;
  }

  const botao = document.getElementById("btnConfirmarMovimentacaoEstoque");

  try {
    movimentacaoEstoqueEmProcessamento = true;
    if (botao) botao.disabled = true;

    const parametrosComuns = {
      p_produto_id: produtoMovimentacaoSelecionado.id,
      p_motivo: motivo,
      p_operador_id: obterOperadorAtualIdProdutos()
    };

    const resposta = tipo === "ajuste"
      ? await sb.rpc("ajustar_estoque_produto", {
          ...parametrosComuns,
          p_novo_estoque: novoEstoque
        })
      : await sb.rpc("movimentar_estoque_produto", {
          ...parametrosComuns,
          p_tipo: tipo,
          p_quantidade: quantidade,
          p_referencia_tipo: "manual",
          p_referencia_id: null,
          p_venda_id: null,
          p_caixa_id: null
        });

    if (resposta.error) throw resposta.error;

    const resultado = resposta.data || {};
    produtoMovimentacaoSelecionado.estoque = Number(
      resultado.estoque_posterior ?? novoEstoque
    );

    document.getElementById("movEstoqueQuantidade").value = "";
    document.getElementById("movEstoqueNovoTotal").value = "";
    document.getElementById("movEstoqueMotivo").value = "";

    atualizarResumoMovimentacaoEstoque();
    await carregarHistoricoEstoqueProduto();
    await carregarProdutos();
    preencherFiltrosCategoriaProduto();
    renderProdutos();

    logProdutos("Movimentação de estoque registrada.", "success");
  } catch (err) {
    await abrirAlertaProduto({
      titulo: "Movimentação não registrada",
      mensagem: escaparHTMLProduto(err.message)
    });
  } finally {
    movimentacaoEstoqueEmProcessamento = false;
    if (botao) botao.disabled = false;
  }
}

// ======================================================
// EXCLUIR
// ======================================================
async function confirmarExcluir(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) {
    await abrirAlertaProduto({
      titulo: "Item não encontrado",
      mensagem: "Não foi possível localizar este item.",
      textoConfirmar: "Fechar"
    });

    return;
  }

  idExcluir = id;

  const tipoItem = obterTipoItemProduto(produto);
  const tituloExcluir = document.getElementById("tituloExcluirItem");

  if (tituloExcluir) {
    tituloExcluir.textContent = `Excluir ${tiposItemCatalogo[tipoItem].singular}?`;
  }

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
  if (typeof crvOperadorPodeModulo !== "function"
      || !crvOperadorPodeModulo("produtos", "excluir")
      || !await confirmarPermissaoAtualProdutos("excluir")) {
    await abrirAlertaProduto({
      titulo: "Acesso não permitido",
      mensagem: "Este operador não possui permissão para excluir este item."
    });
    return;
  }
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

    logProdutos("Item excluído.", "success");

    idExcluir = null;

    fecharModal();

    await carregarProdutos();
    preencherFiltrosCategoriaProduto();
    renderProdutos();

  } catch (err) {
    logProdutos("Erro ao excluir: " + err.message, "error");

    await abrirAlertaProduto({
      titulo: "Erro ao excluir item",
      mensagem: err.message || "Não foi possível excluir o item.",
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

  produtoEstoqueOriginal = null;
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

  if (event.target?.id === "produtoEstoque") {
    atualizarMotivoAjusteProduto();
  }
});

// ======================================================
// MÁSCARAS DO FORMULÁRIO DE PRODUTOS
// ======================================================
function setupMascarasProdutos() {
  aplicarMascaraMoedaInput(document.getElementById("produtoPreco"));
  aplicarMascaraMoedaInput(document.getElementById("produtoPrecoCusto"));
  aplicarMascaraEstoqueInput(document.getElementById("produtoEstoque"));
  aplicarMascaraEstoqueInput(document.getElementById("produtoEstoqueMinimo"));
  aplicarMascaraEstoqueInput(document.getElementById("movEstoqueQuantidade"));
  aplicarMascaraEstoqueInput(document.getElementById("movEstoqueNovoTotal"));
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

  document
    .getElementById("produtoAtivo")
    ?.addEventListener("change", sincronizarTogglesCatalogo);

  document.getElementById("produtoControlaEstoque")?.addEventListener("change", () => {
    atualizarFormularioPorTipoItem();
  });
}

setTimeout(() => {
  crvCarregarConfiguracoesEmpresa();
}, 900);

// ======================================================
// ALERTA ESTOQUE BAIXO
// ======================================================
function verificarEstoqueBaixo() {
  if (!Array.isArray(produtos) || !produtos.length) return;

  const baixos = produtos.filter(produto => {
    const estoque = Number(produto.estoque || 0);

    return itemControlaEstoque(produto) &&
      estoque <= estoqueMinimoProduto(produto) &&
      produto.ativo !== false;
  });

  if (!baixos.length) return;

  const nomes = baixos
    .slice(0, 3)
    .map(produto => `${produto.nome} (${produto.estoque})`)
    .join(", ");

  const extras = baixos.length > 3
    ? ` e mais ${baixos.length - 3}`
    : "";

  const mensagem = `${nomes}${extras}`;

  if (typeof crvToast === "function") {
    crvToast({
      titulo: "Itens com estoque baixo",
      mensagem,
      tipo: "warn",
      tempo: 7000
    });
    return;
  }

  if (typeof mostrarToast === "function") {
    mostrarToast({
      tipo: "warn",
      titulo: "Itens com estoque baixo",
      mensagem
    });
    return;
  }

  console.warn("[CRV PDV] Itens com estoque baixo:", mensagem);
}
