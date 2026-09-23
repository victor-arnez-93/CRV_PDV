// Preferências deste navegador, separadas por empresa. Não alteram acesso aos módulos.
window.crvPreferenciasCaixa = (() => {
  function chave(nome) {
    const empresa = window.APP_EMPRESA_ID || window.APP_EMPRESA?.id;
    return empresa ? `crv-caixa:${empresa}:${nome}` : null;
  }
  function ler(nome) {
    try { const k = chave(nome); return k ? localStorage.getItem(k) : null; }
    catch (_) { return null; }
  }
  function salvar(nome, valor) {
    try { const k = chave(nome); if (k) localStorage.setItem(k, valor); }
    catch (_) { /* A operação continua mesmo com armazenamento indisponível. */ }
  }
  function prepararOpcao() {
    const input = document.getElementById("iniciarNoCaixa");
    if (!input) return;
    input.checked = ler("iniciar") === "1";
    if (input.dataset.ready) return;
    input.dataset.ready = "1";
    input.addEventListener("change", () => salvar("iniciar", input.checked ? "1" : "0"));
  }
  function destinoLogin() {
    // A configuração inicial é tratada antes no login; app.js continua validando permissões.
    return ler("iniciar") === "1" ? "caixa.html" : "dashboard.html";
  }
  return { ler, salvar, prepararOpcao, destinoLogin };
})();
