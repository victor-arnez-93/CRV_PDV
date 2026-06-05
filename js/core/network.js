(function () {

  let estadoAtual = null;
  let primeiraCarga = true;

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
    badge.style.letterSpacing = ".12em";
    badge.style.textTransform = "uppercase";
    badge.style.backdropFilter = "blur(14px)";
    badge.style.transition = "all .25s ease";
    badge.style.pointerEvents = "none";

    document.body.appendChild(badge);

    return badge;
  }

  function atualizarBadgeRede(online) {
    const badge = garantirStatusRedeVisual();

    if (online) {
      badge.textContent = "ONLINE";
      badge.style.color = "#54CD16";
      badge.style.border = "1px solid rgba(84,205,22,.55)";
      badge.style.background = "rgba(84,205,22,.10)";
      badge.style.boxShadow = "0 0 18px rgba(84,205,22,.25)";
      return;
    }

    badge.textContent = "OFFLINE READY";
    badge.style.color = "#FFC857";
    badge.style.border = "1px solid rgba(255,200,87,.5)";
    badge.style.background = "rgba(255,200,87,.1)";
    badge.style.boxShadow = "0 0 22px rgba(255,200,87,.22)";
  }

  function atualizarStatusBarLogin(online) {
    const statusBar = document.querySelector(".status-bar span:first-child");

    if (!statusBar) return;

    statusBar.innerHTML = online
      ? `<span class="status-dot"></span>SISTEMA ONLINE`
      : `<span class="status-dot"></span>OFFLINE READY`;
  }

  function crvSistemaOnline() {
    return Boolean(
      navigator.onLine &&
      window.APP_STATUS &&
      APP_STATUS.online !== false
    );
  }

  function atualizarEstadoRede(online) {
    window.APP_STATUS = window.APP_STATUS || {};
    APP_STATUS.online = online;
    APP_STATUS.offline_ready = true;

    atualizarBadgeRede(online);
    atualizarStatusBarLogin(online);

    if (estadoAtual === online) return;

    estadoAtual = online;

    if (online) {
      crvLog("REDE", "Conexão restaurada", "success");

      if (!primeiraCarga) {
        crvToast({
          titulo: "Conexão restaurada",
          mensagem: "Internet detectada. Sincronizando dados pendentes...",
          tipo: "success"
        });
      }

      document.dispatchEvent(new Event("crv:online"));
    } else {
      crvLog("REDE", "Modo OFFLINE ativado", "warn");

      crvToast({
        titulo: "Modo offline",
        mensagem: "O sistema continuará funcionando localmente nos módulos compatíveis.",
        tipo: "warn",
        tempo: 6000
      });

      document.dispatchEvent(new Event("crv:offline"));
    }

    primeiraCarga = false;
  }

  window.addEventListener("online", () => {
    atualizarEstadoRede(true);

    window.dispatchEvent(
      new CustomEvent("crv:forcar-sync")
    );
  });

  window.addEventListener("offline", () => {
    atualizarEstadoRede(false);
  });

  document.addEventListener("DOMContentLoaded", () => {
    atualizarEstadoRede(navigator.onLine);
  });

  window.crvNetwork = {
    atualizarEstadoRede,
    crvSistemaOnline
  };

})();