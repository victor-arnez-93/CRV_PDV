// ==========================================
// 🔐 AUTH - CRV PDV
// ==========================================

(function () {

  // ==========================================
  // 🧠 ESTADO GLOBAL
  // ==========================================
  window.USER = null;
  window.APP_USER = null;
  window.APP_EMPRESA_ID = null;


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


      // ==========================================
      // 🔍 BUSCAR USUÁRIO SISTEMA
      // ==========================================

      const { data: usuarioSistema, error: userError } = await sb
        .from("usuarios")
        .select("*")
        .eq("id", USER.id)
        .single();

      if (userError) {
        log("Usuário sem cadastro interno", "error");
        return;
      }


      // ==========================================
      // 🌍 ESTADO GLOBAL
      // ==========================================

      window.APP_USER = usuarioSistema;

      window.APP_EMPRESA_ID = usuarioSistema.empresa_id;

      log(
        "Empresa carregada: " + APP_EMPRESA_ID,
        "success"
      );

    } else {

      USER = null;

      log("Nenhuma sessão encontrada", "warn");

    }

  } catch (err) {

    log(
      "Erro ao verificar sessão: " + err.message,
      "error"
    );

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

async function loginDev() {

  const { error } = await sb.auth.signInWithPassword({
    email: "admin@sistema.com",
    password: "admin123"
  });

  if (error) {

    log(
      "Erro login DEV: " + error.message,
      "error"
    );

    return;
  }

  log(
    "Login DEV realizado",
    "success"
  );

  await verificarSessao();

}

loginDev();

})();

