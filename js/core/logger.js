(function () {

  // ======================================================
  // TOAST ROOT
  // ======================================================

  function garantirToastRoot() {

    let root = document.getElementById("crvToastRoot");

    if (root) return root;

    root = document.createElement("div");

    root.id = "crvToastRoot";

    root.style.position = "fixed";
    root.style.top = "18px";
    root.style.right = "18px";
    root.style.zIndex = "999999";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "12px";
    root.style.pointerEvents = "none";

    document.body.appendChild(root);

    return root;
  }

  // ======================================================
  // TOAST
  // ======================================================

  function crvToast({
    titulo = "Sistema",
    mensagem = "",
    tipo = "info",
    tempo = 4000
  }) {

    const root = garantirToastRoot();

    const toast = document.createElement("div");

    const cores = {
      success: {
        border: "#00E08A",
        glow: "rgba(0,224,138,.25)"
      },

      error: {
        border: "#FF4D67",
        glow: "rgba(255,77,103,.25)"
      },

      warn: {
        border: "#FFC857",
        glow: "rgba(255,200,87,.25)"
      },

      info: {
        border: "#3BA4FF",
        glow: "rgba(59,164,255,.25)"
      }
    };

    const cor =
      cores[tipo] || cores.info;

    toast.style.width = "320px";
    toast.style.maxWidth = "92vw";
    toast.style.padding = "14px 16px";
    toast.style.borderRadius = "16px";
    toast.style.background = "rgba(12,12,18,.96)";
    toast.style.border = `1px solid ${cor.border}`;
    toast.style.boxShadow = `0 0 25px ${cor.glow}`;
    toast.style.backdropFilter = "blur(14px)";
    toast.style.color = "#FFF";
    toast.style.fontFamily = "Inter, sans-serif";
    toast.style.pointerEvents = "auto";

    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition =
      "all .28s ease";

    toast.innerHTML = `
      <div style="
        display:flex;
        align-items:flex-start;
        gap:12px;
      ">

        <div style="
          width:10px;
          height:10px;
          margin-top:6px;
          border-radius:50%;
          background:${cor.border};
          box-shadow:0 0 12px ${cor.border};
          flex-shrink:0;
        "></div>

        <div style="flex:1;">

          <div style="
            font-size:.9rem;
            font-weight:700;
            margin-bottom:4px;
          ">
            ${titulo}
          </div>

          <div style="
            font-size:.82rem;
            color:rgba(255,255,255,.82);
            line-height:1.45;
          ">
            ${mensagem}
          </div>

        </div>

      </div>
    `;

    root.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    });

    setTimeout(() => {

      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";

      setTimeout(() => {
        toast.remove();
      }, 300);

    }, tempo);
  }

  // ======================================================
  // LOG F12 PADRÃO
  // ======================================================

  function crvLog(modulo, mensagem, tipo = "info") {

    const estilos = {
      info: "color:#3BA4FF;font-weight:bold;",
      success: "color:#00E08A;font-weight:bold;",
      warn: "color:#FFC857;font-weight:bold;",
      error: "color:#FF4D67;font-weight:bold;"
    };

        const metodo =
      tipo === "error"
        ? console.error
        : tipo === "warn"
          ? console.warn
          : console.log;

    metodo(
      `%c[CRV PDV][${modulo}] ${mensagem}`,
      estilos[tipo] || estilos.info
    );
  }

  // ======================================================
  // GLOBAL
  // ======================================================

  window.crvToast = crvToast;
  window.crvLog = crvLog;

})();