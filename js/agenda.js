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

function formatarNomeProprioAgenda(valor) {
  return String(valor || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trimStart()
    .replace(/(^|\s)([a-záàâãéèêíïóôõöúçñ])/g, (match, espaco, letra) => {
      return espaco + letra.toUpperCase();
    });
}

function hojeISOAgenda() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
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

function competenciaAgenda(dataISO) {
  const data = String(dataISO || hojeISOAgenda()).slice(0, 10);
  return data.slice(0, 7);
}

function somarDiasAgenda(dataISO, dias) {
  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function calcularFimCicloMensalAgenda(dataInicio, qtdJogos = 4) {
  const jogos = Math.max(1, Number(qtdJogos || 4));
  return somarDiasAgenda(dataInicio, (jogos - 1) * 7);
}

function formatarDataCurtaAgenda(dataISO) {
  if (!dataISO) return "-";

  const partes = String(dataISO).slice(0, 10).split("-");
  if (partes.length !== 3) return dataISO;

  return `${partes[2]}/${partes[1]}`;
}

function mensalidadeVencidaParaAvisoAgenda(jogo, mensalidade) {
  if (!jogo || !mensalidade) return false;
  if (mensalidade.status === "pago") return false;

  const dia = Number(jogo.dia_pagamento_mensal || 0);
  if (!dia) return true;

  const hoje = hojeISOAgenda();
  const dataJogo = String(jogo.data_agendamento || hoje).slice(0, 10);
  const referencia = hoje > dataJogo ? hoje : dataJogo;

  const [ano, mes] = referencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaSeguro = Math.min(dia, ultimoDia);

  const dataVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;

  return referencia >= dataVencimento;
}

function obterAgendaOrigemMensal(jogo) {
  return jogo.recorrencia_origem_id || jogo.id;
}

function buscarMensalidadeAgenda(jogo) {
  if (!jogo) return null;

  const origemId = obterAgendaOrigemMensal(jogo);
  const dataJogo = String(jogo.data_agendamento || hojeISOAgenda()).slice(0, 10);

  return mensalidadesAgenda.find(m => {
    const inicio = String(m.data_inicio || "").slice(0, 10);
    const fim = String(m.data_fim || "").slice(0, 10);

    return (
      String(m.agenda_origem_id) === String(origemId) &&
      inicio &&
      fim &&
      dataJogo >= inicio &&
      dataJogo <= fim
    );
  }) || null;
}

// ======================================================
// ESTADO
// ======================================================

let agendaDados = [];
let jogadoresPorAgenda = {};
let mensalidadesAgenda = [];
let excecoesAgenda = [];

let agendaAtualId = null;
let modoModalAgenda = "novo";
let avisosJogosEmitidos = new Set();
let agendaInlineAberta = false;

// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {

  if (window.lucide) {
    lucide.createIcons();
  }

  await inicializarAgendaComSeguranca();

});

async function inicializarAgendaComSeguranca() {

  let tentativas = 0;

  while (
    tentativas < 20 &&
    (
      typeof APP_EMPRESA_ID === "undefined" ||
      !APP_EMPRESA_ID
    )
  ) {
    await new Promise(resolve => setTimeout(resolve, 150));
    tentativas++;
  }

  if (typeof crvCarregarConfiguracoesEmpresa === "function") {
    await crvCarregarConfiguracoesEmpresa();
  }

  await new Promise(resolve => setTimeout(resolve, 300));

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

}

// ======================================================
// EVENTOS
// ======================================================
function inicializarEventosAgenda() {

  document
    .getElementById("btnNovaReserva")
    ?.addEventListener("click", abrirNovoJogo);

document
  .getElementById("btnAgendaInline")
  ?.addEventListener("click", alternarAgendaInline);

document
  .getElementById("buscaAgendaInline")
  ?.addEventListener("input", renderizarAgendaInline);

document
  .getElementById("tipoAgendaInline")
  ?.addEventListener("change", renderizarAgendaInline);

document
  .getElementById("campoAgendaInline")
  ?.addEventListener("change", renderizarAgendaInline);

  document
    .getElementById("btnFecharModalHorariosFixos")
    ?.addEventListener("click", fecharModalHorariosFixos);

      document
    .getElementById("buscaHorariosFixos")
    ?.addEventListener("input", () => {
      const abaAtiva =
        document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo || "todos";

      renderizarHorariosFixos(abaAtiva);
    });

document
  .getElementById("dataHorariosFixos")
  ?.addEventListener("change", async () => {

    const dataModal =
      document.getElementById("dataHorariosFixos")?.value;

    const filtroData =
      document.getElementById("filtroData");

    if (dataModal && filtroData) {
      filtroData.value = dataModal;
    }

    await carregarAgenda();

    renderizarHorariosFixos(
      document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo ||
      "fechados"
    );
  });

document
  .getElementById("btnHojeHorariosFixos")
  ?.addEventListener("click", async () => {

    const hoje = hojeISOAgenda();

    document.getElementById("filtroData").value = hoje;
    document.getElementById("dataHorariosFixos").value = hoje;

    await carregarAgenda();

    renderizarHorariosFixos(
      document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo ||
      "fechados"
    );
  });

document
  .getElementById("btnProximoDiaHorariosFixos")
  ?.addEventListener("click", async () => {

    const inputModal =
      document.getElementById("dataHorariosFixos");

    const inputPrincipal =
      document.getElementById("filtroData");

    const dataAtual =
      inputModal?.value ||
      inputPrincipal?.value ||
      hojeISOAgenda();

    const data = new Date(`${dataAtual}T12:00:00`);

    data.setDate(data.getDate() + 1);

    const novaData =
      data.toISOString().slice(0, 10);

    if (inputModal) {
      inputModal.value = novaData;
    }

    if (inputPrincipal) {
      inputPrincipal.value = novaData;
    }

    await carregarAgenda();

    renderizarHorariosFixos(
      document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo ||
      "fechados"
    );
  });

document
  .getElementById("btnConfigHorarios")
  ?.addEventListener("click", () => {

    const box =
      document.getElementById("boxConfigHorarios");

    const btn =
      document.getElementById("btnConfigHorarios");

    if (!box || !btn) return;

    box.classList.toggle("ativo");
    btn.classList.toggle("ativo");

  });

  document
  .getElementById("btnConfigGradeInline")
  ?.addEventListener("click", () => {
    abrirModalHorariosFixos();

    setTimeout(() => {
      document.getElementById("btnConfigHorarios")?.click();
    }, 80);
  });

[
  "configHoraAbertura",
  "configHoraFechamento",
  "configIntervaloInicio",
  "configDuracoesJogo"
].forEach(id => {
  document
    .getElementById(id)
    ?.addEventListener("change", () => {

      const abaAtiva =
        document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo ||
        "fechados";

        salvarConfigGradeAgenda();

        if (abaAtiva === "livres") {
          renderizarHorariosLivres();
        }

    });
});

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
  ?.addEventListener("change", async () => {
    const dataPrincipal = document.getElementById("filtroData")?.value;
    const dataModal = document.getElementById("dataHorariosFixos");

    if (dataModal && dataPrincipal) {
      dataModal.value = dataPrincipal;
    }

    await carregarAgenda();

    if (agendaInlineAberta) {
      popularCamposAgendaInline();
      renderizarAgendaInline();
    }

    const modalAberto =
      document.getElementById("modalHorariosFixos")?.style.display === "flex";

    if (modalAberto) {
      renderizarHorariosFixos(
        document.querySelector(".agenda-horarios-tab.active")?.dataset.tipo || "fechados"
      );
    }
  });

  document
    .getElementById("filtroBusca")
    ?.addEventListener("input", aplicarFiltrosAgenda);

  document
    .getElementById("filtroStatus")
    ?.addEventListener("change", aplicarFiltrosAgenda);

document
  .getElementById("tipoJogo")
  ?.addEventListener("change", alternarCamposMensais);

      document
    .getElementById("usarTimesJogo")
    ?.addEventListener("change", alternarTimesJogo);

  document
    .getElementById("modalReserva")
    ?.addEventListener("click", e => {
      if (e.target.id === "modalReserva") {
        e.preventDefault();
        e.stopPropagation();
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

  const clienteNome = document.getElementById("clienteNome");

  if (clienteNome) {
    clienteNome.addEventListener("blur", () => {
      clienteNome.value = formatarNomeProprioAgenda(clienteNome.value);
    });
  }

}

function definirDataInicial() {

  const input = document.getElementById("filtroData");

  if (input && !input.value) {
    input.value = hojeISOAgenda();
  }

}

function alterarDiaAgenda(delta) {
  const input = document.getElementById("filtroData");
  if (!input) return;

  const dataAtual = input.value || hojeISOAgenda();
  const data = new Date(`${dataAtual}T12:00:00`);

  data.setDate(data.getDate() + delta);

  input.value = data.toISOString().slice(0, 10);

  carregarAgenda();
}

function voltarHojeAgenda() {
  const input = document.getElementById("filtroData");
  if (!input) return;

  input.value = hojeISOAgenda();

  carregarAgenda();
}

// ======================================================
// MODAL HORÁRIOS FIXOS
// ======================================================
function abrirModalHorariosFixos() {
  const modal = document.getElementById("modalHorariosFixos");

  if (!modal) return;

  modal.style.display = "flex";

  carregarConfigGradeAgenda();

  const busca =
    document.getElementById("buscaHorariosFixos");

  if (busca) {
    busca.value = "";
  }

const dataPrincipal =
  document.getElementById("filtroData")?.value || hojeISOAgenda();

const dataModal =
  document.getElementById("dataHorariosFixos");

if (dataModal) {
  dataModal.value = dataPrincipal;
}

  configurarAbasHorariosFixos();

    renderizarHorariosFixos("fechados");

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalHorariosFixos() {
  const modal = document.getElementById("modalHorariosFixos");

  if (modal) {
    modal.style.display = "none";
  }
}

function configurarAbasHorariosFixos() {
  document
    .querySelectorAll(".agenda-horarios-tab")
    .forEach(btn => {
      btn.onclick = () => {
        document
          .querySelectorAll(".agenda-horarios-tab")
          .forEach(item => item.classList.remove("active"));

        btn.classList.add("active");

        renderizarHorariosFixos(btn.dataset.tipo || "todos");
      };
    });
}

function renderizarHorariosFixos(tipo = "fechados") {
  const lista = document.getElementById("listaHorariosFixos");
  if (!lista) return;

  if (tipo === "livres") {
    renderizarHorariosLivres();
    return;
  }

if (tipo === "mensalista") {
  renderizarMensalidadesAgenda();
  return;
}

  const dataFiltro =
    document.getElementById("filtroData")?.value || hojeISOAgenda();

  const termoBusca =
    String(document.getElementById("buscaHorariosFixos")?.value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  let jogos = [...agendaDados];

  jogos = jogos.filter(jogo => {
    if (jogo.status_jogo === "cancelado") return false;
    if (jogo.status_jogo === "fechado") return false;

    const dataJogo =
      String(jogo.data_agendamento || "").slice(0, 10);

    if (tipo === "fechados") {
      return dataJogo === dataFiltro;
    }

    if (tipo === "mensalista") {
      return (
        !jogo.recorrencia_origem_id &&
        jogoEhMensalAgenda(jogo)
      );
    }

    if (tipo === "evento" || tipo === "campeonato") {
      return (
        String(jogo.tipo_jogo || "") === tipo &&
        dataJogo >= hojeISOAgenda()
      );
    }

    return false;
  });

  if (termoBusca) {
    jogos = jogos.filter(jogo => {
      const jogadores =
        (jogadoresPorAgenda[jogo.id] || [])
          .filter(j => j.removido !== true);

      const textoBusca = [
        jogo.cliente_nome,
        jogo.local_recurso,
        jogo.tipo_jogo,
        jogo.recorrencia,
        jogadores.map(j => j.nome || "").join(" "),
        formatarHora(jogo.hora_inicio),
        formatarHora(jogo.hora_fim)
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return textoBusca.includes(termoBusca);
    });
  }

  jogos.sort((a, b) => {
    const dataA = `${a.data_agendamento || ""} ${a.hora_inicio || ""}`;
    const dataB = `${b.data_agendamento || ""} ${b.hora_inicio || ""}`;
    return dataA.localeCompare(dataB);
  });

  if (!jogos.length) {
    lista.innerHTML = `
      <div class="agenda-horarios-empty">
        Nenhum horário encontrado para este filtro.
      </div>
    `;
    return;
  }

  lista.innerHTML = jogos.map(jogo => {
    const jogadores =
      (jogadoresPorAgenda[jogo.id] || [])
        .filter(j => j.removido !== true);

    const mensalidade =
      buscarMensalidadeAgenda(jogo);

    const dataFormatada =
      String(jogo.data_agendamento || "")
        .slice(0, 10)
        .split("-")
        .reverse()
        .join("/");

    const mensalidadeTexto =
      mensalidade
        ? `${mensalidade.competencia} • ${mensalidade.status}`
        : "Sem mensalidade gerada";

    const badge =
      jogo.recorrencia === "mensal" || jogo.tipo_jogo === "mensalista"
        ? "Mensal"
        : jogo.tipo_jogo || "Avulso";

    return `
      <div class="agenda-horario-item agenda-horario-click" data-id="${jogo.id}">

        <div class="agenda-horario-main">

          <div class="agenda-horario-topline">
            <strong>${jogo.cliente_nome || "-"}</strong>
            <span class="agenda-horario-badge">${badge}</span>
          </div>

          <span>
            ${dataFormatada} • ${formatarHora(jogo.hora_inicio)} às ${formatarHora(jogo.hora_fim)}
          </span>

          <small>
            ${jogo.local_recurso || "-"}
            •
            ${jogadores.length} jogador(es)
            ${
              jogoEhMensalAgenda(jogo)
                ? `• Mensalidade: ${mensalidadeTexto}`
                : ""
            }
          </small>

          ${
            jogo.horario_alterado === true
              ? `<small class="agenda-horario-alerta">
                  Horário alterado: ${jogo.motivo_alteracao_horario || "sem motivo informado"}
                </small>`
              : ""
          }

        </div>

      </div>
    `;
  }).join("");

  lista
    .querySelectorAll(".agenda-horario-click")
    .forEach(card => {
      card.addEventListener("click", () => {
        fecharModalHorariosFixos();
        abrirJogo(card.dataset.id);
      });
    });
}

function normalizarLocalAgenda(local) {
  return String(local || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^csmpo/i, "campo");
}

function obterLocaisAgenda() {
  const locais = agendaDados
    .map(j => normalizarLocalAgenda(j.local_recurso))
    .filter(Boolean);

  return [...new Set(locais)].sort();
}

function minutosParaHoraAgenda(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function gerarSlotsPadraoArena() {
  const abertura =
    horaParaMinutos(
      document.getElementById("configHoraAbertura")?.value || "08:00"
    );

  const fechamento =
    horaParaMinutos(
      document.getElementById("configHoraFechamento")?.value || "23:45"
    );

  const passoMinutos =
    Number(
      document.getElementById("configIntervaloInicio")?.value || 30
    );

  const duracoes =
    String(
      document.getElementById("configDuracoesJogo")?.value || "60,90"
    )
      .split(",")
      .map(Number)
      .filter(Boolean);

  const slots = [];

  for (
    let inicio = abertura;
    inicio < fechamento;
    inicio += passoMinutos
  ) {
    duracoes.forEach(duracao => {
      const fim = inicio + duracao;

      if (fim <= fechamento) {
        slots.push([
          minutosParaHoraAgenda(inicio),
          minutosParaHoraAgenda(fim),
          duracao
        ]);
      }
    });
  }

  return slots;
}

function chaveConfigGradeAgenda() {
  return `crv_agenda_grade_${APP_EMPRESA_ID || "default"}`;
}

function carregarConfigGradeAgenda() {
  const salvo =
    JSON.parse(localStorage.getItem(chaveConfigGradeAgenda()) || "{}");

  document.getElementById("configHoraAbertura").value =
    salvo.abertura || "08:00";

  document.getElementById("configHoraFechamento").value =
    salvo.fechamento || "23:45";

  document.getElementById("configIntervaloInicio").value =
    salvo.intervalo || "30";

  document.getElementById("configDuracoesJogo").value =
    salvo.duracoes || "60,90";
}

function salvarConfigGradeAgenda() {
  const config = {
    abertura: document.getElementById("configHoraAbertura")?.value || "08:00",
    fechamento: document.getElementById("configHoraFechamento")?.value || "23:45",
    intervalo: document.getElementById("configIntervaloInicio")?.value || "30",
    duracoes: document.getElementById("configDuracoesJogo")?.value || "60,90"
  };

  localStorage.setItem(
    chaveConfigGradeAgenda(),
    JSON.stringify(config)
  );
}

function horarioConflitaComJogo(slotInicio, slotFim, jogo) {
  const inicioSlot = horaParaMinutos(slotInicio);
  const fimSlot = horaParaMinutos(slotFim);

  const inicioJogo = horaParaMinutos(jogo.hora_inicio);
  const fimJogo = horaParaMinutos(jogo.hora_fim);

  return inicioSlot < fimJogo && fimSlot > inicioJogo;
}

function renderizarHorariosLivres() {
  const lista = document.getElementById("listaHorariosFixos");
  if (!lista) return;

  const dataFiltro =
    document.getElementById("filtroData")?.value || hojeISOAgenda();

  const locais = obterLocaisAgenda();
  const slots = gerarSlotsPadraoArena();

  if (!locais.length) {
    lista.innerHTML = `
      <div class="agenda-horarios-empty">
        Nenhum campo/quadra cadastrado ainda.
      </div>
    `;
    return;
  }

  const jogosDoDia =
    agendaDados.filter(jogo => {
      return (
        String(jogo.data_agendamento || "").slice(0, 10) === dataFiltro &&
        jogo.status_jogo !== "cancelado"
      );
    });

  let html = "";

  locais.forEach(local => {
    const livres = slots.filter(([inicio, fim]) => {
      return !jogosDoDia.some(jogo => {
        return (
          String(jogo.local_recurso || "").trim().toLowerCase() === local.toLowerCase() &&
          horarioConflitaComJogo(inicio, fim, jogo)
        );
      });
    });

    html += `
      <div class="agenda-livres-grupo">

        <div class="agenda-livres-header">
          <strong>${local}</strong>
          <span>${livres.length} horário(s) livre(s)</span>
        </div>

${
  livres.length
    ? `
      <div class="agenda-livres-grid">
        ${livres.map(([inicio, fim, duracao]) => `
          <button
            class="agenda-horario-livre"
            type="button"
            data-local="${local}"
            data-inicio="${inicio}"
            data-fim="${fim}"
          >
            <span>${inicio} às ${fim}</span>
            <small>${duracao === 90 ? "1h30" : "1h"}</small>
          </button>
        `).join("")}
      </div>
    `
    : `<div class="agenda-horarios-empty pequeno">Nenhum horário livre neste campo.</div>`
}

      </div>
    `;
  });

  lista.innerHTML = html;

  lista
    .querySelectorAll(".agenda-horario-livre")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        fecharModalHorariosFixos();
        abrirNovoJogo();

        document.getElementById("dataAgendamento").value = dataFiltro;
        document.getElementById("localRecurso").value = btn.dataset.local || "";
        document.getElementById("horaInicio").value = btn.dataset.inicio || "";
        document.getElementById("horaFim").value = btn.dataset.fim || "";
      });
    });
}

// ======================================================
// MODAL AVISO
// ======================================================
function abrirModalAviso({
  titulo = "Aviso",
  texto = "",
  confirmarTexto = "Entendi",
  mostrarCancelar = false,
  onConfirm = null,
  campoMotivo = false,
  placeholderMotivo = "Informe o motivo..."
}) {

  const modal = document.getElementById("modalAviso");

  document.getElementById("modalAvisoTitulo").textContent = titulo;

  const textoEl =
    document.getElementById("modalAvisoTexto");

  if (campoMotivo) {

    textoEl.innerHTML = `
      <span>${texto}</span>

      <textarea
        class="input agenda-aviso-textarea"
        id="modalAvisoMotivo"
        placeholder="${placeholderMotivo}"
      ></textarea>
    `;

  } else {

    textoEl.textContent = texto;

  }

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

    if (campoMotivo) {

      const motivo =
        document
          .getElementById("modalAvisoMotivo")
          ?.value
          .trim() || "";

      if (!motivo) {

        document
          .getElementById("modalAvisoMotivo")
          ?.focus();

        return;
      }

      fecharModalAviso();

      if (typeof onConfirm === "function") {
        onConfirm(motivo);
      }

      return;
    }

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

  const modal =
    document.getElementById("modalAviso");

  if (modal) {
    modal.style.display = "none";
  }

}

function empresaUsaAgendaEsportiva() {
  const tipo =
    String(
      window.CRV_SEGMENTO ||
      localStorage.getItem("CRV_SEGMENTO") ||
      localStorage.getItem("crv_segmento") ||
      ""
    )
      .toLowerCase();

  return (
    tipo.includes("arena") ||
    tipo.includes("quadra") ||
    tipo.includes("society") ||
    tipo.includes("beach") ||
    tipo.includes("esport")
  );
}

function dataEhMesmoDiaSemana(dataBase, dataAlvo) {
  return obterDiaSemanaAgenda(dataBase) === obterDiaSemanaAgenda(dataAlvo);
}

function jogoMensalModelo(jogo) {
  return (
    jogoEhMensalAgenda(jogo) &&
    !jogo.recorrencia_origem_id &&
    jogo.status_jogo !== "cancelado" &&
    jogo.status_jogo !== "fechado"
  );
}

function buscarExcecaoAgenda(modelo, dataAlvo) {
  return excecoesAgenda.find(exc => {
    return (
      String(exc.agenda_origem_id) === String(modelo.id) &&
      String(exc.data_original || "").slice(0, 10) === String(dataAlvo).slice(0, 10)
    );
  }) || null;
}

async function gerarOcorrenciasMensaisParaData(dataAlvo) {
  if (!dataAlvo) return;
  if (!empresaUsaAgendaEsportiva()) return;

  const modelos = agendaDados.filter(jogo => {
    if (!jogoMensalModelo(jogo)) return false;

    const dataBase =
      String(jogo.data_agendamento || "").slice(0, 10);

    if (!dataBase) return false;
    if (dataAlvo <= dataBase) return false;

    return dataEhMesmoDiaSemana(dataBase, dataAlvo);
  });

  for (const modelo of modelos) {
const excecao = buscarExcecaoAgenda(modelo, dataAlvo);

if (excecao && excecao.cancelado === true) {
  continue;
}

const dataOcorrencia =
  excecao?.data_nova || dataAlvo;

const jaExiste =
  agendaDados.some(jogo => {
    return (
      String(jogo.recorrencia_origem_id || "") === String(modelo.id) &&
      (
        String(jogo.data_agendamento || "").slice(0, 10) === String(dataAlvo).slice(0, 10) ||
        String(jogo.data_agendamento || "").slice(0, 10) === String(dataOcorrencia).slice(0, 10) ||
        String(jogo.horario_original_data || "").slice(0, 10) === String(dataAlvo).slice(0, 10)
      )
    );
  });

if (jaExiste) continue;

const horaInicioOcorrencia =
  excecao?.hora_inicio_nova || modelo.hora_inicio;

const horaFimOcorrencia =
  excecao?.hora_fim_nova || modelo.hora_fim;

const payloadOcorrencia = {
      empresa_id: APP_EMPRESA_ID,
      cliente_nome: modelo.cliente_nome,
      cliente_telefone: modelo.cliente_telefone || null,
      data_agendamento: dataOcorrencia,
      hora_inicio: horaInicioOcorrencia,
      hora_fim: horaFimOcorrencia,
      local_recurso: modelo.local_recurso,
      tipo_jogo: modelo.tipo_jogo || "mensalista",
      status_jogo: "agendado",
      recorrencia: "avulso",
      recorrencia_origem_id: modelo.id,
      ocorrencia_gerada: true,
      valor_previsto: modelo.valor_previsto || 0,
      valor_mensal: modelo.valor_mensal || 0,
      dia_pagamento_mensal: modelo.dia_pagamento_mensal || null,
      observacoes: modelo.observacoes || null,

      horario_original_data: dataAlvo,
      horario_original_inicio: modelo.hora_inicio || null,
      horario_original_fim: modelo.hora_fim || null,
      horario_alterado: !!excecao,
      motivo_alteracao_horario: excecao?.motivo || null,
      alterado_apenas_ocorrencia: !!excecao,

      permite_avulsos: modelo.permite_avulsos === true,
      permite_time_avulso: modelo.permite_time_avulso === true,

      usar_times: modelo.usar_times === true,
      time_a: modelo.time_a || null,
      time_b: modelo.time_b || null,
      total_jogadores: modelo.total_jogadores || 0,
      total_pago_jogadores: 0,
      total_pendente_jogadores: 0,
      atualizado_em: new Date().toISOString()
    };

    const { data: novaOcorrencia, error } = await sb
      .from("agenda")
      .insert([payloadOcorrencia])
      .select("id")
      .single();

    if (error) {
      console.warn("[AGENDA RECORRÊNCIA]", error);
      continue;
    }

    const jogadoresModelo =
      (jogadoresPorAgenda[modelo.id] || [])
        .filter(j => j.removido !== true);

    if (jogadoresModelo.length) {
      const jogadoresNovaOcorrencia =
        jogadoresModelo.map(j => ({
          empresa_id: APP_EMPRESA_ID,
          agenda_id: novaOcorrencia.id,
          nome: j.nome,
          time_jogador: j.time_jogador || null,
          valor: 0,
          forma_pagamento: null,
          pago: false,
          status_pagamento: "pendente",
          pago_em: null,
          removido: false,
origem_jogador: j.origem_jogador || "mensalista",
mensalista: j.mensalista !== undefined ? j.mensalista : true,
cobrar_no_jogo: j.cobrar_no_jogo !== undefined
  ? j.cobrar_no_jogo
  : String(j.origem_jogador || "mensalista") !== "mensalista"
        }));

      await sb
        .from("agenda_jogadores")
        .insert(jogadoresNovaOcorrencia);
    }

    await garantirMensalidadeAgenda(modelo, dataAlvo);
  }
}

async function garantirMensalidadeAgenda(modelo, dataAlvo) {
  if (!modelo || !modelo.id || !dataAlvo) return;

  const dataInicio = String(dataAlvo).slice(0, 10);
  const qtdJogos = 4;
  const dataFim = calcularFimCicloMensalAgenda(dataInicio, qtdJogos);

  const jaExiste = mensalidadesAgenda.some(m => {
    const inicio = String(m.data_inicio || "").slice(0, 10);
    const fim = String(m.data_fim || "").slice(0, 10);

    return (
      String(m.agenda_origem_id) === String(modelo.id) &&
      inicio &&
      fim &&
      dataInicio >= inicio &&
      dataInicio <= fim
    );
  });

  if (jaExiste) return;

  const payload = {
    empresa_id: APP_EMPRESA_ID,
    agenda_origem_id: modelo.id,
    competencia: competenciaAgenda(dataInicio),
    valor: Number(modelo.valor_mensal || 0),
    status: "pendente",
    data_inicio: dataInicio,
    data_fim: dataFim,
    quantidade_jogos_prevista: qtdJogos,
    quantidade_jogos_usados: 0,
    renovacao_status: "ativa",
    observacoes: `Ciclo mensal de ${formatarDataCurtaAgenda(dataInicio)} até ${formatarDataCurtaAgenda(dataFim)}`
  };

  const { error } = await sb
    .from("agenda_mensalidades")
    .insert([payload]);

  if (error) {
    console.warn("[AGENDA MENSALIDADE]", error);
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
      .eq("empresa_id", APP_EMPRESA_ID)
      .neq("removido", true);

      const {
  data: mensalidades,
  error: mensalidadesError
} = await sb
  .from("agenda_mensalidades")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID);

  const {
  data: excecoes,
  error: excecoesError
} = await sb
  .from("agenda_excecoes")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID);

if (excecoesError) {
  throw excecoesError;
}

if (mensalidadesError) {
  throw mensalidadesError;
}

    if (jogadoresError) {
      throw jogadoresError;
    }

agendaDados = agenda || [];
mensalidadesAgenda = mensalidades || [];
excecoesAgenda = excecoes || [];

jogadoresPorAgenda = agruparJogadores(
  jogadores || []
);

    const dataFiltro =
      document.getElementById("filtroData")?.value || hojeISOAgenda();

    await gerarOcorrenciasMensaisParaData(dataFiltro);

if (dataFiltro) {
  const { data: agendaAtualizada } = await sb
    .from("agenda")
    .select("*")
    .eq("empresa_id", APP_EMPRESA_ID)
    .order("data_agendamento", {
      ascending: true
    });

  const { data: jogadoresAtualizados } = await sb
    .from("agenda_jogadores")
    .select("*")
    .eq("empresa_id", APP_EMPRESA_ID)
    .neq("removido", true);

  const { data: mensalidadesAtualizadas } = await sb
    .from("agenda_mensalidades")
    .select("*")
    .eq("empresa_id", APP_EMPRESA_ID);

  agendaDados = agendaAtualizada || [];
  jogadoresPorAgenda = agruparJogadores(jogadoresAtualizados || []);
  mensalidadesAgenda = mensalidadesAtualizadas || [];
}

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
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  agendaDados.forEach(jogo => {
    if (String(jogo.data_agendamento || "").slice(0, 10) !== hoje) return;
    if (jogo.status_jogo === "cancelado") return;

    const inicioMinutos = horaParaMinutos(jogo.hora_inicio);
    const fimMinutos = horaParaMinutos(jogo.hora_fim);

    if (!inicioMinutos || !fimMinutos) return;

    if (minutosAgora >= inicioMinutos && minutosAgora <= inicioMinutos + 1) {
      const chave = `${jogo.id}-inicio`;

      if (!avisosJogosEmitidos.has(chave)) {
        avisosJogosEmitidos.add(chave);

        crvToast({
          titulo: "Jogo iniciado",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} começou agora.`,
          tipo: "info",
          tempo: 8000
        });
      }
    }

    const faltam = fimMinutos - minutosAgora;

    if (faltam > 0 && faltam <= 5 && jogo.status_jogo !== "fechado") {
      const chave = `${jogo.id}-fim-5min`;

      if (!avisosJogosEmitidos.has(chave)) {
        avisosJogosEmitidos.add(chave);

        crvToast({
          titulo: "Jogo quase finalizando",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} termina em ${faltam} minuto(s).`,
          tipo: "warn",
          tempo: 8000
        });
      }
    }

    if (minutosAgora >= fimMinutos && minutosAgora <= fimMinutos + 1 && jogo.status_jogo !== "fechado") {
      const chave = `${jogo.id}-finalizado`;

      if (!avisosJogosEmitidos.has(chave)) {
        avisosJogosEmitidos.add(chave);

        crvToast({
          titulo: "Jogo finalizado",
          mensagem: `${jogo.local_recurso || "Quadra/Campo"} finalizou. Verifique a cobrança.`,
          tipo: "warn",
          tempo: 9000
        });
      }
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

let status =
  document.getElementById("filtroStatus")?.value || "";

if (status === "todos") {
  status = "";
}

  let lista = [...agendaDados];

if (data) {
  lista = lista.filter(item => {
    return String(item.data_agendamento || "").slice(0, 10) === data;
  });
}

if (status) {
  lista = lista.filter(item => {
    return calcularStatusVisual(item) === status;
  });
}

if (!status) {
  lista = lista.filter(item => {
    return calcularStatusVisual(item) !== "cancelado";
  });
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
      (jogadoresPorAgenda[jogo.id] || [])
        .filter(j => j.removido !== true);

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
  .querySelectorAll(".btn-cancelar-jogo")
  .forEach(btn => {

    btn.addEventListener("click", e => {

      e.stopPropagation();

      cancelarJogo(btn.dataset.id);

    });

  });

container
  .querySelectorAll(".btn-apagar-jogo")
  .forEach(btn => {

    btn.addEventListener("click", e => {

      e.stopPropagation();

      apagarJogo(btn.dataset.id);

    });

  });

}

function criarCardJogo(jogo) {

  const status =
    calcularStatusVisual(jogo);

  const jogadores =
    (jogadoresPorAgenda[jogo.id] || [])
      .filter(j => j.removido !== true);

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

        const mensalidade =
  buscarMensalidadeAgenda(jogo);

const ehMensal =
  jogoEhMensalAgenda(jogo);

const vencimentoMensal =
  jogo.dia_pagamento_mensal || null;

const statusMensalidade =
  mensalidade?.status || null;

  const jogosUsadosMensalidade =
  Number(mensalidade?.quantidade_jogos_usados || 0);

const jogosPrevistosMensalidade =
  Number(mensalidade?.quantidade_jogos_prevista || 4);

const textoCicloMensal =
  mensalidade
    ? `Jogo ${Math.min(jogosUsadosMensalidade + 1, jogosPrevistosMensalidade)}/${jogosPrevistosMensalidade}`
    : "";

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
  ${status === "cobranca" ? "cobrança" : status === "fechado" ? "pago" : status}
</span>

      </div>

      <div class="agenda-card-responsavel">
        ${jogo.cliente_nome || "-"}
      </div>

<div class="agenda-card-cobranca-info">

  <div class="agenda-card-cobranca-linha">
    <strong>${ehMensal ? "Mensalista" : "Avulso"}</strong>

    ${
  ehMensal && textoCicloMensal
    ? `<span>${textoCicloMensal}</span>`
    : ""
}

    ${
      ehMensal && vencimentoMensal
        ? `<span>Vence dia ${vencimentoMensal}</span>`
        : ""
    }
  </div>

  ${
    ehMensal
      ? (
          statusMensalidade === "pago"
            ? `
              <div class="agenda-card-cobranca-status pago">
                ✓ Mensalidade paga
              </div>
            `
            : `
              <div class="agenda-card-cobranca-status pendente">
                ⚠ Mensalidade pendente
              </div>
            `
        )
      : (
          pendente > 0
            ? `
              <div class="agenda-card-cobranca-status pendente">
                ⚠ Pagamento pendente
              </div>
            `
            : `
              <div class="agenda-card-cobranca-status pago">
                ✓ Pagamento quitado
              </div>
            `
        )
  }

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

  ${
    status !== "cancelado" && status !== "fechado"
      ? `
        <button
          class="btn-cancelar-jogo"
          data-id="${jogo.id}"
          title="Cancelar jogo"
          type="button"
        >
          <i data-lucide="ban"></i>
        </button>
      `
      : ""
  }

  <button
    class="btn-apagar-jogo"
    data-id="${jogo.id}"
    title="Apagar definitivamente"
    type="button"
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

alternarCamposMensais();

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

    if (status === "cobranca") {
    abrirAvisoIrParaCaixa(jogo);
    return;
  }

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

const permiteAvulsos = document.getElementById("permiteAvulsos");
const permiteTimeAvulso = document.getElementById("permiteTimeAvulso");
const motivoAlteracaoHorario = document.getElementById("motivoAlteracaoHorario");

if (permiteAvulsos) {
  permiteAvulsos.checked = jogo.permite_avulsos === true;
}

if (permiteTimeAvulso) {
  permiteTimeAvulso.checked = jogo.permite_time_avulso === true;
}

if (motivoAlteracaoHorario) {
  motivoAlteracaoHorario.value = jogo.motivo_alteracao_horario || "";
}

alternarCamposMensais();

      const usarTimesJogo =
    document.getElementById("usarTimesJogo");

  if (usarTimesJogo) {
    usarTimesJogo.checked = jogo.usar_times === true;
  }

  const timeA =
    document.getElementById("timeA");

  if (timeA) {
    timeA.value = jogo.time_a || "";
  }

  const timeB =
    document.getElementById("timeB");

  if (timeB) {
    timeB.value = jogo.time_b || "";
  }

  alternarTimesJogo();

  const jogadores =
    jogadoresPorAgenda[jogo.id] || [];

  jogadores.forEach(j => {
    adicionarLinhaJogador(j);
  });

  aplicarModoModal();

  atualizarTotalizadorModal();

  abrirModalJogo();

}

function abrirAvisoIrParaCaixa(jogo) {
  abrirModalAviso({
    titulo: "Jogo em cobrança",
    texto:
      "Este jogo já terminou. A cobrança dos jogadores deve ser feita no Caixa.",
    confirmarTexto: "Ir para o Caixa",
    mostrarCancelar: true,
    onConfirm: () => {
      window.location.href = "caixa.html";
    }
  });
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
  const modoFechado = modoModalAgenda === "fechado";
  const modoCancelado = modoModalAgenda === "cancelado";

  const podeEditarAgenda =
    !modoFechado &&
    !modoCancelado;

  const titulo = document.getElementById("modalReservaTitulo");
  const subtitulo = document.querySelector(".agenda-modal-subtitle");
  const btnSalvar = document.getElementById("btnSalvarReserva");
  const btnAdicionar = document.getElementById("btnAdicionarJogador");

  if (modoNovo) {
    titulo.textContent = "Novo horário";
    subtitulo.textContent = "Cadastre o horário, responsável e jogadores.";
  } else if (modoFechado) {
    titulo.textContent = "Jogo fechado";
    subtitulo.textContent = "Jogo já finalizado no caixa.";
  } else if (modoCancelado) {
    titulo.textContent = "Jogo cancelado";
    subtitulo.textContent = "Jogo cancelado.";
  } else {
    titulo.textContent = "Editar jogo";
    subtitulo.textContent = "Ajuste horário, responsável e jogadores. A cobrança é feita no Caixa.";
  }

  [
    "clienteNome",
    "clienteTelefone",
    "dataAgendamento",
    "localRecurso",
    "horaInicio",
    "horaFim",
    "tipoJogo",
    "valorPrevisto",
    "valorMensal",
    "diaPagamentoMensal",
    "observacoes",
    "usarTimesJogo",
    "timeA",
    "timeB"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !podeEditarAgenda;
  });

  const statusJogo = document.getElementById("statusJogo");

  if (statusJogo) {
    statusJogo.disabled = true;
    statusJogo.closest(".input-group")?.style.setProperty("display", "none");
  }

  if (btnSalvar) {
    btnSalvar.style.display = podeEditarAgenda ? "inline-flex" : "none";
  }

  if (btnAdicionar) {
    btnAdicionar.style.display = podeEditarAgenda ? "inline-flex" : "none";
  }

document.querySelectorAll(".agenda-jogador-row").forEach(row => {

  row.classList.remove(
    "modo-agendamento",
    "modo-cobranca"
  );

  row.classList.add("modo-agendamento");

  const nome = row.querySelector(".jogador-nome");
  const valor = row.querySelector(".jogador-valor");
  const pagamento = row.querySelector(".jogador-pagamento");
  const pago = row.querySelector(".jogador-pago");
  const remover = row.querySelector(".agenda-remover-jogador");

  if (nome) nome.disabled = !podeEditarAgenda;

  const time = row.querySelector(".jogador-time");

  if (time) {
    time.disabled = !podeEditarAgenda;
  }

  if (valor) {
    valor.disabled = true;
    valor.style.display = "none";
  }

  if (pagamento) {
    pagamento.disabled = true;
    pagamento.style.display = "none";
  }

  if (pago) {
    pago.disabled = true;

    pago
      .closest("label")
      ?.style.setProperty("display", "none");
  }

  if (remover) {
    remover.style.display =
      podeEditarAgenda
        ? "flex"
        : "none";
  }

});

  renderizarControleMarcarTodosJogadores();
}

function alternarTimesJogo() {
  const usarTimes =
    document.getElementById("usarTimesJogo")?.checked === true;

  const boxTimes =
    document.getElementById("boxTimesJogo");

  if (boxTimes) {
    if (usarTimes) {
      boxTimes.classList.add("ativo");
    } else {
      boxTimes.classList.remove("ativo");
    }
  }

  document
    .querySelectorAll(".jogador-time")
    .forEach(select => {
      select.style.display = usarTimes ? "block" : "none";

      if (!usarTimes) {
        select.value = "";
      }
    });
}

// ======================================================
// CAMPOS MENSAIS
// ======================================================
function alternarCamposMensais() {
  const tipoJogo =
    document.getElementById("tipoJogo")?.value || "avulso";

  const ehMensal =
    tipoJogo === "mensalista";

  const boxMensal =
    document.getElementById("boxMensal");

  if (boxMensal) {
    boxMensal.classList.toggle(
      "ativo",
      ehMensal
    );
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
    "observacoes",
    "timeA",
    "timeB"
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

const usarTimesJogo =
  document.getElementById("usarTimesJogo");

if (usarTimesJogo) {
  usarTimesJogo.checked = false;
}

const motivoAlteracaoHorario =
  document.getElementById("motivoAlteracaoHorario");

if (motivoAlteracaoHorario) {
  motivoAlteracaoHorario.value = "";
}

alternarCamposMensais();
alternarTimesJogo();

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

function renderizarControleMarcarTodosJogadores() {
  return;
}

// ======================================================
// JOGADORES
// ======================================================
function adicionarLinhaJogador(jogador = {}) {

  const lista =
    document.getElementById("listaJogadores");

  const row =
    document.createElement("div");

  row.className =
    "agenda-jogador-row";

  if (jogador.id) {
    row.dataset.jogadorId = jogador.id;
  }

  const tipoJogo =
    document.getElementById("tipoJogo")?.value || "avulso";

  const ehMensal =
    tipoJogo === "mensalista";

  row.innerHTML = `
    <input
      class="input jogador-nome"
      placeholder="Nome do jogador"
      value="${jogador.nome || ""}"
    >

    ${
      ehMensal
        ? `
          <select class="input jogador-origem">
            <option value="mensalista" ${
              jogador.origem_jogador === "mensalista" ||
              jogador.mensalista === true
                ? "selected"
                : ""
            }>
              Mensal
            </option>

            <option value="avulso" ${
              jogador.origem_jogador === "avulso" ||
              jogador.mensalista === false
                ? "selected"
                : ""
            }>
              Avulso
            </option>
          </select>
        `
        : ""
    }

    <select class="input jogador-time">
      <option value="">Time</option>
      <option value="A" ${jogador.time_jogador === "A" ? "selected" : ""}>Time A</option>
      <option value="B" ${jogador.time_jogador === "B" ? "selected" : ""}>Time B</option>
    </select>

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
      <option value="pix" ${jogador.forma_pagamento === "pix" ? "selected" : ""}>PIX</option>
      <option value="dinheiro" ${jogador.forma_pagamento === "dinheiro" ? "selected" : ""}>Dinheiro</option>
      <option value="cartao" ${jogador.forma_pagamento === "cartao" ? "selected" : ""}>Cartão</option>
    </select>

    <label class="agenda-jogador-check">
      <input
        type="checkbox"
        class="jogador-pago"
        ${jogador.pago ? "checked" : ""}
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

  const inputNomeJogador = row.querySelector(".jogador-nome");

  if (inputNomeJogador) {
    inputNomeJogador.addEventListener("blur", () => {
      inputNomeJogador.value =
        formatarNomeProprioAgenda(inputNomeJogador.value);
    });
  }

  row
    .querySelector(".agenda-remover-jogador")
    .addEventListener("click", () => {

      const jogadorId = row.dataset.jogadorId || null;

      if (jogadorId && agendaAtualId) {
        const jogadoresExistentes =
          jogadoresPorAgenda[agendaAtualId] || [];

        const jogadorExistente =
          jogadoresExistentes.find(j => String(j.id) === String(jogadorId));

        const jogadorVinculado =
          jogadorExistente &&
          (
            jogadorExistente.pago === true ||
            jogadorExistente.comanda_id ||
            jogadorExistente.venda_id
          );

        if (jogadorVinculado) {
          mostrarErro(
            "Este jogador já possui pagamento ou comanda vinculada. Você pode editar o nome, mas não pode removê-lo."
          );

          return;
        }
      }

      row.remove();

      atualizarTotalizadorModal();

    });

  row
    .querySelectorAll("input, select")
    .forEach(el => {
      el.addEventListener("input", atualizarTotalizadorModal);
      el.addEventListener("change", atualizarTotalizadorModal);
    });

  aplicarModoModal();

  alternarTimesJogo();

  atualizarTotalizadorModal();

  if (window.lucide) {
    lucide.createIcons();
  }
}

function obterJogadoresModal() {

  const tipoJogo =
    document.getElementById("tipoJogo")?.value || "avulso";

  const ehMensal =
    tipoJogo === "mensalista";

  return [
    ...document.querySelectorAll(".agenda-jogador-row")
  ]
    .map(row => {
      const origem =
        ehMensal
          ? row.querySelector(".jogador-origem")?.value || "mensalista"
          : "avulso";

      return {
        id: row.dataset.jogadorId || null,

        nome:
          row.querySelector(".jogador-nome")?.value.trim(),

        time_jogador:
          row.querySelector(".jogador-time")?.value || null,

        origem_jogador: origem,

        valor:
          normalizarMoedaAgenda(
            row.querySelector(".jogador-valor")?.value
          ),

        forma_pagamento:
          row.querySelector(".jogador-pagamento")?.value || null,

        pago:
          row.querySelector(".jogador-pago")?.checked || false
      };
    })
    .filter(j => j.nome)
    .map(j => ({
      ...j,
      mensalista: j.origem_jogador === "mensalista",
      cobrar_no_jogo: j.origem_jogador !== "mensalista"
    }));
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
function obterDiaSemanaAgenda(dataISO) {
  if (!dataISO) return null;

  const data =
    new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);

  return data.getDay();
}

function jogoEhMensalAgenda(jogo) {
  return (
    String(jogo.recorrencia || "") === "mensal" ||
    String(jogo.tipo_jogo || "") === "mensalista"
  );
}

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

const tipoNovo =
  document.getElementById("tipoJogo")?.value || "avulso";

const novoEhMensal =
  tipoNovo === "mensalista";

  const novoInicio =
    horaParaMinutos(inicio);

  const novoFim =
    horaParaMinutos(fim);

  const novoDiaSemana =
    obterDiaSemanaAgenda(data);

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

    const conflitoHora =
      novoInicio < fimExistente &&
      novoFim > inicioExistente;

    if (!conflitoHora) {
      return false;
    }

    const jogoExistenteEhMensal =
      jogoEhMensalAgenda(jogo);

    const diaSemanaExistente =
      obterDiaSemanaAgenda(jogo.data_agendamento);

    if (
      novoEhMensal &&
      jogoExistenteEhMensal &&
      novoDiaSemana === diaSemanaExistente
    ) {
      return true;
    }

    if (
      novoEhMensal &&
      !jogoExistenteEhMensal &&
      novoDiaSemana === diaSemanaExistente
    ) {
      return true;
    }

    if (
      !novoEhMensal &&
      jogoExistenteEhMensal &&
      novoDiaSemana === diaSemanaExistente
    ) {
      return true;
    }

    if (
      !novoEhMensal &&
      !jogoExistenteEhMensal &&
      String(jogo.data_agendamento || "").slice(0, 10) === data
    ) {
      return true;
    }

    return false;

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

    const inicioMinutos = horaParaMinutos(inicio);
const fimMinutos = horaParaMinutos(fim);

if (fimMinutos <= inicioMinutos) {
  return mostrarErro(
    "O horário final deve ser maior que o horário inicial."
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
  const nomeLimpo = formatarNomeProprioAgenda(jogador.nome);

  if (!nomeLimpo) return;

const usarTimes =
  document.getElementById("usarTimesJogo")?.checked === true;

jogadoresNormalizados.push({
  id: jogador.id || null,
  nome: nomeLimpo,
  time_jogador: usarTimes ? jogador.time_jogador || null : null,
  valor: Number(jogador.valor || 0),
  forma_pagamento: jogador.forma_pagamento || null,
  pago: jogador.pago === true,
  origem_jogador: jogador.origem_jogador || "mensalista",
  mensalista: jogador.mensalista === true,
  cobrar_no_jogo: jogador.cobrar_no_jogo === true
});

});

jogadores.length = 0;
jogadores.push(...jogadoresNormalizados);

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

const jogoAtual =
  agendaDados.find(j => String(j.id) === String(agendaAtualId));

let statusJogo =
  modoModalAgenda === "novo"
    ? "agendado"
    : jogoAtual?.status_jogo || "agendado";

    const ehOcorrenciaMensal =
  jogoAtual &&
  jogoAtual.recorrencia_origem_id &&
  jogoAtual.ocorrencia_gerada === true;

const dataOriginalOcorrencia =
  String(jogoAtual?.data_agendamento || "").slice(0, 10);

const horarioFoiAlterado =
  ehOcorrenciaMensal &&
  (
    String(data) !== String(jogoAtual.data_agendamento).slice(0, 10) ||
    String(inicio) !== formatarHora(jogoAtual.hora_inicio) ||
    String(fim) !== formatarHora(jogoAtual.hora_fim)
  );

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
  document.getElementById("tipoJogo")?.value === "mensalista"
    ? "mensal"
    : "avulso",

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

permite_avulsos:
  jogadores.some(j => j.origem_jogador === "avulso"),

permite_time_avulso:
  false,

motivo_alteracao_horario:
  document.getElementById("motivoAlteracaoHorario")?.value.trim() || null,

horario_original_data:
  horarioFoiAlterado
    ? dataOriginalOcorrencia
    : jogoAtual?.horario_original_data || jogoAtual?.data_agendamento || null,

horario_original_inicio:
  horarioFoiAlterado
    ? jogoAtual?.hora_inicio || null
    : jogoAtual?.horario_original_inicio || jogoAtual?.hora_inicio || null,

horario_original_fim:
  horarioFoiAlterado
    ? jogoAtual?.hora_fim || null
    : jogoAtual?.horario_original_fim || jogoAtual?.hora_fim || null,

horario_alterado:
  horarioFoiAlterado || jogoAtual?.horario_alterado === true,

alterado_apenas_ocorrencia:
  horarioFoiAlterado || jogoAtual?.alterado_apenas_ocorrencia === true,

      usar_times:
        document.getElementById("usarTimesJogo")?.checked === true,

      time_a:
        document.getElementById("usarTimesJogo")?.checked === true
          ? document.getElementById("timeA")?.value.trim() || null
          : null,

      time_b:
        document.getElementById("usarTimesJogo")?.checked === true
          ? document.getElementById("timeB")?.value.trim() || null
          : null,

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

if (horarioFoiAlterado) {
  const motivoAlteracao =
    document.getElementById("motivoAlteracaoHorario")?.value.trim() ||
    document.getElementById("observacoes")?.value.trim() ||
    "Alteração temporária de horário";

  const origemMensalId =
    jogoAtual.recorrencia_origem_id;

  const { error: excecaoError } = await sb
    .from("agenda_excecoes")
    .upsert([{
      empresa_id: APP_EMPRESA_ID,
      agenda_origem_id: origemMensalId,
      data_original: dataOriginalOcorrencia,
      hora_inicio_original: jogoAtual.hora_inicio,
      hora_fim_original: jogoAtual.hora_fim,
      data_nova: data,
      hora_inicio_nova: inicio,
      hora_fim_nova: fim,
      tipo: "alteracao",
      motivo: motivoAlteracao,
      cancelado: false,
      atualizado_em: new Date().toISOString()
    }], {
      onConflict: "empresa_id,agenda_origem_id,data_original"
    });

  if (excecaoError) {
    throw excecaoError;
  }

  await sb
    .from("agenda")
    .update({
      status_jogo: "cancelado",
      motivo_cancelamento: `Horário mensal alterado temporariamente para ${data}`,
      cancelado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    })
    .eq("empresa_id", APP_EMPRESA_ID)
    .eq("recorrencia_origem_id", origemMensalId)
    .eq("data_agendamento", dataOriginalOcorrencia)
    .neq("id", agendaId);
}

    const jogadoresExistentes =
      jogadoresPorAgenda[agendaId] || [];

    const idsMantidos =
      jogadores
        .filter(j => j.id)
        .map(j => String(j.id));

    for (const jogadorExistente of jogadoresExistentes) {
      const foiRemovido =
        !idsMantidos.includes(String(jogadorExistente.id));

      const podeRemover =
        jogadorExistente.pago !== true &&
        !jogadorExistente.comanda_id &&
        !jogadorExistente.venda_id;

      if (foiRemovido && !podeRemover) {
        return mostrarErro(
          `O jogador ${jogadorExistente.nome || ""} já possui pagamento ou comanda vinculada. Ele não pode ser removido.`
        );
      }

      if (foiRemovido && podeRemover) {
        const { error } = await sb
          .from("agenda_jogadores")
          .update({
            removido: true,
            removido_em: new Date().toISOString(),
            motivo_remocao: "Removido pela agenda",
            atualizado_em: new Date().toISOString()
          })
          .eq("id", jogadorExistente.id)
          .eq("empresa_id", APP_EMPRESA_ID);

        if (error) throw error;
      }
    }

    for (const jogador of jogadores) {
      if (jogador.id) {
        const { error } = await sb
          .from("agenda_jogadores")
.update({
  nome: jogador.nome,
  time_jogador: jogador.time_jogador || null,
  origem_jogador: jogador.origem_jogador || "mensalista",
  mensalista: jogador.mensalista === true,
  cobrar_no_jogo: jogador.cobrar_no_jogo === true,
  atualizado_em: new Date().toISOString()
})
          .eq("id", jogador.id)
          .eq("empresa_id", APP_EMPRESA_ID);

        if (error) throw error;
      } else {
        const { error } = await sb
          .from("agenda_jogadores")
.insert([{
  empresa_id: APP_EMPRESA_ID,
  agenda_id: agendaId,
  nome: jogador.nome,
  time_jogador: jogador.time_jogador || null,
  valor: 0,
  forma_pagamento: null,
  pago: false,
  status_pagamento: "pendente",
  pago_em: null,
  removido: false,
  origem_jogador: jogador.origem_jogador || "mensalista",
  mensalista: jogador.mensalista === true,
  cobrar_no_jogo: jogador.cobrar_no_jogo === true
}]);

        if (error) throw error;
      }
    }

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
// CANCELAR E REMOVER
// ======================================================
function cancelarJogo(id) {
  const jogo =
    agendaDados.find(j => String(j.id) === String(id));

  if (!jogo) return;

  abrirModalAviso({

    titulo: "Cancelar jogo",

    texto:
      `Informe o motivo do cancelamento de ${jogo.cliente_nome || "este jogo"}.`,

    confirmarTexto: "Cancelar jogo",

    mostrarCancelar: true,

    campoMotivo: true,

    placeholderMotivo:
      "Ex: cliente desistiu, chuva, sem time, reagendado...",

    onConfirm: async motivo => {

      try {

        const { error } = await sb
          .from("agenda")
          .update({
            status_jogo: "cancelado",
            motivo_cancelamento: motivo,
            cancelado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
          })
          .eq("id", id)
          .eq("empresa_id", APP_EMPRESA_ID);

        if (error) {
          throw error;
        }

        await carregarAgenda();

        crvToast({
          titulo: "Jogo cancelado",
          mensagem: "O horário foi liberado na agenda.",
          tipo: "success"
        });

      } catch (err) {

        abrirModalAviso({
          titulo: "Erro",
          texto:
            err.message ||
            "Erro ao cancelar jogo."
        });

      }

    }

  });
}

function apagarJogo(id) {

  const jogo =
    agendaDados.find(j => String(j.id) === String(id));

  abrirModalAviso({

    titulo: "Apagar definitivamente",

    texto:
      `Isso vai apagar ${jogo?.cliente_nome || "este jogo"} do banco e remover o histórico vinculado. Deseja continuar?`,

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

        crvToast({
          titulo: "Jogo apagado",
          mensagem: "Registro removido definitivamente.",
          tipo: "success"
        });

      } catch (err) {

        abrirModalAviso({
          titulo: "Erro",
          texto:
            err.message ||
            "Erro ao apagar."
        });

      }

    }

  });

}

function abrirModalMensalidades() {

  abrirModalHorariosFixos();

  setTimeout(() => {

    const abaMensalistas =
      document.querySelector(
        '.agenda-horarios-tab[data-tipo="mensalista"]'
      );

    if (abaMensalistas) {
      abaMensalistas.click();
    }

  }, 80);

}

function obterJogoOrigemMensalidade(mensalidade) {
  return agendaDados.find(jogo => {
    return String(jogo.id) === String(mensalidade.agenda_origem_id);
  }) || null;
}

function formatarCompetenciaMensalidade(comp) {
  if (!comp) return "-";

  const [ano, mes] = String(comp).split("-").map(Number);

  const nomesMeses = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  return `${nomesMeses[mes]} de ${ano}`;
}

function renderizarMensalidadesAgenda() {
  const lista =
    document.getElementById("listaHorariosFixos");

  if (!lista) return;

  const termoBusca =
    String(document.getElementById("buscaHorariosFixos")?.value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  let mensalidades =
    [...mensalidadesAgenda];

    const dataFiltro =
  document.getElementById("dataHorariosFixos")?.value ||
  document.getElementById("filtroData")?.value ||
  hojeISOAgenda();

const competenciaAtual =
  competenciaAgenda(dataFiltro);

mensalidades = mensalidades.filter(m => {
  const jogo = obterJogoOrigemMensalidade(m);

  if (!jogo || jogo.status_jogo === "cancelado") {
    return false;
  }

  return String(m.competencia) === String(competenciaAtual);
});



  if (termoBusca) {
    mensalidades = mensalidades.filter(m => {
      const jogo = obterJogoOrigemMensalidade(m);

      const texto = [
        jogo?.cliente_nome,
        jogo?.local_recurso,
        m.competencia,
        m.status,
        m.renovacao_status
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return texto.includes(termoBusca);
    });
  }

  mensalidades.sort((a, b) => {
    return String(a.competencia || "").localeCompare(String(b.competencia || ""));
  });

  if (!mensalidades.length) {
    lista.innerHTML = `
      <div class="agenda-horarios-empty">
        Nenhuma mensalidade encontrada.
      </div>
    `;
    return;
  }

  lista.innerHTML = mensalidades.map(m => {
    const jogo =
      obterJogoOrigemMensalidade(m);

const ciclo =
  calcularIndiceJogoMensal(jogo, m);

const usados =
  ciclo.atual - 1;

const previstos =
  ciclo.total;

    const statusClasse =
      m.status === "pago"
        ? "pago"
        : m.status === "cancelado"
          ? "cancelado"
          : "pendente";

    return `
      <div class="agenda-mensalidade-item">

        <div class="agenda-mensalidade-main">

          <div class="agenda-mensalidade-top">
            <strong>${jogo?.cliente_nome || "-"}</strong>
            <span class="agenda-mensalidade-status ${statusClasse}">
              ${m.status || "pendente"}
            </span>
          </div>

          <div class="agenda-mensalidade-info">
            <span>${jogo?.local_recurso || "-"}</span>
            <span>${formatarHora(jogo?.hora_inicio)} às ${formatarHora(jogo?.hora_fim)}</span>
            <span>Mensalidade referente a ${formatarCompetenciaMensalidade(m.competencia)}</span>
          </div>

          <div class="agenda-mensalidade-ciclo">
<strong>
  ${
    ciclo.atual >= ciclo.total
      ? `Último jogo ${ciclo.atual}/${ciclo.total}`
      : `Próximo jogo ${ciclo.atual}/${ciclo.total}`
  }
</strong>
            <span>${fmtAgenda(m.valor || 0)}</span>
          </div>

${
  mensalidadeEhUltimoJogoCiclo(jogo, m)
    ? `
      <div class="agenda-mensalidade-alerta">
        Último jogo do ciclo mensal. Verifique renovação para ${formatarCompetenciaMensalidade(obterProximaCompetenciaAgenda(m.competencia))}.
      </div>
    `
    : ""
}

        </div>

        <div class="agenda-mensalidade-actions">

<button
  type="button"
  class="btn-secondary btn-receber-mensalidade"
  data-id="${m.id}"
>
  Receber no Caixa
</button>

<button
  type="button"
  class="btn-ghost btn-manter-pendente-mensalidade"
  data-id="${m.id}"
>
  Manter pendente
</button>

          <button
            type="button"
            class="btn-ghost btn-cancelar-mensalidade"
            data-id="${m.id}"
          >
            Cancelar
          </button>

        </div>

      </div>
    `;
  }).join("");

  lista
    .querySelectorAll(".btn-receber-mensalidade")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        receberMensalidadeAgenda(btn.dataset.id);
      });
    });

  lista
    .querySelectorAll(".btn-renovar-mensalidade")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        renovarMensalidadeAgenda(btn.dataset.id);
      });
    });

lista
  .querySelectorAll(".btn-manter-pendente-mensalidade")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      manterPendenteMensalidadeAgenda(btn.dataset.id);
    });
  });

  lista
    .querySelectorAll(".btn-cancelar-mensalidade")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        cancelarMensalidadeAgenda(btn.dataset.id);
      });
    });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function encontrarMensalidadePorId(id) {
  return mensalidadesAgenda.find(m => String(m.id) === String(id)) || null;
}

function receberMensalidadeAgenda(id) {
  const mensalidade =
    encontrarMensalidadePorId(id);

  if (!mensalidade) return;

  const jogo =
    obterJogoOrigemMensalidade(mensalidade);

  if (!jogo) {
    abrirModalAviso({
      titulo: "Mensalidade sem horário",
      texto: "Não foi possível localizar o horário vinculado a esta mensalidade."
    });
    return;
  }

  const recebimento = {
    tipo: "agenda_mensalidade",
    mensalidade_id: mensalidade.id,
    agenda_id: mensalidade.agenda_origem_id,
    origem_id: mensalidade.id,
    cliente_nome: jogo.cliente_nome || "Mensalista",
    local_recurso: jogo.local_recurso || "",
    hora_inicio: jogo.hora_inicio || "",
    hora_fim: jogo.hora_fim || "",
    competencia: mensalidade.competencia || "",
    valor: Number(mensalidade.valor || jogo.valor_mensal || 0),
    descricao: `Mensalidade ${jogo.cliente_nome || "Mensalista"} - ${formatarCompetenciaMensalidade(mensalidade.competencia)}`
  };

  sessionStorage.setItem(
    "crv_recebimento_agenda_caixa",
    JSON.stringify(recebimento)
  );

  window.location.href = "caixa.html";
}

async function renovarMensalidadeAgenda(id) {
  const mensalidade =
    encontrarMensalidadePorId(id);

  if (!mensalidade) return;

  const jogo =
    obterJogoOrigemMensalidade(mensalidade);

  abrirModalAviso({
    titulo: "Renovar mensalidade",
    texto: `Este é o último jogo do ciclo. Renovar ${jogo?.cliente_nome || "mensalista"} para ${formatarCompetenciaMensalidade(obterProximaCompetenciaAgenda(mensalidade.competencia))}?`,
    confirmarTexto: "Renovar",
    mostrarCancelar: true,
    onConfirm: async () => {
      try {
        const [ano, mes] =
          String(mensalidade.competencia).split("-").map(Number);

        const proximaData =
          new Date(ano, mes, 1);

        const proximaCompetencia =
          `${proximaData.getFullYear()}-${String(proximaData.getMonth() + 1).padStart(2, "0")}`;

        const dataInicio =
          `${proximaCompetencia}-01`;

        const dataFim =
          new Date(
            proximaData.getFullYear(),
            proximaData.getMonth() + 1,
            0
          ).toISOString().slice(0, 10);

        const { error } = await sb
          .from("agenda_mensalidades")
          .upsert([{
            empresa_id: APP_EMPRESA_ID,
            agenda_origem_id: mensalidade.agenda_origem_id,
            competencia: proximaCompetencia,
            valor: Number(mensalidade.valor || jogo?.valor_mensal || 0),
            status: "pendente",
            data_inicio: dataInicio,
            data_fim: dataFim,
            quantidade_jogos_prevista: Number(mensalidade.quantidade_jogos_prevista || 4),
            quantidade_jogos_usados: 0,
            renovacao_status: "ativa",
            observacoes: "Mensalidade renovada pela agenda",
            atualizado_em: new Date().toISOString()
          }], {
            onConflict: "empresa_id,agenda_origem_id,competencia"
          });

        if (error) throw error;

        await sb
          .from("agenda_mensalidades")
          .update({
            renovacao_status: "renovada",
            atualizado_em: new Date().toISOString()
          })
          .eq("id", mensalidade.id)
          .eq("empresa_id", APP_EMPRESA_ID);

        await carregarAgenda();

        renderizarMensalidadesAgenda();

        crvToast({
          titulo: "Mensalidade renovada",
          mensagem: "Nova competência criada com sucesso.",
          tipo: "success"
        });

      } catch (err) {
        abrirModalAviso({
          titulo: "Erro",
          texto: err.message || "Erro ao renovar mensalidade."
        });
      }
    }
  });
}

async function cancelarMensalidadeAgenda(id) {
  const mensalidade =
    encontrarMensalidadePorId(id);

  if (!mensalidade) return;

  const jogo =
    obterJogoOrigemMensalidade(mensalidade);

  abrirModalAviso({
    titulo: "Cancelar mensalidade",
    texto: `Cancelar mensalidade de ${jogo?.cliente_nome || "mensalista"}?`,
    confirmarTexto: "Cancelar mensalidade",
    mostrarCancelar: true,
    onConfirm: async () => {
      try {
        const { error } = await sb
          .from("agenda_mensalidades")
          .update({
            status: "cancelado",
            renovacao_status: "cancelada",
            atualizado_em: new Date().toISOString()
          })
          .eq("id", id)
          .eq("empresa_id", APP_EMPRESA_ID);

        if (error) throw error;

        await carregarAgenda();

        renderizarMensalidadesAgenda();

        crvToast({
          titulo: "Mensalidade cancelada",
          mensagem: "Registro atualizado com sucesso.",
          tipo: "success"
        });

      } catch (err) {
        abrirModalAviso({
          titulo: "Erro",
          texto: err.message || "Erro ao cancelar mensalidade."
        });
      }
    }
  });
}

function contarJogosMensaisUsadosNaCompetencia(agendaOrigemId, competencia) {
  if (!agendaOrigemId || !competencia) return 0;

  return agendaDados.filter(jogo => {
    if (jogo.status_jogo === "cancelado") return false;

    const jogoPertenceAoModelo =
      String(jogo.id) === String(agendaOrigemId) ||
      String(jogo.recorrencia_origem_id) === String(agendaOrigemId);

    if (!jogoPertenceAoModelo) return false;

    return competenciaAgenda(jogo.data_agendamento) === competencia;
  }).length;
}

function listarDatasTeoricasMensalidade(jogo, competencia) {
  if (!jogo || !competencia) return [];

  const [ano, mes] = competencia.split("-").map(Number);
  const primeiroDia = new Date(ano, mes - 1, 1, 12);
  const ultimoDia = new Date(ano, mes, 0, 12);

  const diaSemanaModelo =
    obterDiaSemanaAgenda(jogo.data_agendamento);

  const datas = [];

  for (
    let data = new Date(primeiroDia);
    data <= ultimoDia;
    data.setDate(data.getDate() + 1)
  ) {
    if (data.getDay() === diaSemanaModelo) {
      datas.push(data.toISOString().slice(0, 10));
    }
  }

  return datas;
}

function calcularIndiceJogoMensal(jogo, mensalidade) {
  const dataFiltro =
    document.getElementById("dataHorariosFixos")?.value ||
    document.getElementById("filtroData")?.value ||
    hojeISOAgenda();

  const datas =
    listarDatasTeoricasMensalidade(jogo, mensalidade.competencia);

  if (!datas.length) {
    return {
      atual: 1,
      total: Number(mensalidade.quantidade_jogos_prevista || 4)
    };
  }

  const indice =
    datas.findIndex(data => data >= dataFiltro);

  const atual =
    indice >= 0
      ? indice + 1
      : datas.length;

  return {
    atual,
    total: datas.length
  };
}

function mensalidadeEhUltimoJogoCiclo(jogo, mensalidade) {
  if (!jogo || !mensalidade) return false;

  const ciclo =
    calcularIndiceJogoMensal(jogo, mensalidade);

  return ciclo.atual >= ciclo.total;
}

function obterProximaCompetenciaAgenda(competencia) {
  const [ano, mes] =
    String(competencia).split("-").map(Number);

  const data =
    new Date(ano, mes, 1);

  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

async function manterPendenteMensalidadeAgenda(id) {
  const mensalidade =
    encontrarMensalidadePorId(id);

  if (!mensalidade) return;

  try {
    const { error } = await sb
      .from("agenda_mensalidades")
      .update({
        status: "pendente",
        renovacao_status: "a_vencer",
        renovacao_observacao: "Mantida pendente pela agenda",
        atualizado_em: new Date().toISOString()
      })
      .eq("id", id)
      .eq("empresa_id", APP_EMPRESA_ID);

    if (error) throw error;

    await carregarAgenda();

    renderizarMensalidadesAgenda();

    crvToast({
      titulo: "Mensalidade mantida pendente",
      mensagem: "O ciclo continuará aparecendo como pendente até receber ou renovar.",
      tipo: "warn"
    });

  } catch (err) {
    abrirModalAviso({
      titulo: "Erro",
      texto: err.message || "Erro ao manter mensalidade pendente."
    });
  }
}

function alternarAgendaInline() {
  const painel = document.getElementById("agendaInlinePanel");
  const botao = document.getElementById("btnAgendaInline");

  if (!painel || !botao) return;

  agendaInlineAberta = !agendaInlineAberta;

  painel.style.display = agendaInlineAberta ? "block" : "none";
  botao.classList.toggle("aberto", agendaInlineAberta);

  if (agendaInlineAberta) {
    carregarConfigGradeAgenda();
    popularCamposAgendaInline();
    renderizarAgendaInline();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function popularCamposAgendaInline() {
  const select = document.getElementById("campoAgendaInline");
  if (!select) return;

  const valorAtual = select.value;
  const campos = obterLocaisAgenda();

  select.innerHTML = `
    <option value="">Todos os campos</option>
    ${campos.map(campo => `
      <option value="${campo}">
        ${campo}
      </option>
    `).join("")}
  `;

  select.value = valorAtual || "";
}

function normalizarBuscaAgendaInline(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function criarLinhasLivresAgendaInline() {
  const dataFiltro =
    document.getElementById("filtroData")?.value || hojeISOAgenda();

  const campoFiltro =
    normalizarBuscaAgendaInline(
      document.getElementById("campoAgendaInline")?.value || ""
    );

  const busca =
    normalizarBuscaAgendaInline(
      document.getElementById("buscaAgendaInline")?.value || ""
    );

  const locais =
    obterLocaisAgenda().filter(local => {
      if (!campoFiltro) return true;
      return normalizarBuscaAgendaInline(local) === campoFiltro;
    });

  const slots = gerarSlotsPadraoArena();

  const jogosDoDia =
    agendaDados.filter(jogo => {
      return (
        String(jogo.data_agendamento || "").slice(0, 10) === dataFiltro &&
        jogo.status_jogo !== "cancelado"
      );
    });

  const linhas = [];

  locais.forEach(local => {
    slots.forEach(([inicio, fim, duracao]) => {
      const ocupado =
        jogosDoDia.some(jogo => {
          return (
            normalizarBuscaAgendaInline(jogo.local_recurso) === normalizarBuscaAgendaInline(local) &&
            horarioConflitaComJogo(inicio, fim, jogo)
          );
        });

      if (ocupado) return;

const horaCompacta =
  `${inicio} ${fim} ${inicio.replace(":", "")} ${fim.replace(":", "")}`;

const textoBusca =
  normalizarBuscaAgendaInline([
    inicio,
    fim,
    horaCompacta,
    local,
    "livre",
    duracao === 90 ? "1h30" : "1h",
    duracao === 90 ? "90 minutos" : "60 minutos"
  ].join(" "));

      if (busca && !textoBusca.includes(busca)) return;

      linhas.push({
        livre: true,
        horario: `${inicio} - ${fim}`,
        inicio,
        fim,
        campo: local,
        duracao
      });
    });
  });

  return linhas;
}

function criarLinhasJogosAgendaInline() {
  const dataFiltro =
    document.getElementById("filtroData")?.value || hojeISOAgenda();

  const tipoFiltro =
    document.getElementById("tipoAgendaInline")?.value || "todos";

  const campoFiltro =
    normalizarBuscaAgendaInline(
      document.getElementById("campoAgendaInline")?.value || ""
    );

  const busca =
    normalizarBuscaAgendaInline(
      document.getElementById("buscaAgendaInline")?.value || ""
    );

  let jogos =
    agendaDados.filter(jogo => {
      return (
        String(jogo.data_agendamento || "").slice(0, 10) === dataFiltro &&
        jogo.status_jogo !== "cancelado"
      );
    });

  if (campoFiltro) {
    jogos = jogos.filter(jogo => {
      return normalizarBuscaAgendaInline(jogo.local_recurso) === campoFiltro;
    });
  }

  if (tipoFiltro === "mensalista") {
    jogos = jogos.filter(jogo => jogoEhMensalAgenda(jogo));
  }

  if (tipoFiltro === "evento" || tipoFiltro === "campeonato") {
    jogos = jogos.filter(jogo => String(jogo.tipo_jogo || "") === tipoFiltro);
  }

  if (tipoFiltro === "livres") {
    return [];
  }

  if (busca) {
    jogos = jogos.filter(jogo => {
      const jogadores =
        (jogadoresPorAgenda[jogo.id] || []).filter(j => j.removido !== true);

      const texto =
        normalizarBuscaAgendaInline([
          jogo.cliente_nome,
          jogo.local_recurso,
          jogo.tipo_jogo,
          jogo.recorrencia,
          jogo.status_jogo,
          formatarHora(jogo.hora_inicio),
          formatarHora(jogo.hora_fim),
          jogadores.map(j => j.nome).join(" ")
        ].join(" "));

      return texto.includes(busca);
    });
  }

  return jogos.map(jogo => ({
    livre: false,
    jogo
  }));
}

function renderizarAgendaInline() {
  const tbody = document.getElementById("agendaInlineTabela");
  if (!tbody) return;

  const tipoFiltro =
    document.getElementById("tipoAgendaInline")?.value || "todos";

  let linhas = [];

  if (tipoFiltro === "livres") {
    linhas = criarLinhasLivresAgendaInline();
  } else if (tipoFiltro === "todos") {
    linhas = [
      ...criarLinhasJogosAgendaInline(),
      ...criarLinhasLivresAgendaInline()
    ];
  } else {
    linhas = criarLinhasJogosAgendaInline();
  }

  linhas.sort((a, b) => {
    const horaA = a.livre ? a.inicio : formatarHora(a.jogo?.hora_inicio);
    const horaB = b.livre ? b.inicio : formatarHora(b.jogo?.hora_inicio);

    const campoA = a.livre ? a.campo : a.jogo?.local_recurso || "";
    const campoB = b.livre ? b.campo : b.jogo?.local_recurso || "";

    return `${horaA} ${campoA}`.localeCompare(`${horaB} ${campoB}`);
  });

  if (!linhas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="agenda-inline-empty">
          Nenhum horário encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML =
    linhas.map(linha => {
      if (linha.livre) {
        return criarLinhaLivreAgendaInline(linha);
      }

      return criarLinhaJogoAgendaInline(linha.jogo);
    }).join("");

  tbody
    .querySelectorAll(".btn-agenda-inline-ver")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        abrirJogo(btn.dataset.id);
      });
    });

  tbody
    .querySelectorAll(".btn-agenda-inline-novo")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        abrirNovoJogo();

        document.getElementById("dataAgendamento").value =
          document.getElementById("filtroData")?.value || hojeISOAgenda();

        document.getElementById("localRecurso").value =
          btn.dataset.campo || "";

        document.getElementById("horaInicio").value =
          btn.dataset.inicio || "";

        document.getElementById("horaFim").value =
          btn.dataset.fim || "";
      });
    });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function criarLinhaLivreAgendaInline(linha) {
  return `
    <tr class="agenda-inline-row agenda-inline-livre">
      <td>
        <strong>${linha.horario}</strong>
        <small>${linha.duracao === 90 ? "1h30" : "1h"}</small>
      </td>

      <td>${linha.campo || "-"}</td>
      <td>—</td>

      <td>
        <span class="agenda-inline-badge livre">Livre</span>
      </td>

      <td>—</td>
      <td>—</td>
      <td>—</td>

      <td class="right">
        <button
          type="button"
          class="agenda-inline-action novo btn-agenda-inline-novo"
          data-campo="${linha.campo}"
          data-inicio="${linha.inicio}"
          data-fim="${linha.fim}"
        >
          <i data-lucide="plus" width="15" height="15"></i>
          Novo jogo
        </button>
      </td>
    </tr>
  `;
}

function criarLinhaJogoAgendaInline(jogo) {
  const jogadores =
    (jogadoresPorAgenda[jogo.id] || []).filter(j => j.removido !== true);

  const status = calcularStatusVisual(jogo);
  const mensalidade = buscarMensalidadeAgenda(jogo);
  const ehMensal = jogoEhMensalAgenda(jogo);

  const tipoTexto =
    ehMensal
      ? "Mensal"
      : jogo.tipo_jogo === "evento"
        ? "Evento"
        : jogo.tipo_jogo === "campeonato"
          ? "Campeonato"
          : "Avulso";

  const pagamentoTexto =
    ehMensal
      ? (
          mensalidade?.status === "pago"
            ? "Mensalidade paga"
            : "Mensalidade pendente"
        )
      : (
          jogadores.some(j => !j.pago && Number(j.valor || 0) > 0)
            ? "Pendente"
            : "Sem pendência"
        );

  const pagamentoClasse =
    pagamentoTexto.toLowerCase().includes("pendente")
      ? "pendente"
      : "pago";

  return `
    <tr class="agenda-inline-row">
      <td>
        <strong>${formatarHora(jogo.hora_inicio)} - ${formatarHora(jogo.hora_fim)}</strong>
      </td>

      <td>${jogo.local_recurso || "-"}</td>

      <td>
        <strong>${jogo.cliente_nome || "-"}</strong>
      </td>

      <td>
        <span class="agenda-inline-badge tipo">
          ${tipoTexto}
        </span>
      </td>

      <td>
        <span class="agenda-inline-status status-${status}">
          ${status === "cobranca" ? "Cobrança" : status}
        </span>
      </td>

      <td>${jogadores.length}</td>

      <td>
        <span class="agenda-inline-pagamento ${pagamentoClasse}">
          ${pagamentoTexto}
        </span>
      </td>

      <td class="right">
        <button
          type="button"
          class="agenda-inline-action btn-agenda-inline-ver"
          data-id="${jogo.id}"
          title="Visualizar jogo"
        >
          <i data-lucide="eye" width="16" height="16"></i>
        </button>
      </td>
    </tr>
  `;
}

function renderizarAgendaInline() {
  const tbody =
    document.getElementById("agendaInlineTabela");

  if (!tbody) return;

  const tipoFiltro =
    document.getElementById("tipoAgendaInline")?.value || "todos";

  let linhas = [];

  if (tipoFiltro === "livres") {
    linhas = criarLinhasLivresAgendaInline();
  } else if (tipoFiltro === "todos") {
    linhas = [
      ...criarLinhasJogosAgendaInline(),
      ...criarLinhasLivresAgendaInline()
    ];
  } else {
    linhas = criarLinhasJogosAgendaInline();
  }

  linhas.sort((a, b) => {
    const horaA =
      a.livre
        ? a.inicio
        : formatarHora(a.jogo?.hora_inicio);

    const horaB =
      b.livre
        ? b.inicio
        : formatarHora(b.jogo?.hora_inicio);

    const campoA =
      a.livre
        ? a.campo
        : a.jogo?.local_recurso || "";

    const campoB =
      b.livre
        ? b.campo
        : b.jogo?.local_recurso || "";

    return `${horaA} ${campoA}`.localeCompare(`${horaB} ${campoB}`);
  });

  if (!linhas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="agenda-inline-empty">
          Nenhum horário encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML =
    linhas.map(linha => {
      if (linha.livre) {
        return criarLinhaLivreAgendaInline(linha);
      }

      return criarLinhaJogoAgendaInline(linha.jogo);
    }).join("");

  tbody
    .querySelectorAll(".btn-agenda-inline-ver")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        abrirJogo(btn.dataset.id);
      });
    });

  tbody
    .querySelectorAll(".btn-agenda-inline-novo")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        abrirNovoJogo();

        document.getElementById("dataAgendamento").value =
          document.getElementById("filtroData")?.value || hojeISOAgenda();

        document.getElementById("localRecurso").value =
          btn.dataset.campo || "";

        document.getElementById("horaInicio").value =
          btn.dataset.inicio || "";

        document.getElementById("horaFim").value =
          btn.dataset.fim || "";
      });
    });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function criarLinhaLivreAgendaInline(linha) {
  return `
    <tr class="agenda-inline-row agenda-inline-livre">
      <td>
        <strong>${linha.horario}</strong>
        <small>${linha.duracao === 90 ? "1h30" : "1h"}</small>
      </td>

      <td>${linha.campo || "-"}</td>

      <td>—</td>

      <td>
        <span class="agenda-inline-badge livre">Livre</span>
      </td>

      <td>—</td>

      <td>—</td>

      <td>—</td>

      <td class="right">
        <button
          type="button"
          class="agenda-inline-action novo btn-agenda-inline-novo"
          data-campo="${linha.campo}"
          data-inicio="${linha.inicio}"
          data-fim="${linha.fim}"
        >
          <i data-lucide="plus" width="15" height="15"></i>
          Novo jogo
        </button>
      </td>
    </tr>
  `;
}

function criarLinhaJogoAgendaInline(jogo) {
  const jogadores =
    (jogadoresPorAgenda[jogo.id] || [])
      .filter(j => j.removido !== true);

  const status =
    calcularStatusVisual(jogo);

  const mensalidade =
    buscarMensalidadeAgenda(jogo);

  const ehMensal =
    jogoEhMensalAgenda(jogo);

  const tipoTexto =
    ehMensal
      ? "Mensal"
      : jogo.tipo_jogo === "evento"
        ? "Evento"
        : jogo.tipo_jogo === "campeonato"
          ? "Campeonato"
          : "Avulso";

  const pagamentoTexto =
    ehMensal
      ? (
          mensalidade?.status === "pago"
            ? "Mensalidade paga"
            : "Mensalidade pendente"
        )
      : (
          jogadores.some(j => !j.pago && Number(j.valor || 0) > 0)
            ? "Pendente"
            : "Sem pendência"
        );

  const pagamentoClasse =
    pagamentoTexto.toLowerCase().includes("pendente")
      ? "pendente"
      : "pago";

  return `
    <tr class="agenda-inline-row">
      <td>
        <strong>${formatarHora(jogo.hora_inicio)} - ${formatarHora(jogo.hora_fim)}</strong>
      </td>

      <td>${jogo.local_recurso || "-"}</td>

      <td>
        <strong>${jogo.cliente_nome || "-"}</strong>
      </td>

      <td>
        <span class="agenda-inline-badge tipo">
          ${tipoTexto}
        </span>
      </td>

      <td>
        <span class="agenda-inline-status status-${status}">
          ${status === "cobranca" ? "Cobrança" : status}
        </span>
      </td>

      <td>${jogadores.length}</td>

      <td>
        <span class="agenda-inline-pagamento ${pagamentoClasse}">
          ${pagamentoTexto}
        </span>
      </td>

      <td class="right">
        <button
          type="button"
          class="agenda-inline-action btn-agenda-inline-ver"
          data-id="${jogo.id}"
          title="Visualizar jogo"
        >
          <i data-lucide="eye" width="16" height="16"></i>
        </button>
      </td>
    </tr>
  `;
}