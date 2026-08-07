(function () {
  let estadoOperacional = null;
  let primeiraCarga = true;
  let estadoSync = "sincronizado";
  let pendencias = 0;

  function garantirStatusRedeVisual() {
    let badge = document.getElementById("crvNetworkBadge");

    if (badge) return badge;

    badge = document.createElement("div");
    badge.id = "crvNetworkBadge";
    badge.style.position = "fixed";
    badge.style.right = "18px";
    badge.style.bottom = "18px";
    badge.style.zIndex = "999998";
    badge.style.padding = "9px 13px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = ".72rem";
    badge.style.fontWeight = "800";
    badge.style.letterSpacing = ".08em";
    badge.style.textTransform = "uppercase";
    badge.style.backdropFilter = "blur(14px)";
    badge.style.transition = "all .25s ease";
    badge.style.pointerEvents = "none";
    document.body.appendChild(badge);

    return badge;
  }

  function estiloBadge(badge, cor, fundo, borda, sombra) {
    badge.style.color = cor;
    badge.style.background = fundo;
    badge.style.border = borda;
    badge.style.boxShadow = sombra;
  }

  function atualizarBadgeRede() {
    const badge = garantirStatusRedeVisual();
    const online = crvSistemaOnline();

    if (estadoSync === "sincronizando") {
      badge.textContent = `SINCRONIZANDO • ${pendencias} PENDENTE(S)`;
      estiloBadge(
        badge,
        "#61C8FF",
        "rgba(0,56,135,.18)",
        "1px solid rgba(97,200,255,.55)",
        "0 0 20px rgba(97,200,255,.24)"
      );
      return;
    }

    if (estadoSync === "erro") {
      badge.textContent = `FALHA DE SYNC • ${pendencias} PENDENTE(S)`;
      estiloBadge(
        badge,
        "#FF7070",
        "rgba(255,70,70,.11)",
        "1px solid rgba(255,112,112,.5)",
        "0 0 20px rgba(255,112,112,.22)"
      );
      return;
    }

    if (online) {
      badge.textContent = pendencias > 0
        ? `ONLINE • ${pendencias} PENDENTE(S)`
        : "ONLINE • SINCRONIZADO";

      estiloBadge(
        badge,
        "#54CD16",
        "rgba(84,205,22,.10)",
        "1px solid rgba(84,205,22,.55)",
        "0 0 18px rgba(84,205,22,.25)"
      );
      return;
    }

    if (navigator.onLine && window.APP_STATUS?.supabase_testado !== true) {
      badge.textContent = "CONECTANDO";
    } else {
      badge.textContent = pendencias > 0
        ? `OFFLINE • ${pendencias} PENDENTE(S)`
        : "OFFLINE • SALVAMENTO LOCAL";
    }

    estiloBadge(
      badge,
      "#FFC857",
      "rgba(255,200,87,.1)",
      "1px solid rgba(255,200,87,.5)",
      "0 0 22px rgba(255,200,87,.22)"
    );
  }

  function atualizarStatusBarLogin() {
    const statusBar = document.querySelector(".status-bar span:first-child");

    if (!statusBar) return;

    statusBar.innerHTML = crvSistemaOnline()
      ? `<span class="status-dot"></span>SISTEMA ONLINE`
      : `<span class="status-dot"></span>MODO OFFLINE`;
  }

  function crvSistemaOnline() {
    return Boolean(
      navigator.onLine &&
      window.APP_STATUS?.online !== false &&
      window.APP_STATUS?.supabase_ok === true
    );
  }

  async function atualizarPendencias() {
    const escopo = window.crvOfflineContext?.obterEscopo?.();

    if (!escopo || !window.crvOfflineDB) {
      pendencias = 0;
      atualizarBadgeRede();
      return;
    }

    pendencias = await window.crvOfflineDB.contarOperacoesPendentes({
      empresa_id: escopo.empresa_id,
      usuario_id: escopo.usuario_id
    });

    atualizarBadgeRede();
  }

  function atualizarEstadoOperacional() {
    const online = crvSistemaOnline();

    window.APP_STATUS = window.APP_STATUS || {};
    window.APP_STATUS.offline_ready = true;

    atualizarBadgeRede();
    atualizarStatusBarLogin();

    if (
      primeiraCarga &&
      navigator.onLine &&
      APP_STATUS.supabase_testado !== true
    ) {
      return;
    }

    if (estadoOperacional === online) return;

    estadoOperacional = online;

    if (online) {
      if (typeof window.crvLog === "function") {
        window.crvLog("REDE", "Supabase disponível", "success");
      }

      if (!primeiraCarga && typeof window.crvToast === "function") {
        window.crvToast({
          titulo: "Conexão restaurada",
          mensagem: "Internet confirmada. Verificando operações pendentes...",
          tipo: "success"
        });
      }

      document.dispatchEvent(new Event("crv:online"));
    } else if (!primeiraCarga || navigator.onLine === false) {
      if (typeof window.crvLog === "function") {
        window.crvLog("REDE", "Modo offline ativado", "warn");
      }

      if (typeof window.crvToast === "function") {
        window.crvToast({
          titulo: "Modo offline",
          mensagem: "Vendas comuns continuarão sendo salvas neste dispositivo.",
          tipo: "warn",
          tempo: 6000
        });
      }

      document.dispatchEvent(new Event("crv:offline"));
    }

    primeiraCarga = false;
  }

  window.addEventListener("online", async () => {
    window.APP_STATUS = window.APP_STATUS || {};
    APP_STATUS.online = true;
    atualizarBadgeRede();

    if (typeof window.testarSupabase === "function") {
      await window.testarSupabase({ silencioso: true });
    }

    atualizarEstadoOperacional();
  });

  window.addEventListener("offline", () => {
    window.APP_STATUS = window.APP_STATUS || {};
    APP_STATUS.online = false;
    APP_STATUS.supabase_ok = false;
    atualizarEstadoOperacional();
  });

  document.addEventListener("crv:supabase-status", event => {
    window.APP_STATUS = window.APP_STATUS || {};
    APP_STATUS.supabase_ok = event.detail?.disponivel === true;
    atualizarEstadoOperacional();
  });

  document.addEventListener("crv:sync-status", event => {
    estadoSync = event.detail?.estado || "sincronizado";
    pendencias = Number(event.detail?.pendentes || 0);
    atualizarBadgeRede();
  });

  document.addEventListener("crv:pendencias-alteradas", atualizarPendencias);
  document.addEventListener("crv:contexto-offline-pronto", atualizarPendencias);

  document.addEventListener("DOMContentLoaded", async () => {
    atualizarEstadoOperacional();
    await atualizarPendencias();
  });

  window.crvNetwork = {
    atualizarEstadoRede: atualizarEstadoOperacional,
    atualizarPendencias,
    crvSistemaOnline
  };
})();
