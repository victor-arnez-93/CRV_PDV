document.addEventListener("DOMContentLoaded", () => {
  const novaSenha = document.getElementById("novaSenha");
  const confirmarSenha = document.getElementById("confirmarSenha");
  const feedback = document.getElementById("feedbackSenha");
  const btnSalvar = document.getElementById("btnSalvarSenha");

  function mostrarFeedback(msg, tipo = "erro") {
    feedback.textContent = msg;
    feedback.style.color = tipo === "sucesso" ? "var(--crv-green, #20ff8a)" : "#ff7070";
  }

  btnSalvar.addEventListener("click", async () => {
    const senha = novaSenha.value.trim();
    const confirmar = confirmarSenha.value.trim();

    if (!senha || !confirmar) {
      mostrarFeedback("Preencha todos os campos.");
      return;
    }

    if (senha.length < 6) {
      mostrarFeedback("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmar) {
      mostrarFeedback("As senhas não coincidem.");
      return;
    }

    try {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvando...";
      mostrarFeedback("Atualizando senha...", "sucesso");

      const { error } = await sb.auth.updateUser({
        password: senha
      });

      if (error) throw error;

      mostrarFeedback("Senha alterada com sucesso. Redirecionando...", "sucesso");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1800);

    } catch (err) {
      console.error("[CRV PDV][NOVA SENHA]", err);

      mostrarFeedback("Não foi possível alterar a senha. Abra novamente o link enviado por e-mail.");

      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar nova senha";
    }
  });
});