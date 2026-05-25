// ===== FORMATAÇÃO =====
const fmt = v => Number(v || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const fmtDataHora = valor => {
  if (!valor) return "--:--";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "--:--";

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

function normalizarFormaPagamento(valor) {
  const tipo = String(valor || "").toLowerCase();

  if (tipo.includes("dinheiro")) return "dinheiro";
  if (tipo.includes("cart")) return "cartao";
  if (tipo.includes("pix")) return "pix";

  return "outros";
}

function obterDataVenda(venda) {
  return venda.data || venda.created_at || venda.createdAt || venda.criado_em || null;
}

// ======================================================
// OFFLINE DASHBOARD
// ======================================================

async function obterDadosOfflineDashboard() {

  const vendasCache =
    await crvOfflineDB.obterCache("dashboard_vendas") || [];

  const itensCache =
    await crvOfflineDB.obterCache("dashboard_itens") || [];

  const caixaCache =
    await crvOfflineDB.obterCache("dashboard_caixa") || null;

  const fila =
    await crvOfflineDB.obterFilaOffline();

  const vendasPendentes =
    fila
      .filter(item => item.tabela === "vendas")
      .map(item => item.payload);

  const itensPendentes =
    fila
      .filter(item => item.tabela === "vendas_itens")
      .flatMap(item => {
        return Array.isArray(item.payload)
          ? item.payload
          : [item.payload];
      });

  return {
    vendas: [
      ...vendasPendentes,
      ...vendasCache
    ],

    itens: [
      ...itensPendentes,
      ...itensCache
    ],

    caixaAtual:
      caixaCache
  };
}

function dataVendaEhHoje(venda) {
  const valor = obterDataVenda(venda);
  if (!valor) return false;

  const hojeISO = new Date().toISOString().slice(0, 10);
  const texto = String(valor);

  // Formato ISO: 2026-05-22...
  if (texto.startsWith(hojeISO)) return true;

  // Formato brasileiro: 22/05/2026...
  const hojeBR = new Date().toLocaleDateString("pt-BR");
  if (texto.startsWith(hojeBR)) return true;

  const data = new Date(valor);
  if (!Number.isNaN(data.getTime())) {
    return data.toISOString().slice(0, 10) === hojeISO;
  }

  return false;
}

// ===== INIT =====
async function initDashboard() {
  if (!window.APP_EMPRESA_ID) {
    logSistema("DASHBOARD", "Empresa não carregada", "error");
    return;
  }

  logSistema("DASHBOARD", "Inicializando dashboard...");

  try {
    let vendas = [];
    let itens = [];
    let caixaAtual = null;

    if (APP_STATUS.online && APP_STATUS.supabase_ok) {
      logSistema("DASHBOARD", "Buscando dados do Supabase...");

      const { data: vendasData, error: vendasError } = await sb
        .from("vendas")
        .select("*")
        .eq("empresa_id", APP_EMPRESA_ID)
        .order("id", { ascending: false });

      if (vendasError) throw vendasError;

      vendas = vendasData || [];

      const { data: itensData, error: itensError } = await sb
        .from("vendas_itens")
        .select("*")
        .eq("empresa_id", APP_EMPRESA_ID);

      if (itensError) throw itensError;

      itens = itensData || [];

      const { data: caixaData, error: caixaError } = await sb
        .from("caixa")
        .select("*")
        .eq("empresa_id", APP_EMPRESA_ID)
        .order("data_abertura", { ascending: false })
        .limit(1);

      if (caixaError) throw caixaError;

      caixaAtual = caixaData?.[0] || null;

      await crvOfflineDB.salvarCache("dashboard_vendas", vendas);
      await crvOfflineDB.salvarCache("dashboard_itens", itens);
      await crvOfflineDB.salvarCache("dashboard_caixa", caixaAtual);

      logSistema("DASHBOARD", "Dados carregados do Supabase", "success");
    } else {
      logSistema("DASHBOARD", "Modo offline - usando IndexedDB", "warn");

      const dadosOffline =
        await obterDadosOfflineDashboard();

      vendas = dadosOffline.vendas;
      itens = dadosOffline.itens;
      caixaAtual = dadosOffline.caixaAtual;
    }

    const hoje = new Date().toISOString().slice(0, 10);

    const vendasHoje = vendas.filter(dataVendaEhHoje);

    const idsVendasHoje = vendasHoje.map(v => v.id);

    const itensHoje = itens.filter(item => {
      return idsVendasHoje.includes(item.venda_id);
    });

    const faturamento = vendasHoje.reduce((acc, v) => acc + Number(v.total || 0), 0);
    const totalVendas = vendasHoje.length;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

    const lucroBruto = itensHoje.reduce((acc, item) => {
      return acc + Number(item.lucro_total || 0);
    }, 0);

    const margem = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;

    const pagamentos = {
      dinheiro: 0,
      cartao: 0,
      pix: 0
    };

    vendasHoje.forEach(v => {
      const tipo = normalizarFormaPagamento(v.forma_pagamento || v.pagamento);

      if (tipo === "dinheiro") pagamentos.dinheiro += Number(v.total || 0);
      if (tipo === "cartao") pagamentos.cartao += Number(v.total || 0);
      if (tipo === "pix") pagamentos.pix += Number(v.total || 0);
    });

    const ultimas = vendasHoje.slice(0, 5).map(v => ({
      hora: fmtDataHora(obterDataVenda(v)),
      desc:
  v.descricao ||
  (v.origem === "agenda"
    ? "Pagamento de jogo"
    : `${v.total_itens || 1} item(ns)`),
      valor: Number(v.total || 0),
      pagto: normalizarFormaPagamento(v.forma_pagamento || v.pagamento).toUpperCase()
    }));

    document.getElementById("faturamentoDia").textContent = fmt(faturamento);
    document.getElementById("totalVendas").textContent = totalVendas;
    document.getElementById("ticketMedio").textContent = fmt(ticketMedio);

    const lucroEl = document.getElementById("lucroBrutoDia");
    const margemEl = document.getElementById("margemDia");

    if (lucroEl) lucroEl.textContent = fmt(lucroBruto);
    if (margemEl) margemEl.textContent = `Margem: ${margem.toFixed(1)}%`;

    document.getElementById("deltaDia").textContent =
      totalVendas > 0 ? `${totalVendas} transação(ões)` : "sem movimentação";

    document.getElementById("deltaDia").classList.add("positive");
    document.getElementById("deltaVendas").textContent = "vendas hoje";
    document.getElementById("deltaTicket").textContent = "por venda";

    atualizarStatusCaixa(caixaAtual);
    atualizarPagamentos(pagamentos);
    renderizarUltimasVendas(ultimas);

    initChart(vendas);
  } catch (err) {
    logSistema("DASHBOARD", "Erro: " + err.message, "error");
    console.error("[CRV PDV][DASHBOARD]", err);
  }
}

// ===== STATUS CAIXA =====
function atualizarStatusCaixa(caixaAtual) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!dot || !text) return;

  if (caixaAtual?.status === "aberto") {
    dot.classList.remove("closed");
    dot.classList.add("open");

    text.textContent = "Caixa aberto";
    text.style.color = "var(--crv-green)";
  } else {
    dot.classList.remove("open");
    dot.classList.add("closed");

    text.textContent = "Caixa fechado";
    text.style.color = "";
  }
}

// ===== PAGAMENTOS =====
function atualizarPagamentos(pagamentos) {
  const totalPag = pagamentos.dinheiro + pagamentos.cartao + pagamentos.pix;

  const pct = v => totalPag > 0 ? `${((v / totalPag) * 100).toFixed(1)}%` : "0%";

  document.getElementById("valDinheiro").textContent = fmt(pagamentos.dinheiro);
  document.getElementById("valCartao").textContent = fmt(pagamentos.cartao);
  document.getElementById("valPix").textContent = fmt(pagamentos.pix);

  setTimeout(() => {
    document.getElementById("barDinheiro").style.width = pct(pagamentos.dinheiro);
    document.getElementById("barCartao").style.width = pct(pagamentos.cartao);
    document.getElementById("barPix").style.width = pct(pagamentos.pix);
  }, 250);
}

// ===== ÚLTIMAS VENDAS =====
function renderizarUltimasVendas(ultimas) {
  const container = document.getElementById("recentSales");
  if (!container) return;

  container.innerHTML = "";

  if (!ultimas.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox" width="32" height="32"></i>
        <p>Nenhuma venda hoje</p>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    return;
  }

  ultimas.forEach(v => {
    container.innerHTML += `
      <div class="sale-item">
        <div class="sale-item-left">
          <span class="sale-item-hora">${v.hora} · ${v.pagto}</span>
          <span class="sale-item-desc">${v.desc}</span>
        </div>
        <span class="sale-item-value">${fmt(v.valor)}</span>
      </div>
    `;
  });
}

// ===== GRÁFICO =====
function initChart(vendas) {
  const canvas = document.getElementById("chartFaturamento");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const hoje = new Date();
  const labels = [];
  const valores = [];

  for (let i = 6; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);

    const iso = data.toISOString().slice(0, 10);

    labels.push(data.toLocaleDateString("pt-BR", {
      weekday: "short"
    }).replace(".", ""));

    const totalDia = vendas
      .filter(v => {
        const dataVenda = obterDataVenda(v);
        if (!dataVenda) return false;

const texto = String(dataVenda);

if (texto.startsWith(iso)) return true;

const dataConvertida = new Date(dataVenda);
return !Number.isNaN(dataConvertida.getTime()) &&
       dataConvertida.toISOString().slice(0, 10) === iso;
      })
      .reduce((acc, v) => acc + Number(v.total || 0), 0);

    valores.push(totalDia);
  }

  if (window.dashboardChart) {
    window.dashboardChart.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, "rgba(249,137,72,0.35)");
  gradient.addColorStop(1, "rgba(249,137,72,0)");

  window.dashboardChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: valores,
        borderColor: "#F98948",
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: "#F98948",
        pointRadius: 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// ===== MODAL USUÁRIO =====
async function initUserModalDashboard() {
  const btnUserModal = document.getElementById("btnUserModal");
  const userModal = document.getElementById("userModal");
  const closeUserModal = document.getElementById("closeUserModal");
  const btnSair = [...userModal.querySelectorAll("button")]
  .find(btn => btn.innerText.trim().includes("Sair do Sistema"));
  const btnAlterarSenha = [...userModal.querySelectorAll("button")]
  .find(btn => btn.innerText.trim().includes("Alterar Senha"));

  if (!btnUserModal || !userModal || !closeUserModal) return;

  btnUserModal.addEventListener("click", async () => {
    userModal.classList.remove("hidden");

    const user = await crvObterUsuarioAtual();

    if (user) {
      const strongNome = userModal.querySelector(".user-info strong");
      const spanEmail = userModal.querySelector(".user-info span");

      if (strongNome) strongNome.textContent = user.email?.split("@")[0] || "Usuário";
      if (spanEmail) spanEmail.textContent = user.email || "";
    }

    const sessaoEl = [...userModal.querySelectorAll(".user-row")]
      .find(row => row.innerText.includes("Sessão ativa"))
      ?.querySelector("strong");

    if (sessaoEl) sessaoEl.textContent = crvTempoSessaoTexto();
  });

  closeUserModal.addEventListener("click", () => {
    userModal.classList.add("hidden");
  });

  userModal.addEventListener("click", e => {
    if (e.target === userModal) {
      userModal.classList.add("hidden");
    }
  });
  if (btnSair) {
  btnSair.addEventListener("click", () => {
    abrirModalConfirmacaoSaida();
  });
}
  if (btnAlterarSenha) {
  btnAlterarSenha.addEventListener("click", () => {
    abrirModalEnviarRedefinicaoSenha();
  });
}

}

function abrirModalConfirmacaoSaida() {
  const modalExistente = document.getElementById("modalConfirmarSaida");
  if (modalExistente) modalExistente.remove();

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

        <button class="modal-close" id="btnFecharConfirmarSaida">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="user-modal-body">
        <p style="color:var(--text-secondary); margin-bottom:20px;">
          Tem certeza que deseja sair do CRV PDV?
        </p>

        <div class="user-actions">
          <button class="btn-secondary" id="btnCancelarSaida">
            <span>Cancelar</span>
          </button>

          <button class="btn-primary" id="btnConfirmarSaida">
            Sair do Sistema
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnFecharConfirmarSaida").onclick = () => modal.remove();
  document.getElementById("btnCancelarSaida").onclick = () => modal.remove();
  document.getElementById("btnConfirmarSaida").onclick = () => crvLogout();
}

// ======================================================
// MODAL ALTERAR SENHA
// ======================================================

function abrirModalAlterarSenha() {

  const modalExistente = document.getElementById("modalAlterarSenha");

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement("div");

  modal.id = "modalAlterarSenha";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="user-modal" style="max-width:420px;">

      <div class="user-modal-header">

        <div class="user-info">
          <div class="user-avatar">
            <i class="fa-solid fa-lock"></i>
          </div>

          <div>
            <strong>Alterar senha</strong>
            <span>Atualize sua senha de acesso</span>
          </div>
        </div>

        <button class="modal-close" id="btnFecharAlterarSenha">
          <i class="fa-solid fa-xmark"></i>
        </button>

      </div>

      <div class="user-modal-body">

        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:8px;">
            Nova senha
          </label>

          <input
            type="password"
            id="novaSenhaInput"
            class="input"
            placeholder="Digite a nova senha"
            style="
              width:100%;
              padding:14px;
              border-radius:14px;
              border:1px solid var(--border);
              background:var(--bg-elevated);
              color:var(--text-primary);
            "
          >
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:8px;">
            Confirmar senha
          </label>

          <input
            type="password"
            id="confirmarSenhaInput"
            class="input"
            placeholder="Confirme a nova senha"
            style="
              width:100%;
              padding:14px;
              border-radius:14px;
              border:1px solid var(--border);
              background:var(--bg-elevated);
              color:var(--text-primary);
            "
          >
        </div>

        <div
          id="alterarSenhaFeedback"
          style="
            margin-bottom:16px;
            font-size:.9rem;
            color:var(--text-secondary);
          "
        ></div>

        <div class="user-actions">

          <button
            class="btn-secondary"
            id="btnCancelarAlterarSenha"
          >
            <span>Cancelar</span>
          </button>

          <button
            class="btn-primary"
            id="btnSalvarNovaSenha"
          >
            Salvar senha
          </button>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const fechar = () => modal.remove();

  document.getElementById("btnFecharAlterarSenha").onclick = fechar;

  document.getElementById("btnCancelarAlterarSenha").onclick = fechar;

  document.getElementById("btnSalvarNovaSenha").onclick = async () => {

    const senha = document.getElementById("novaSenhaInput").value.trim();

    const confirmar = document.getElementById("confirmarSenhaInput").value.trim();

    const feedback = document.getElementById("alterarSenhaFeedback");

    if (!senha || !confirmar) {

      feedback.innerHTML = "Preencha todos os campos.";
      feedback.style.color = "#FF7070";

      return;
    }

    if (senha.length < 6) {

      feedback.innerHTML = "A senha deve ter pelo menos 6 caracteres.";
      feedback.style.color = "#FF7070";

      return;
    }

    if (senha !== confirmar) {

      feedback.innerHTML = "As senhas não coincidem.";
      feedback.style.color = "#FF7070";

      return;
    }

    feedback.innerHTML = "Alterando senha...";
    feedback.style.color = "var(--text-secondary)";

    const resultado = await crvAlterarSenha(senha);

    if (resultado.ok) {

      feedback.innerHTML = resultado.mensagem;
      feedback.style.color = "var(--crv-green)";

      setTimeout(() => {
        fechar();
      }, 1200);

    } else {

      feedback.innerHTML = resultado.mensagem;
      feedback.style.color = "#FF7070";
    }
  };
}

// ==== REDEFINIÇÃO DE SENHA ====
async function abrirModalEnviarRedefinicaoSenha() {
  const user = await crvObterUsuarioAtual();
  const email = user?.email || "";

  const modalExistente = document.getElementById("modalEnviarRedefinicaoSenha");
  if (modalExistente) modalExistente.remove();

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
        <div style="display:flex; flex-direction:column; gap:4px;">
  <strong>Redefinir senha</strong>

  <span style="
    font-size:.9rem;
    color:var(--text-secondary);
    font-weight:500;
    line-height:1.4;
  ">
    Enviaremos um link para seu e-mail
  </span>
</div>
      </div>

      <button class="modal-close" id="btnFecharRedefinicaoSenha">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="user-modal-body">
      <label style="display:block; margin-bottom:10px; font-weight:700;">
        E-mail para redefinição
      </label>

      <input
        type="email"
        id="emailRedefinicaoSenha"
        value="${email || ""}"
        placeholder="Digite o e-mail"
        style="
          width:100%;
          padding:16px 18px;
          border-radius:16px;
          border:1px solid var(--border);
          background:var(--bg-elevated);
          color:var(--text-primary);
          font-size:1rem;
          font-weight:700;
          margin-bottom:18px;
        "
      >

      <div id="feedbackRedefinicaoSenha" style="margin-bottom:16px; color:var(--text-secondary);"></div>

      <div class="user-actions">
        <button class="btn-secondary" id="btnCancelarRedefinicaoSenha">
          <span>Cancelar</span>
        </button>

        <button class="btn-primary" id="btnEnviarRedefinicaoSenha">
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
    feedback.textContent = "Enviando link...";
    feedback.style.color = "var(--text-secondary)";

    const emailDigitado = document.getElementById("emailRedefinicaoSenha").value.trim();

if (!emailDigitado) {
  feedback.textContent = "Informe um e-mail válido.";
  feedback.style.color = "#FF7070";
  return;
}

    const resultado = await crvEnviarLinkRedefinicaoSenha(emailDigitado);

    feedback.textContent = resultado.mensagem;
    feedback.style.color = resultado.ok ? "var(--crv-green)" : "#FF7070";
  };
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {

  setTimeout(async () => {
    if (typeof crvCarregarConfiguracoesEmpresa === "function") {
      await crvCarregarConfiguracoesEmpresa();
    }

    if (window.APP_EMPRESA_ID) {
      await initDashboard();
    } else {
      logSistema("DASHBOARD", "Empresa ainda não carregada após aguardar auth", "error");
    }
  }, 1000);
});