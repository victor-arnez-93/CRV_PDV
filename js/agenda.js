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
    .getElementById("btnHorariosFixos")
    ?.addEventListener("click", abrirModalHorariosFixos);

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

  aplicarFiltrosAgenda();
}

function voltarHojeAgenda() {
  const input = document.getElementById("filtroData");
  if (!input) return;

  input.value = hojeISOAgenda();

  aplicarFiltrosAgenda();
}

// ======================================================
// MODAL HORÁRIOS FIXOS
// ======================================================

function abrirModalHorariosFixos() {
  const modal = document.getElementById("modalHorariosFixos");

  if (!modal) return;

  modal.style.display = "flex";

  const busca =
    document.getElementById("buscaHorariosFixos");

  if (busca) {
    busca.value = "";
  }

  configurarAbasHorariosFixos();

    renderizarHorariosFixos("hoje");

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

function renderizarHorariosFixos(tipo = "todos") {
  const lista = document.getElementById("listaHorariosFixos");

  if (!lista) return;

  let jogos = [...agendaDados];

    const termoBusca =
    String(document.getElementById("buscaHorariosFixos")?.value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const diasSemanaAgenda = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado"
  ];

  const hoje =
    hojeISOAgenda();

  jogos = jogos.filter(jogo => {
    if (jogo.status_jogo === "cancelado") return false;
    if (jogo.status_jogo === "fechado") return false;

    if (tipo === "hoje") {
      const dataJogo =
        String(jogo.data_agendamento || "").slice(0, 10);

      if (dataJogo !== hoje) {
        return false;
      }
    } else if (tipo !== "todos" && String(jogo.tipo_jogo || "") !== tipo) {
      return false;
    }

    if (!termoBusca) {
      return true;
    }

    const jogadores =
      (jogadoresPorAgenda[jogo.id] || [])
        .filter(j => j.removido !== true);

    const nomesJogadores =
      jogadores
        .map(j => j.nome || "")
        .join(" ");

    const diaSemana =
      diasSemanaAgenda[
        obterDiaSemanaAgenda(jogo.data_agendamento)
      ] || "";

    const horarioInicio =
      formatarHora(jogo.hora_inicio);

    const horarioFim =
      formatarHora(jogo.hora_fim);

    const textoBusca = [
      jogo.cliente_nome,
      jogo.local_recurso,
      jogo.tipo_jogo,
      jogo.recorrencia,
      jogo.status_jogo,
      nomesJogadores,
      diaSemana,
      horarioInicio,
      horarioFim,
      `${horarioInicio} ${horarioFim}`,
      `${horarioInicio}-${horarioFim}`,
      `${horarioInicio} as ${horarioFim}`,
      jogo.recorrencia === "mensal" || jogo.tipo_jogo === "mensalista"
        ? `toda ${diaSemana}`
        : ""
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return textoBusca.includes(termoBusca);
  });

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

    const dataFormatada =
      String(jogo.data_agendamento || "").slice(0, 10).split("-").reverse().join("/");

          const diasSemanaAgenda = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado"
    ];

    const diaSemana =
      diasSemanaAgenda[
        obterDiaSemanaAgenda(jogo.data_agendamento)
      ];

    const horarioTexto =
      jogo.recorrencia === "mensal" || jogo.tipo_jogo === "mensalista"
        ? `Toda ${diaSemana}, das ${formatarHora(jogo.hora_inicio)} às ${formatarHora(jogo.hora_fim)}`
        : `${dataFormatada} • ${formatarHora(jogo.hora_inicio)} - ${formatarHora(jogo.hora_fim)}`;

    return `
      <div class="agenda-horario-item">

        <div class="agenda-horario-main">

          <strong>${jogo.cliente_nome || "-"}</strong>

          <span>
            ${horarioTexto}
          </span>

          <small>
            ${jogo.local_recurso || "-"}
            •
            ${jogo.tipo_jogo || "avulso"}
            •
            ${jogadores.length} jogador(es)
          </small>

        </div>

        <div class="agenda-horario-badge">
          ${jogo.recorrencia === "mensal" ? "Mensal" : jogo.tipo_jogo || "Avulso"}
        </div>

      </div>
    `;
  }).join("");
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
    const jaExiste =
      agendaDados.some(jogo => {
        return (
          String(jogo.recorrencia_origem_id || "") === String(modelo.id) &&
          String(jogo.data_agendamento || "").slice(0, 10) === dataAlvo
        );
      });

    if (jaExiste) continue;

    const payloadOcorrencia = {
      empresa_id: APP_EMPRESA_ID,
      cliente_nome: modelo.cliente_nome,
      cliente_telefone: modelo.cliente_telefone || null,
      data_agendamento: dataAlvo,
      hora_inicio: modelo.hora_inicio,
      hora_fim: modelo.hora_fim,
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
          removido: false
        }));

      await sb
        .from("agenda_jogadores")
        .insert(jogadoresNovaOcorrencia);
    }
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

    if (jogadoresError) {
      throw jogadoresError;
    }

    agendaDados = agenda || [];

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

      agendaDados = agendaAtualizada || [];
      jogadoresPorAgenda = agruparJogadores(jogadoresAtualizados || []);
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
    "recorrenciaJogo",
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
    const nome = row.querySelector(".jogador-nome");
    const valor = row.querySelector(".jogador-valor");
    const pagamento = row.querySelector(".jogador-pagamento");
    const pago = row.querySelector(".jogador-pago");
    const remover = row.querySelector(".agenda-remover-jogador");

    if (nome) nome.disabled = !podeEditarAgenda;

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
      pago.closest("label")?.style.setProperty("display", "none");
    }

    if (remover) {
      remover.style.display = podeEditarAgenda ? "flex" : "none";
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
  const lista = document.getElementById("listaJogadores");
  if (!lista) return;

  document.getElementById("controleMarcarTodosJogadores")?.remove();

  return;

  const controle = document.createElement("div");
  controle.id = "controleMarcarTodosJogadores";
  controle.className = "agenda-marcar-todos-jogadores";

  controle.innerHTML = `
    <input
      class="input"
      id="valorTodosJogadores"
      placeholder="Valor para todos"
    >

    <button
      type="button"
      class="btn btn-primary"
      id="btnMarcarTodosJogadores"
    >
      Aplicar a todos
    </button>
  `;

  lista.parentElement.insertBefore(controle, lista);

  const inputValorTodos = document.getElementById("valorTodosJogadores");

  aplicarMascaraMoedaAgenda(inputValorTodos);

  document
    .getElementById("btnMarcarTodosJogadores")
    .addEventListener("click", () => {
      const valor = inputValorTodos.value;

      if (!valor) {
        mostrarErro("Informe o valor para aplicar em todos os jogadores.");
        return;
      }

      document.querySelectorAll(".agenda-jogador-row").forEach(row => {
        const inputValor = row.querySelector(".jogador-valor");
        const checkPago = row.querySelector(".jogador-pago");

        if (inputValor) {
          inputValor.value = valor;
        }

        if (checkPago) {
          checkPago.checked = true;
        }
      });

      atualizarTotalizadorModal();

      mostrarSucesso("Valor aplicado e jogadores marcados como pagos.");
    });
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

      if (jogador.id) {
    row.dataset.jogadorId = jogador.id;
  }

  row.innerHTML = `
    <input
      class="input jogador-nome"
      placeholder="Nome do jogador"
      value="${jogador.nome || ""}"
    >

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

  const inputNomeJogador = row.querySelector(".jogador-nome");

  if (inputNomeJogador) {
    inputNomeJogador.addEventListener("blur", () => {
      inputNomeJogador.value = formatarNomeProprioAgenda(inputNomeJogador.value);
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
      id:
        row.dataset.jogadorId || null,

      nome:
        row.querySelector(
          ".jogador-nome"
        )?.value.trim(),

      time_jogador:
        row.querySelector(".jogador-time")?.value || null,

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

  const recorrenciaNova =
    document.getElementById(
      "recorrenciaJogo"
    )?.value || "avulso";

  const tipoNovo =
    document.getElementById(
      "tipoJogo"
    )?.value || "avulso";

  const novoEhMensal =
    recorrenciaNova === "mensal" ||
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
  pago: jogador.pago === true
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
            removido: false
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
