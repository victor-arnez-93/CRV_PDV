// ======================================================
// CRV PDV - CONFIGURAÇÕES
// ======================================================

let CONFIG_EMPRESA = null;

// ======================================================
// HELPERS
// ======================================================

function cfgFeedback(msg, tipo = "normal") {
  const el = document.getElementById("cfgFeedback");

  if (!el) return;

  el.textContent = msg;

  if (tipo === "erro") {
    el.style.color = "#FF7070";
  } else if (tipo === "sucesso") {
    el.style.color = "var(--crv-green)";
  } else {
    el.style.color = "var(--text-secondary)";
  }
}

function valor(id) {
  return document.getElementById(id)?.value?.trim() || "";
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

    cfgFeedback("Configurações carregadas.", "sucesso");
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

  atualizarPreviewLogo();
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
    img.src = CONFIG_EMPRESA.logo_url;
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

  cfgFeedback("Enviando logo...");

  const extensao = logoFile.name.split(".").pop()?.toLowerCase() || "png";

  const nomeArquivo =
    `logo-${empresaId}-${Date.now()}.${extensao}`;

  const { error: uploadError } = await sb.storage
    .from("logo")
    .upload(nomeArquivo, logoFile, {
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = sb.storage
    .from("logo")
    .getPublicUrl(nomeArquivo);

  return publicData.publicUrl;
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
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from("empresas")
      .update(payload)
      .eq("id", empresaId)
      .select("*")
      .single();

    if (error) throw error;

    CONFIG_EMPRESA = data;

    if (window.crvCarregarConfiguracoesEmpresa) {
      await crvCarregarConfiguracoesEmpresa();
    }

    cfgFeedback("Configurações salvas com sucesso.", "sucesso");
  } catch (err) {
    console.error("[CRV CONFIG]", err);
    cfgFeedback("Erro ao salvar configurações.", "erro");
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

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  const btnSalvar = document.getElementById("btnSalvarConfiguracoes");
  const logoInput = document.getElementById("cfgLogoFile");

  initMascaras();
  initFeedbackLink();

  if (btnSalvar) {
    btnSalvar.addEventListener("click", salvarConfiguracoes);
  }

  if (logoInput) {
    logoInput.addEventListener("change", e => {
      const file = e.target.files?.[0];

      if (file) {
        atualizarPreviewLogo(file);
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
});