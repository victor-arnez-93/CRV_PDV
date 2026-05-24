// ======================================================
// CRV PDV - CORE USUÁRIO / SESSÃO
// ======================================================

window.CRV_USER = {
  usuario: null,
  perfil: "Operador",
  inicioSessao: new Date()
};

// ======================================================
// OBTER USUÁRIO ATUAL
// ======================================================
async function crvObterUsuarioAtual() {
  try {
    const { data, error } = await sb.auth.getUser();

    if (error) throw error;

    const user = data?.user || null;

    if (!user) return null;

    window.CRV_USER.usuario = user;

    return user;
  } catch (err) {
    console.error("[CRV PDV][USER] Erro ao obter usuário:", err);
    return null;
  }
}

// ======================================================
// TEMPO DE SESSÃO
// ======================================================
function crvTempoSessaoTexto() {
  const inicio = window.CRV_USER?.inicioSessao || new Date();
  const agora = new Date();

  const diffMs = agora - inicio;
  const minutos = Math.max(0, Math.floor(diffMs / 60000));

  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const restoMin = minutos % 60;

  return `${horas}h ${restoMin}min`;
}

// ======================================================
// LOGOUT
// ======================================================
async function crvLogout() {
  try {
    const { error } = await sb.auth.signOut();

    if (error) throw error;

    window.location.href = "index.html";
  } catch (err) {
    console.error("[CRV PDV][USER] Erro ao sair:", err);
    alert("Erro ao sair do sistema.");
  }
}

// ======================================================
// ALTERAR SENHA
// ======================================================
async function crvEnviarLinkRedefinicaoSenha(email) {
  try {
    if (!email) {
      return {
        ok: false,
        mensagem: "E-mail do usuário não encontrado."
      };
    }

    const redirectTo = `${window.location.origin}/nova-senha.html`;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    return {
      ok: true,
      mensagem: "Enviamos um link de redefinição para seu e-mail."
    };
  } catch (err) {
    console.error("[CRV PDV][USER] Erro ao enviar link:", err);

    return {
      ok: false,
      mensagem: "Não foi possível enviar o link de redefinição."
    };
  }
}

window.crvEnviarLinkRedefinicaoSenha = crvEnviarLinkRedefinicaoSenha;

// ======================================================
// EXPOR FUNÇÕES GLOBALMENTE
// ======================================================
window.crvObterUsuarioAtual = crvObterUsuarioAtual;
window.crvTempoSessaoTexto = crvTempoSessaoTexto;
window.crvLogout = crvLogout;
