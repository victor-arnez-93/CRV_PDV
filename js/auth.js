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
    log("Verificando e-mail antes do cadastro...");

    const emailNormalizado = String(email || "").trim().toLowerCase();

    const { data: usuarioExistente, error: erroUsuarioExistente } = await sb
      .from("usuarios")
      .select("id, email")
      .ilike("email", emailNormalizado)
      .maybeSingle();

    if (erroUsuarioExistente) {
      throw erroUsuarioExistente;
    }

    if (usuarioExistente) {
      return {
        ok: false,
        mensagem: "Este e-mail já está cadastrado. Faça login ou recupere sua senha."
      };
    }

    log("Criando conta...");

    const redirectTo =
      `${window.location.origin}/login.html`;

    const { data, error } = await sb.auth.signUp({
      email: emailNormalizado,
      password: senha,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          nome
        }
      }
    });

    if (error) throw error;

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

async function enviarRecuperacaoSenha(email) {
  try {
    if (!email) {
      return {
        ok: false,
        mensagem: "Informe seu e-mail para recuperar a senha."
      };
    }

    const redirectTo =
      `${window.location.origin}/nova-senha.html`;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    return {
      ok: true,
      mensagem: "Enviamos um link de redefinição para seu e-mail."
    };

  } catch (err) {
    return {
      ok: false,
      mensagem: err.message || "Erro ao enviar link de recuperação."
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
      window.location.href = "login.html";

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
      window.location.href = "login.html";
    }
  }


  // ==========================================
  // 🌍 EXPOR GLOBAL
  // ==========================================
window.auth = {
  login,
  cadastrarConta,
  enviarRecuperacaoSenha,
  logout,
  verificarSessao,
  protegerPagina
};

  // ==========================================
  // 🔒 PROTEÇÃO AUTOMÁTICA DE ROTAS
  // ==========================================
  function paginaPublica() {
    const paginasPublicas = [
      "",
      "index.html",
      "login.html",
      "cadastro.html",
      "nova-senha.html",
      "recuperar-senha.html",
      "esqueci-senha.html"
    ];

    const paginaAtual =
      window.location.pathname.split("/").pop() || "login.html";

    return paginasPublicas.includes(paginaAtual);
  }


  // ==========================================
  // 🚀 INIT
  // ==========================================
  document.addEventListener("DOMContentLoaded", async () => {
    log("Inicializando módulo de autenticação...");

    await verificarSessao();

    if (!paginaPublica() && !USER) {
      log("Acesso direto bloqueado - redirecionando", "warn");
      window.location.href = "login.html";
      return;
    }
  });
})();

