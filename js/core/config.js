// ======================================================
// CRV PDV - CONFIG GLOBAL
// ======================================================

window.CRV_CONFIG = {
  empresa: null
};

// ======================================================
// CARREGAR CONFIG EMPRESA
// ======================================================

async function crvCarregarConfiguracoesEmpresa() {

  try {

    if (!window.APP_EMPRESA_ID) {
      return null;
    }

    const { data, error } = await sb
      .from("empresas")
      .select("*")
      .eq("id", APP_EMPRESA_ID)
      .single();

    if (error) throw error;

    window.CRV_CONFIG.empresa = data;

    aplicarConfiguracoesSistema(data);

    return data;

  } catch (err) {

    console.error(
      "[CRV CONFIG GLOBAL]",
      err
    );

    return null;
  }
}

// ======================================================
// APLICAR CONFIGURAÇÕES
// ======================================================

function aplicarConfiguracoesSistema(cfg) {

  if (!cfg) return;

  // ==========================================
  // TEMA
  // ==========================================

  if (cfg.tema) {

    document.documentElement.setAttribute(
      "data-theme",
      cfg.tema
    );

    localStorage.setItem(
      "crv-theme",
      cfg.tema
    );
  }

  // ==========================================
  // LOGO
  // ==========================================

  const logos =
    document.querySelectorAll(".sidebar-logo-img");

  logos.forEach(img => {

    if (cfg.logo_url) {
      img.src = cfg.logo_url;
    }
  });

  // ==========================================
  // SUBTÍTULO SIDEBAR
  // ==========================================

  const subs =
    document.querySelectorAll(".sidebar-logo-sub");

  subs.forEach(el => {

    el.textContent =
      cfg.nome_fantasia ||
      cfg.nome ||
      "CRV PDV";
  });

  // ==========================================
  // MÓDULOS
  // ==========================================

  controlarModulo(
    "Caixa / PDV",
    cfg.modulo_caixa
  );

  controlarModulo(
    "Produtos",
    cfg.modulo_produtos
  );

  controlarModulo(
    "Comandas",
    cfg.modulo_comandas
  );

  controlarModulo(
    "Relatórios",
    cfg.modulo_relatorios
  );

  controlarModulo(
    "Horários",
    cfg.modulo_horarios
  );
}

// ======================================================
// MOSTRAR / ESCONDER MÓDULOS
// ======================================================

function controlarModulo(texto, ativo) {

  const itens =
    document.querySelectorAll(".nav-item");

  itens.forEach(item => {

    if (
      item.textContent
        .trim()
        .includes(texto)
    ) {

      item.style.display =
        ativo === false
          ? "none"
          : "";
    }
  });
}

// ======================================================
// INIT
// ======================================================

window.crvCarregarConfiguracoesEmpresa =
  crvCarregarConfiguracoesEmpresa;