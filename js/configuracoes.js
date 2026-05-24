// ======================================================
// CRV PDV - CONFIGURAÇÕES
// ======================================================

let CONFIG_EMPRESA = null;

const SEGMENTOS_CONFIG = {

  comercio_geral: {
    titulo: "Comércio geral",
    modulos: [
      "Caixa / PDV",
      "Produtos",
      "Clientes",
      "Relatórios"
    ]
  },

  padaria: {
    titulo: "Padaria",
    modulos: [
      "Caixa rápido",
      "Produtos",
      "Comandas opcionais",
      "Relatórios"
    ]
  },

  restaurante: {
    titulo: "Restaurante",
    modulos: [
      "Comandas",
      "Caixa",
      "Produtos",
      "Relatórios"
    ]
  },

  bar_adega: {
    titulo: "Bar / Adega",
    modulos: [
      "Comandas",
      "Caixa",
      "Bebidas",
      "Relatórios"
    ]
  },

  arena_esportiva: {
    titulo: "Arena esportiva",
    modulos: [
      "Agenda esportiva",
      "Controle de jogos",
      "Cobrança por jogador",
      "Relatórios"
    ]
  },

  arena_beach: {
    titulo: "Arena de areia / Beach sports",
    modulos: [
      "Quadras",
      "Agenda",
      "Jogos",
      "Cobrança por jogador"
    ]
  },

  quadras_esportivas: {
    titulo: "Quadras esportivas",
    modulos: [
      "Reservas",
      "Agenda",
      "Controle de horários",
      "Relatórios"
    ]
  }
};

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

  if (uf) {
    uf.addEventListener("input", e => {
      e.target.value = e.target.value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 2);
    });
  }
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

document.getElementById("cfgTipoNegocio").value =
  data.tipo_negocio || "";

atualizarPreviewSegmento();

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

  const tipo = select.value;

  const cfg = SEGMENTOS_CONFIG[tipo];

  if (!cfg) {

    title.textContent =
      "Configure o segmento do negócio";

    content.innerHTML = `
      <div class="segment-empty">
        Selecione um segmento para visualizar os recursos automáticos do sistema.
      </div>
    `;

    return;
  }

  title.textContent = cfg.titulo;

  content.innerHTML =
    cfg.modulos.map(modulo => `
      <div class="segment-module">
        <i class="fa-solid fa-circle-check"></i>
        <span>${modulo}</span>
      </div>
    `).join("");
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
    "#cfgNomeFantasia, #cfgRazaoSocial, #cfgCnpj, #cfgTelefone, #cfgWhatsapp, #cfgEmail, #cfgEndereco, #cfgCidade, #cfgUf, #cfgTipoNegocio, #cfgLogoFile"
  ).forEach(el => {
    el.disabled = false;
  });

  document.getElementById("btnSalvarConfiguracoes").style.display = "";
  document.getElementById("btnEditarConfiguracoes").style.display = "none";
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
      tipo_negocio:
  valor("cfgTipoNegocio"),

configuracao_inicial_concluida: true,

configuracao_inicial_em:
  new Date().toISOString(),
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

atualizarPreviewLogo();

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
    cfgFeedback("Erro ao salvar configurações.", "erro");
  }
}

async function removerLogoEmpresa() {
  try {
    const empresaId = window.APP_EMPRESA_ID;

    if (!empresaId) {
      cfgFeedback("Empresa não encontrada.", "erro");
      return;
    }

    cfgFeedback("Removendo logo...");

    const pasta = `empresas/${empresaId}`;

    await sb.storage.from("logo").remove([
      `${pasta}/logo.png`,
      `${pasta}/logo.jpg`,
      `${pasta}/logo.jpeg`,
      `${pasta}/logo.webp`
    ]);

    const { data, error } = await sb
      .from("empresas")
      .update({
        logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", empresaId)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    CONFIG_EMPRESA = data;

    const preview = document.getElementById("cfgLogoPreview");
    const headerLogo = document.querySelector(".empresa-logo-header");
    const logoInput = document.getElementById("cfgLogoFile");
    const fileName = document.getElementById("cfgLogoFileName");

    if (preview) preview.src = "assets/logo1.png";
    if (headerLogo) headerLogo.src = "assets/logo1.png";
    if (logoInput) logoInput.value = "";
    if (fileName) fileName.textContent = "Nenhum arquivo selecionado";

    if (window.crvCarregarConfiguracoesEmpresa) {
      await crvCarregarConfiguracoesEmpresa();
    }

    cfgFeedback("Logo removida com sucesso.", "erro");
  } catch (err) {
    console.error("[CRV CONFIG]", err);
    cfgFeedback(err?.message || "Erro ao remover logo.", "erro");
  }
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
  if (!CONFIG_EMPRESA?.configuracao_inicial_concluida) return;

  document.querySelectorAll(
    "#cfgNomeFantasia, #cfgRazaoSocial, #cfgCnpj, #cfgTelefone, #cfgWhatsapp, #cfgEmail, #cfgEndereco, #cfgCidade, #cfgUf, #cfgTipoNegocio, #cfgLogoFile"
  ).forEach(el => {
    el.disabled = true;
  });

  const btnEditar = document.getElementById("btnEditarConfiguracoes");

   if (btnEditar) {
     btnEditar.style.display = "";
   }

}

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  const btnSalvar = document.getElementById("btnSalvarConfiguracoes");
  const logoInput = document.getElementById("cfgLogoFile");
  const btnRemoverLogo = document.getElementById("btnRemoverLogoEmpresa");

  initMascaras();
  initFeedbackLink();

  if (btnSalvar) {
    btnSalvar.addEventListener("click", salvarConfiguracoes);
  }

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
  btnConfirmarRemoverLogo.addEventListener("click", async () => {
    if (modalRemoverLogo) {
      modalRemoverLogo.classList.remove("active");
    }

    await removerLogoEmpresa();
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

  setTimeout(() => {
    carregarConfiguracoes();
  }, 700);

  setTimeout(() => {
    if (window.crvCarregarConfiguracoesEmpresa) {
      crvCarregarConfiguracoesEmpresa();
    }
  }, 900);
  const tipoNegocio =
  document.getElementById("cfgTipoNegocio");

if (tipoNegocio) {
  tipoNegocio.addEventListener(
    "change",
    atualizarPreviewSegmento
  );
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
