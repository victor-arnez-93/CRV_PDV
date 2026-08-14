(() => {
  "use strict";

  const html = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  let temaAtual = localStorage.getItem("crv-landing-theme") === "light" ? "light" : "dark";

  function aplicarTema(tema) {
    temaAtual = tema;
    html.setAttribute("data-theme", tema);
    localStorage.setItem("crv-landing-theme", tema);
    themeToggle.innerHTML = tema === "dark"
      ? '<i data-lucide="moon"></i>'
      : '<i data-lucide="sun"></i>';
    lucide.createIcons();
  }

  aplicarTema(temaAtual);
  themeToggle.addEventListener("click", () => aplicarTema(temaAtual === "dark" ? "light" : "dark"));

  function iniciarAnimacoes() {
    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elementosReveal = [...document.querySelectorAll(".reveal")];

    if (
      reduzirMovimento ||
      typeof window.gsap === "undefined" ||
      typeof window.ScrollMagic === "undefined"
    ) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: .12 });

      elementosReveal.forEach(el => observer.observe(el));
      return;
    }

    const controller = new ScrollMagic.Controller();

    gsap.from(".hero-content > *", {
      autoAlpha: 0,
      y: 20,
      duration: .72,
      stagger: .09,
      ease: "power2.out",
      delay: .08,
      clearProps: "opacity,visibility,transform"
    });

    elementosReveal.forEach((elemento, index) => {
      gsap.set(elemento, {
        autoAlpha: 0,
        y: 24
      });

      new ScrollMagic.Scene({
        triggerElement: elemento,
        triggerHook: .9,
        reverse: false
      })
        .on("enter", () => {
          gsap.to(elemento, {
            autoAlpha: 1,
            y: 0,
            duration: .72,
            delay: Math.min((index % 3) * .035, .07),
            ease: "power2.out",
            onComplete: () => {
              elemento.classList.add("visible");
              gsap.set(elemento, { clearProps: "opacity,visibility,transform" });
            }
          });
        })
        .addTo(controller);
    });

  }

  iniciarAnimacoes();

  document.querySelectorAll("[data-whatsapp-message]").forEach(link => {
    const mensagem = link.dataset.whatsappMessage;
    link.href = `https://wa.me/5515997021387?text=${encodeURIComponent(mensagem)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });

  const SUPABASE_URL = "https://qpytwbiiqixkitnpksna.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9Bc3KFSsNOQ3Qc9Q9DEfCQ_GBD-_K-F";
  const supabasePrelogin = SUPABASE_ANON_KEY && window.supabase
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const preloginModal = document.getElementById("preloginModal");
  const fecharPrelogin = document.getElementById("fecharPrelogin");
  const btnValidarPrelogin = document.getElementById("btnValidarPrelogin");
  const preloginFeedback = document.getElementById("preloginFeedback");
  const preloginEmail = document.getElementById("preloginEmail");
  const preloginSenha = document.getElementById("preloginSenha");

  function abrirPrelogin() {
    preloginModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => preloginEmail.focus(), 50);
  }

  function fecharModalPrelogin() {
    preloginModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    preloginFeedback.textContent = "";
  }

  document.querySelectorAll("[data-prelogin-open]").forEach(botao => {
    botao.addEventListener("click", event => {
      event.preventDefault();
      abrirPrelogin();
    });
  });

  fecharPrelogin.addEventListener("click", fecharModalPrelogin);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !preloginModal.classList.contains("hidden")) {
      fecharModalPrelogin();
    }
  });

  async function validarPrelogin() {
    const email = preloginEmail.value.trim();
    const senha = preloginSenha.value.trim();
    preloginFeedback.textContent = "";

    if (!email || !senha) {
      preloginFeedback.textContent = "Informe e-mail e senha.";
      return;
    }

    if (!supabasePrelogin) {
      preloginFeedback.textContent = "Configure a chave pública do Supabase para validar o acesso.";
      return;
    }

    btnValidarPrelogin.disabled = true;
    btnValidarPrelogin.textContent = "Validando...";

    const { data, error } = await supabasePrelogin.rpc("validar_pre_acesso", {
      p_email: email,
      p_senha: senha
    });

    btnValidarPrelogin.disabled = false;
    btnValidarPrelogin.textContent = "Entrar";

    if (error || data !== true) {
      preloginFeedback.textContent = "Credencial inválida ou acesso inativo.";
      return;
    }

    sessionStorage.setItem("crv-prelogin-ok", "true");
    window.location.href = "login.html";
  }

  btnValidarPrelogin.addEventListener("click", validarPrelogin);
  preloginSenha.addEventListener("keydown", event => {
    if (event.key === "Enter") validarPrelogin();
  });

  lucide.createIcons();
})();
