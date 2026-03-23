// ==========================================
// 🔐 AUTH - CRV PDV
// ==========================================

(function () {

  // ==========================================
  // 🧠 ESTADO GLOBAL
  // ==========================================
  window.USER = null;


  // ==========================================
  // 📡 LOG
  // ==========================================
  function log(msg, tipo = "info") {
    if (window.logSistema) {
      logSistema("AUTH", msg, tipo);
    } else {
      console.log("[AUTH]", msg);
    }
  }


  // ==========================================
  // 🔍 VERIFICAR SESSÃO
  // ==========================================
  async function verificarSessao() {
    try {
      const { data, error } = await sb.auth.getSession();

      if (error) throw error;

      if (data?.session) {
        USER = data.session.user;
        log("Sessão ativa: " + USER.email, "success");
      } else {
        USER = null;
        log("Nenhuma sessão encontrada", "warn");
      }

    } catch (err) {
      log("Erro ao verificar sessão: " + err.message, "error");
    }
  }


  // ==========================================
  // 🔑 LOGIN
  // ==========================================
  async function login(email, senha) {
    try {
      log("Tentando login...");

      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: senha
      });

      if (error) throw error;

      USER = data.user;

      log("Login realizado com sucesso", "success");

      return true;

    } catch (err) {
      log("Erro no login: " + err.message, "error");
      return false;
    }
  }


  // ==========================================
  // 🚪 LOGOUT
  // ==========================================
  async function logout() {
    try {
      await sb.auth.signOut();

      USER = null;

      log("Logout realizado", "success");

      // redirecionamento opcional
      window.location.href = "index.html";

    } catch (err) {
      log("Erro no logout: " + err.message, "error");
    }
  }


  // ==========================================
  // 🔒 PROTEGER PÁGINA
  // ==========================================
  async function protegerPagina() {
    await verificarSessao();

    if (!USER) {
      log("Acesso bloqueado - redirecionando", "warn");
      window.location.href = "index.html";
    }
  }


  // ==========================================
  // 🌍 EXPOR GLOBAL
  // ==========================================
  window.auth = {
    login,
    logout,
    verificarSessao,
    protegerPagina
  };


  // ==========================================
  // 🚀 INIT
  // ==========================================
  document.addEventListener("DOMContentLoaded", async () => {
    log("Inicializando módulo de autenticação...");
    await verificarSessao();
  });

})();