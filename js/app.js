// ===== THEME =====
(function () {

  const savedTheme =
    localStorage.getItem("crv-theme") || "dark";

  document.documentElement.setAttribute(
    "data-theme",
    savedTheme
  );

  window.CRV_THEME = savedTheme;

})();

let crvAppCaixaAberto = false;
let crvAppUsuarioNome = "";

function crvFmtHora(data) {
  if (!data) return "";

  const d = new Date(data);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function crvFmtDataHora(data) {
  if (!data) return "";

  const d = new Date(data);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function crvCapitalizarNome(nome) {
  const limpo = String(nome || "").trim();

  if (!limpo) return "";

  return limpo
    .split(" ")
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
}

function crvObterEmpresaIdGlobal() {
  if (window.APP_EMPRESA_ID) return window.APP_EMPRESA_ID;

  if (typeof APP_EMPRESA_ID !== "undefined" && APP_EMPRESA_ID) {
    return APP_EMPRESA_ID;
  }

  return null;
}

function crvObterUserGlobal() {
  if (window.USER) return window.USER;

  if (typeof USER !== "undefined" && USER) {
    return USER;
  }

  return null;
}

function crvSupabasePronto() {
  return Boolean(
    window.sb &&
    crvObterEmpresaIdGlobal()
  );
}

async function crvAguardarSupabaseGlobal() {
  let tentativas = 0;

  while (tentativas < 40) {
    if (crvSupabasePronto()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativas++;
  }

  return false;
}

function crvAplicarStatusCaixa(aberto, caixaData = null) {
  const caixaStatus = document.getElementById("caixaStatus");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const btnDashboardCaixa = document.getElementById("btnDashboardCaixa");

  crvAppCaixaAberto = aberto === true;

  if (caixaStatus) {
    caixaStatus.classList.remove("open", "closed");
    caixaStatus.classList.add(crvAppCaixaAberto ? "open" : "closed");
  }

  if (statusDot) {
    statusDot.classList.remove("open", "closed");
    statusDot.classList.add(crvAppCaixaAberto ? "open" : "closed");
  }

  if (statusText) {
    if (crvAppCaixaAberto) {
      const horaAbertura = crvFmtHora(caixaData?.data_abertura);
      statusText.textContent = horaAbertura
        ? `Caixa aberto desde ${horaAbertura}`
        : "Caixa aberto";
    } else {
      statusText.textContent = "Caixa fechado";
    }
  }

  if (btnDashboardCaixa) {
    const span = btnDashboardCaixa.querySelector("span");

    if (span) {
      span.textContent = crvAppCaixaAberto ? "Ir para o Caixa" : "Abrir Caixa";
    }

    btnDashboardCaixa.title = crvAppCaixaAberto
      ? "Caixa já está aberto. Ir para o PDV."
      : "Abrir o caixa para iniciar as vendas.";
  }
}

async function crvAtualizarStatusCaixaGlobal() {
  const statusText = document.getElementById("statusText");

  if (statusText) {
    statusText.textContent = "Verificando caixa...";
  }

  const pronto = await crvAguardarSupabaseGlobal();

  if (!pronto) {
    crvAplicarStatusCaixa(false);
    return;
  }

  try {
    const empresaId = crvObterEmpresaIdGlobal();

    const { data, error } = await sb
      .from("caixa")
      .select("id, status, data_abertura, valor_inicial")
      .eq("empresa_id", empresaId)
      .eq("status", "aberto")
      .order("data_abertura", { ascending: false })
      .limit(1);

    if (error) throw error;

    const caixaAberto = Array.isArray(data) && data.length > 0
      ? data[0]
      : null;

    crvAplicarStatusCaixa(Boolean(caixaAberto), caixaAberto);

  } catch (err) {
    console.warn("[CRV PDV] Não foi possível atualizar status do caixa:", err.message);
    crvAplicarStatusCaixa(false);
  }
}

async function crvCarregarNomeUsuario() {
  const user = crvObterUserGlobal();

  if (user?.nome) return crvCapitalizarNome(user.nome);
  if (user?.nome_completo) return crvCapitalizarNome(user.nome_completo);
  if (user?.name) return crvCapitalizarNome(user.name);

  const pronto = await crvAguardarSupabaseGlobal();

  if (!pronto) {
    if (user?.email) return user.email.split("@")[0];
    return "";
  }

  try {
    const authUserId = user?.id;

    if (!authUserId) {
      if (user?.email) return user.email.split("@")[0];
      return "";
    }

    const { data, error } = await sb
      .from("usuarios")
      .select("nome, email")
      .eq("id", authUserId)
      .maybeSingle();

    if (error) throw error;

    if (data?.nome) return crvCapitalizarNome(data.nome);
    if (data?.email) return data.email.split("@")[0];

    if (user?.email) return user.email.split("@")[0];

    return "";

  } catch (err) {
    console.warn("[CRV PDV] Não foi possível carregar nome do usuário:", err.message);

    if (user?.email) return user.email.split("@")[0];

    return "";
  }
}

async function crvAtualizarSaudacao() {
  const greetEl = document.getElementById('greetingText');
  const greetDate = document.getElementById('greetingDate');

  if (greetEl) {
    const h = new Date().getHours();

    const saudacao = h < 12
      ? "Bom dia"
      : h < 18
        ? "Boa tarde"
        : "Boa noite";

    const nomeUsuario = await crvCarregarNomeUsuario();

    crvAppUsuarioNome = nomeUsuario;

    greetEl.textContent = nomeUsuario
      ? `${saudacao}, ${nomeUsuario} 👋`
      : `${saudacao} 👋`;
  }

  if (greetDate) {
    greetDate.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}

function crvInicializarTema() {

  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('iconTheme');

  const aplicarTema = (tema) => {

    document.documentElement.setAttribute(
      'data-theme',
      tema
    );

    localStorage.setItem(
      'crv-theme',
      tema
    );

    window.CRV_THEME = tema;

    if (icon) {

      icon.setAttribute(
        'data-lucide',
        tema === 'dark'
          ? 'moon'
          : 'sun'
      );
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  };

  aplicarTema(
    localStorage.getItem('crv-theme') || 'dark'
  );

  if (!toggle) return;

  toggle.addEventListener('click', () => {

    const temaAtual =
      document.documentElement.getAttribute('data-theme') || 'dark';

    const novoTema =
      temaAtual === 'dark'
        ? 'light'
        : 'dark';

    aplicarTema(novoTema);
  });
}

function crvInicializarSidebarMobile() {
  const btnMenu = document.getElementById('btnMenu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!btnMenu || !sidebar || !overlay) return;

  btnMenu.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

function crvInicializarRelogio() {
  const clockEl = document.getElementById('topbarDatetime');

  if (!clockEl) return;

  const tick = () => {
    const now = new Date();

    clockEl.textContent = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  tick();
  setInterval(tick, 1000);
}

function crvInicializarModalUsuario() {
  const avatar = document.querySelector('.topbar-avatar');
  const modal = document.getElementById('userModal');
  const closeBtn = document.getElementById('closeUserModal');

  if (!avatar || !modal) return;

  avatar.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}

function crvAplicarLogoEmpresaTopbar(logoUrl) {

const sidebarLogo = document.querySelector(".sidebar-logo-img");

if (sidebarLogo && !sidebarLogo.src.includes("logo1.png")) {
  sidebarLogo.src = "assets/logo1.png";
}

  const titulo = document.querySelector(".topbar-title");

  if (!titulo) return;

  let logo = document.getElementById("empresaLogoTopbar");

  if (!logoUrl) {

    if (logo) {
      logo.remove();
    }

    return;
  }

  if (!logo) {

    logo = document.createElement("img");

    logo.id = "empresaLogoTopbar";

    logo.className = "empresa-logo-topbar";

    titulo.parentElement.appendChild(logo);
  }

  if (logo.src !== logoUrl) {
    logo.src = logoUrl;
  }
}

window.crvAplicarLogoEmpresaTopbar = crvAplicarLogoEmpresaTopbar;

async function crvCarregarLogoEmpresaTopbar() {
  try {
    const pronto = await crvAguardarSupabaseGlobal();

    if (!pronto) return;

    const empresaId = crvObterEmpresaIdGlobal();

    const { data, error } = await sb
      .from("empresas")
      .select("logo_url")
      .eq("id", empresaId)
      .single();

    if (error) throw error;

    crvAplicarLogoEmpresaTopbar(data?.logo_url || "");

  } catch (err) {
    console.warn("[CRV PDV] Não foi possível carregar logo da empresa:", err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  crvInicializarTema();
  crvInicializarSidebarMobile();
  crvInicializarRelogio();
  crvInicializarModalUsuario();

  if (window.crvCarregarConfiguracoesEmpresa) {
    await window.crvCarregarConfiguracoesEmpresa();
  }

  await crvAtualizarSaudacao();
  await crvAtualizarStatusCaixaGlobal();
  await crvCarregarLogoEmpresaTopbar();

  setInterval(crvAtualizarStatusCaixaGlobal, 15000);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});