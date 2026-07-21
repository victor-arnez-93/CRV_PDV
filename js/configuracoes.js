// ======================================================
// CRV PDV - CONFIGURAÇÕES
// ======================================================

let CONFIG_EMPRESA = null;
let LOGO_REMOVER_PENDENTE = false;

const CATALOGO_NEGOCIOS_FALLBACK = [
  {
    codigo: "comercio",
    nome: "Comércio",
    ordem: 10,
    tipos: [
      { codigo: "comercio_geral", nome: "Comércio geral / Loja", ordem: 10 },
      { codigo: "mercado_conveniencia", nome: "Mercado / Mercearia / Conveniência", ordem: 20 }
    ]
  },
  {
    codigo: "alimentacao",
    nome: "Alimentação",
    ordem: 20,
    tipos: [
      { codigo: "padaria_confeitaria", nome: "Padaria / Confeitaria", ordem: 10 },
      { codigo: "lanchonete_cafeteria", nome: "Lanchonete / Cafeteria / Doceria", ordem: 20 },
      { codigo: "restaurante", nome: "Restaurante", ordem: 30 },
      { codigo: "bar_adega", nome: "Bar / Adega", ordem: 40 }
    ]
  },
  {
    codigo: "servicos",
    nome: "Serviços",
    ordem: 30,
    tipos: [
      { codigo: "servicos_gerais", nome: "Serviços gerais", ordem: 10 },
      { codigo: "servicos_agendados", nome: "Serviços com agendamento", ordem: 20 },
      { codigo: "assistencia_tecnica", nome: "Assistência técnica", ordem: 30 }
    ]
  },
  {
    codigo: "esportes_lazer",
    nome: "Esportes e lazer",
    ordem: 40,
    tipos: [
      { codigo: "arena_quadras", nome: "Arena / Campos / Quadras", ordem: 10 }
    ]
  }
];

const PREVIEW_NEGOCIOS_FALLBACK = {
  comercio_geral: ["Caixa / PDV", "Produtos", "Código de barras", "Estoque mínimo", "Clientes", "Relatórios"],
  mercado_conveniencia: ["Caixa / PDV", "Código de barras", "Estoque mínimo", "Clientes", "Relatórios"],
  padaria_confeitaria: ["Caixa / PDV", "Combos", "Comandas", "Código de barras", "Estoque mínimo", "Relatórios"],
  lanchonete_cafeteria: ["Caixa / PDV", "Comandas", "Combos", "Código de barras", "Relatórios"],
  restaurante: ["Caixa / PDV", "Comandas", "Clientes", "Produtos", "Relatórios"],
  bar_adega: ["Caixa / PDV", "Comandas", "Código de barras", "Estoque mínimo", "Relatórios"],
  servicos_gerais: ["Caixa / PDV", "Clientes", "Produtos", "Vendas", "Relatórios"],
  servicos_agendados: ["Caixa / PDV", "Clientes", "Produtos", "Vendas", "Relatórios"],
  assistencia_tecnica: ["Caixa / PDV", "Clientes", "Produtos", "Vendas", "Relatórios"],
  arena_quadras: ["Agenda esportiva", "Quadras / Campos", "Mensalistas", "Jogadores", "Relatórios"]
};

const ALIASES_TIPOS_NEGOCIO = {
  mercado: "mercado_conveniencia",
  mercado_mercearia: "mercado_conveniencia",
  conveniencia: "mercado_conveniencia",
  loja_conveniencia: "mercado_conveniencia",
  padaria: "padaria_confeitaria",
  panificadora: "padaria_confeitaria",
  confeitaria: "padaria_confeitaria",
  cafeteria_padaria: "padaria_confeitaria",
  lanchonete: "lanchonete_cafeteria",
  cafeteria: "lanchonete_cafeteria",
  cafeteria_doceria: "lanchonete_cafeteria",
  doceria: "lanchonete_cafeteria",
  bar: "bar_adega",
  servicos: "servicos_gerais",
  barbearia: "servicos_agendados",
  salao: "servicos_agendados",
  assistencia: "assistencia_tecnica",
  arena: "arena_quadras",
  society: "arena_quadras",
  arena_society: "arena_quadras",
  arena_esportiva: "arena_quadras",
  arena_beach: "arena_quadras",
  beach_sports: "arena_quadras",
  beach_tennis: "arena_quadras",
  futvolei: "arena_quadras",
  volei_areia: "arena_quadras",
  quadras: "arena_quadras",
  quadras_esportivas: "arena_quadras"
};

let catalogoNegocios = CATALOGO_NEGOCIOS_FALLBACK;
let previewNegocios = { ...PREVIEW_NEGOCIOS_FALLBACK };

// ======================================================
// HELPERS
// ======================================================
let toastConfigTimer = null;

function cfgFeedback(msg, tipo = "normal") {
  if (!msg) return;

  const toast = document.getElementById("toastConfig");
  const texto = document.getElementById("toastConfigTexto");
  const icon = document.getElementById("toastConfigIcon");

  if (!toast || !texto) return;

  texto.textContent = msg;

  toast.classList.remove("sucesso", "erro", "alerta", "active");

  if (tipo === "erro") {
    toast.classList.add("erro");
    if (icon) icon.className = "fa-solid fa-circle-xmark";
  } else if (tipo === "sucesso") {
    toast.classList.add("sucesso");
    if (icon) icon.className = "fa-solid fa-circle-check";
  } else {
    toast.classList.add("alerta");
    if (icon) icon.className = "fa-solid fa-circle-info";
  }

  toast.classList.add("active");

  clearTimeout(toastConfigTimer);

  toastConfigTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, 3200);
}

function valor(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function normalizarTipoNegocio(tipo) {
  const codigo = String(tipo || "").trim();
  return ALIASES_TIPOS_NEGOCIO[codigo] || codigo;
}

function categoriaPorTipoNegocio(tipo) {
  const tipoNormalizado = normalizarTipoNegocio(tipo);

  for (const categoria of catalogoNegocios) {
    if (categoria.tipos.some(item => item.codigo === tipoNormalizado)) {
      return categoria.codigo;
    }
  }

  return "";
}

function renderizarCategoriasNegocio() {
  const select = document.getElementById("cfgCategoriaNegocio");

  if (!select) return;

  const valorAtual = select.value;
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione a categoria";
  select.appendChild(placeholder);

  [...catalogoNegocios]
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
    .forEach(categoria => {
      const option = document.createElement("option");
      option.value = categoria.codigo;
      option.textContent = categoria.nome;
      select.appendChild(option);
    });

  select.value = valorAtual;
}

function carregarTiposDaCategoria(categoria, tipoSelecionado = "") {
  const selectTipo = document.getElementById("cfgTipoNegocio");

  if (!selectTipo) return;

  const grupo = catalogoNegocios.find(item => item.codigo === categoria);
  const tipos = grupo?.tipos || [];

  if (!categoria || !tipos.length) {
    selectTipo.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione primeiro a categoria";
    selectTipo.appendChild(placeholder);
    selectTipo.disabled = true;
    return;
  }

  selectTipo.disabled = false;
  selectTipo.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione o tipo de negócio";
  selectTipo.appendChild(placeholder);

  [...tipos]
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
    .forEach(tipo => {
      const option = document.createElement("option");
      option.value = tipo.codigo;
      option.textContent = tipo.nome;
      selectTipo.appendChild(option);
    });

  selectTipo.value = normalizarTipoNegocio(tipoSelecionado);
}

async function carregarCatalogoNegocios() {
  try {
    const [categoriasResp, tiposResp, modulosResp, vinculosModulosResp, featuresResp, vinculosFeaturesResp] =
      await Promise.all([
        sb.from("categorias_negocio").select("codigo, nome, ordem, ativo").eq("ativo", true).order("ordem"),
        sb.from("tipos_negocio").select("codigo, nome, categoria_codigo, ordem, ativo, selecionavel").eq("ativo", true).eq("selecionavel", true).order("ordem"),
        sb.from("modulos_sistema").select("codigo, nome, ordem, ativo").eq("ativo", true).order("ordem"),
        sb.from("tipos_negocio_modulos").select("tipo_negocio, modulo_codigo, ativo").eq("ativo", true),
        sb.from("features_sistema").select("codigo, nome, categoria, ativo, implementada").eq("ativo", true).eq("implementada", true),
        sb.from("tipos_negocio_features").select("tipo_negocio, feature_codigo, ativo").eq("ativo", true)
      ]);

    const respostas = [
      categoriasResp,
      tiposResp,
      modulosResp,
      vinculosModulosResp,
      featuresResp,
      vinculosFeaturesResp
    ];

    const erro = respostas.find(resposta => resposta.error)?.error;
    if (erro) throw erro;

    const categorias = categoriasResp.data || [];
    const tipos = tiposResp.data || [];

    catalogoNegocios = categorias.map(categoria => ({
      ...categoria,
      tipos: tipos.filter(tipo => tipo.categoria_codigo === categoria.codigo)
    })).filter(categoria => categoria.tipos.length > 0);

    const nomesModulos = new Map(
      (modulosResp.data || []).map(modulo => [modulo.codigo, modulo.nome])
    );

    const nomesFeatures = new Map(
      (featuresResp.data || []).map(feature => [feature.codigo, feature.nome])
    );

    const novoPreview = {};

    tipos.forEach(tipo => {
      const itens = new Set();

      (vinculosModulosResp.data || [])
        .filter(vinculo => vinculo.tipo_negocio === tipo.codigo)
        .forEach(vinculo => {
          const nome = nomesModulos.get(vinculo.modulo_codigo);
          if (nome) itens.add(nome);
        });

      (vinculosFeaturesResp.data || [])
        .filter(vinculo => vinculo.tipo_negocio === tipo.codigo)
        .forEach(vinculo => {
          const nome = nomesFeatures.get(vinculo.feature_codigo);
          if (nome) itens.add(nome);
        });

      novoPreview[tipo.codigo] = [...itens];
    });

    previewNegocios = novoPreview;
  } catch (err) {
    console.warn("[CRV CATALOGO NEGOCIOS] Usando catalogo compativel local.", err);
    catalogoNegocios = CATALOGO_NEGOCIOS_FALLBACK;
    previewNegocios = { ...PREVIEW_NEGOCIOS_FALLBACK };
  }

  renderizarCategoriasNegocio();
}

// ======================================================
// MÁSCARAS
// ======================================================

function aplicarMascaraCNPJ(value) {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

function aplicarMascaraTelefone(value) {
  const numeros = value.replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numeros
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function initMascaras() {
  const cnpj = document.getElementById("cfgCnpj");
  const telefone = document.getElementById("cfgTelefone");
  const whatsapp = document.getElementById("cfgWhatsapp");
  const uf = document.getElementById("cfgUf");

  if (cnpj) {
    cnpj.addEventListener("input", e => {
      e.target.value = aplicarMascaraCNPJ(e.target.value);
    });
  }

  if (telefone) {
    telefone.addEventListener("input", e => {
      e.target.value = aplicarMascaraTelefone(e.target.value);
    });
  }

  if (whatsapp) {
    whatsapp.addEventListener("input", e => {
      e.target.value = aplicarMascaraTelefone(e.target.value);
    });
  }

// UF agora é select

}

// ======================================================
// CARREGAR CONFIGURAÇÕES
// ======================================================

async function carregarConfiguracoes() {
  try {
    cfgFeedback("Carregando configurações...");

    const empresaId = window.APP_EMPRESA_ID;

    if (!empresaId) {
      cfgFeedback("Empresa não encontrada.", "erro");
      return;
    }

    const { data, error } = await sb
      .from("empresas")
      .select("*")
      .eq("id", empresaId)
      .single();

    if (error) throw error;

    CONFIG_EMPRESA = data;

    preencherFormulario(data);

    cfgFeedback("");
  } catch (err) {
    console.error("[CRV CONFIG]", err);
    cfgFeedback("Erro ao carregar configurações.", "erro");
  }
}

// ======================================================
// PREENCHER FORM
// ======================================================

function preencherFormulario(data) {
  document.getElementById("cfgNomeFantasia").value =
    data.nome_fantasia || "";

  document.getElementById("cfgRazaoSocial").value =
    data.nome || "";

  document.getElementById("cfgCnpj").value =
    data.cnpj || "";

  document.getElementById("cfgTelefone").value =
    data.telefone || "";

  document.getElementById("cfgWhatsapp").value =
    data.whatsapp || "";

  document.getElementById("cfgEmail").value =
    data.email || "";

  document.getElementById("cfgEndereco").value =
    data.endereco || "";

  document.getElementById("cfgCidade").value =
    data.cidade || "";

  document.getElementById("cfgUf").value =
    data.uf || "";

const tipoNegocio = normalizarTipoNegocio(data.tipo_negocio || "");
const categoriaNegocio = categoriaPorTipoNegocio(tipoNegocio);

document.getElementById("cfgCategoriaNegocio").value = categoriaNegocio;

carregarTiposDaCategoria(categoriaNegocio, tipoNegocio);

atualizarPreviewSegmento();

  const fundoPreset = document.getElementById("cfgFundoPreset");
  if (fundoPreset) {
    fundoPreset.value = data.fundo_preset || "classico";
  }

  atualizarPreviewFundo();

  atualizarPreviewLogo();
  aplicarBloqueioConfiguracao();
}

function atualizarPreviewSegmento() {

  const select =
    document.getElementById("cfgTipoNegocio");

  const title =
    document.getElementById("segmentPreviewTitle");

  const content =
    document.getElementById("segmentPreviewContent");

  if (!select || !title || !content) return;

  const tipo = normalizarTipoNegocio(select.value);
  const grupo = catalogoNegocios.find(categoria =>
    categoria.tipos.some(item => item.codigo === tipo)
  );
  const tipoInfo = grupo?.tipos.find(item => item.codigo === tipo);
  const itens = previewNegocios[tipo] || [];

  if (!tipoInfo) {

    title.textContent =
      "Configure o segmento do negócio";

    content.innerHTML = `
      <div class="segment-empty">
        Selecione um segmento para visualizar os recursos automáticos do sistema.
      </div>
    `;

    return;
  }

  title.textContent = tipoInfo.nome;
  content.replaceChildren();

  if (!itens.length) {
    const vazio = document.createElement("div");
    vazio.className = "segment-empty";
    vazio.textContent = "Os recursos deste tipo serão carregados após salvar.";
    content.appendChild(vazio);
    return;
  }

  itens.forEach(item => {
    const linha = document.createElement("div");
    linha.className = "segment-module";

    const icone = document.createElement("i");
    icone.className = "fa-solid fa-circle-check";

    const texto = document.createElement("span");
    texto.textContent = item;

    linha.append(icone, texto);
    content.appendChild(linha);
  });
}

function atualizarPreviewFundo() {
  const select = document.getElementById("cfgFundoPreset");
  const preview = document.getElementById("cfgFundoPreview");

  if (!select || !preview) return;

  const presets = window.CRV_FUNDOS_PRESET || {};
  const codigo = presets[select.value] ? select.value : "classico";
  const preset = presets[codigo];

  if (!preset) return;

  const claro = preview.querySelector(".fundo-preview-claro");
  const escuro = preview.querySelector(".fundo-preview-escuro");

  if (claro) claro.style.backgroundImage = `url("${preset.claro}")`;
  if (escuro) escuro.style.backgroundImage = `url("${preset.escuro}")`;

  if (window.crvAplicarFundoPreset) {
    window.crvAplicarFundoPreset(codigo);
  }
}

// ======================================================
// PREVIEW LOGO
// ======================================================

function atualizarPreviewLogo(file = null) {
  const img = document.getElementById("cfgLogoPreview");

  if (!img) return;

  if (file) {
    const reader = new FileReader();

    reader.onload = e => {
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
    return;
  }

  if (CONFIG_EMPRESA && CONFIG_EMPRESA.logo_url) {
    img.src = `${CONFIG_EMPRESA.logo_url}${CONFIG_EMPRESA.logo_url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  } else {
    img.src = "assets/logo1.png";
  }
}

// ======================================================
// UPLOAD DA LOGO
// ======================================================
async function enviarLogoEmpresa(empresaId) {
  const logoInput = document.getElementById("cfgLogoFile");
  const logoFile = logoInput?.files?.[0];

  if (LOGO_REMOVER_PENDENTE) {
    const pasta = `empresas/${empresaId}`;

    await sb.storage.from("logo").remove([
      `${pasta}/logo.png`,
      `${pasta}/logo.jpg`,
      `${pasta}/logo.jpeg`,
      `${pasta}/logo.webp`
    ]);

    return "";
  }

  if (!logoFile) {
    return CONFIG_EMPRESA?.logo_url || "";
  }

  const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];

  if (!tiposPermitidos.includes(logoFile.type)) {
    throw new Error("Formato inválido. Use PNG, JPG ou WEBP.");
  }

  if (logoFile.size > 3 * 1024 * 1024) {
    throw new Error("Logo muito grande. Máximo 3MB.");
  }

  cfgFeedback("Enviando logo...");

  const extensao =
    logoFile.type === "image/jpeg"
      ? "jpg"
      : logoFile.type.replace("image/", "");

  const pasta = `empresas/${empresaId}`;

  await sb.storage.from("logo").remove([
    `${pasta}/logo.png`,
    `${pasta}/logo.jpg`,
    `${pasta}/logo.jpeg`,
    `${pasta}/logo.webp`
  ]);

  const caminho = `${pasta}/logo.${extensao}`;

  const { error } = await sb.storage
    .from("logo")
    .upload(caminho, logoFile, {
      cacheControl: "0",
      upsert: true
    });

  if (error) throw error;

  const { data } = sb.storage
    .from("logo")
    .getPublicUrl(caminho);

  return `${data.publicUrl}?v=${Date.now()}`;
}

// ======================================================
// EDITAR CONFIGURAÇÕES
// ======================================================
function liberarEdicaoConfiguracao() {
  document.querySelectorAll(
    "#cfgNomeFantasia, #cfgRazaoSocial, #cfgCnpj, #cfgTelefone, #cfgWhatsapp, #cfgEmail, #cfgEndereco, #cfgCidade, #cfgUf, #cfgCategoriaNegocio, #cfgTipoNegocio, #cfgFundoPreset, #cfgLogoFile"
  ).forEach(el => {
    el.disabled = false;
  });

  document.querySelectorAll(".btn-salvar-config, .btn-cancelar-config").forEach(btn => {
    btn.style.display = "";
  });

  const btnRemoverLogo = document.getElementById("btnRemoverLogoEmpresa");
  if (btnRemoverLogo) btnRemoverLogo.disabled = false;

  document.getElementById("btnEditarConfiguracoes").style.display = "none";
}

function cancelarEdicaoConfiguracao() {
  if (!CONFIG_EMPRESA) return;

  LOGO_REMOVER_PENDENTE = false;

  const logoInput = document.getElementById("cfgLogoFile");
  const fileName = document.getElementById("cfgLogoFileName");

  if (logoInput) logoInput.value = "";
  if (fileName) fileName.textContent = "Nenhum arquivo selecionado";

  preencherFormulario(CONFIG_EMPRESA);
  cfgFeedback("Alterações canceladas.", "sucesso");
}

// ======================================================
// SALVAR CONFIGURAÇÕES
// ======================================================

async function salvarConfiguracoes() {
  try {
    cfgFeedback("Salvando configurações...");

    const empresaId = window.APP_EMPRESA_ID;

    if (!empresaId) {
      cfgFeedback("Empresa não encontrada.", "erro");
      return;
    }

    const tipoNegocio = normalizarTipoNegocio(valor("cfgTipoNegocio"));

    if (!tipoNegocio) {
      cfgFeedback("Selecione o tipo de negócio.", "erro");
      return;
    }

    const logoUrl = await enviarLogoEmpresa(empresaId);

    const payload = {
      nome_fantasia: valor("cfgNomeFantasia"),
      nome: valor("cfgRazaoSocial"),
      cnpj: valor("cfgCnpj"),
      telefone: valor("cfgTelefone"),
      whatsapp: valor("cfgWhatsapp"),
      email: valor("cfgEmail"),
      endereco: valor("cfgEndereco"),
      cidade: valor("cfgCidade"),
      uf: valor("cfgUf"),
      logo_url: logoUrl,
      tipo_negocio: tipoNegocio,
      fundo_preset: valor("cfgFundoPreset") || "classico",
      configuracao_inicial_concluida: true,
      configuracao_inicial_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from("empresas")
      .update(payload)
      .eq("id", empresaId)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Nenhuma empresa foi atualizada. Verifique se o usuário tem permissão para editar esta empresa."
      );
    }

    CONFIG_EMPRESA = data;
    LOGO_REMOVER_PENDENTE = false;

    atualizarPreviewLogo();
    atualizarPreviewFundo();

    aplicarBloqueioConfiguracao();

    const logoInput = document.getElementById("cfgLogoFile");
    const fileName = document.getElementById("cfgLogoFileName");

    if (logoInput) {
      logoInput.value = "";
    }

    if (fileName) {
      fileName.textContent = "Nenhum arquivo selecionado";
    }

    if (window.crvCarregarConfiguracoesEmpresa) {
      await crvCarregarConfiguracoesEmpresa();
    }

    if (window.crvAplicarLogoEmpresaTopbar) {
      window.crvAplicarLogoEmpresaTopbar(data.logo_url);
    }

    const logoHeader = document.querySelector(".empresa-logo-header");

    if (logoHeader && data.logo_url) {
      logoHeader.src = data.logo_url;
    }

    cfgFeedback("Configurações salvas com sucesso.", "sucesso");
    if (sessionStorage.getItem("crv_primeira_configuracao") === "1") {
      sessionStorage.removeItem("crv_primeira_configuracao");

      const modalFinalizado = document.getElementById("setupModalFinalizado");

      if (modalFinalizado) {
        modalFinalizado.classList.add("active");
        return;
      }

      window.location.href = "dashboard.html";
    }
  } catch (err) {
    console.error("[CRV CONFIG]", err);
    cfgFeedback(err?.message || "Erro ao salvar configurações.", "erro");
  }
}

function removerLogoEmpresa() {
  LOGO_REMOVER_PENDENTE = true;

  const preview = document.getElementById("cfgLogoPreview");
  const logoInput = document.getElementById("cfgLogoFile");
  const fileName = document.getElementById("cfgLogoFileName");

  if (preview) preview.src = "assets/logo1.png";
  if (logoInput) logoInput.value = "";
  if (fileName) fileName.textContent = "Logo será removida ao salvar";

  cfgFeedback("Remoção preparada. Salve para confirmar ou cancele para desfazer.");
}

// ======================================================
// FEEDBACK WHATSAPP
// ======================================================

function initFeedbackLink() {
  const link = document.getElementById("cfgFeedbackLink");

  if (!link) return;

  const texto = encodeURIComponent(
    "Olá, equipe CRV. Gostaria de enviar um feedback sobre o CRV PDV:"
  );

  link.href = `https://wa.me/5515997021387?text=${texto}`;
}

function aplicarBloqueioConfiguracao() {
  if (!CONFIG_EMPRESA?.configuracao_inicial_concluida) {
    liberarEdicaoConfiguracao();
    return;
  }

  document.querySelectorAll(
    "#cfgNomeFantasia, #cfgRazaoSocial, #cfgCnpj, #cfgTelefone, #cfgWhatsapp, #cfgEmail, #cfgEndereco, #cfgCidade, #cfgUf, #cfgCategoriaNegocio, #cfgTipoNegocio, #cfgFundoPreset, #cfgLogoFile"
  ).forEach(el => {
    el.disabled = true;
  });

  document.querySelectorAll(".btn-salvar-config, .btn-cancelar-config").forEach(btn => {
    btn.style.display = "none";
  });

  const btnRemoverLogo = document.getElementById("btnRemoverLogoEmpresa");
  if (btnRemoverLogo) btnRemoverLogo.disabled = true;

  const btnEditar = document.getElementById("btnEditarConfiguracoes");

   if (btnEditar) {
     btnEditar.style.display = "";
   }

}

// ======================================================
// ABAS CONFIGURAÇÕES / SOBRE
// ======================================================
function initConfigTabs() {
  const tabs = [
    {
      tab: document.getElementById("tabConfiguracoes"),
      sec: document.getElementById("secConfiguracoes")
    },
    {
      tab: document.getElementById("tabAparencia"),
      sec: document.getElementById("secAparencia")
    },
    {
      tab: document.getElementById("tabOperadores"),
      sec: document.getElementById("secOperadores")
    },
    {
      tab: document.getElementById("tabSobreSistema"),
      sec: document.getElementById("secSobreSistema")
    }
  ];

  const tabsValidas = tabs.filter(item => item.tab && item.sec);

  if (!tabsValidas.length) return;

  tabsValidas.forEach(item => {
    item.tab.addEventListener("click", async () => {
      tabsValidas.forEach(t => {
        t.tab.classList.remove("active");
        t.sec.classList.remove("active");
      });

      item.tab.classList.add("active");
      item.sec.classList.add("active");

      if (
        item.tab.id === "tabOperadores" &&
        window.crvPermissoes &&
        typeof window.crvPermissoes.carregarOperadores === "function"
      ) {
        await window.crvPermissoes.carregarOperadores();
      }
    });
  });
    const params = new URLSearchParams(window.location.search);
  const abaInicial = params.get("aba");

  if (abaInicial === "operadores") {
    document.getElementById("tabOperadores")?.click();
  }

  if (abaInicial === "aparencia") {
    document.getElementById("tabAparencia")?.click();
  }

  if (abaInicial === "sobre") {
    document.getElementById("tabSobreSistema")?.click();
  }
}

async function aguardarEmpresaECarregarConfiguracoes() {
  let tentativas = 0;

  while (!window.APP_EMPRESA_ID && tentativas < 30) {
    await new Promise(resolve => setTimeout(resolve, 100));
    tentativas++;
  }

  if (!window.APP_EMPRESA_ID) {
    cfgFeedback("Empresa não encontrada.", "erro");
    return;
  }

  await carregarCatalogoNegocios();
  await carregarConfiguracoes();

  if (window.crvCarregarConfiguracoesEmpresa) {
    await crvCarregarConfiguracoesEmpresa();
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get("aba") === "operadores") {
    document.getElementById("tabOperadores")?.click();
  }
}

// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const botoesSalvar = document.querySelectorAll(".btn-salvar-config");
  const botoesCancelar = document.querySelectorAll(".btn-cancelar-config");
  const logoInput = document.getElementById("cfgLogoFile");
  const btnRemoverLogo = document.getElementById("btnRemoverLogoEmpresa");
  const fundoPreset = document.getElementById("cfgFundoPreset");

  initMascaras();
  initFeedbackLink();
  initConfigTabs();

  botoesSalvar.forEach(btn => btn.addEventListener("click", salvarConfiguracoes));
  botoesCancelar.forEach(btn => btn.addEventListener("click", cancelarEdicaoConfiguracao));

const modalRemoverLogo = document.getElementById("modalConfirmarRemoverLogo");
const btnCancelarRemoverLogo = document.getElementById("btnCancelarRemoverLogo");
const btnConfirmarRemoverLogo = document.getElementById("btnConfirmarRemoverLogo");

if (btnRemoverLogo) {
  btnRemoverLogo.addEventListener("click", () => {
    if (modalRemoverLogo) {
      modalRemoverLogo.classList.add("active");
    }
  });
}

if (btnCancelarRemoverLogo) {
  btnCancelarRemoverLogo.addEventListener("click", () => {
    if (modalRemoverLogo) {
      modalRemoverLogo.classList.remove("active");
    }
  });
}

if (btnConfirmarRemoverLogo) {
  btnConfirmarRemoverLogo.addEventListener("click", () => {
    if (modalRemoverLogo) {
      modalRemoverLogo.classList.remove("active");
    }

    removerLogoEmpresa();
  });
}

const btnEditar = document.getElementById("btnEditarConfiguracoes");

if (btnEditar) {
  btnEditar.addEventListener("click", liberarEdicaoConfiguracao);
}

const btnFinalizarConfiguracao = document.getElementById("btnFinalizarConfiguracao");

if (btnFinalizarConfiguracao) {
  btnFinalizarConfiguracao.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });
}

if (logoInput) {
  logoInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    const fileName = document.getElementById("cfgLogoFileName");

    if (file) {
      LOGO_REMOVER_PENDENTE = false;
      atualizarPreviewLogo(file);

      if (fileName) {
        fileName.textContent = file.name;
      }
    } else {
      if (fileName) {
        fileName.textContent = "Nenhum arquivo selecionado";
      }
    }
  });
}

aguardarEmpresaECarregarConfiguracoes();

const params = new URLSearchParams(window.location.search);

if (params.get("aba") === "operadores") {
  setTimeout(() => {
    document.getElementById("tabOperadores")?.click();
  }, 100);
}

const categoriaNegocio =
  document.getElementById("cfgCategoriaNegocio");

const tipoNegocio =
  document.getElementById("cfgTipoNegocio");

if (categoriaNegocio) {
  categoriaNegocio.addEventListener("change", () => {
    carregarTiposDaCategoria(categoriaNegocio.value);
    atualizarPreviewSegmento();
  });
}

if (tipoNegocio) {
  tipoNegocio.addEventListener(
    "change",
    atualizarPreviewSegmento
  );
}

if (fundoPreset) {
  fundoPreset.addEventListener("change", atualizarPreviewFundo);
}

const setupModal = document.getElementById("setupModalObrigatorio");
const btnIniciarConfiguracao = document.getElementById("btnIniciarConfiguracao");

if (sessionStorage.getItem("crv_primeira_configuracao") === "1") {
  if (setupModal) {
    setupModal.classList.add("active");
  }
}

if (btnIniciarConfiguracao) {
  btnIniciarConfiguracao.addEventListener("click", () => {
    if (setupModal) {
      setupModal.classList.remove("active");
    }
  });
}

});