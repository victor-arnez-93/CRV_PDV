// ======================================================
// CRV PDV - CONFIG GLOBAL / SAAS MULTI-SEGMENTO
// ======================================================

window.CRV_CONFIG = {
  empresa: null,
  segmento: null,
  modulos: {},
  modulosLista: []
};

window.CRV_SEGMENTO = null;
window.CRV_MODULOS = {};

// ======================================================
// CARREGAR CONFIG EMPRESA
// ======================================================

async function crvCarregarConfiguracoesEmpresa() {
  try {
    if (!window.APP_EMPRESA_ID) {
      return null;
    }

    const { data: empresa, error: empresaError } = await sb
      .from("empresas")
      .select("*")
      .eq("id", APP_EMPRESA_ID)
      .single();

    if (empresaError) throw empresaError;

    window.CRV_CONFIG.empresa = empresa;
    window.CRV_CONFIG.segmento = empresa.tipo_negocio || "comercio_geral";
    window.CRV_SEGMENTO = window.CRV_CONFIG.segmento;

    await crvCarregarModulosSegmento(window.CRV_SEGMENTO);

    aplicarConfiguracoesSistema(empresa);

    document.dispatchEvent(new CustomEvent("crv:config-pronta", {
      detail: {
        empresa,
        segmento: window.CRV_SEGMENTO,
        modulos: window.CRV_MODULOS
      }
    }));

    return empresa;

  } catch (err) {
    console.error("[CRV CONFIG GLOBAL]", err);
    return null;
  }
}

// ======================================================
// CARREGAR MÓDULOS DO SEGMENTO
// ======================================================

async function crvCarregarModulosSegmento(tipoNegocio) {
  try {
    const tipo = String(tipoNegocio || "comercio_geral").trim();

    const { data, error } = await sb
      .from("tipos_negocio_modulos")
      .select(`
        modulo_codigo,
        ativo,
        modulos_sistema:modulo_codigo (
          codigo,
          nome,
          rota,
          icone,
          ordem,
          ativo
        )
      `)
      .eq("tipo_negocio", tipo)
      .eq("ativo", true);

    if (error) throw error;

    const lista = Array.isArray(data)
      ? data
          .map(item => item.modulos_sistema)
          .filter(modulo => modulo && modulo.ativo !== false)
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      : [];

    const mapa = {};

    lista.forEach(modulo => {
      mapa[modulo.codigo] = true;
    });

    window.CRV_CONFIG.modulosLista = lista;
    window.CRV_CONFIG.modulos = mapa;
    window.CRV_MODULOS = mapa;

    return mapa;

  } catch (err) {
    console.error("[CRV MÓDULOS]", err);

    window.CRV_MODULOS = {
      dashboard: true,
      caixa: true,
      vendas: true,
      produtos: true,
      clientes: true,
      relatorios: true,
      configuracoes: true
    };

    window.CRV_CONFIG.modulos = window.CRV_MODULOS;
    window.CRV_CONFIG.modulosLista = [];

    return window.CRV_MODULOS;
  }
}

// ======================================================
// HELPERS DE MÓDULOS
// ======================================================

function crvModuloAtivo(codigo) {
  return window.CRV_MODULOS?.[codigo] === true;
}

function crvSegmentoUsaAgenda() {
  return crvModuloAtivo("agenda");
}

function crvSegmentoAtual() {
  return window.CRV_SEGMENTO || window.CRV_CONFIG?.empresa?.tipo_negocio || "";
}

// ======================================================
// APLICAR CONFIGURAÇÕES
// ======================================================

function aplicarConfiguracoesSistema(cfg) {
  if (!cfg) return;

  const logosSistema = document.querySelectorAll(".sidebar-logo-img");

  logosSistema.forEach(img => {
    img.src = "assets/logo1.png";
    img.alt = "CRV PDV";
  });

  if (window.crvAplicarLogoEmpresaTopbar) {
    window.crvAplicarLogoEmpresaTopbar(cfg.logo_url || "");
  }

  const subs = document.querySelectorAll(".sidebar-logo-sub");

  subs.forEach(el => {
    el.textContent =
      cfg.nome_fantasia ||
      cfg.nome ||
      "CRV PDV";

    el.classList.add("ready");
  });

  aplicarModulosNaSidebar();
}

// ======================================================
// SIDEBAR DINÂMICA
// ======================================================

function aplicarModulosNaSidebar() {
  const mapaRotas = {
    "dashboard.html": "dashboard",
    "caixa.html": "caixa",
    "comandas.html": "comandas",
    "agenda.html": "agenda",
    "vendas.html": "vendas",
    "produtos.html": "produtos",
    "clientes.html": "clientes",
    "relatorios.html": "relatorios",
    "configuracoes.html": "configuracoes"
  };

  document.querySelectorAll(".nav-item").forEach(item => {
    const href = item.getAttribute("href") || "";
    const rota = href.split("/").pop();
    const modulo = mapaRotas[rota];

    if (!modulo) return;

    item.style.display = crvModuloAtivo(modulo) ? "" : "none";
  });

  limparSecoesVaziasSidebar();
}

// ======================================================
// ESCONDER TÍTULOS VAZIOS DA SIDEBAR
// ======================================================

function limparSecoesVaziasSidebar() {
  const labels = document.querySelectorAll(".nav-section-label");

  labels.forEach(label => {
    let atual = label.nextElementSibling;
    let temItemVisivel = false;

    while (atual && !atual.classList.contains("nav-section-label")) {
      if (
        atual.classList.contains("nav-item") &&
        atual.style.display !== "none"
      ) {
        temItemVisivel = true;
        break;
      }

      atual = atual.nextElementSibling;
    }

    label.style.display = temItemVisivel ? "" : "none";
  });
}

// ======================================================
// BLOQUEAR PÁGINA SEM MÓDULO
// ======================================================

function crvBloquearPaginaSemModulo(codigoModulo) {
  if (!codigoModulo) return false;

  if (!crvModuloAtivo(codigoModulo)) {
    window.location.href = "dashboard.html";
    return true;
  }

  return false;
}

// ======================================================
// INIT
// ======================================================

window.crvCarregarConfiguracoesEmpresa = crvCarregarConfiguracoesEmpresa;
window.crvCarregarModulosSegmento = crvCarregarModulosSegmento;
window.crvModuloAtivo = crvModuloAtivo;
window.crvSegmentoUsaAgenda = crvSegmentoUsaAgenda;
window.crvSegmentoAtual = crvSegmentoAtual;
window.crvBloquearPaginaSemModulo = crvBloquearPaginaSemModulo;