// ======================================================
// CRV PDV — INICIALIZAÇÃO VISUAL IMEDIATA
// Executado no <head>, antes da renderização da página.
// ======================================================

(function () {
  const root = document.documentElement;

  const temaSalvo = localStorage.getItem("crv-theme");
  const temaInicial = temaSalvo === "light" ? "light" : "dark";

  root.setAttribute("data-theme", temaInicial);
  window.CRV_THEME = temaInicial;

  const fundos = {
    classico: {
      claro: "assets/imgfundo.png",
      escuro: "assets/imgfundo1.png"
    },
    grafico: {
      claro: "assets/fundo1.png",
      escuro: "assets/fundo2.png"
    },
    financeiro: {
      claro: "assets/fundo_5.png",
      escuro: "assets/fundo_4.png"
    },
    circuito: {
      claro: "assets/fundo_6.png",
      escuro: "assets/fundo_1.1.png"
    },
    conexoes: {
      claro: "assets/fundo_7.png",
      escuro: "assets/fundo_9.png"
    }
  };

  const fundoSalvo =
    localStorage.getItem("crv-background-preset") || "classico";

  const codigoFundo = fundos[fundoSalvo]
    ? fundoSalvo
    : "classico";

  const fundo = fundos[codigoFundo];

  root.style.setProperty(
    "--app-bg-light",
    `url("${fundo.claro}")`
  );

  root.style.setProperty(
    "--app-bg-dark",
    `url("${fundo.escuro}")`
  );

  root.dataset.backgroundPreset = codigoFundo;
})();