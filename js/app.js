// ===== THEME =====
(function () {

  const savedTheme =
    localStorage.getItem("crv-theme") || "dark";

  document.documentElement.setAttribute(
    "data-theme",
    savedTheme
  );

  window.CRV_THEME = savedTheme;

  document.documentElement.classList.add("crv-permissoes-carregando");

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

let crvToastGlobalTimer = null;

function crvAvisoGlobal(mensagem, tipo = "alerta") {
  if (!mensagem) return;

  let toast = document.getElementById("crvToastGlobal");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "crvToastGlobal";
    toast.className = "toast-config";

    toast.innerHTML = `
      <i class="fa-solid fa-circle-info" id="crvToastGlobalIcon"></i>
      <span id="crvToastGlobalTexto"></span>
    `;

    document.body.appendChild(toast);
  }

  const texto = document.getElementById("crvToastGlobalTexto");
  const icon = document.getElementById("crvToastGlobalIcon");

  if (!texto) return;

  texto.textContent = mensagem;

  toast.classList.remove("sucesso", "erro", "alerta", "active");

  if (tipo === "erro") {
    toast.classList.add("erro");
    if (icon) icon.className = "fa-solid fa-circle-xmark";
  } else if (tipo === "sucesso") {
    toast.classList.add("sucesso");
    if (icon) icon.className = "fa-solid fa-circle-check";
  } else {
    toast.classList.add("alerta");
    if (icon) icon.className = "fa-solid fa-circle-info";
  }

  toast.classList.add("active");

  clearTimeout(crvToastGlobalTimer);

  crvToastGlobalTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, 3200);
}

window.crvAvisoGlobal = crvAvisoGlobal;

function crvObterEmpresaIdGlobal() {
  if (window.APP_EMPRESA_ID) return window.APP_EMPRESA_ID;

  if (typeof APP_EMPRESA_ID !== "undefined" && APP_EMPRESA_ID) {
    return APP_EMPRESA_ID;
  }

  return null;
}

function crvObterOperadorAtual() {
  return {
    id: sessionStorage.getItem("CRV_OPERADOR_ID") || null,
    nome: sessionStorage.getItem("CRV_OPERADOR_NOME") || null,
    perfil: sessionStorage.getItem("CRV_OPERADOR_PERFIL") || null
  };
}

function crvLimparOperadorAtual() {
  sessionStorage.removeItem("CRV_OPERADOR_ID");
  sessionStorage.removeItem("CRV_OPERADOR_NOME");
  sessionStorage.removeItem("CRV_OPERADOR_PERFIL");
}

function crvSalvarOperadorAtual(operador) {
  sessionStorage.setItem("CRV_OPERADOR_ID", operador.id);
  sessionStorage.setItem("CRV_OPERADOR_NOME", operador.nome || "");
  sessionStorage.setItem("CRV_OPERADOR_PERFIL", operador.perfil || "");
}

window.CRV_PERMISSOES_OPERADOR = {
  modulos: {},
  especiais: {},
  modulosNegocio: {}
};

async function crvCarregarPermissoesOperadorAtual() {
  window.CRV_PERMISSOES_OPERADOR = {
    modulos: {},
    especiais: {},
    modulosNegocio: {}
  };

  const empresaId = crvObterEmpresaIdGlobal();

  if (!empresaId || !window.sb) {
    return window.CRV_PERMISSOES_OPERADOR;
  }

  const { data: empresa, error: erroEmpresa } = await sb
    .from("empresas")
    .select("tipo_negocio")
    .eq("id", empresaId)
    .maybeSingle();

  if (erroEmpresa) {
    console.warn("[CRV PERMISSÕES][EMPRESA]", erroEmpresa);
  }

  const tipoNegocio = empresa?.tipo_negocio || null;

  if (tipoNegocio) {
    const { data: modulosNegocio, error: erroModulosNegocio } = await sb
      .from("tipos_negocio_modulos")
      .select("modulo_codigo, ativo")
      .eq("tipo_negocio", tipoNegocio)
      .eq("ativo", true);

    if (erroModulosNegocio) {
      console.warn("[CRV PERMISSÕES][TIPO NEGÓCIO]", erroModulosNegocio);
    }

    (modulosNegocio || []).forEach(item => {
      window.CRV_PERMISSOES_OPERADOR.modulosNegocio[item.modulo_codigo] = true;
    });
  }

  const operador = crvObterOperadorAtual();

  if (!operador.id) {
    return window.CRV_PERMISSOES_OPERADOR;
  }

  const { data: modulos, error: erroModulos } = await sb
    .from("operador_permissoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("operador_id", operador.id);

  if (erroModulos) {
    console.warn("[CRV PERMISSÕES][MÓDULOS]", erroModulos);
    return window.CRV_PERMISSOES_OPERADOR;
  }

  const { data: especiais, error: erroEspeciais } = await sb
    .from("operador_permissoes_especiais")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("operador_id", operador.id);

  if (erroEspeciais) {
    console.warn("[CRV PERMISSÕES][ESPECIAIS]", erroEspeciais);
  }

  (modulos || []).forEach(item => {
    window.CRV_PERMISSOES_OPERADOR.modulos[item.modulo_codigo] = {
      visualizar: item.pode_visualizar === true,
      criar: item.pode_criar === true,
      editar: item.pode_editar === true,
      excluir: item.pode_excluir === true
    };
  });

  (especiais || []).forEach(item => {
    window.CRV_PERMISSOES_OPERADOR.especiais[item.permissao] =
      item.permitido === true;
  });

  return window.CRV_PERMISSOES_OPERADOR;
}

function crvModuloPorHref(href) {
  const texto = String(href || "").toLowerCase();

  if (texto.includes("dashboard")) return "dashboard";
  if (texto.includes("caixa")) return "caixa";
  if (texto.includes("comandas")) return "comandas";
  if (texto.includes("agenda")) return "agenda";
  if (texto.includes("vendas")) return "vendas";
  if (texto.includes("produtos")) return "produtos";
  if (texto.includes("clientes")) return "clientes";
  if (texto.includes("relatorios")) return "relatorios";
  if (texto.includes("configuracoes")) return "configuracoes";

  return null;
}

function crvModuloLiberadoNoNegocio(modulo) {
  if (!modulo) return true;

  const modulosNegocio =
    window.CRV_PERMISSOES_OPERADOR?.modulosNegocio || {};

  if (!Object.keys(modulosNegocio).length) return true;

  return modulosNegocio[modulo] === true;
}

function crvOperadorPodeModulo(modulo, acao = "visualizar") {
  const operador = crvObterOperadorAtual();

  if (!crvModuloLiberadoNoNegocio(modulo)) {
    return false;
  }

  if (!operador.id) return true;
  if (operador.perfil === "admin") return true;

  const permissao =
    window.CRV_PERMISSOES_OPERADOR?.modulos?.[modulo];

  if (!permissao) return false;

  return permissao[acao] === true;
}

function crvOperadorPodeEspecial(permissao) {
  const operador = crvObterOperadorAtual();

  if (!operador.id) return true;
  if (operador.perfil === "admin") return true;

  return window.CRV_PERMISSOES_OPERADOR?.especiais?.[permissao] === true;
}

function crvBloquearElemento(el, mensagem) {
  if (!el) return;

  el.classList.add("crv-permissao-oculto");
  el.hidden = true;
  el.setAttribute("data-crv-bloqueado", "1");
  el.setAttribute("data-crv-msg-bloqueio", mensagem || "Sem permissão para esta ação.");
}

function crvLiberarElemento(el) {
  if (!el) return;

  el.classList.remove("crv-permissao-oculto");
  el.classList.remove("crv-permissao-bloqueado");
  el.hidden = false;
  el.removeAttribute("data-crv-bloqueado");
  el.removeAttribute("data-crv-msg-bloqueio");
}

function crvAplicarPermissoesInterface() {
  const linksMenu =
    document.querySelectorAll(".sidebar-nav .nav-item");

  linksMenu.forEach(link => {
    const modulo = crvModuloPorHref(link.getAttribute("href"));

    if (!modulo) return;

    if (!crvOperadorPodeModulo(modulo, "visualizar")) {
      crvBloquearElemento(
        link,
        "Operador sem permissão para acessar este módulo."
      );
    } else {
      crvLiberarElemento(link);
    }
  });

  document.querySelectorAll("[data-crv-modulo]").forEach(el => {
    const modulo = el.dataset.crvModulo;
    const acao = el.dataset.crvAcao || "visualizar";

    if (!crvOperadorPodeModulo(modulo, acao)) {
      crvBloquearElemento(
        el,
        "Operador sem permissão para esta ação."
      );
    } else {
      crvLiberarElemento(el);
    }
  });

  document.querySelectorAll("[data-crv-especial]").forEach(el => {
    const permissao = el.dataset.crvEspecial;

    if (!crvOperadorPodeEspecial(permissao)) {
      crvBloquearElemento(
        el,
        "Operador sem permissão especial para esta ação."
      );
    } else {
      crvLiberarElemento(el);
    }
  });

  document.querySelectorAll(".nav-section-label").forEach(label => {
    let proximo = label.nextElementSibling;
    let temItemVisivel = false;

    while (proximo && !proximo.classList.contains("nav-section-label")) {
      if (
        proximo.classList.contains("nav-item") &&
        !proximo.classList.contains("crv-permissao-oculto")
      ) {
        temItemVisivel = true;
        break;
      }

      proximo = proximo.nextElementSibling;
    }

    if (!temItemVisivel) {
      crvBloquearElemento(label, "");
    } else {
      crvLiberarElemento(label);
    }
  });

  document.documentElement.classList.remove("crv-permissoes-carregando");
}

function crvPrimeiraTelaPermitida() {
  const ordem = [
    "dashboard",
    "caixa",
    "comandas",
    "agenda",
    "vendas",
    "produtos",
    "clientes",
    "relatorios",
    "configuracoes"
  ];

  const rotas = {
    dashboard: "dashboard.html",
    caixa: "caixa.html",
    comandas: "comandas.html",
    agenda: "agenda.html",
    vendas: "vendas.html",
    produtos: "produtos.html",
    clientes: "clientes.html",
    relatorios: "relatorios.html",
    configuracoes: "configuracoes.html"
  };

  const modulo = ordem.find(item =>
    crvOperadorPodeModulo(item, "visualizar")
  );

  return rotas[modulo] || "dashboard.html";
}

function crvValidarPermissaoPaginaAtual() {
  const pagina = window.location.pathname.split("/").pop() || "dashboard.html";
  const modulo = crvModuloPorHref(pagina);

  if (!modulo) return;

  if (!crvOperadorPodeModulo(modulo, "visualizar")) {
    crvAvisoGlobal("Operador sem permissão para acessar este módulo.", "erro");

    setTimeout(() => {
      window.location.href = crvPrimeiraTelaPermitida();
    }, 700);
  }
}

function crvInterceptarCliqueBloqueado() {
  document.addEventListener("click", event => {
    const bloqueado = event.target.closest("[data-crv-bloqueado='1']");

    if (!bloqueado) return;

    event.preventDefault();
    event.stopPropagation();

    crvAvisoGlobal(
      bloqueado.getAttribute("data-crv-msg-bloqueio") ||
      "Operador sem permissão para esta ação.",
      "erro"
    );
  }, true);
}

let crvPermissoesObserver = null;

function crvObservarMudancasInterface() {
  if (crvPermissoesObserver) {
    crvPermissoesObserver.disconnect();
  }

  crvPermissoesObserver = new MutationObserver(() => {
    clearTimeout(window.__crvPermissoesTimer);

    window.__crvPermissoesTimer = setTimeout(() => {
      crvAplicarPermissoesInterface();
    }, 80);
  });

  crvPermissoesObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function crvInicializarPermissoesSistema() {
  document.documentElement.classList.add("crv-permissoes-carregando");

  await crvCarregarPermissoesOperadorAtual();

  crvAplicarPermissoesInterface();
  crvValidarPermissaoPaginaAtual();
  crvInterceptarCliqueBloqueado();
  crvObservarMudancasInterface();
}

window.crvOperadorPodeModulo = crvOperadorPodeModulo;
window.crvOperadorPodeEspecial = crvOperadorPodeEspecial;
window.crvAplicarPermissoesInterface = crvAplicarPermissoesInterface;
window.crvCarregarPermissoesOperadorAtual = crvCarregarPermissoesOperadorAtual;
window.crvInicializarPermissoesSistema = crvInicializarPermissoesSistema;

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

  if (navigator.onLine === false || window.APP_STATUS?.online === false) {
  if (statusText) {
    statusText.textContent = "Offline Ready";
    statusText.style.color = "#FFC857";
  }

  return;
}

  if (statusText) {
    statusText.textContent = "Verificando caixa...";
  }

  const pronto = await crvAguardarSupabaseGlobal();

if (!pronto) {
  if (navigator.onLine === false) {
    console.warn("[CRV PDV] Offline: status do caixa será lido pelo módulo local quando disponível.");
  }

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

function crvCriarModalUsuarioGlobal() {
  let modal = document.getElementById("userModal");

  if (modal) {
    modal.remove();
  }

  modal = document.createElement("div");
  modal.className = "modal-overlay hidden";
  modal.id = "userModal";

  modal.innerHTML = `
    <div class="user-modal">

      <div class="user-modal-header">
        <div class="user-info">
          <div class="user-avatar">
            <i class="fa-solid fa-user"></i>
          </div>

          <div>
            <strong id="userModalNome">Usuário</strong>
            <span id="userModalEmail">Carregando...</span>
          </div>
        </div>

        <button class="modal-close" id="closeUserModal" type="button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="user-modal-body">

        <div class="user-row">
          <span>Último acesso:</span>
          <strong id="userModalUltimoAcesso">Sessão atual</strong>
        </div>

        <div class="user-row">
          <span>Operador atual:</span>
          <strong id="userModalOperador">Conta principal</strong>
        </div>

        <div class="user-row">
          <span>Perfil:</span>
          <strong id="userModalPerfil">Principal</strong>
        </div>

        <div class="user-row">
          <span>Sessão ativa há:</span>
          <strong id="userModalTempoSessao">0 min</strong>
        </div>

        <div class="user-actions">
          <button class="btn-secondary" id="btnUserConfiguracoes" type="button">
            <span>Configurações</span>
          </button>

          <button class="btn-secondary" id="btnUserAlterarSenha" type="button">
            <span>Alterar Senha</span>
          </button>

          <button class="btn-secondary" id="btnUserTrocarOperador" type="button">
            <span>Trocar operador</span>
          </button>

          <button class="btn-primary" id="btnUserLogout" type="button">
            Sair do Sistema
          </button>
        </div>

      </div>

      <div class="user-modal-footer">
        Sistema seguro • CRV PDV
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  return modal;
}

async function crvPreencherModalUsuarioGlobal() {
  const user =
    typeof crvObterUsuarioAtual === "function"
      ? await crvObterUsuarioAtual()
      : window.USER;

  const nomeEl = document.getElementById("userModalNome");
  const emailEl = document.getElementById("userModalEmail");
  const perfilEl = document.getElementById("userModalPerfil");
  const operadorEl = document.getElementById("userModalOperador");
  const tempoEl = document.getElementById("userModalTempoSessao");
  const btnAlterarSenha = document.getElementById("btnUserAlterarSenha");

  const email =
    user?.email ||
    window.APP_USER?.email ||
    "";

  const nome =
    window.APP_USER?.nome ||
    user?.user_metadata?.nome ||
    email.split("@")[0] ||
    "Usuário";

  if (nomeEl) nomeEl.textContent = crvCapitalizarNome(nome);
  if (emailEl) emailEl.textContent = email || "E-mail não encontrado";
  if (perfilEl) perfilEl.textContent = window.APP_USER?.perfil || "Operador";
    const operadorAtual = crvObterOperadorAtual();

  if (operadorEl) {
    operadorEl.textContent = operadorAtual.nome || "Conta principal";
  }

  if (perfilEl) {
    perfilEl.textContent = operadorAtual.perfil || window.APP_USER?.perfil || "Principal";
  }

    if (btnAlterarSenha) {
    btnAlterarSenha.classList.toggle(
      "crv-permissao-oculto",
      Boolean(operadorAtual.id)
    );
  }

  if (tempoEl) {
    tempoEl.textContent =
      typeof crvTempoSessaoTexto === "function"
        ? crvTempoSessaoTexto()
        : "0 min";
  }
}

function crvAbrirModalRedefinicaoSenhaGlobal() {
  const modalExistente = document.getElementById("modalEnviarRedefinicaoSenha");

  if (modalExistente) {
    modalExistente.remove();
  }

  const emailAtual =
    window.USER?.email ||
    window.APP_USER?.email ||
    "";

  const modal = document.createElement("div");
  modal.id = "modalEnviarRedefinicaoSenha";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="user-modal" style="max-width:420px;">

      <div class="user-modal-header">
        <div class="user-info">
          <div class="user-avatar">
            <i class="fa-solid fa-envelope"></i>
          </div>

          <div>
            <strong>Redefinir senha</strong>
            <span>Enviaremos um link para seu e-mail</span>
          </div>
        </div>

        <button class="modal-close" id="btnFecharRedefinicaoSenha" type="button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="user-modal-body">
        <label class="input-label">E-mail para redefinição</label>

        <input
          class="input"
          type="email"
          id="emailRedefinicaoSenha"
          value="${emailAtual}"
          placeholder="Digite o e-mail"
          autocomplete="email"
        >

        <div
          id="feedbackRedefinicaoSenha"
          style="margin:14px 0;color:var(--text-secondary);font-size:.88rem;"
        ></div>

        <div class="user-actions">
          <button class="btn-secondary" id="btnCancelarRedefinicaoSenha" type="button">
            <span>Cancelar</span>
          </button>

          <button class="btn-primary" id="btnEnviarRedefinicaoSenha" type="button">
            Enviar link
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const fechar = () => modal.remove();

  document.getElementById("btnFecharRedefinicaoSenha").onclick = fechar;
  document.getElementById("btnCancelarRedefinicaoSenha").onclick = fechar;

  document.getElementById("btnEnviarRedefinicaoSenha").onclick = async () => {
    const feedback = document.getElementById("feedbackRedefinicaoSenha");
    const email = document.getElementById("emailRedefinicaoSenha").value.trim();

    if (!email) {
      feedback.textContent = "Informe um e-mail válido.";
      feedback.style.color = "#FF7070";
      return;
    }

    feedback.textContent = "Enviando link...";
    feedback.style.color = "var(--text-secondary)";

    const redirectTo = `${window.location.origin}/nova-senha.html`;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      feedback.textContent = error.message || "Erro ao enviar link.";
      feedback.style.color = "#FF7070";
      return;
    }

    feedback.textContent = "Link enviado. Verifique sua caixa de entrada e também spam/lixo eletrônico.";
    feedback.style.color = "var(--crv-green)";
  };
}

function crvAbrirModalConfirmacaoSaidaGlobal() {
  const modalExistente = document.getElementById("modalConfirmarSaida");

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement("div");
  modal.id = "modalConfirmarSaida";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="user-modal" style="max-width:420px;">
      <div class="user-modal-header">
        <div class="user-info">
          <div class="user-avatar">
            <i class="fa-solid fa-right-from-bracket"></i>
          </div>

          <div>
            <strong>Sair do sistema?</strong>
            <span>Confirme para encerrar sua sessão.</span>
          </div>
        </div>

        <button class="modal-close" id="btnFecharConfirmarSaida" type="button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="user-modal-body">
        <p style="color:var(--text-secondary); margin-bottom:20px;">
          Tem certeza que deseja sair do CRV PDV?
        </p>

        <div class="user-actions">
          <button class="btn-secondary" id="btnCancelarSaida" type="button">
            <span>Cancelar</span>
          </button>

          <button class="btn-primary" id="btnConfirmarSaida" type="button">
            Sair do Sistema
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnFecharConfirmarSaida").onclick = () => modal.remove();
  document.getElementById("btnCancelarSaida").onclick = () => modal.remove();

  document.getElementById("btnConfirmarSaida").onclick = async () => {
    if (typeof crvLogout === "function") {
      await crvLogout();
      return;
    }

    await sb.auth.signOut();
    window.location.href = "login.html";
  };
}

async function crvAbrirModalTrocarOperadorGlobal() {
  const modalExistente = document.getElementById("modalTrocarOperador");

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement("div");
  modal.id = "modalTrocarOperador";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="user-modal" style="max-width:440px;">
      <div class="user-modal-header">
        <div class="user-info">
          <div class="user-avatar">
            <i class="fa-solid fa-user-shield"></i>
          </div>

          <div>
            <strong>Trocar operador</strong>
            <span>Selecione quem está usando esta sessão</span>
          </div>
        </div>

        <button class="modal-close" id="btnFecharTrocarOperador" type="button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="user-modal-body">
        <label class="input-label">Operador</label>

        <select class="input" id="selectTrocarOperador">
          <option value="">Conta principal — acesso completo</option>
        </select>

        <label class="input-label" style="margin-top:12px;">Senha interna</label>

        <input
          class="input"
          type="password"
          id="senhaTrocarOperador"
          placeholder="Digite a senha interna"
          autocomplete="off"
        >

        <div
          id="feedbackTrocarOperador"
          style="margin:14px 0;color:var(--text-secondary);font-size:.88rem;"
        ></div>

        <div class="user-actions">
          <button class="btn-secondary" id="btnCancelarTrocarOperador" type="button">
            <span>Cancelar</span>
          </button>

          <button class="btn-primary" id="btnConfirmarTrocarOperador" type="button">
            Confirmar operador
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const select = document.getElementById("selectTrocarOperador");
  const senhaInput = document.getElementById("senhaTrocarOperador");
  const feedback = document.getElementById("feedbackTrocarOperador");

  const labelSenha = senhaInput?.previousElementSibling;

select.addEventListener("change", () => {
  const usandoContaPrincipal = !select.value;

  if (labelSenha) {
    labelSenha.style.display = usandoContaPrincipal ? "none" : "";
  }

  if (senhaInput) {
    senhaInput.style.display = usandoContaPrincipal ? "none" : "";
    senhaInput.value = "";
  }
});

select.dispatchEvent(new Event("change"));

  const fechar = () => modal.remove();

  document.getElementById("btnFecharTrocarOperador").onclick = fechar;
  document.getElementById("btnCancelarTrocarOperador").onclick = fechar;

  try {
    const empresaId = crvObterEmpresaIdGlobal();

    if (!empresaId) {
      throw new Error("Empresa não encontrada.");
    }

    const { data, error } = await sb
      .from("operadores_internos")
      .select("id, nome, usuario, perfil, ativo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) throw error;

    (data || [])
      .filter(operador => operador.usuario !== "admin")
      .forEach(operador => {
        const option = document.createElement("option");
        option.value = operador.id;
        option.textContent = `${operador.nome} — ${operador.perfil}`;
        option.dataset.nome = operador.nome || "";
        option.dataset.perfil = operador.perfil || "";
        select.appendChild(option);
      });

  } catch (err) {
    feedback.textContent = err.message || "Erro ao carregar operadores.";
    feedback.style.color = "#FF7070";
  }

  document.getElementById("btnConfirmarTrocarOperador").onclick = async () => {
    const operadorId = select.value;
    const senha = String(senhaInput.value || "").trim();

    if (!operadorId) {
      crvLimparOperadorAtual();

      await crvCarregarPermissoesOperadorAtual();
      crvAplicarPermissoesInterface();
      crvValidarPermissaoPaginaAtual();

      fechar();

      await crvPreencherModalUsuarioGlobal();

      crvAvisoGlobal("Sessão voltou para a conta principal.", "sucesso");

      return;
    }

    if (!senha) {
      feedback.textContent = "Digite a senha interna do operador.";
      feedback.style.color = "#FF7070";
      return;
    }

    try {
      feedback.textContent = "Validando operador...";
      feedback.style.color = "var(--text-secondary)";

      const { data, error } = await sb
        .from("operadores_internos")
        .select("id, nome, usuario, perfil, senha, ativo")
        .eq("empresa_id", crvObterEmpresaIdGlobal())
        .eq("id", operadorId)
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error("Operador não encontrado ou inativo.");
      }

      if (String(data.senha || "") !== senha) {
        throw new Error("Senha interna incorreta.");
      }

      crvSalvarOperadorAtual(data);

      await crvCarregarPermissoesOperadorAtual();
      crvAplicarPermissoesInterface();
      crvValidarPermissaoPaginaAtual();

      await sb
        .from("operadores_internos")
        .update({
          ultimo_login_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .eq("id", data.id)
        .eq("empresa_id", crvObterEmpresaIdGlobal());

      fechar();

      await crvPreencherModalUsuarioGlobal();

      crvAvisoGlobal(`Operador ativo: ${data.nome}`, "sucesso");

    } catch (err) {
      feedback.textContent = err.message || "Erro ao trocar operador.";
      feedback.style.color = "#FF7070";
    }
  };

  setTimeout(() => {
    select?.focus();
  }, 80);
}

function crvInicializarModalUsuario() {
  const avatar = document.querySelector(".topbar-avatar");

  if (!avatar) return;

  const modal = crvCriarModalUsuarioGlobal();

  avatar.addEventListener("click", async () => {
    await crvPreencherModalUsuarioGlobal();
    modal.classList.remove("hidden");
  });

  document.getElementById("closeUserModal").onclick = () => {
    modal.classList.add("hidden");
  };

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });

  document.getElementById("btnUserConfiguracoes").onclick = () => {
    window.location.href = "configuracoes.html";
  };

  document.getElementById("btnUserAlterarSenha").onclick = () => {
    modal.classList.add("hidden");
    crvAbrirModalRedefinicaoSenhaGlobal();
  };

  document.getElementById("btnUserTrocarOperador").onclick = () => {
    modal.classList.add("hidden");
    crvAbrirModalTrocarOperadorGlobal();
  };

document.getElementById("btnUserLogout").onclick = () => {
  modal.classList.add("hidden");
  crvAbrirModalConfirmacaoSaidaGlobal();
};
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

  await crvInicializarPermissoesSistema();

if (
  window.crvSync &&
  typeof window.crvSync.sincronizarPendencias === "function"
) {
  window.crvSync.sincronizarPendencias();
}

setInterval(() => {
  if (navigator.onLine !== false && window.APP_STATUS?.online !== false) {
    crvAtualizarStatusCaixaGlobal();
  }
}, 15000);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});