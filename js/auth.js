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

      await sb.rpc("garantir_empresa_usuario", {
        p_nome: USER.user_metadata?.nome || USER.email,
        p_email: USER.email
      });

      const { data: usuarioSistema, error: userError } = await sb
        .from("usuarios")
        .select(`
          *,
          empresas:empresa_id (
            id,
            nome,
            nome_fantasia,
            tipo_negocio,
            configuracao_inicial_concluida,
            configuracao_obrigatoria,
            logo_url
          )
        `)
        .eq("id", USER.id)
        .single();

      if (userError) {
        log("Usuário sem cadastro interno", "error");
        return;
      }

      window.APP_USER = usuarioSistema;
      window.APP_EMPRESA_ID = usuarioSistema.empresa_id;
      window.APP_EMPRESA = usuarioSistema.empresas || null;

      log("Empresa carregada: " + APP_EMPRESA_ID, "success");
    } else {
      USER = null;
      window.APP_USER = null;
      window.APP_EMPRESA_ID = null;
      window.APP_EMPRESA = null;

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


async function cadastrarConta(nome, email, senha) {
  try {

    log("Criando conta...");

    const { data, error } = await sb.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome
        }
      }
    });

    if (error) throw error;

    // ==========================================
    // EMPRESA + USUÁRIO INTERNO
    // ==========================================

    if (data?.session) {

      const { error: rpcError } =
        await sb.rpc(
          "criar_empresa_usuario",
          {
            p_nome: nome,
            p_email: email
          }
        );

      if (rpcError) throw rpcError;

      // força confirmação de email
      await sb.auth.signOut();

    }

    return {
      ok: true,
      user: data.user,
      mensagem:
        "Conta criada. Confirme seu e-mail antes de entrar."
    };

  } catch (err) {

    log(
      "Erro no cadastro: " + err.message,
      "error"
    );

    return {
      ok: false,
      mensagem:
        err.message || "Erro ao criar conta."
    };

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
  cadastrarConta,
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


