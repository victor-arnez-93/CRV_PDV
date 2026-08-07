(function () {
  const CONTEXT_KEY = "CRV_OFFLINE_CONTEXT_V1";

  function lerContextoSalvo() {
    try {
      const bruto = localStorage.getItem(CONTEXT_KEY);
      const contexto = bruto ? JSON.parse(bruto) : null;

      if (
        !contexto?.auth_user_id ||
        !contexto?.empresa_id ||
        !contexto?.usuario
      ) {
        return null;
      }

      return contexto;
    } catch (err) {
      console.warn("[CRV OFFLINE][CONTEXTO] Cache inválido.", err);
      return null;
    }
  }

  function salvarContexto({ user, usuario, empresa }) {
    if (!user?.id || !usuario?.empresa_id) {
      return false;
    }

    const contexto = {
      auth_user_id: user.id,
      empresa_id: usuario.empresa_id,
      usuario,
      empresa: empresa || usuario.empresas || null,
      atualizado_em: new Date().toISOString()
    };

    localStorage.setItem(CONTEXT_KEY, JSON.stringify(contexto));
    document.dispatchEvent(
      new CustomEvent("crv:contexto-offline-pronto", {
        detail: contexto
      })
    );

    return true;
  }

  function restaurarContexto(authUserId) {
    const contexto = lerContextoSalvo();

    if (!contexto || String(contexto.auth_user_id) !== String(authUserId || "")) {
      return null;
    }

    window.APP_USER = contexto.usuario;
    window.APP_EMPRESA_ID = contexto.empresa_id;
    window.APP_EMPRESA = contexto.empresa || contexto.usuario?.empresas || null;

    document.dispatchEvent(
      new CustomEvent("crv:contexto-offline-pronto", {
        detail: contexto
      })
    );

    return contexto;
  }

  function obterEscopo() {
    const contexto = lerContextoSalvo();
    const usuarioId = window.USER?.id || contexto?.auth_user_id || null;
    const empresaId = window.APP_EMPRESA_ID || contexto?.empresa_id || null;

    if (!usuarioId || !empresaId) {
      return null;
    }

    if (
      contexto &&
      String(contexto.auth_user_id) !== String(usuarioId)
    ) {
      return null;
    }

    return {
      usuario_id: usuarioId,
      empresa_id: empresaId
    };
  }

  function chaveEscopo(chave) {
    const escopo = obterEscopo();

    if (!escopo) {
      return null;
    }

    return [
      "crv",
      escopo.empresa_id,
      escopo.usuario_id,
      String(chave || "")
    ].join(":");
  }

  window.crvOfflineContext = {
    salvarContexto,
    restaurarContexto,
    obterEscopo,
    chaveEscopo
  };
})();
