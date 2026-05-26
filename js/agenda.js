// ======================================================
// CRV PDV - AGENDA / CONTROLE DE JOGOS
// ======================================================

// ======================================================
// FORMATADORES
// ======================================================

const fmtAgenda = valor =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

function normalizarMoedaAgenda(valor) {
  let texto = String(valor || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);

  return Number.isNaN(numero)
    ? 0
    : Number(numero.toFixed(2));
}

function formatarMoedaInputAgenda(valor) {
  let numeros = String(valor || "").replace(/\D/g, "");

  if (!numeros) return "";

  while (numeros.length < 3) {
    numeros = "0" + numeros;
  }

  const centavos = numeros.slice(-2);
  const reais = numeros.slice(0, -2);

  return `${Number(reais).toLocaleString("pt-BR")},${centavos}`;
}

function valorBancoParaInputAgenda(valor) {
  const numero = Number(valor || 0);

  if (!numero || Number.isNaN(numero)) return "";

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function aplicarMascaraMoedaAgenda(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = formatarMoedaInputAgenda(input.value);

    atualizarTotalizadorModal();
  });
}

function aplicarMascaraTelefoneAgenda(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    let v = input.value.replace(/\D/g, "").slice(0, 11);

    if (v.length <= 10) {
      v = v.replace(
        /^(\d{0,2})(\d{0,4})(\d{0,4}).*/,
        (_, ddd, p1, p2) => {
          let r = "";

          if (ddd) r += `(${ddd}`;
          if (ddd.length === 2) r += ") ";

          if (p1) r += p1;
          if (p2) r += `-${p2}`;

          return r;
        }
      );
    } else {
      v = v.replace(
        /^(\d{0,2})(\d{0,5})(\d{0,4}).*/,
        (_, ddd, p1, p2) => {
          let r = "";

          if (ddd) r += `(${ddd}`;
          if (ddd.length === 2) r += ") ";

          if (p1) r += p1;
          if (p2) r += `-${p2}`;

          return r;
        }
      );
    }

    input.value = v;
  });
}

function hojeISOAgenda() {
  return new Date().toISOString().slice(0, 10);
}

function horaParaMinutos(hora) {
  if (!hora) return 0;

  const [h, m] = String(hora).split(":");

  return Number(h || 0) * 60 + Number(m || 0);
}

function formatarHora(hora) {
  if (!hora) return "--:--";

  return String(hora).slice(0, 5);
}

// ======================================================
// ESTADO
// ======================================================

let agendaDados = [];
let jogadoresPorAgenda = {};

let agendaAtualId = null;
let modoModalAgenda = "novo";
let avisosJogosEmitidos = new Set();

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

  if (window.lucide) {
    lucide.createIcons();
  }

  setTimeout(async () => {

    if (typeof crvCarregarConfiguracoesEmpresa === "function") {
      await crvCarregarConfiguracoesEmpresa();
    }

    if (
      typeof crvBloquearPaginaSemModulo === "function" &&
      crvBloquearPaginaSemModulo("agenda")
    ) {
      return;
    }

    inicializarEventosAgenda();

    setupMascarasAgenda();

    definirDataInicial();

    await carregarAgenda();

    verificarAvisosFimDeJogo();

    setInterval(() => {
      aplicarFiltrosAgenda();
      verificarAvisosFimDeJogo();
    }, 15000);

  }, 800);

});

// ======================================================
// EVENTOS
// ======================================================

function inicializarEventosAgenda() {

  document
    .getElementById("btnNovaReserva")
    ?.addEventListener("click", abrirNovoJogo);

  document
    .getElementById("btnFecharModalReserva")
    ?.addEventListener("click", fecharModalJogo);

  document
    .getElementById("btnCancelarReserva")
    ?.addEventListener("click", fecharModalJogo);

  document
    .getElementById("btnSalvarReserva")
    ?.addEventListener("click", salvarJogo);

  document
    .getElementById("btnAdicionarJogador")
    ?.addEventListener("click", adicionarLinhaJogador);

  document
    .getElementById("filtroData")
    ?.addEventListener("change", aplicarFiltrosAgenda);

  document
    .getElementById("filtroBusca")
    ?.addEventListener("input", aplicarFiltrosAgenda);

  document
    .getElementById("filtroStatus")
    ?.addEventListener("change", aplicarFiltrosAgenda);

  document
    .getElementById("recorrenciaJogo")
    ?.addEventListener("change", alternarCamposMensais);

  document
    .getElementById("modalReserva")
    ?.addEventListener("click", e => {

      if (e.target.id === "modalReserva") {
        fecharModalJogo();
      }

    });

  document
    .getElementById("btnAvisoConfirmar")
    ?.addEventListener("click", fecharModalAviso);

  document
    .getElementById("btnAvisoCancelar")
    ?.addEventListener("click", fecharModalAviso);

}

function setupMascarasAgenda() {

  aplicarMascaraTelefoneAgenda(
    document.getElementById("clienteTelefone")
  );

  aplicarMascaraMoedaAgenda(
    document.getElementById("valorPrevisto")
  );

  aplicarMascaraMoedaAgenda(
    document.getElementById("valorMensal")
  );

}

function definirDataInicial() {

  const input = document.getElementById("filtroData");

  if (input && !input.value) {
    input.value = hojeISOAgenda();
  }

}

// ======================================================
// MODAL AVISO
// ======================================================

function abrirModalAviso({
  titulo = "Aviso",
  texto = "",
  confirmarTexto = "Entendi",
  mostrarCancelar = false,
  onConfirm = null
}) {

  const modal = document.getElementById("modalAviso");

  document.getElementById("modalAvisoTitulo").textContent = titulo;

  document.getElementById("modalAvisoTexto").textContent = texto;

  const btnConfirmar =
    document.getElementById("btnAvisoConfirmar");

  const btnCancelar =
    document.getElementById("btnAvisoCancelar");

  btnConfirmar.textContent = confirmarTexto;

  btnCancelar.style.display =
    mostrarCancelar
      ? "inline-flex"
      : "none";

  btnConfirmar.onclick = () => {

    fecharModalAviso();

    if (typeof onConfirm === "function") {
      onConfirm();
    }

  };

  btnCancelar.onclick = fecharModalAviso;

  modal.style.display = "flex";

  if (window.lucide) {
    lucide.createIcons();
  }

}

function fecharModalAviso() {

  const modal = document.getElementById("modalAviso");

  if (modal) {
    modal.style.display = "none";
  }

}

// ======================================================
// CARREGAMENTO
// ======================================================

async function carregarAgenda() {

  try {

    const { data: agenda, error } = await sb
      .from("agenda")
      .select("*")
      .eq("empresa_id", APP_EMPRESA_ID)
      .order("data_agendamento", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    const {
      data: jogadores,
      error: jogadoresError
    } = await sb
      .from("agenda_jogadores")
      .select("*")
      .eq("empresa_id", APP_EMPRESA_ID);

    if (jogadoresError) {
      throw jogadoresError;
    }

    agendaDados = agenda || [];

    jogadoresPorAgenda = agruparJogadores(
      jogadores || []
    );

    aplicarFiltrosAgenda();

  } catch (err) {

    console.error("[AGENDA]", err);

  }

}

// ======================================================
// OFFLINE AGENDA
// ======================================================

async function salvarAgendaOffline({
  tabela,
  operacao = "insert",
  payload
}) {

  try {

    await crvOfflineDB.adicionarFilaOffline({
      tabela,
      operacao,
      payload,
      empresa_id: APP_EMPRESA_ID
    });

    crvLog(
      "AGENDA OFFLINE",
      `${operacao} salvo offline em ${tabela}`,
      "warn"
    );

    return true;

  } catch (err) {

    crvLog(
      "AGENDA OFFLINE",
      err.message,
      "error"
    );

    return false;
  }
}

function agruparJogadores(lista) {

  const grupos = {};

  lista.forEach(j => {

    if (!grupos[j.agenda_id]) {
      grupos[j.agenda_id] = [];
    }

    grupos[j.agenda_id].push(j);

  });

  return grupos;

}

// ======================================================
// AVISO DE FIM DE JOGO (PARA ARENAS)
// ======================================================
function verificarAvisosFimDeJogo() {
  const agora = new Date();
  const hoje = hojeISOAgenda();

  agendaDados.forEach(jogo => {
    if (String(jogo.data_agendamento || "").slice(0, 10) !== hoje) return;
    if (jogo.status_jogo === "cancelado" || jogo.status_jogo === "fechado") return;

    const fimMinutos = horaParaMinutos(jogo.hora_fim);
    if (!fimMinutos) return;

    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const faltam = fimMinutos - minutosAgora;

    if (faltam > 0 && faltam <= 5) {
      const chave = `${jogo.id}-fim-5min`;

      if (avisosJogosEmitidos.has(chave)) return;

      avisosJogosEmitidos.add(chave);

      crvToast({
        titulo: "Jogo quase finalizando",
        mensagem: `${jogo.local_recurso || "Quadra/Campo"} termina em ${faltam} minuto(s).`,
        tipo: "warn",
        tempo: 8000
      });

      crvLog(
        "AGENDA",
        `Aviso: jogo ${jogo.id} termina em ${faltam} minuto(s).`,
        "warn"
      );
    }
  });
}

// ======================================================
// FILTROS
// ======================================================
function aplicarFiltrosAgenda() {

  const data =
    document.getElementById("filtroData")?.value || "";

  const busca =
    String(
      document.getElementById("filtroBusca")?.value || ""
    )
      .toLowerCase()
      .trim();

  const status =
    document.getElementById("filtroStatus")?.value || "";

  let lista = [...agendaDados];

  if (data) {
    lista = lista.filter(
      item => item.data_agendamento === data
    );
  }

  if (status) {
    lista = lista.filter(
      item => calcularStatusVisual(item) === status
    );
  }

  if (busca) {

    lista = lista.filter(item => {

      const jogadores =
        jogadoresPorAgenda[item.id] || [];

      const textoJogadores =
        jogadores
          .map(j => j.nome)
          .join(" ")
          .toLowerCase();

      return (
        String(item.cliente_nome || "")
          .toLowerCase()
          .includes(busca)

        ||

        String(item.local_recurso || "")
          .toLowerCase()
          .includes(busca)

        ||

        textoJogadores.includes(busca)
      );

    });

  }

  renderizarAgenda(lista);

  atualizarResumo(lista);

}

// ======================================================
// STATUS
// ======================================================
function calcularStatusVisual(jogo) {
  if (jogo.status_jogo === "cancelado") return "cancelado";
  if (jogo.status_jogo === "fechado") return "fechado";

  const hoje = hojeISOAgenda();
  const dataJogo = String(jogo.data_agendamento || "").slice(0, 10);

  if (dataJogo > hoje) return "agendado";
  if (dataJogo < hoje) return "cobranca";

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const inicio = horaParaMinutos(jogo.hora_inicio);
  const fim = horaParaMinutos(jogo.hora_fim || jogo.hora_inicio);

  if (minutosAgora < inicio) return "agendado";
  if (minutosAgora >= inicio && minutosAgora < fim) return "andamento";

  return "cobranca";
}

// ======================================================
// RESUMO
// ======================================================

function atualizarResumo(lista) {

  let recebido = 0;
  let pendente = 0;

  lista.forEach(jogo => {

    const status =
      calcularStatusVisual(jogo);

    if (status === "cancelado") {
      return;
    }

    const jogadores =
      jogadoresPorAgenda[jogo.id] || [];

    jogadores.forEach(j => {

      if (j.pago) {
        recebido += Number(j.valor || 0);
      } else {
        pendente += Number(j.valor || 0);
      }

    });

  });

  document.getElementById(
    "totalReservasHoje"
  ).textContent = lista.length;

  document.getElementById(
    "totalPagoHoje"
  ).textContent = fmtAgenda(recebido);

  document.getElementById(
    "totalPendenteHoje"
  ).textContent = fmtAgenda(pendente);

  document.getElementById(
    "totalEmAndamento"
  ).textContent =
    lista.filter(
      j => calcularStatusVisual(j) === "andamento"
    ).length;

}

// ======================================================
// RENDER
// ======================================================

function renderizarAgenda(lista) {

  const futuros =
    document.getElementById("agendaFuturos");

  const andamento =
    document.getElementById("agendaAndamento");

  const finalizados =
    document.getElementById("agendaFinalizados");

  futuros.innerHTML = "";
  andamento.innerHTML = "";
  finalizados.innerHTML = "";

  const futurosLista = [];
  const andamentoLista = [];
  const finalizadosLista = [];

  lista.forEach(jogo => {

    const status =
      calcularStatusVisual(jogo);

    if (status === "agendado") {
      futurosLista.push(jogo);
    } else if (status === "andamento") {
      andamentoLista.push(jogo);
    } else {
      finalizadosLista.push(jogo);
    }

  });

  preencherColuna(
    futuros,
    futurosLista,
    "Nenhum próximo jogo."
  );

  preencherColuna(
    andamento,
    andamentoLista,
    "Nenhum jogo em andamento."
  );

  preencherColuna(
    finalizados,
    finalizadosLista,
    "Nenhum jogo finalizado."
  );

  if (window.lucide) {
    lucide.createIcons();
  }

}

function preencherColuna(
  container,
  lista,
  vazio
) {

  if (!lista.length) {

    container.innerHTML = `
      <div class="agenda-empty">
        ${vazio}
      </div>
    `;

    return;

  }

  container.innerHTML =
    lista.map(criarCardJogo).join("");

  container
    .querySelectorAll(".agenda-card")
    .forEach(card => {

      card.addEventListener("click", () => {
        abrirJogo(card.dataset.id);
      });

    });

  container
    .querySelectorAll(".btn-remover-jogo")
    .forEach(btn => {

      btn.addEventListener("click", e => {

        e.stopPropagation();

        removerJogo(btn.dataset.id);

      });

    });

}

function criarCardJogo(jogo) {

  const status =
    calcularStatusVisual(jogo);

  const jogadores =
    jogadoresPorAgenda[jogo.id] || [];

  const recebido =
    jogadores
      .filter(j => j.pago)
      .reduce((acc, j) =>
        acc + Number(j.valor || 0), 0);

  const pendente =
    jogadores
      .filter(j => !j.pago)
      .reduce((acc, j) =>
        acc + Number(j.valor || 0), 0);

  return `
    <div class="agenda-card" data-id="${jogo.id}">

      <div class="agenda-card-top">

        <div>

          <div class="agenda-card-horario">
            ${formatarHora(jogo.hora_inicio)}
            -
            ${formatarHora(jogo.hora_fim)}
          </div>

          <div class="agenda-card-local">
            ${jogo.local_recurso || "-"}
          </div>

        </div>

        <span class="agenda-card-status status-${status}">
          ${status}
        </span>

      </div>

      <div class="agenda-card-responsavel">
        ${jogo.cliente_nome || "-"}
      </div>

      <div class="agenda-card-footer">

        <div class="agenda-card-total">
          <span>Recebido</span>
          <strong>${fmtAgenda(recebido)}</strong>
        </div>

        <div class="agenda-card-total">
          <span>Pendente</span>
          <strong>${
            status === "cancelado"
              ? fmtAgenda(0)
              : fmtAgenda(pendente)
          }</strong>
        </div>

      </div>

      <div class="agenda-card-actions">

        <button
          class="btn-remover-jogo"
          data-id="${jogo.id}"
        >
          <i data-lucide="trash-2"></i>
        </button>

      </div>

    </div>
  `;

}

// ======================================================
// MODAL
// ======================================================

function abrirNovoJogo() {

  agendaAtualId = null;

  modoModalAgenda = "novo";

  limparModal();

  document.getElementById(
    "modalReservaTitulo"
  ).textContent = "Novo horário";

  document.getElementById(
    "statusJogo"
  ).value = "agendado";

  document.getElementById(
    "dataAgendamento"
  ).value = hojeISOAgenda();

  aplicarModoModal();

  abrirModalJogo();

}

function abrirJogo(id) {

  const jogo =
    agendaDados.find(
      j => String(j.id) === String(id)
    );

  if (!jogo) return;

  agendaAtualId = jogo.id;

  limparModal();

  const status =
    calcularStatusVisual(jogo);

  modoModalAgenda = status;

  document.getElementById(
    "clienteNome"
  ).value = jogo.cliente_nome || "";

  document.getElementById(
    "clienteTelefone"
  ).value = jogo.cliente_telefone || "";

  document.getElementById(
    "dataAgendamento"
  ).value = jogo.data_agendamento || "";

  document.getElementById(
    "localRecurso"
  ).value = jogo.local_recurso || "";

  document.getElementById(
    "horaInicio"
  ).value = formatarHora(jogo.hora_inicio);

  document.getElementById(
    "horaFim"
  ).value = formatarHora(jogo.hora_fim);

  document.getElementById(
    "tipoJogo"
  ).value = jogo.tipo_jogo || "avulso";

  document.getElementById(
    "statusJogo"
  ).value = jogo.status_jogo || status;

  document.getElementById(
    "valorPrevisto"
  ).value =
    valorBancoParaInputAgenda(
      jogo.valor_previsto || 0
    );

  document.getElementById(
    "recorrenciaJogo"
  ).value = jogo.recorrencia || "avulso";

  document.getElementById(
    "valorMensal"
  ).value =
    valorBancoParaInputAgenda(
      jogo.valor_mensal || 0
    );

  document.getElementById(
    "diaPagamentoMensal"
  ).value =
    jogo.dia_pagamento_mensal || "";

  document.getElementById(
    "observacoes"
  ).value =
    jogo.observacoes || "";

  const jogadores =
    jogadoresPorAgenda[jogo.id] || [];

  jogadores.forEach(j => {
    adicionarLinhaJogador(j);
  });

  aplicarModoModal();

  atualizarTotalizadorModal();

  abrirModalJogo();

}

function abrirModalJogo() {

  document.getElementById(
    "modalReserva"
  ).style.display = "flex";

}

function fecharModalJogo() {

  document.getElementById(
    "modalReserva"
  ).style.display = "none";

}

// ======================================================
// MODOS
// ======================================================
function aplicarModoModal() {
  const modoNovo = modoModalAgenda === "novo";
  const modoAgendado = modoModalAgenda === "agendado";
  const modoAndamento = modoModalAgenda === "andamento";
  const modoCobranca = modoModalAgenda === "cobranca";
  const modoFechado = modoModalAgenda === "fechado";
  const modoCancelado = modoModalAgenda === "cancelado";

  const titulo = document.getElementById("modalReservaTitulo");
  const subtitulo = document.querySelector(".agenda-modal-subtitle");
  const btnSalvar = document.getElementById("btnSalvarReserva");
  const btnAdicionar = document.getElementById("btnAdicionarJogador");

  if (modoNovo) {
    titulo.textContent = "Novo horário";
    subtitulo.textContent = "Cadastre o horário e os jogadores, se já souber.";
  }

  if (modoAgendado) {
    titulo.textContent = "Jogo agendado";
    subtitulo.textContent = "Dados salvos. Jogadores ficam registrados; pagamento só libera após o término.";
  }

  if (modoAndamento) {
    titulo.textContent = "Jogo em andamento";
    subtitulo.textContent = "Permite apenas ajustar o horário final, caso o jogo atrase.";
  }

  if (modoCobranca) {
    titulo.textContent = "Cobrança do jogo";
    subtitulo.textContent = "Marque valores, formas de pagamento e quem pagou.";
  }

  if (modoFechado) {
    titulo.textContent = "Jogo fechado";
    subtitulo.textContent = "Jogo já finalizado e conferido.";
  }

  if (modoCancelado) {
    titulo.textContent = "Jogo cancelado";
    subtitulo.textContent = "Jogo cancelado. Não gera pendência financeira.";
  }

  const camposSempreTravados = [
    "clienteNome",
    "clienteTelefone",
    "dataAgendamento",
    "localRecurso",
    "tipoJogo",
    "valorPrevisto",
    "recorrenciaJogo",
    "valorMensal",
    "diaPagamentoMensal",
    "observacoes",
    "statusJogo"
  ];

  camposSempreTravados.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !modoNovo;
  });

  document.getElementById("horaInicio").disabled = !modoNovo;
  document.getElementById("horaFim").disabled = !(modoNovo || modoAndamento);

  btnSalvar.style.display = (modoNovo || modoAndamento || modoCobranca) ? "inline-flex" : "none";
  btnAdicionar.style.display = (modoNovo || modoAgendado) ? "inline-flex" : "none";

  document.querySelectorAll(".agenda-jogador-row").forEach(row => {
    const nome = row.querySelector(".jogador-nome");
    const valor = row.querySelector(".jogador-valor");
    const pagamento = row.querySelector(".jogador-pagamento");
    const pago = row.querySelector(".jogador-pago");
    const remover = row.querySelector(".agenda-remover-jogador");

    row.classList.toggle("modo-agendamento", !modoCobranca);
    row.classList.toggle("modo-cobranca", modoCobranca);

    if (nome) nome.disabled = !(modoNovo || modoAgendado);
    if (valor) valor.disabled = !modoCobranca;
    if (pagamento) pagamento.disabled = !modoCobranca;
    if (pago) pago.disabled = !modoCobranca;
    if (remover) remover.style.display = (modoNovo || modoAgendado) ? "flex" : "none";
  });
}

// ======================================================
// CAMPOS MENSAIS
// ======================================================

function alternarCamposMensais() {

  const valor =
    document.getElementById(
      "recorrenciaJogo"
    ).value;

  const box =
    document.getElementById(
      "boxMensal"
    );

  if (valor === "mensal") {
    box.classList.add("ativo");
  } else {
    box.classList.remove("ativo");
  }

}

// ======================================================
// LIMPAR
// ======================================================

function limparModal() {

  [
    "clienteNome",
    "clienteTelefone",
    "dataAgendamento",
    "localRecurso",
    "horaInicio",
    "horaFim",
    "valorPrevisto",
    "valorMensal",
    "diaPagamentoMensal",
    "observacoes"
  ].forEach(id => {

    const el =
      document.getElementById(id);

    if (el) {
      el.value = "";
    }

  });

  document.getElementById(
    "listaJogadores"
  ).innerHTML = "";

  esconderFeedback();

}

// ======================================================
// FEEDBACK
// ======================================================

function mostrarErro(msg) {

  const el =
    document.getElementById(
      "feedbackReserva"
    );

  el.textContent = msg;

  el.className =
    "agenda-feedback erro";

}

function mostrarSucesso(msg) {

  const el =
    document.getElementById(
      "feedbackReserva"
    );

  el.textContent = msg;

  el.className =
    "agenda-feedback sucesso";

}

function esconderFeedback() {

  const el =
    document.getElementById(
      "feedbackReserva"
    );

  el.textContent = "";

  el.className =
    "agenda-feedback";

}

// ======================================================
// JOGADORES
// ======================================================

function adicionarLinhaJogador(jogador = {}) {

  const lista =
    document.getElementById(
      "listaJogadores"
    );

  const row =
    document.createElement("div");

  row.className =
    "agenda-jogador-row";

  row.innerHTML = `
    <input
      class="input jogador-nome"
      placeholder="Nome do jogador"
      value="${jogador.nome || ""}"
    >

    <input
      class="input jogador-valor"
      placeholder="Valor"
      value="${
        jogador.valor
          ? valorBancoParaInputAgenda(jogador.valor)
          : ""
      }"
    >

    <select class="input jogador-pagamento">
      <option value="">Pagamento</option>
      <option
        value="pix"
        ${
          jogador.forma_pagamento === "pix"
            ? "selected"
            : ""
        }
      >
        PIX
      </option>

      <option
        value="dinheiro"
        ${
          jogador.forma_pagamento === "dinheiro"
            ? "selected"
            : ""
        }
      >
        Dinheiro
      </option>

      <option
        value="cartao"
        ${
          jogador.forma_pagamento === "cartao"
            ? "selected"
            : ""
        }
      >
        Cartão
      </option>
    </select>

    <label class="agenda-jogador-check">
      <input
        type="checkbox"
        class="jogador-pago"
        ${
          jogador.pago
            ? "checked"
            : ""
        }
      >
      Pago
    </label>

    <button
      type="button"
      class="agenda-remover-jogador"
    >
      <i data-lucide="trash-2"></i>
    </button>
  `;

  lista.appendChild(row);

  aplicarMascaraMoedaAgenda(
    row.querySelector(".jogador-valor")
  );

  row
    .querySelector(".agenda-remover-jogador")
    .addEventListener("click", () => {

      row.remove();

      atualizarTotalizadorModal();

    });

  row
    .querySelectorAll("input, select")
    .forEach(el => {

      el.addEventListener(
        "input",
        atualizarTotalizadorModal
      );

      el.addEventListener(
        "change",
        atualizarTotalizadorModal
      );

    });

  aplicarModoModal();

  atualizarTotalizadorModal();

  if (window.lucide) {
    lucide.createIcons();
  }

}

function obterJogadoresModal() {

  return [
    ...document.querySelectorAll(
      ".agenda-jogador-row"
    )
  ]
    .map(row => ({
      nome:
        row.querySelector(
          ".jogador-nome"
        )?.value.trim(),

      valor:
        normalizarMoedaAgenda(
          row.querySelector(
            ".jogador-valor"
          )?.value
        ),

      forma_pagamento:
        row.querySelector(
          ".jogador-pagamento"
        )?.value || null,

      pago:
        row.querySelector(
          ".jogador-pago"
        )?.checked || false
    }))
    .filter(j => j.nome);

}

function atualizarTotalizadorModal() {

  const jogadores =
    obterJogadoresModal();

  const recebido =
    jogadores
      .filter(j => j.pago)
      .reduce((acc, j) =>
        acc + Number(j.valor || 0), 0);

  const pendente =
    jogadores
      .filter(j => !j.pago)
      .reduce((acc, j) =>
        acc + Number(j.valor || 0), 0);

  document.getElementById(
    "modalTotalJogadores"
  ).textContent = jogadores.length;

  document.getElementById(
    "modalTotalRecebido"
  ).textContent = fmtAgenda(recebido);

  document.getElementById(
    "modalTotalPendente"
  ).textContent = fmtAgenda(pendente);

}

// ======================================================
// CONFLITO
// ======================================================

function existeConflitoHorario() {

  const data =
    document.getElementById(
      "dataAgendamento"
    ).value;

  const local =
    document.getElementById(
      "localRecurso"
    ).value
      .trim()
      .toLowerCase();

  const inicio =
    document.getElementById(
      "horaInicio"
    ).value;

  const fim =
    document.getElementById(
      "horaFim"
    ).value;

  const novoInicio =
    horaParaMinutos(inicio);

  const novoFim =
    horaParaMinutos(fim);

  return agendaDados.some(jogo => {

    if (
      String(jogo.id) ===
      String(agendaAtualId)
    ) {
      return false;
    }

    if (
      jogo.status_jogo ===
      "cancelado"
    ) {
      return false;
    }

    if (
      jogo.data_agendamento !== data
    ) {
      return false;
    }

    if (
      String(jogo.local_recurso || "")
        .trim()
        .toLowerCase() !== local
    ) {
      return false;
    }

    const inicioExistente =
      horaParaMinutos(
        jogo.hora_inicio
      );

    const fimExistente =
      horaParaMinutos(
        jogo.hora_fim
      );

    return (
      novoInicio < fimExistente &&
      novoFim > inicioExistente
    );

  });

}

// ======================================================
// SALVAR
// ======================================================
async function salvarJogo() {

  esconderFeedback();

  try {

    const clienteNome =
      document.getElementById(
        "clienteNome"
      ).value.trim();

    const data =
      document.getElementById(
        "dataAgendamento"
      ).value;

    const local =
      document.getElementById(
        "localRecurso"
      ).value.trim();

    const inicio =
      document.getElementById(
        "horaInicio"
      ).value;

    const fim =
      document.getElementById(
        "horaFim"
      ).value;

    if (!clienteNome) {
      return mostrarErro(
        "Informe o responsável."
      );
    }

    if (!data) {
      return mostrarErro(
        "Informe a data."
      );
    }

    if (!local) {
      return mostrarErro(
        "Informe a quadra/campo."
      );
    }

    if (!inicio) {
      return mostrarErro(
        "Informe o horário inicial."
      );
    }

    if (!fim) {
      return mostrarErro(
        "Informe o horário final."
      );
    }

    if (existeConflitoHorario()) {

      return mostrarErro(
        "Já existe jogo nesse campo/quadra nesse horário."
      );

    }

const linhasJogadores = [
  ...document.querySelectorAll(".agenda-jogador-row")
];

const existeJogadorSemNome = linhasJogadores.some(row => {
  const nome = row.querySelector(".jogador-nome")?.value.trim() || "";
  return !nome;
});

if (existeJogadorSemNome) {
  return mostrarErro(
    "Preencha o nome de todos os jogadores adicionados ou remova a linha vazia."
  );
}

const jogadores =
  obterJogadoresModal();

  const jogadoresNormalizados = [];

jogadores.forEach(jogador => {
  const nomeLimpo = String(jogador.nome || "").trim();

  if (!nomeLimpo) return;

  jogadoresNormalizados.push({
    nome: nomeLimpo,
    valor: Number(jogador.valor || 0),
    forma_pagamento: jogador.forma_pagamento || null,
    pago: jogador.pago === true
  });
});

jogadores.length = 0;
jogadores.push(...jogadoresNormalizados);

if (modoModalAgenda === "cobranca") {
  const jogadorPagoSemValor = jogadores.some(j => j.pago && Number(j.valor || 0) <= 0);

  if (jogadorPagoSemValor) {
    return mostrarErro(
      "Existe jogador marcado como pago sem valor informado."
    );
  }

  const jogadorPagoSemForma = jogadores.some(j => j.pago && !j.forma_pagamento);

  if (jogadorPagoSemForma) {
    return mostrarErro(
      "Informe a forma de pagamento dos jogadores marcados como pagos."
    );
  }
}

const recebido =
  jogadores
        .filter(j => j.pago)
        .reduce((acc, j) =>
          acc + Number(j.valor || 0), 0);

    const pendente =
      jogadores
        .filter(j => !j.pago)
        .reduce((acc, j) =>
          acc + Number(j.valor || 0), 0);

let statusJogo = modoModalAgenda === "novo"
  ? "agendado"
  : calcularStatusVisual({ data_agendamento: data, hora_inicio: inicio, hora_fim: fim, status_jogo: null });

    if (
      jogadores.length > 0 &&
      pendente === 0 &&
      recebido > 0
    ) {
      statusJogo = "fechado";
    }

    const payload = {

      empresa_id:
        APP_EMPRESA_ID,

      cliente_nome:
        clienteNome,

      cliente_telefone:
        document.getElementById(
          "clienteTelefone"
        ).value.trim() || null,

      data_agendamento:
        data,

      hora_inicio:
        inicio,

      hora_fim:
        fim,

      local_recurso:
        local,

      tipo_jogo:
        document.getElementById(
          "tipoJogo"
        ).value,

      status_jogo:
        statusJogo,

      recorrencia:
        document.getElementById(
          "recorrenciaJogo"
        ).value,

      valor_previsto:
        normalizarMoedaAgenda(
          document.getElementById(
            "valorPrevisto"
          ).value
        ),

      valor_mensal:
        normalizarMoedaAgenda(
          document.getElementById(
            "valorMensal"
          ).value
        ),

      dia_pagamento_mensal:
        Number(
          document.getElementById(
            "diaPagamentoMensal"
          ).value || 0
        ) || null,

      observacoes:
        document.getElementById(
          "observacoes"
        ).value.trim() || null,

      total_jogadores:
        jogadores.length,

      total_pago_jogadores:
        statusJogo === "cancelado"
          ? 0
          : recebido,

      total_pendente_jogadores:
        statusJogo === "cancelado"
          ? 0
          : pendente,

      atualizado_em:
        new Date().toISOString()

    };

    // ======================================================
// OFFLINE
// ======================================================

if (!navigator.onLine) {

  const agendaOfflineId =
    agendaAtualId ||
    `offline-agenda-${Date.now()}`;

  const agendaOfflinePayload = {
    id: agendaOfflineId,
    ...payload,
    offline: true
  };

  await salvarAgendaOffline({
    tabela: "agenda",
    payload: agendaOfflinePayload
  });

  if (jogadores.length) {

    const jogadoresOffline =
      jogadores.map(j => ({
        empresa_id: APP_EMPRESA_ID,
        agenda_id: agendaOfflineId,
        nome: j.nome,
        valor: j.valor,
        forma_pagamento: j.forma_pagamento,
        pago: j.pago,
        offline: true,
        pago_em:
          j.pago
            ? new Date().toISOString()
            : null
      }));

    await salvarAgendaOffline({
      tabela: "agenda_jogadores",
      payload: jogadoresOffline
    });
  }

  mostrarSucesso(
    "Jogo salvo offline."
  );

  crvToast({
    titulo: "Agenda offline",
    mensagem:
      "O jogo será sincronizado automaticamente quando a internet voltar.",
    tipo: "warn"
  });

  await carregarAgenda();

  setTimeout(() => {
    fecharModalJogo();
  }, 700);

  return;
}

    let agendaId =
      agendaAtualId;

    if (agendaId) {

      const { error } = await sb
        .from("agenda")
        .update(payload)
        .eq("id", agendaId);

      if (error) {
        throw error;
      }

    const { error: deleteJogadoresError } = await sb
  .from("agenda_jogadores")
  .delete()
  .eq("agenda_id", agendaId)
  .eq("empresa_id", APP_EMPRESA_ID);

if (deleteJogadoresError) {
  throw deleteJogadoresError;
}

    } else {

      const {
        data: agendaNova,
        error
      } = await sb
        .from("agenda")
        .insert([payload])
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      agendaId =
        agendaNova.id;

    }

    if (jogadores.length) {

      const linhas =
        jogadores.map(j => ({

          empresa_id:
            APP_EMPRESA_ID,

          agenda_id:
            agendaId,

          nome:
            j.nome,

          valor:
            j.valor,

          forma_pagamento:
            j.forma_pagamento,

          pago:
            j.pago,

          pago_em:
            j.pago
              ? new Date().toISOString()
              : null

        }));

      const { error } = await sb
        .from("agenda_jogadores")
        .insert(linhas);

      if (error) {
        throw error;
      }

    }

    await sincronizarAgendaComCaixa(
      agendaId,
      payload,
      jogadores
    );

    mostrarSucesso(
      "Jogo salvo com sucesso."
    );

    await carregarAgenda();

    setTimeout(() => {

      fecharModalJogo();

    }, 700);

  } catch (err) {

    console.error(err);

    mostrarErro(
      err.message ||
      "Erro ao salvar."
    );

  }

}

// ======================================================
// REMOVER
// ======================================================
function removerJogo(id) {

  abrirModalAviso({

    titulo: "Excluir jogo",

    texto:
      "Deseja realmente apagar este jogo do histórico?",

    confirmarTexto: "Apagar",

    mostrarCancelar: true,

    onConfirm: async () => {

      try {

        await sb
          .from("agenda_jogadores")
          .delete()
          .eq("agenda_id", id);

        await sb
          .from("agenda")
          .delete()
          .eq("id", id);

        await carregarAgenda();

      } catch (err) {

        abrirModalAviso({
          titulo: "Erro",
          texto:
            err.message ||
            "Erro ao remover."
        });

      }

    }

  });

}

// ======================================================
// INTEGRAR AGENDA COM CAIXA / VENDAS
// Apenas segmentos com módulo agenda ativo
// ======================================================
async function sincronizarAgendaComCaixa(agendaId, jogo, jogadores) {

  if (
    typeof crvModuloAtivo === "function" &&
    !crvModuloAtivo("agenda")
  ) {
    return;
  }

  const pagos = jogadores.filter(j =>
    j.pago === true &&
    Number(j.valor || 0) > 0
  );

  if (!pagos.length) {
    return;
  }

  const totalPago = pagos.reduce((acc, j) => {
    return acc + Number(j.valor || 0);
  }, 0);

  if (totalPago <= 0) {
    return;
  }

  const formas = pagos
    .map(j => j.forma_pagamento)
    .filter(Boolean);

  const formaPagamento =
    formas.length > 0
      ? formas[0]
      : "pix";

// ======================================================
// OFFLINE
// ======================================================

if (!navigator.onLine) {

  const vendaOfflineId =
    `offline-agenda-venda-${Date.now()}`;

  const vendaPayload = {
    id: vendaOfflineId,
    empresa_id: APP_EMPRESA_ID,
    caixa_id: null,
    cliente_id: null,
    data: new Date().toISOString(),
    subtotal: totalPago,
    desconto: 0,
    total: totalPago,
    forma_pagamento: formaPagamento,
    troco: 0,
    origem: "agenda",
    origem_id: agendaId,
    descricao:
      descricao:
  `${jogo.tipo_jogo === "mensal" ? "Jogo mensal" : "Jogo avulso"} - ${jogo.local_recurso || "Quadra/Campo"} - ${jogo.cliente_nome || "Responsável"}`,
    offline: true
  };

  const itensPayload =
    pagos.map(jogador => ({
      empresa_id: APP_EMPRESA_ID,
      venda_id: vendaOfflineId,
      produto_id: null,
      nome:
        `Pagamento de jogo - ${jogador.nome}`,
      preco: Number(jogador.valor || 0),
      quantidade: 1,
      preco_custo: 0,
      lucro_unitario:
        Number(jogador.valor || 0),
      lucro_total:
        Number(jogador.valor || 0)
    }));

  await salvarAgendaOffline({
    tabela: "vendas",
    payload: vendaPayload
  });

  await salvarAgendaOffline({
    tabela: "vendas_itens",
    payload: itensPayload
  });

  crvLog(
    "AGENDA OFFLINE",
    "Pagamento salvo offline",
    "warn"
  );

  return;
}

  const { data: caixaAberto, error: erroCaixa } = await sb
    .from("caixa")
    .select("id")
    .eq("empresa_id", APP_EMPRESA_ID)
    .eq("status", "aberto")
    .order("data_abertura", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroCaixa) {
    throw erroCaixa;
  }

  if (!caixaAberto?.id) {
    throw new Error(
      "Abra o caixa antes de marcar pagamentos da agenda."
    );
  }

  const { data: vendaExistente, error: erroBuscaVenda } = await sb
    .from("vendas")
    .select("id")
    .eq("empresa_id", APP_EMPRESA_ID)
    .eq("origem", "agenda")
    .eq("origem_id", agendaId)
    .maybeSingle();

  if (erroBuscaVenda) {
    throw erroBuscaVenda;
  }

  if (vendaExistente?.id) {

    await sb
      .from("vendas_itens")
      .delete()
      .eq("empresa_id", APP_EMPRESA_ID)
      .eq("venda_id", vendaExistente.id);

    const { error: erroUpdate } = await sb
      .from("vendas")
      .update({
        caixa_id: caixaAberto.id,
        subtotal: totalPago,
        desconto: 0,
        total: totalPago,
        forma_pagamento: formaPagamento,
        troco: 0,
        descricao:
          descricao:
  `${jogo.tipo_jogo === "mensal" ? "Jogo mensal" : "Jogo avulso"} - ${jogo.local_recurso || "Quadra/Campo"} - ${jogo.cliente_nome || "Responsável"}`
      })
      .eq("id", vendaExistente.id)
      .eq("empresa_id", APP_EMPRESA_ID);

    if (erroUpdate) {
      throw erroUpdate;
    }

    await inserirItensVendaAgenda(
      vendaExistente.id,
      pagos,
      jogo
    );

    return;
  }

  const { data: vendaNova, error: erroVenda } = await sb
    .from("vendas")
    .insert([{
      empresa_id: APP_EMPRESA_ID,
      caixa_id: caixaAberto.id,
      cliente_id: null,
      data: new Date().toISOString(),
      subtotal: totalPago,
      desconto: 0,
      total: totalPago,
      forma_pagamento: formaPagamento,
      troco: 0,
      origem: "agenda",
      origem_id: agendaId,
      descricao:
        descricao:
  `${jogo.tipo_jogo === "mensal" ? "Jogo mensal" : "Jogo avulso"} - ${jogo.local_recurso || "Quadra/Campo"} - ${jogo.cliente_nome || "Responsável"}`
    }])
    .select("id")
    .single();

  if (erroVenda) {
    throw erroVenda;
  }

  await inserirItensVendaAgenda(
    vendaNova.id,
    pagos,
    jogo
  );
}

async function inserirItensVendaAgenda(vendaId, jogadoresPagos, jogo) {

  const itens = jogadoresPagos.map(jogador => ({
    empresa_id: APP_EMPRESA_ID,
    venda_id: vendaId,
    produto_id: null,
    nome:
      `Pagamento de jogo - ${jogador.nome}`,
    preco: Number(jogador.valor || 0),
    quantidade: 1,
    preco_custo: 0,
    lucro_unitario: Number(jogador.valor || 0),
    lucro_total: Number(jogador.valor || 0)
  }));

  const { error } = await sb
    .from("vendas_itens")
    .insert(itens);

  if (error) {
    throw error;
  }
}