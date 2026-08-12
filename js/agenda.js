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
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);

  return String(valor || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((parte, index) => {
      if (index > 0 && minusculas.has(parte)) return parte;

      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(" ");
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

function calcularVencimentoCompetenciaAgenda(competencia, diaPagamento) {
  const [ano, mes] = String(competencia || "").split("-").map(Number);

  if (!ano || !mes) return null;

  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaSeguro = Math.min(
    Math.max(Number(diaPagamento || 1), 1),
    ultimoDia
  );

  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
}

function somarDiasAgenda(dataISO, dias) {
  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function formatarDataCurtaAgenda(dataISO) {
  if (!dataISO) return "-";

  const partes = String(dataISO).slice(0, 10).split("-");
  if (partes.length !== 3) return dataISO;

  return `${partes[2]}/${partes[1]}`;
}

function formatarDataCompletaAgenda(dataISO) {
  if (!dataISO) return "-";

  const partes = String(dataISO).slice(0, 10).split("-");
  if (partes.length !== 3) return dataISO;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function obterPagamentoPrevistoMensalidadeAgenda(mensalidade, competencia) {
  const vencimentoRegistrado = String(
    mensalidade?.data_vencimento || ""
  ).slice(0, 10);

  if (vencimentoRegistrado) return vencimentoRegistrado;

  return calcularVencimentoCompetenciaAgenda(
    mensalidade?.competencia || competencia,
    mensalidade?.dia_pagamento || 1
  );
}

function mensalidadeVencidaParaAvisoAgenda(jogo, mensalidade) {
  if (!jogo || !mensalidade) return false;
  if (mensalidade.status === "pago") return false;

  const vencimentoCiclo = String(mensalidade.data_vencimento || "").slice(0, 10);

  if (vencimentoCiclo) {
    return hojeISOAgenda() >= vencimentoCiclo;
  }

  const dia = Number(
    mensalidade.dia_pagamento ||
    jogo.dia_pagamento_mensal ||
    0
  );
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
  const dataJogo = String(
    jogo.horario_original_data ||
    jogo.data_agendamento ||
    hojeISOAgenda()
  ).slice(0, 10);

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

function jogadorPagoAgenda(jogador) {
  return (
    jogador.pago === true ||
    jogador.status_pagamento === "pago_direto" ||
    jogador.status_pagamento === "pago_em_comanda"
  );
}

function jogadorEmComandaAgenda(jogador) {
  return jogador.status_pagamento === "em_comanda" || !!jogador.comanda_id;
}

function jogadorPendenteAgenda(jogador) {
  return !jogadorPagoAgenda(jogador) && !jogadorEmComandaAgenda(jogador);
}

function obterResumoPagamentoAgenda(jogo) {
  const todosJogadores = (jogadoresPorAgenda[jogo.id] || [])
    .filter(j => j.removido !== true);

  // Mensalistas pertencem à mensalidade do ciclo e nunca entram como
  // cobrança individual em cada ocorrência. Aqui ficam somente os avulsos.
  const jogadores = todosJogadores.filter(j => {
    return !(
      j.mensalista === true &&
      j.cobrar_no_jogo === false
    );
  });

  const total = todosJogadores.length;
  const totalCobravel = jogadores.length;
  const pagos = jogadores.filter(jogadorPagoAgenda).length;
  const comandas = jogadores.filter(jogadorEmComandaAgenda).length;
  const pendentes = jogadores.filter(jogadorPendenteAgenda).length;

  const recebido = jogadores
    .filter(jogadorPagoAgenda)
    .reduce((acc, j) => acc + Number(j.valor || 0), 0);

  const emComanda = jogadores
    .filter(jogadorEmComandaAgenda)
    .reduce((acc, j) => acc + Number(j.valor || 0), 0);

  const pendente = jogadores
    .filter(jogadorPendenteAgenda)
    .reduce((acc, j) => acc + Number(j.valor || 0), 0);

  const ehMensal = jogoEhMensalAgenda(jogo);
  const mensalidade = ehMensal ? buscarMensalidadeAgenda(jogo) : null;
  const mensalidadePaga = String(mensalidade?.status || "").toLowerCase() === "pago";

  let texto = "Pagamento pendente";
  let classe = "pendente";

  if (ehMensal && !mensalidade) {
    texto = "Mensalidade não localizada";
    classe = "pendente";
  } else if (ehMensal && !mensalidadePaga) {
    texto = pagos > 0 || comandas > 0
      ? "Mensalidade e avulsos pendentes"
      : "Mensalidade pendente";
    classe = pagos > 0 || comandas > 0 ? "parcial" : "pendente";
  } else if (totalCobravel === 0 || (pendentes === 0 && comandas === 0)) {
    texto = "Pagamento quitado";
    classe = "pago";
  } else if (pagos > 0 || comandas > 0) {
    texto = "Pagamento parcial";
    classe = "parcial";
  }

  return {
    total,
    totalCobravel,
    pagos,
    comandas,
    pendentes,
    recebido,
    emComanda,
    pendente,
    mensalidade,
    mensalidadePaga,
    texto,
    classe
  };
}

function ordenarJogadoresAgenda(jogadores, responsavel = "") {
  const normalizar = valor => normalizarBuscaAgendaInline(valor || "");

  return [...jogadores].sort((a, b) => {
    const aResp = normalizar(a.nome) === normalizar(responsavel);
    const bResp = normalizar(b.nome) === normalizar(responsavel);

    if (aResp && !bResp) return -1;
    if (!aResp && bResp) return 1;

    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

// ======================================================
// ESTADO
// ======================================================
let agendaDados = [];
let jogadoresPorAgenda = {};
let mensalidadesAgenda = [];
let excecoesAgenda = [];

let camposArena = [];
let configuracaoAgenda = null;
let valoresPadraoAgenda = [];

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
    .getElementById("btnConfigGradeInline")
    ?.addEventListener("click", alternarConfigGradeInline);

    garantirBotaoSemanaAgenda();

  document
    .getElementById("btnAdicionarCampoArena")
    ?.addEventListener("click", adicionarCampoArenaInline);

    document
  .getElementById("btnAdicionarValorAgenda")
  ?.addEventListener("click", adicionarValorPadraoAgendaInline);

    document
  .getElementById("btnSalvarConfigAgendaInline")
  ?.addEventListener("click", salvarConfiguracaoAgendaInlineCompleta);

  document
    .getElementById("buscaAgendaInline")
    ?.addEventListener("input", renderizarAgendaInline);

  document
    .getElementById("tipoAgendaInline")
    ?.addEventListener("change", renderizarAgendaInline);

  document
    .getElementById("campoAgendaInline")
    ?.addEventListener("change", renderizarAgendaInline);

  [
    "configHoraAbertura",
    "configHoraFechamento",
    "configIntervaloInicio",
    "configDuracoesJogo"
  ].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener("change", async () => {
        await salvarConfigGradeAgenda();

        if (agendaInlineAberta) {
          popularCamposAgendaInline();
          renderizarAgendaInline();
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
      await carregarAgenda();

      if (agendaInlineAberta) {
        popularCamposAgendaInline();
        renderizarAgendaInline();
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
  ?.addEventListener("change", () => {
    alternarCamposMensais();

    document.getElementById("valorPrevisto").value = "";
    document.getElementById("valorMensal").value = "";

    aplicarValorPadraoAgendaNoModal();
  });

  ["dataAgendamento", "horaInicio", "horaFim"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      alternarCamposMensais();

      if (id !== "dataAgendamento") {
        aplicarValorPadraoAgendaNoModal();
      }
    });
  });

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

async function alterarDiaAgenda(delta) {
  const input = document.getElementById("filtroData");
  if (!input) return;

  const dataAtual = input.value || hojeISOAgenda();
  const data = new Date(`${dataAtual}T12:00:00`);

  data.setDate(data.getDate() + delta);

  input.value = data.toISOString().slice(0, 10);

await sincronizarAgendaVisual();
}

async function voltarHojeAgenda() {
  const input = document.getElementById("filtroData");
  if (!input) return;

  input.value = hojeISOAgenda();

await sincronizarAgendaVisual();
}

function normalizarLocalAgenda(local) {
  return String(local || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^csmpo/i, "campo");
}

function obterLocaisAgenda() {
  if (camposArena.length) {
    return camposArena
      .filter(campo => campo.ativo !== false)
      .sort((a, b) => {
        const ordemA = Number(a.ordem || 0);
        const ordemB = Number(b.ordem || 0);

        if (ordemA !== ordemB) return ordemA - ordemB;

        return String(a.nome || "").localeCompare(String(b.nome || ""));
      })
      .map(campo => campo.nome)
      .filter(Boolean);
  }

  const locais = agendaDados
    .map(j => normalizarLocalAgenda(j.local_recurso))
    .filter(Boolean);

  return [...new Set(locais)].sort();
}

function obterCampoArenaPorNome(nome) {
  const normalizado = normalizarBuscaAgendaInline(nome);

  return camposArena.find(campo => {
    return normalizarBuscaAgendaInline(campo.nome) === normalizado;
  }) || null;
}

function popularSelectLocalRecurso(valorAtual = "") {
  const select = document.getElementById("localRecurso");
  if (!select) return;

  const valor = normalizarLocalAgenda(valorAtual || select.value || "");
  const camposAtivos = obterLocaisAgenda();

  const existeNosAtivos =
    camposAtivos.some(campo =>
      normalizarBuscaAgendaInline(campo) === normalizarBuscaAgendaInline(valor)
    );

  select.innerHTML = `
    <option value="">Selecione a quadra/campo</option>

    ${camposAtivos.map(campo => `
      <option value="${campo}">
        ${campo}
      </option>
    `).join("")}

    ${
      valor && !existeNosAtivos
        ? `
          <option value="${valor}">
            ${valor} (desativado)
          </option>
        `
        : ""
    }
  `;

  select.value = valor;
}

function minutosParaHoraAgenda(minutos) {
  const total =
    ((Number(minutos || 0) % 1440) + 1440) % 1440;

  const h = Math.floor(total / 60);
  const m = total % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function gerarSlotsPadraoArena() {
const abertura = horaParaMinutos(
  document.getElementById("configHoraAbertura")?.value ??
  configuracaoAgenda?.hora_abertura ??
  "08:00"
);

let fechamento = horaParaMinutos(
  document.getElementById("configHoraFechamento")?.value ??
  configuracaoAgenda?.hora_fechamento ??
  "23:45" // apenas fallback quando ainda não existir configuração
);

// expediente atravessando meia-noite
// Ex:
// 18:00 → 05:00
// 08:00 → 00:00
// 22:00 → 02:00
if (fechamento <= abertura) {
  fechamento += 1440;
}

  const passoMinutos =
    Number(
      document.getElementById("configIntervaloInicio")?.value ||
      configuracaoAgenda?.intervalo_minutos ||
      30
    );

  let duracoes =
    configuracaoAgenda?.duracoes_minutos || [60, 90];

  const duracoesInput =
    document.getElementById("configDuracoesJogo")?.value;

  if (duracoesInput) {
    duracoes = String(duracoesInput)
      .split(",")
      .map(Number)
      .filter(Boolean);
  }

  const slots = [];

  for (let inicio = abertura; inicio < fechamento; inicio += passoMinutos) {
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

function carregarConfigGradeAgenda() {
  document.getElementById("configHoraAbertura").value =
    configuracaoAgenda?.hora_abertura?.slice(0, 5) || "08:00";

  document.getElementById("configHoraFechamento").value =
    configuracaoAgenda?.hora_fechamento?.slice(0, 5) || "23:45";

  document.getElementById("configIntervaloInicio").value =
    String(configuracaoAgenda?.intervalo_minutos || 30);

  document.getElementById("configDuracoesJogo").value =
    Array.isArray(configuracaoAgenda?.duracoes_minutos)
      ? configuracaoAgenda.duracoes_minutos.join(",")
      : "60,90";
}

async function salvarConfigGradeAgenda() {
  const duracoes =
    String(document.getElementById("configDuracoesJogo")?.value || "60,90")
      .split(",")
      .map(Number)
      .filter(Boolean);

const payload = {
  empresa_id: APP_EMPRESA_ID,
  hora_abertura: document.getElementById("configHoraAbertura")?.value || "08:00",
  hora_fechamento: document.getElementById("configHoraFechamento")?.value || "23:45",
  intervalo_minutos: Number(document.getElementById("configIntervaloInicio")?.value || 30),
  duracoes_minutos: duracoes.length ? duracoes : [60, 90],
  atualizado_em: new Date().toISOString()
};

  const { data, error } = await sb
    .from("agenda_configuracao")
    .upsert([payload], {
      onConflict: "empresa_id"
    })
    .select("*")
    .single();

  if (error) {
    crvToast({
      titulo: "Erro",
      mensagem: error.message || "Erro ao salvar configuração da grade.",
      tipo: "error"
    });

    return;
  }

  configuracaoAgenda = data;

  renderizarAgendaInline();
}

function horarioConflitaComJogo(slotInicio, slotFim, jogo) {
  const inicioSlot = horaParaMinutos(slotInicio);
  const fimSlot = horaParaMinutos(slotFim);

  const inicioJogo = horaParaMinutos(jogo.hora_inicio);
  const fimJogo = horaParaMinutos(jogo.hora_fim);

  return inicioSlot < fimJogo && fimSlot > inicioJogo;
}

// ======================================================
// MODAL AVISO
// ======================================================
function abrirModalAviso({
  titulo = "Aviso",
  texto = "",
  confirmarTexto = "Entendi",
  secundarioTexto = "",
  mostrarCancelar = false,
  onConfirm = null,
  onSecondary = null,
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

  textoEl.innerHTML = texto;

}

  const btnConfirmar =
    document.getElementById("btnAvisoConfirmar");

  const btnCancelar =
    document.getElementById("btnAvisoCancelar");

  const btnSecundario =
    document.getElementById("btnAvisoSecundario");

  btnConfirmar.textContent = confirmarTexto;

  btnCancelar.style.display =
    mostrarCancelar
      ? "inline-flex"
      : "none";

  if (btnSecundario) {
    btnSecundario.textContent = secundarioTexto || "Outra ação";
    btnSecundario.style.display =
      secundarioTexto && typeof onSecondary === "function"
        ? "inline-flex"
        : "none";

    btnSecundario.onclick = () => {
      const motivo = campoMotivo
        ? document.getElementById("modalAvisoMotivo")?.value.trim() || ""
        : "";

      if (campoMotivo && !motivo) {
        document.getElementById("modalAvisoMotivo")?.focus();
        return;
      }

      fecharModalAviso();
      onSecondary(motivo);
    };
  }

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

async function gerarOcorrenciasMensaisParaData(dataAlvo) {
  if (
    !dataAlvo ||
    !empresaUsaAgendaEsportiva() ||
    navigator.onLine === false ||
    !window.sb
  ) {
    return;
  }

  const dataReferencia = String(dataAlvo).slice(0, 10);
  const ciclosAtivos = mensalidadesAgenda.filter(mensalidade => {
    const inicio = String(mensalidade.data_inicio || "").slice(0, 10);
    const fim = String(mensalidade.data_fim || "").slice(0, 10);

    return (
      mensalidade.status !== "cancelado" &&
      mensalidade.renovacao_status !== "cancelada" &&
      inicio &&
      fim &&
      dataReferencia >= inicio &&
      dataReferencia <= fim
    );
  });

  for (const mensalidade of ciclosAtivos) {
    const { error } = await sb.rpc("materializar_ciclo_mensal_agenda", {
      p_mensalidade_id: mensalidade.id
    });

    if (error) {
      console.warn("[AGENDA][MATERIALIZAR CICLO]", error);
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

  const {
  data: campos,
  error: camposError
} = await sb
  .from("arena_campos")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID)
  .eq("ativo", true)
  .order("ordem", { ascending: true })
  .order("nome", { ascending: true });

const {
  data: configAgenda,
  error: configAgendaError
} = await sb
  .from("agenda_configuracao")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID)
  .maybeSingle();

  const {
  data: valoresPadrao,
  error: valoresPadraoError
} = await sb
  .from("agenda_valores_padrao")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID)
  .eq("ativo", true)
  .order("ordem", { ascending: true })
  .order("duracao", { ascending: true });

if (camposError) {
  throw camposError;
}

if (configAgendaError) {
  throw configAgendaError;
}

if (valoresPadraoError) {
  throw valoresPadraoError;
}

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
camposArena = campos || [];
configuracaoAgenda = configAgenda || null;
valoresPadraoAgenda = valoresPadrao || [];

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

const { data: camposAtualizados } = await sb
  .from("arena_campos")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID)
  .eq("ativo", true)
  .order("ordem", { ascending: true })
  .order("nome", { ascending: true });

const { data: configAgendaAtualizada } = await sb
  .from("agenda_configuracao")
  .select("*")
  .eq("empresa_id", APP_EMPRESA_ID)
  .maybeSingle();

agendaDados = agendaAtualizada || [];
jogadoresPorAgenda = agruparJogadores(jogadoresAtualizados || []);
mensalidadesAgenda = mensalidadesAtualizadas || [];
camposArena = camposAtualizados || [];
configuracaoAgenda = configAgendaAtualizada || configuracaoAgenda;
}

    aplicarFiltrosAgenda();

  } catch (err) {

    console.error("[AGENDA]", err);

  }

}

async function sincronizarAgendaVisual() {
  await carregarAgenda();

  if (agendaInlineAberta) {
    popularCamposAgendaInline();
    renderizarAgendaInline();
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

  const resumoPagamento = obterResumoPagamentoAgenda(jogo);

  const hoje = hojeISOAgenda();
  const dataJogo = String(jogo.data_agendamento || "").slice(0, 10);

  if (dataJogo > hoje) return "agendado";
  if (dataJogo < hoje) {
    return (resumoPagamento.total > 0 || jogoEhMensalAgenda(jogo)) &&
      resumoPagamento.classe === "pago"
      ? "fechado"
      : "cobranca";
  }

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const inicio = horaParaMinutos(jogo.hora_inicio);
  const fim = horaParaMinutos(jogo.hora_fim || jogo.hora_inicio);

  if (minutosAgora < inicio) return "agendado";
  if (minutosAgora >= inicio && minutosAgora < fim) return "andamento";

  return (resumoPagamento.total > 0 || jogoEhMensalAgenda(jogo)) &&
    resumoPagamento.classe === "pago"
    ? "fechado"
    : "cobranca";
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
  .querySelectorAll(".btn-renovar-mensalidade")
  .forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      renovarMensalidadeAgenda(btn.dataset.id);
    });
  });
}

function criarCardJogo(jogo) {

  const status =
    calcularStatusVisual(jogo);

  const jogadores =
    (jogadoresPorAgenda[jogo.id] || [])
      .filter(j => j.removido !== true);

const resumoPagamento = obterResumoPagamentoAgenda(jogo);

const recebido = resumoPagamento.recebido;
const pendente = resumoPagamento.pendente + resumoPagamento.emComanda;

        const mensalidade =
  buscarMensalidadeAgenda(jogo);

const ehMensal =
  jogoEhMensalAgenda(jogo);

const vencimentoMensal =
  jogo.dia_pagamento_mensal || null;

const statusMensalidade =
  mensalidade?.status || null;

const cicloMensal =
  mensalidade
    ? calcularIndiceJogoMensal(jogo, mensalidade)
    : null;

const textoCicloMensal =
  cicloMensal
    ? `Jogo ${cicloMensal.atual}/${cicloMensal.total}`
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

      ${
        status === "cancelado"
          ? `<div class="agenda-card-aviso cancelado">
               Jogo cancelado: ${jogo.motivo_cancelamento || "motivo não informado"}
             </div>`
          : jogo.horario_alterado === true
            ? `<div class="agenda-card-aviso alterado">
                 Horário alterado somente nesta ocorrência
                 ${jogo.motivo_alteracao_horario ? ` · ${jogo.motivo_alteracao_horario}` : ""}
               </div>`
            : ""
      }

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
          resumoPagamento.classe !== "pago"
            ? `
              <div class="agenda-card-cobranca-status pendente">
                ⚠ ${resumoPagamento.texto}
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
          <span>${ehMensal ? "Avulsos recebidos" : "Recebido"}</span>
          <strong>${fmtAgenda(recebido)}</strong>
        </div>

        <div class="agenda-card-total">
          <span>${ehMensal ? "Avulsos pendentes" : "Pendente"}</span>
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

${
  ehMensal &&
  mensalidade?.status === "pago" &&
  cicloMensal &&
  cicloMensal.atual >= cicloMensal.total &&
  mensalidade.renovacao_status !== "renovada"
    ? `
      <button
        class="btn-renovar-mensalidade"
        data-id="${mensalidade.id}"
        title="Renovar próximo mês"
        type="button"
      >
        <i data-lucide="rotate-cw"></i>
      </button>
    `
    : ""
}

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

popularSelectLocalRecurso();

document.getElementById(
  "modalReservaTitulo"
).textContent = "Novo horário";

  document.getElementById(
    "statusJogo"
  ).value = "agendado";

document.getElementById(
  "dataAgendamento"
).value = hojeISOAgenda();

aplicarValorPadraoAgendaNoModal();

alternarCamposMensais();

aplicarModoModal();

  abrirModalJogo();

}

function abrirJogo(id, opcoes = {}) {

  const jogo =
    agendaDados.find(
      j => String(j.id) === String(id)
    );

  if (!jogo) return;

  agendaAtualId = jogo.id;

  limparModal();

  const status =
    calcularStatusVisual(jogo);

  if (status === "cobranca" && opcoes.forcarEdicao !== true) {
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

popularSelectLocalRecurso(jogo.local_recurso || "");

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
  ordenarJogadoresAgenda(
    jogadoresPorAgenda[jogo.id] || [],
    jogo.cliente_nome
  );

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

    const jogoAtualModal =
      agendaDados.find(j => String(j.id) === String(agendaAtualId));

    const mensalidadeAtual =
      jogoAtualModal
        ? buscarMensalidadeAgenda(jogoAtualModal)
        : null;

    const ehMensalAtual =
      jogoAtualModal
        ? jogoEhMensalAgenda(jogoAtualModal)
        : false;

    if (
      ehMensalAtual &&
      mensalidadeAtual?.renovacao_status === "renovada"
    ) {

      const proximoMes =
        obterProximaCompetenciaAgenda(mensalidadeAtual.competencia);

      titulo.textContent =
        `Renovado para ${formatarCompetenciaMensalidade(proximoMes)}`;

      subtitulo.textContent =
        "Jogo fechado no caixa. O próximo mês já foi criado.";

    } else {

      titulo.textContent = "Jogo fechado";
      subtitulo.textContent = "Jogo já finalizado no caixa.";

    }

  } else if (modoCancelado) {

    titulo.textContent = "Jogo cancelado";
    subtitulo.textContent = "Jogo cancelado.";

  } else {

    titulo.textContent = "Editar jogo";
    subtitulo.textContent =
      "Ajuste horário, responsável e jogadores. A cobrança é feita no Caixa.";

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

  // A recorrência controla ciclo, mensalidade e forma de cobrança. Evita
  // conversões silenciosas de um jogo já criado entre mensal e avulso.
  const tipoJogo = document.getElementById("tipoJogo");
  if (tipoJogo && !modoNovo) {
    tipoJogo.disabled = true;
  }

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
  const origem = row.querySelector(".jogador-origem");
  const pagamento = row.querySelector(".jogador-pagamento");
  const pago = row.querySelector(".jogador-pago");
  const remover = row.querySelector(".agenda-remover-jogador");

  if (nome) nome.disabled = !podeEditarAgenda;

  const time = row.querySelector(".jogador-time");

  if (time) {
    time.disabled = !podeEditarAgenda;
  }

  if (origem) {
    origem.disabled = !podeEditarAgenda;
  }

  if (valor) {
    const jogadorEhAvulso = !origem || origem.value === "avulso";

    row.classList.toggle("jogador-avulso", jogadorEhAvulso);

    valor.disabled = !podeEditarAgenda || !jogadorEhAvulso;
    valor.style.display = jogadorEhAvulso ? "block" : "none";
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
      select.closest(".agenda-jogador-row")?.classList.toggle(
        "usa-times",
        usarTimes
      );
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

  const grupoValorPrevisto =
    document.getElementById("grupoValorPrevistoJogo");

  const boxAlteracao =
    document.getElementById("boxAlteracaoHorario");

  const infoCiclo =
    document.getElementById("infoCicloMensal");

  const jogoAtual = agendaDados.find(jogo => {
    return String(jogo.id) === String(agendaAtualId);
  });

  if (boxMensal) {
    boxMensal.classList.toggle(
      "ativo",
      ehMensal
    );
  }

  if (grupoValorPrevisto) {
    grupoValorPrevisto.style.display = ehMensal ? "none" : "grid";
  }

  if (ehMensal) {
    const valorPrevisto = document.getElementById("valorPrevisto");
    if (valorPrevisto) valorPrevisto.value = "";
  }

  if (boxAlteracao) {
    const mostrarAlteracao =
      ehMensal &&
      modoModalAgenda !== "novo" &&
      jogoAtual;

    boxAlteracao.classList.toggle("ativo", Boolean(mostrarAlteracao));

    const infoOriginal = document.getElementById("infoHorarioOriginal");

    if (infoOriginal && mostrarAlteracao) {
      const dataOriginal =
        jogoAtual.horario_original_data || jogoAtual.data_agendamento;
      const inicioOriginal =
        jogoAtual.horario_original_inicio || jogoAtual.hora_inicio;
      const fimOriginal =
        jogoAtual.horario_original_fim || jogoAtual.hora_fim;

      infoOriginal.textContent =
        `Horário original desta ocorrência: ${formatarDataCompletaAgenda(dataOriginal)} · ` +
        `${formatarHora(inicioOriginal)} às ${formatarHora(fimOriginal)}. ` +
        "Alterações de data ou hora afetam somente este jogo.";
    }
  }

  if (infoCiclo && ehMensal) {
    const dataBase =
      document.getElementById("dataAgendamento")?.value || hojeISOAgenda();
    const datas = obterDatasDoDiaAteFimDoMesAgenda(dataBase);

    infoCiclo.textContent = modoModalAgenda === "novo"
      ? `Ao salvar, ${datas.length} jogo(s) deste mesmo dia e horário serão fechados até o fim do mês: ${datas.map(formatarDataCurtaAgenda).join(" • ")}.`
      : "O elenco mensal é sincronizado nas ocorrências futuras deste ciclo. Convidados avulsos permanecem apenas neste jogo.";
  }
}

function obterDatasDoDiaAteFimDoMesAgenda(dataISO) {
  const base = new Date(`${String(dataISO || hojeISOAgenda()).slice(0, 10)}T12:00:00`);
  const diaSemana = base.getDay();
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0, 12);
  const datas = [];

  for (
    let data = new Date(base);
    data <= ultimoDia;
    data.setDate(data.getDate() + 1)
  ) {
    if (data.getDay() === diaSemana) {
      datas.push(data.toISOString().slice(0, 10));
    }
  }

  return datas;
}

// ======================================================
// LIMPAR
// ======================================================
function limparModal() {

  [
    "clienteNome",
    "clienteTelefone",
    "dataAgendamento",
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

  if (!el) return;

  el.textContent = msg;

  el.className =
    "agenda-feedback erro";

  el.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  el.focus?.();

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

  if (jogador.jogador_origem_id) {
    row.dataset.jogadorOrigemId = jogador.jogador_origem_id;
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

  row.querySelector(".jogador-origem")?.addEventListener("change", () => {
    aplicarModoModal();
    atualizarTotalizadorModal();
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

        jogador_origem_id:
          row.dataset.jogadorOrigemId || null,

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

let novoFim =
  horaParaMinutos(fim);

if (novoFim <= novoInicio) {
  novoFim += 1440;
}

  const datasNovas =
    novoEhMensal && !agendaAtualId
      ? obterDatasDoDiaAteFimDoMesAgenda(data)
      : [data];

  const jogoAtual = agendaDados.find(jogo => {
    return String(jogo.id) === String(agendaAtualId);
  });

  const origemCicloAtual = jogoAtual && jogoEhMensalAgenda(jogoAtual)
    ? String(obterAgendaOrigemMensal(jogoAtual))
    : null;

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

    const origemCicloExistente = jogoEhMensalAgenda(jogo)
      ? String(obterAgendaOrigemMensal(jogo))
      : null;

    // As ocorrências da mesma série não conflitam entre si durante a edição
    // do elenco ou dos dados do ciclo.
    if (
      origemCicloAtual &&
      origemCicloExistente &&
      origemCicloAtual === origemCicloExistente
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

let fimExistente =
  horaParaMinutos(
    jogo.hora_fim
  );

if (fimExistente <= inicioExistente) {
  fimExistente += 1440;
}

    const conflitoHora =
      novoInicio < fimExistente &&
      novoFim > inicioExistente;

    if (!conflitoHora) {
      return false;
    }

    const dataExistente =
      String(jogo.data_agendamento || "").slice(0, 10);

    return datasNovas.includes(dataExistente);

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

      const campoArena =
  obterCampoArenaPorNome(local);

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
let fimMinutos = horaParaMinutos(fim);

if (fimMinutos <= inicioMinutos) {
  fimMinutos += 1440;
}

if (fimMinutos <= inicioMinutos) {
  return mostrarErro(
    "Informe um horário final válido."
  );
}

const tipoJogoSelecionado =
  document.getElementById("tipoJogo")?.value || "avulso";

const valorMensalSelecionado = normalizarMoedaAgenda(
  document.getElementById("valorMensal")?.value || 0
);

const diaPagamentoSelecionado = Number(
  document.getElementById("diaPagamentoMensal")?.value || 0
);

if (tipoJogoSelecionado === "mensalista") {
  if (valorMensalSelecionado <= 0) {
    return mostrarErro("Informe um valor mensal maior que zero.");
  }

  if (diaPagamentoSelecionado < 1 || diaPagamentoSelecionado > 31) {
    return mostrarErro("Informe o dia previsto de pagamento entre 1 e 31.");
  }
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
  jogador_origem_id: jogador.jogador_origem_id || null,
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

if (agendaAtualId) {
  const idsMantidosAntesDeSalvar = new Set(
    jogadores
      .filter(jogador => jogador.id)
      .map(jogador => String(jogador.id))
  );

  const jogadorProtegidoRemovido =
    (jogadoresPorAgenda[agendaAtualId] || []).find(jogador => {
      const removido = !idsMantidosAntesDeSalvar.has(String(jogador.id));
      const protegido =
        jogador.pago === true ||
        Boolean(jogador.comanda_id) ||
        Boolean(jogador.venda_id);

      return removido && protegido;
    });

  if (jogadorProtegidoRemovido) {
    return mostrarErro(
      `O jogador ${jogadorProtegidoRemovido.nome || ""} já possui pagamento ou comanda vinculada. Ele não pode ser removido.`
    );
  }
}

let statusJogo =
  modoModalAgenda === "novo"
    ? "agendado"
    : jogoAtual?.status_jogo || "agendado";

    const ehOcorrenciaMensal =
  jogoAtual && jogoEhMensalAgenda(jogoAtual);

const dataOriginalOcorrencia =
  String(
    jogoAtual?.horario_original_data ||
    jogoAtual?.data_agendamento ||
    ""
  ).slice(0, 10);

const horarioFoiAlterado =
  ehOcorrenciaMensal &&
  (
    String(data) !== String(jogoAtual.data_agendamento).slice(0, 10) ||
    String(inicio) !== formatarHora(jogoAtual.hora_inicio) ||
    String(fim) !== formatarHora(jogoAtual.hora_fim)
  );

const motivoAlteracaoInformado =
  document.getElementById("motivoAlteracaoHorario")?.value.trim() || "";

if (horarioFoiAlterado && !motivoAlteracaoInformado) {
  return mostrarErro(
    "Informe claramente o motivo da alteração de data ou horário deste jogo mensal."
  );
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

        campo_id:
  campoArena?.id || null,

      tipo_jogo:
        tipoJogoSelecionado,

      status_jogo:
        statusJogo,

recorrencia:
  tipoJogoSelecionado === "mensalista"
    ? "mensal"
    : "avulso",

      valor_previsto:
        tipoJogoSelecionado === "mensalista"
          ? 0
          : normalizarMoedaAgenda(
              document.getElementById("valorPrevisto")?.value || 0
            ),

      valor_mensal:
        tipoJogoSelecionado === "mensalista"
          ? valorMensalSelecionado
          : 0,

      dia_pagamento_mensal:
        tipoJogoSelecionado === "mensalista"
          ? diaPagamentoSelecionado
          : null,

      observacoes:
        document.getElementById(
          "observacoes"
        ).value.trim() || null,

permite_avulsos:
  tipoJogoSelecionado === "mensalista" ||
  jogadores.some(j => j.origem_jogador === "avulso"),

permite_time_avulso:
  document.getElementById("usarTimesJogo")?.checked === true,

motivo_alteracao_horario:
  document.getElementById("motivoAlteracaoHorario")?.value.trim() || null,

horario_original_data:
  jogoAtual?.horario_original_data ||
  jogoAtual?.data_agendamento ||
  null,

horario_original_inicio:
  jogoAtual?.horario_original_inicio ||
  jogoAtual?.hora_inicio ||
  null,

horario_original_fim:
  jogoAtual?.horario_original_fim ||
  jogoAtual?.hora_fim ||
  null,

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
  if (tipoJogoSelecionado === "mensalista") {
    return mostrarErro(
      "A criação e a alteração de ciclos mensais exigem conexão para fechar todas as datas com segurança."
    );
  }

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

    if (!agendaAtualId && tipoJogoSelecionado === "mensalista") {
      const mensalistas = jogadores
        .filter(jogador => jogador.origem_jogador === "mensalista")
        .map(jogador => ({
          nome: jogador.nome,
          time_jogador: jogador.time_jogador || null
        }));

      const avulsosPrimeiroJogo = jogadores
        .filter(jogador => jogador.origem_jogador === "avulso")
        .map(jogador => ({
          nome: jogador.nome,
          time_jogador: jogador.time_jogador || null,
          valor: Number(jogador.valor || 0)
        }));

      const { error } = await sb.rpc("criar_ciclo_mensal_agenda", {
        p_dados: {
          cliente_nome: clienteNome,
          cliente_telefone:
            document.getElementById("clienteTelefone")?.value.trim() || null,
          data_inicio: data,
          hora_inicio: inicio,
          hora_fim: fim,
          campo_id: campoArena?.id || null,
          local_recurso: local,
          valor_mensal: valorMensalSelecionado,
          dia_pagamento: diaPagamentoSelecionado,
          permite_avulsos: true,
          permite_time_avulso:
            document.getElementById("usarTimesJogo")?.checked === true,
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
          observacoes:
            document.getElementById("observacoes")?.value.trim() || null,
          operador_criacao_id:
            sessionStorage.getItem("CRV_OPERADOR_ID") || null,
          mensalistas,
          avulsos_primeiro_jogo: avulsosPrimeiroJogo
        }
      });

      if (error) throw error;

      mostrarSucesso(
        `Ciclo mensal criado com ${obterDatasDoDiaAteFimDoMesAgenda(data).length} jogo(s) previsto(s).`
      );

      await sincronizarAgendaVisual();

      setTimeout(() => {
        fecharModalJogo();
      }, 700);

      return;
    }

    let agendaId =
      agendaAtualId;

    if (agendaId && horarioFoiAlterado) {
      const { error: erroReagendamento } = await sb.rpc(
        "reagendar_ocorrencia_agenda",
        {
          p_agenda_id: agendaId,
          p_nova_data: data,
          p_nova_hora_inicio: inicio,
          p_nova_hora_fim: fim,
          p_motivo: motivoAlteracaoInformado
        }
      );

      if (erroReagendamento) throw erroReagendamento;
    }

    if (agendaId) {

      const { error } = await sb
        .from("agenda")
        .update(payload)
        .eq("id", agendaId)
        .eq("empresa_id", APP_EMPRESA_ID);

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

    let jogadoresParaPersistir = jogadores;
    let jogadoresExistentesParaPersistir = jogadoresPorAgenda[agendaId] || [];

    if (jogoAtual && tipoJogoSelecionado === "mensalista") {
      const agendaOrigemId = obterAgendaOrigemMensal(jogoAtual);
      const mensalidadeAtual = buscarMensalidadeAgenda(jogoAtual);
      const competenciaAtual =
        mensalidadeAtual?.competencia ||
        competenciaAgenda(dataOriginalOcorrencia || data);

      const mensalistas = jogadores
        .filter(jogador => jogador.origem_jogador === "mensalista")
        .map(jogador => ({
          id:
            String(agendaId) === String(agendaOrigemId)
              ? jogador.id || null
              : jogador.jogador_origem_id || null,
          nome: jogador.nome,
          time_jogador: jogador.time_jogador || null
        }));

      const { error: erroElenco } = await sb.rpc(
        "salvar_mensalistas_ciclo_agenda",
        {
          p_agenda_origem_id: agendaOrigemId,
          p_competencia: competenciaAtual,
          p_mensalistas: mensalistas
        }
      );

      if (erroElenco) throw erroElenco;

      const dadosModelo = {
        cliente_nome: clienteNome,
        cliente_telefone:
          document.getElementById("clienteTelefone")?.value.trim() || null,
        valor_mensal: valorMensalSelecionado,
        dia_pagamento_mensal: diaPagamentoSelecionado,
        permite_avulsos: true,
        permite_time_avulso:
          document.getElementById("usarTimesJogo")?.checked === true,
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
        observacoes:
          document.getElementById("observacoes")?.value.trim() || null,
        atualizado_em: new Date().toISOString()
      };

      const { error: erroModelo } = await sb
        .from("agenda")
        .update(dadosModelo)
        .eq("id", agendaOrigemId)
        .eq("empresa_id", APP_EMPRESA_ID);

      if (erroModelo) throw erroModelo;

      if (mensalidadeAtual && mensalidadeAtual.status !== "pago") {
        const dataVencimento = calcularVencimentoCompetenciaAgenda(
          competenciaAtual,
          diaPagamentoSelecionado
        );

        const { error: erroMensalidade } = await sb
          .from("agenda_mensalidades")
          .update({
            valor: valorMensalSelecionado,
            dia_pagamento: diaPagamentoSelecionado,
            data_vencimento: dataVencimento,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", mensalidadeAtual.id)
          .eq("empresa_id", APP_EMPRESA_ID)
          .neq("status", "pago");

        if (erroMensalidade) throw erroMensalidade;
      }

      // O elenco mensal foi sincronizado pela RPC. A persistência direta
      // abaixo cuida apenas dos convidados avulsos desta ocorrência.
      jogadoresParaPersistir = jogadores.filter(jogador => {
        return jogador.origem_jogador === "avulso";
      });

      jogadoresExistentesParaPersistir =
        (jogadoresPorAgenda[agendaId] || []).filter(jogador => {
          return !(
            jogador.mensalista === true &&
            jogador.cobrar_no_jogo === false
          );
        });
    }

    const jogadoresExistentes = jogadoresExistentesParaPersistir;

    const idsMantidos =
      jogadoresParaPersistir
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

    for (const jogador of jogadoresParaPersistir) {
      if (jogador.id) {
        const { error } = await sb
          .from("agenda_jogadores")
.update({
  nome: jogador.nome,
  time_jogador: jogador.time_jogador || null,
  valor: Number(jogador.valor || 0),
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
  valor: Number(jogador.valor || 0),
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

await sincronizarAgendaVisual();

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

  if (navigator.onLine === false) {
    abrirModalAviso({
      titulo: "Cancelamento online",
      texto: "Para preservar o ciclo e o histórico corretamente, cancele o jogo quando a conexão estiver disponível."
    });
    return;
  }

  const ehMensal = jogoEhMensalAgenda(jogo);

  abrirModalAviso({

    titulo: ehMensal ? "Cancelar horário mensal" : "Cancelar jogo",

    texto: ehMensal
      ? `Informe o motivo. Você pode cancelar somente o jogo de ${formatarDataCompletaAgenda(jogo.data_agendamento)} ou todas as ocorrências restantes deste ciclo.`
      : `Informe o motivo do cancelamento de ${jogo.cliente_nome || "este jogo"}.`,

    confirmarTexto: ehMensal ? "Somente este jogo" : "Cancelar jogo",

    secundarioTexto: ehMensal ? "Restante do mês" : "",

    mostrarCancelar: true,

    campoMotivo: true,

    placeholderMotivo:
      "Ex: cliente desistiu, chuva, sem time, reagendado...",

    onConfirm: motivo =>
      executarCancelamentoJogoAgenda(jogo, motivo, false),

    onSecondary: ehMensal
      ? motivo => executarCancelamentoJogoAgenda(jogo, motivo, true)
      : null

  });
}

async function executarCancelamentoJogoAgenda(jogo, motivo, restanteCiclo) {
  try {
    let error = null;

    if (restanteCiclo) {
      const mensalidade = buscarMensalidadeAgenda(jogo);

      if (!mensalidade) {
        throw new Error("Não foi possível localizar o ciclo mensal deste jogo.");
      }

      ({ error } = await sb.rpc("cancelar_restante_ciclo_mensal_agenda", {
        p_agenda_origem_id: obterAgendaOrigemMensal(jogo),
        p_competencia: mensalidade.competencia,
        p_a_partir_de:
          jogo.horario_original_data || jogo.data_agendamento,
        p_motivo: motivo
      }));
    } else {
      ({ error } = await sb.rpc("cancelar_ocorrencia_agenda", {
        p_agenda_id: jogo.id,
        p_motivo: motivo
      }));
    }

    if (error) throw error;

    await sincronizarAgendaVisual();

    crvToast({
      titulo: restanteCiclo ? "Ciclo mensal cancelado" : "Jogo cancelado",
      mensagem: restanteCiclo
        ? "As ocorrências restantes foram canceladas e o histórico foi preservado."
        : "Apenas esta ocorrência foi cancelada e o horário foi liberado.",
      tipo: "success"
    });
  } catch (err) {
    abrirModalAviso({
      titulo: "Erro ao cancelar",
      texto: err.message || "Não foi possível cancelar o jogo."
    });
  }
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
  renderizarAgendaInline();
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

function formatarDiaSemanaNomeAgenda(dataISO) {
  if (!dataISO) return "-";

  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);

  return data.toLocaleDateString("pt-BR", {
    weekday: "long"
  });
}

function obterResumoHorarioRenovacaoAgenda(jogo) {
  const originalData =
    jogo?.horario_original_data ||
    jogo?.data_agendamento;

  const originalInicio =
    jogo?.horario_original_inicio ||
    jogo?.hora_inicio;

  const originalFim =
    jogo?.horario_original_fim ||
    jogo?.hora_fim;

  const atualData =
    jogo?.data_agendamento;

  const atualInicio =
    jogo?.hora_inicio;

  const atualFim =
    jogo?.hora_fim;

  const originalTexto =
    `${formatarDiaSemanaNomeAgenda(originalData)} • ${formatarHora(originalInicio)} às ${formatarHora(originalFim)}`;

  const atualTexto =
    `${formatarDiaSemanaNomeAgenda(atualData)} • ${formatarHora(atualInicio)} às ${formatarHora(atualFim)}`;

  const alterado =
    jogo?.horario_alterado === true ||
    String(originalData || "").slice(0, 10) !== String(atualData || "").slice(0, 10) ||
    formatarHora(originalInicio) !== formatarHora(atualInicio) ||
    formatarHora(originalFim) !== formatarHora(atualFim);

  return {
    originalTexto,
    atualTexto,
    alterado
  };
}

function obterDatasProximoMesMensalidade(jogo, proximaCompetencia) {
  const origemData =
    jogo?.horario_original_data ||
    jogo?.data_agendamento;

  const diaSemana =
    obterDiaSemanaAgenda(origemData);

  const [ano, mes] =
    String(proximaCompetencia).split("-").map(Number);

  const primeiroDia =
    new Date(ano, mes - 1, 1, 12);

  const ultimoDia =
    new Date(ano, mes, 0, 12);

  const datas = [];

  for (
    let data = new Date(primeiroDia);
    data <= ultimoDia;
    data.setDate(data.getDate() + 1)
  ) {
    if (data.getDay() === diaSemana) {
      datas.push(data.toISOString().slice(0, 10));
    }
  }

  return datas;
}

async function renovarMensalidadeAgenda(id) {
  const mensalidade = encontrarMensalidadePorId(id);

  if (!mensalidade) return;

  const jogo = obterJogoOrigemMensalidade(mensalidade);

  if (!jogo) {
    abrirModalAviso({
      titulo: "Mensalidade sem horário",
      texto: "Não foi possível localizar o horário original deste mensalista."
    });
    return;
  }

  const proximaCompetencia =
    obterProximaCompetenciaAgenda(mensalidade.competencia);

  const datasProximoMes =
    obterDatasProximoMesMensalidade(jogo, proximaCompetencia);

  const horario =
    obterResumoHorarioRenovacaoAgenda(jogo);

  const textoHorario = horario.alterado
    ? `
      <span><strong>Horário original</strong> ${horario.originalTexto}</span>
      <span><strong>Último jogo</strong> ${horario.atualTexto}</span>
      <span class="agenda-renovacao-alerta">
        O próximo mês será criado utilizando o <strong>horário original</strong>.
      </span>
    `
    : `
      <span><strong>Horário</strong> ${horario.originalTexto}</span>
    `;

  abrirModalAviso({
    titulo: "Renovar próximo mês",
    texto: `
      <div class="agenda-renovacao-aviso">

        <p>
          Este foi o último jogo deste horário mensal.
        </p>

        <div class="agenda-renovacao-info">

          <span>
            <strong>Responsável</strong>
            ${jogo.cliente_nome || "Mensalista"}
          </span>

          <span>
            <strong>Campo</strong>
            ${jogo.local_recurso || "-"}
          </span>

          ${textoHorario}

          <span>
            <strong>Próximo mês</strong>
            ${formatarCompetenciaMensalidade(proximaCompetencia)}
          </span>

        </div>

        <div class="agenda-renovacao-datas">

          <strong>Jogos previstos</strong>

          <span>
            ${datasProximoMes
              .map(formatarDataCurtaAgenda)
              .join(" • ")}
          </span>

        </div>

      </div>
    `,
    confirmarTexto: "Criar próximo mês",
    mostrarCancelar: true,

    onConfirm: async () => {

      try {

        const { error } = await sb.rpc("renovar_ciclo_mensal_agenda", {
          p_agenda_origem_id: mensalidade.agenda_origem_id,
          p_competencia: `${proximaCompetencia}-01`,
          p_valor_mensal: Number(
            mensalidade.valor || jogo.valor_mensal || 0
          ),
          p_dia_pagamento: Number(
            mensalidade.dia_pagamento ||
            jogo.dia_pagamento_mensal ||
            1
          )
        });

        if (error) throw error;

        await sincronizarAgendaVisual();

        crvToast({
          titulo: "Próximo mês criado",
          mensagem:
            `${formatarCompetenciaMensalidade(proximaCompetencia)} criado com sucesso.`,
          tipo: "success"
        });

      } catch (err) {

        abrirModalAviso({
          titulo: "Erro",
          texto:
            err.message ||
            "Erro ao renovar próximo mês."
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

function alternarConfigGradeInline() {
  const painel = document.getElementById("agendaConfigInlinePanel");
  const botao = document.getElementById("btnConfigGradeInline");

  if (!painel || !botao) return;

  const aberto = painel.style.display === "block";

  painel.style.display = aberto ? "none" : "block";
  botao.classList.toggle("aberto", !aberto);

if (!aberto) {
  carregarConfigGradeAgenda();
  renderizarValoresPadraoAgendaInline();
  renderizarCamposArenaInline();
}

  if (window.lucide) {
    lucide.createIcons();
  }
}

function duracaoMinutosParaTextoAgenda(minutos) {
  const total = Number(minutos || 0);

  if (total <= 0) return "";

  const horas = Math.floor(total / 60);
  const mins = total % 60;

  if (horas > 0 && mins > 0) return `${horas}h${String(mins).padStart(2, "0")}`;
  if (horas > 0) return `${horas}h`;

  return `${mins}min`;
}

function duracaoTextoParaMinutosAgenda(texto) {
  const valor = String(texto || "").toLowerCase().trim();

  if (!valor) return 0;

  const horasMatch = valor.match(/(\d+)\s*h/);
  const minMatch = valor.match(/h\s*(\d+)/) || valor.match(/(\d+)\s*min/);

  const horas = horasMatch ? Number(horasMatch[1]) : 0;
  const minutos = minMatch ? Number(minMatch[1]) : 0;

  if (!horas && !minutos && /^\d+$/.test(valor)) {
    return Number(valor);
  }

  return (horas * 60) + minutos;
}

function renderizarValoresPadraoAgendaInline() {
  const lista = document.getElementById("listaValoresAgendaInline");
  if (!lista) return;

  if (!valoresPadraoAgenda.length) {
    valoresPadraoAgenda = [
      {
        duracao: "1h",
        valor_avulso: 0,
        valor_mensal: 0,
        ordem: 1,
        novo: true
      },
      {
        duracao: "1h30",
        valor_avulso: 0,
        valor_mensal: 0,
        ordem: 2,
        novo: true
      }
    ];
  }

  lista.innerHTML = valoresPadraoAgenda.map((item, index) => `
    <div
      class="agenda-valor-inline-item"
      data-id="${item.id || ""}"
      data-novo="${item.novo === true ? "true" : "false"}"
    >
      <input
        class="input agenda-valor-duracao"
        value="${item.duracao || ""}"
        placeholder="Ex: 1h30"
      >

      <input
        class="input agenda-valor-avulso"
        value="${valorBancoParaInputAgenda(item.valor_avulso || 0)}"
        placeholder="Avulso"
      >

      <input
        class="input agenda-valor-mensal"
        value="${valorBancoParaInputAgenda(item.valor_mensal || 0)}"
        placeholder="Mensal"
      >

      <button
        type="button"
        class="agenda-inline-action cancelar btn-remover-valor-agenda"
        title="Remover valor"
      >
        <i data-lucide="trash-2" width="15" height="15"></i>
      </button>
    </div>
  `).join("");

  lista.querySelectorAll(".agenda-valor-avulso, .agenda-valor-mensal")
    .forEach(input => aplicarMascaraMoedaAgenda(input));

  lista.querySelectorAll(".btn-remover-valor-agenda")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".agenda-valor-inline-item");
        row?.remove();
      });
    });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function adicionarValorPadraoAgendaInline() {
  const lista = document.getElementById("listaValoresAgendaInline");
  if (!lista) return;

  const row = document.createElement("div");
  row.className = "agenda-valor-inline-item";
  row.dataset.novo = "true";

  row.innerHTML = `
    <input
      class="input agenda-valor-duracao"
      value=""
      placeholder="Ex: 2h"
    >

    <input
      class="input agenda-valor-avulso"
      value=""
      placeholder="Avulso"
    >

    <input
      class="input agenda-valor-mensal"
      value=""
      placeholder="Mensal"
    >

    <button
      type="button"
      class="agenda-inline-action cancelar btn-remover-valor-agenda"
      title="Remover valor"
    >
      <i data-lucide="trash-2" width="15" height="15"></i>
    </button>
  `;

  lista.appendChild(row);

  aplicarMascaraMoedaAgenda(row.querySelector(".agenda-valor-avulso"));
  aplicarMascaraMoedaAgenda(row.querySelector(".agenda-valor-mensal"));

  row.querySelector(".btn-remover-valor-agenda")
    ?.addEventListener("click", () => row.remove());

  row.querySelector(".agenda-valor-duracao")?.focus();

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function salvarValoresPadraoAgendaInline() {
  const linhas = [
    ...document.querySelectorAll(".agenda-valor-inline-item")
  ];

  const duracoesUsadas = new Set();

  for (let index = 0; index < linhas.length; index++) {
    const linha = linhas[index];

    const id = linha.dataset.id || null;

    const duracao =
      String(linha.querySelector(".agenda-valor-duracao")?.value || "")
        .trim();

    const valorAvulso = normalizarMoedaAgenda(
      linha.querySelector(".agenda-valor-avulso")?.value || 0
    );

    const valorMensal = normalizarMoedaAgenda(
      linha.querySelector(".agenda-valor-mensal")?.value || 0
    );

    if (!duracao) {
      crvToast({
        titulo: "Duração obrigatória",
        mensagem: "Informe a duração do valor padrão.",
        tipo: "warn"
      });

      linha.querySelector(".agenda-valor-duracao")?.focus();
      return false;
    }

    const chave = normalizarBuscaAgendaInline(duracao);

    if (duracoesUsadas.has(chave)) {
      crvToast({
        titulo: "Duração duplicada",
        mensagem: `A duração "${duracao}" foi informada mais de uma vez.`,
        tipo: "warn"
      });

      linha.querySelector(".agenda-valor-duracao")?.focus();
      return false;
    }

    duracoesUsadas.add(chave);

    const payload = {
      empresa_id: APP_EMPRESA_ID,
      duracao,
      valor_avulso: valorAvulso,
      valor_mensal: valorMensal,
      ordem: index + 1,
      ativo: true,
      updated_at: new Date().toISOString()
    };

    const query = id
      ? sb
          .from("agenda_valores_padrao")
          .update(payload)
          .eq("id", id)
          .eq("empresa_id", APP_EMPRESA_ID)
      : sb
          .from("agenda_valores_padrao")
          .upsert([payload], {
            onConflict: "empresa_id,duracao"
          });

    const { error } = await query;

    if (error) {
      crvToast({
        titulo: "Erro",
        mensagem: error.message || "Erro ao salvar valores padrão.",
        tipo: "error"
      });

      return false;
    }
  }

  const idsTela = linhas
    .map(linha => linha.dataset.id)
    .filter(Boolean)
    .map(String);

  const removidos = valoresPadraoAgenda.filter(item => {
    return item.id && !idsTela.includes(String(item.id));
  });

  for (const item of removidos) {
    const { error } = await sb
      .from("agenda_valores_padrao")
      .update({
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .eq("empresa_id", APP_EMPRESA_ID);

    if (error) {
      crvToast({
        titulo: "Erro",
        mensagem: error.message || "Erro ao remover valor padrão.",
        tipo: "error"
      });

      return false;
    }
  }

  const { data } = await sb
    .from("agenda_valores_padrao")
    .select("*")
    .eq("empresa_id", APP_EMPRESA_ID)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("duracao", { ascending: true });

  valoresPadraoAgenda = data || [];

  renderizarValoresPadraoAgendaInline();

  return true;
}

function obterValorPadraoAgendaPorDuracao(duracaoMinutos, tipoJogo = "avulso") {
  const duracaoTexto = duracaoMinutosParaTextoAgenda(duracaoMinutos);
  const chave = normalizarBuscaAgendaInline(duracaoTexto);

  const config = valoresPadraoAgenda.find(item => {
    return normalizarBuscaAgendaInline(item.duracao) === chave;
  });

  if (!config) return 0;

  return tipoJogo === "mensalista"
    ? Number(config.valor_mensal || 0)
    : Number(config.valor_avulso || 0);
}

function obterDuracaoModalAgenda() {
  const inicio =
    document.getElementById("horaInicio")?.value || "";

  const fim =
    document.getElementById("horaFim")?.value || "";

  if (!inicio || !fim) return 0;

  const inicioMinutos = horaParaMinutos(inicio);
  let fimMinutos = horaParaMinutos(fim);

  if (fimMinutos <= inicioMinutos) {
    fimMinutos += 1440;
  }

  return fimMinutos - inicioMinutos;
}

function aplicarValorPadraoAgendaNoModal() {
  const duracao = obterDuracaoModalAgenda();
  const tipo = document.getElementById("tipoJogo")?.value || "avulso";

  if (!duracao) return;

  const valor = obterValorPadraoAgendaPorDuracao(duracao, tipo);

  if (tipo === "mensalista") {
    const campoMensal = document.getElementById("valorMensal");

    if (campoMensal && !campoMensal.value) {
      campoMensal.value = valorBancoParaInputAgenda(valor);
    }

    return;
  }

  const campoAvulso = document.getElementById("valorPrevisto");

  if (campoAvulso && !campoAvulso.value) {
    campoAvulso.value = valorBancoParaInputAgenda(valor);
  }
}

function renderizarCamposArenaInline() {
  const lista = document.getElementById("listaCamposArenaInline");
  if (!lista) return;

  if (!camposArena.length) {
    lista.innerHTML = `
      <div class="agenda-inline-empty">
        Nenhum campo cadastrado.
      </div>
    `;
    return;
  }

  lista.innerHTML = camposArena.map(campo => `
    <div class="agenda-campo-inline-item" data-id="${campo.id}">
      <input
        class="input agenda-campo-nome"
        value="${campo.nome || ""}"
        placeholder="Nome do campo"
      >

      <input
        class="input agenda-campo-ordem"
        type="number"
        value="${campo.ordem || 0}"
        placeholder="Ordem"
      >

<button
  type="button"
  class="agenda-inline-action cancelar btn-desativar-campo-arena"
  data-id="${campo.id}"
  title="Remover campo"
>
  <i data-lucide="trash-2" width="15" height="15"></i>
</button>
    </div>
  `).join("");

  lista.querySelectorAll(".btn-desativar-campo-arena").forEach(btn => {
    btn.addEventListener("click", () => desativarCampoArenaInline(btn.dataset.id));
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function adicionarCampoArenaInline() {
  const lista = document.getElementById("listaCamposArenaInline");
  if (!lista) return;

  const tempId = `novo-${Date.now()}`;

  const row = document.createElement("div");
  row.className = "agenda-campo-inline-item";
  row.dataset.id = tempId;
  row.dataset.novo = "true";

  row.innerHTML = `
    <input
      class="input agenda-campo-nome"
      value="Novo espaço"
      placeholder="Nome do campo"
    >

    <input
      class="input agenda-campo-ordem"
      type="number"
      value="1"
      placeholder="Ordem"
    >

    <button
      type="button"
      class="agenda-inline-action cancelar btn-desativar-campo-arena"
      title="Remover campo"
    >
      <i data-lucide="trash-2" width="15" height="15"></i>
    </button>
  `;

  lista.appendChild(row);

  row.querySelector(".btn-desativar-campo-arena")
    ?.addEventListener("click", () => row.remove());

  row.querySelector(".agenda-campo-nome")?.focus();
  row.querySelector(".agenda-campo-nome")?.select();

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function salvarCampoArenaInline(id) {
  const row = document.querySelector(`.agenda-campo-inline-item[data-id="${id}"]`);
  if (!row) return;

  const nome = row.querySelector(".agenda-campo-nome")?.value.trim();
  const ordem = Number(row.querySelector(".agenda-campo-ordem")?.value || 0);

  if (!nome) {
    crvToast({
      titulo: "Campo obrigatório",
      mensagem: "Informe o nome do campo.",
      tipo: "warn"
    });
    return;
  }

  const { error } = await sb
    .from("arena_campos")
    .update({
      nome,
      ordem
    })
    .eq("id", id)
    .eq("empresa_id", APP_EMPRESA_ID);

  if (error) {
    crvToast({
      titulo: "Erro",
      mensagem: error.message || "Erro ao salvar campo.",
      tipo: "error"
    });
    return;
  }

  await carregarAgenda();
  renderizarCamposArenaInline();
  popularCamposAgendaInline();
  renderizarAgendaInline();
}

function desativarCampoArenaInline(id) {
  const campo = camposArena.find(c => String(c.id) === String(id));

  abrirModalAviso({
    titulo: "Remover campo",
    texto: `Remover "${campo?.nome || "este campo"}" da grade? Jogos antigos continuam preservados.`,
    confirmarTexto: "Remover",
    mostrarCancelar: true,
    onConfirm: async () => {
      const { error } = await sb
        .from("arena_campos")
        .update({
          ativo: false
        })
        .eq("id", id)
        .eq("empresa_id", APP_EMPRESA_ID);

      if (error) {
        abrirModalAviso({
          titulo: "Erro",
          texto: error.message || "Erro ao remover campo."
        });
        return;
      }

      await carregarAgenda();
      renderizarCamposArenaInline();
      popularCamposAgendaInline();
      renderizarAgendaInline();

      crvToast({
        titulo: "Campo removido",
        mensagem: "Campo removido da grade.",
        tipo: "success"
      });
    }
  });
}

async function salvarConfiguracaoAgendaInlineCompleta() {
  await salvarConfigGradeAgenda();

  const valoresOk = await salvarValoresPadraoAgendaInline();
  if (!valoresOk) return;

  const linhas = [
    ...document.querySelectorAll(".agenda-campo-inline-item")
  ];

  for (const linha of linhas) {
    const id = linha.dataset.id;
    const novo = linha.dataset.novo === "true";

    const nome = formatarNomeProprioAgenda(
      linha.querySelector(".agenda-campo-nome")?.value || ""
    );

    const ordem = Number(
      linha.querySelector(".agenda-campo-ordem")?.value || 1
    );

    if (!nome) {
      crvToast({
        titulo: "Campo obrigatório",
        mensagem: "Informe o nome do campo.",
        tipo: "warn"
      });

      linha.querySelector(".agenda-campo-nome")?.focus();
      return;
    }

    const existeDuplicado = camposArena.some(campo =>
      String(campo.id) !== String(id) &&
      normalizarBuscaAgendaInline(campo.nome) ===
        normalizarBuscaAgendaInline(nome)
    );

    if (existeDuplicado) {
      crvToast({
        titulo: "Nome já utilizado",
        mensagem: `Já existe um campo chamado "${nome}". Escolha outro nome.`,
        tipo: "warn"
      });

      linha.querySelector(".agenda-campo-nome")?.focus();
      return;
    }

    const { error } = novo
      ? await sb
          .from("arena_campos")
          .insert([{
            empresa_id: APP_EMPRESA_ID,
            nome,
            ordem,
            ativo: true
          }])
      : await sb
          .from("arena_campos")
          .update({
            nome,
            ordem
          })
          .eq("id", id)
          .eq("empresa_id", APP_EMPRESA_ID);

    if (error) {
      crvToast({
        titulo: "Erro",
        mensagem:
          error.code === "23505"
            ? `Já existe um campo chamado "${nome}". Escolha outro nome.`
            : error.message || "Erro ao salvar campos.",
        tipo: "error"
      });
      return;
    }
  }

  await carregarAgenda();
  renderizarCamposArenaInline();
  popularCamposAgendaInline();
  popularSelectLocalRecurso();
  renderizarAgendaInline();

  crvToast({
    titulo: "Configuração salva",
    mensagem: "Grade, duração e campos atualizados com sucesso.",
    tipo: "success"
  });
}

function garantirBotaoSemanaAgenda() {
  const btnConfig =
    document.getElementById("btnConfigGradeInline");

  if (!btnConfig || document.getElementById("btnAgendaSemana")) {
    return;
  }

  const btn = document.createElement("button");

  btn.id = "btnAgendaSemana";
  btn.type = "button";
  btn.className = btnConfig.className;
  btn.innerHTML = `
    <i data-lucide="calendar-days"></i>
    <span>Gerenciar horários</span>
  `;

  btnConfig.insertAdjacentElement("afterend", btn);

  btn.addEventListener("click", abrirModalSemanaAgenda);

  if (window.lucide) {
    lucide.createIcons();
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

function atualizarContadoresAgendaInline(linhas) {
  const painel = document.getElementById("agendaInlinePanel");
  if (!painel) return;

  let contador = painel.querySelector(".agenda-inline-contadores");

  if (!contador) {
    contador = document.createElement("div");
    contador.className = "agenda-inline-contadores";

    const toolbar = painel.querySelector(".agenda-inline-toolbar");
    toolbar?.insertAdjacentElement("afterend", contador);
  }

  const livres = linhas.filter(l => l.livre).length;
  const fechados = linhas.filter(l => !l.livre).length;

  contador.innerHTML = `
    <span><strong>${livres}</strong> horário(s) disponível(is)</span>
    <span><strong>${fechados}</strong> horário(s) fechado(s)</span>
  `;
}

function abrirCobrancaAgendaInline(id) {
  const jogo = agendaDados.find(j => String(j.id) === String(id));
  if (!jogo) return;

  const mensalidade = buscarMensalidadeAgenda(jogo);

  if (jogoEhMensalAgenda(jogo) && mensalidade) {
    receberMensalidadeAgenda(mensalidade.id);
    return;
  }

  sessionStorage.setItem(
    "crv_recebimento_agenda_caixa",
    JSON.stringify({
      tipo: "agenda_avulso",
      agenda_id: jogo.id,
      origem_id: jogo.id,
      cliente_nome: jogo.cliente_nome || "Jogo avulso",
      local_recurso: jogo.local_recurso || "",
      data_agendamento: jogo.data_agendamento || "",
      hora_inicio: jogo.hora_inicio || "",
      hora_fim: jogo.hora_fim || "",
      descricao: `Jogo avulso - ${jogo.cliente_nome || "Sem responsável"}`
    })
  );

  window.location.href = "caixa.html";
}

function garantirBotoesDataAgendaInline() {
  const toolbar = document.querySelector(".agenda-inline-toolbar");
  if (!toolbar) return;

  let wrap = document.getElementById("agendaInlineDataWrap");

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "agendaInlineDataWrap";
    wrap.className = "agenda-inline-data-wrap";

    wrap.innerHTML = `
      <button id="btnAgendaInlineHoje" type="button" class="agenda-date-btn">Hoje</button>
      <button id="btnAgendaInlineProximo" type="button" class="agenda-date-btn">Próximo dia →</button>
      <div id="agendaInlineDataAtual" class="agenda-inline-data-atual"></div>
    `;

    const tipo = document.getElementById("tipoAgendaInline");
    toolbar.insertBefore(wrap, tipo);

    document.getElementById("btnAgendaInlineHoje")
      ?.addEventListener("click", async () => {
        voltarHojeAgenda();
        atualizarDataAtualAgendaInline();
      });

    document.getElementById("btnAgendaInlineProximo")
      ?.addEventListener("click", async () => {
        alterarDiaAgenda(1);
        atualizarDataAtualAgendaInline();
      });
  }

  atualizarDataAtualAgendaInline();
}

function atualizarDataAtualAgendaInline() {
  const el = document.getElementById("agendaInlineDataAtual");
  const input = document.getElementById("filtroData");

  if (!el || !input) return;

  const [ano, mes, dia] = String(input.value || hojeISOAgenda()).split("-");

  el.innerHTML = `<strong>${dia}/${mes}/${ano}</strong>`;
}

function obterSemanaAgenda(dataISO) {
  const base = new Date(`${String(dataISO || hojeISOAgenda()).slice(0, 10)}T12:00:00`);
  const diaSemana = base.getDay();
  const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const inicio = new Date(base);
  inicio.setDate(base.getDate() + diffSegunda);

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10)
  };
}

function listarDiasSemanaAgenda(inicioISO) {
  const dias = [];
  const base = new Date(`${inicioISO}T12:00:00`);

  for (let i = 0; i < 7; i++) {
    const data = new Date(base);
    data.setDate(base.getDate() + i);
    dias.push(data.toISOString().slice(0, 10));
  }

  return dias;
}

function formatarDiaSemanaCurtoAgenda(dataISO) {
  const data = new Date(`${dataISO}T12:00:00`);

  return data.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

let dataGerenciarHorariosAgenda =
  hojeISOAgenda();

let filtroTipoGerenciarHorariosAgenda =
  "todos";

let buscaGerenciarHorariosAgenda =
  "";

function abrirModalSemanaAgenda() {
  const existente =
    document.getElementById("modalSemanaAgenda");

  if (existente) existente.remove();

  dataGerenciarHorariosAgenda =
    document.getElementById("filtroData")?.value || hojeISOAgenda();

  const modal = document.createElement("div");

  modal.id = "modalSemanaAgenda";
  modal.className = "modal-overlay agenda-semana-modal-overlay";

  modal.innerHTML = `
    <div class="modal card agenda-semana-modal agenda-gerenciar-modal">

      <button
        type="button"
        class="btn-ghost agenda-semana-fechar"
        id="btnFecharSemanaAgenda"
        title="Fechar"
      >
        <i data-lucide="x" width="16" height="16"></i>
      </button>

      <div class="agenda-semana-header">
        <div>
          <h2>Gerenciar horários</h2>
          <p>
            Consulte horários livres, mensais e avulsos. Clique em um horário para administrar.
          </p>
        </div>
      </div>

      <div class="agenda-gerenciar-toolbar">

        <input
          type="date"
          class="input"
          id="agendaGerenciarData"
          value="${dataGerenciarHorariosAgenda}"
        >

        <button
          type="button"
          class="agenda-date-btn"
          id="btnGerenciarDiaAnterior"
        >
          ← Dia anterior
        </button>

        <button
          type="button"
          class="agenda-date-btn active"
          id="btnGerenciarHoje"
        >
          Hoje
        </button>

        <button
          type="button"
          class="agenda-date-btn"
          id="btnGerenciarProximoDia"
        >
          Próximo dia →
        </button>

        <input
          type="search"
          class="input"
          id="agendaGerenciarBusca"
          placeholder="Buscar responsável, jogador, campo ou horário..."
        >

        <select
          class="input"
          id="agendaGerenciarTipo"
        >
          <option value="todos">Todos</option>
          <option value="mensal">Mensais</option>
          <option value="mensais_mes">Mensais do mês</option>
          <option value="avulso">Avulsos</option>
          <option value="livre">Livres</option>
        </select>

      </div>

      <div id="agendaSemanaConteudo"></div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.style.display = "flex";

  document
    .getElementById("btnFecharSemanaAgenda")
    ?.addEventListener("click", () => modal.remove());

  document
    .getElementById("agendaGerenciarData")
    ?.addEventListener("change", event => {
      dataGerenciarHorariosAgenda = event.target.value || hojeISOAgenda();
      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  document
    .getElementById("btnGerenciarDiaAnterior")
    ?.addEventListener("click", () => {
      dataGerenciarHorariosAgenda =
        somarDiasAgenda(dataGerenciarHorariosAgenda, -1);

      document.getElementById("agendaGerenciarData").value =
        dataGerenciarHorariosAgenda;

      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  document
    .getElementById("btnGerenciarHoje")
    ?.addEventListener("click", () => {
      dataGerenciarHorariosAgenda = hojeISOAgenda();

      document.getElementById("agendaGerenciarData").value =
        dataGerenciarHorariosAgenda;

      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  document
    .getElementById("btnGerenciarProximoDia")
    ?.addEventListener("click", () => {
      dataGerenciarHorariosAgenda =
        somarDiasAgenda(dataGerenciarHorariosAgenda, 1);

      document.getElementById("agendaGerenciarData").value =
        dataGerenciarHorariosAgenda;

      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  document
    .getElementById("agendaGerenciarBusca")
    ?.addEventListener("input", event => {
      buscaGerenciarHorariosAgenda =
        normalizarBuscaAgendaInline(event.target.value || "");

      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  document
    .getElementById("agendaGerenciarTipo")
    ?.addEventListener("change", event => {
      filtroTipoGerenciarHorariosAgenda =
        event.target.value || "todos";

      renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);
    });

  renderizarDiaSemanaAgenda(dataGerenciarHorariosAgenda);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderizarMensaisDoMesAgenda(dataISO) {
  const container =
    document.getElementById("agendaSemanaConteudo");

  if (!container) return;

  const competencia =
    competenciaAgenda(dataISO);

  const mensalidadesMes =
    mensalidadesAgenda.filter(m => {
      return (
        String(m.competencia || "") === competencia &&
        String(m.status || "") !== "cancelado"
      );
    });

  const itens =
    mensalidadesMes
      .map(mensalidade => {
        const jogo =
          obterJogoOrigemMensalidade(mensalidade);

        if (!jogo) return null;

        const horario =
          obterResumoHorarioRenovacaoAgenda(jogo);

        const datas =
          obterDatasProximoMesMensalidade(jogo, competencia);

        return {
          mensalidade,
          jogo,
          horario,
          datas,
          pagamentoPrevisto:
            obterPagamentoPrevistoMensalidadeAgenda(
              mensalidade,
              competencia
            )
        };
      })
      .filter(Boolean)
      .filter(item => {
        if (!buscaGerenciarHorariosAgenda) return true;

        const texto =
          normalizarBuscaAgendaInline([
            item.jogo.cliente_nome,
            item.jogo.local_recurso,
            item.horario.originalTexto,
            item.datas.map(formatarDataCurtaAgenda).join(" ")
          ].join(" "));

        return texto.includes(buscaGerenciarHorariosAgenda);
      })
      .sort((a, b) =>
        String(a.jogo.cliente_nome || "")
          .localeCompare(String(b.jogo.cliente_nome || ""), "pt-BR")
      );

  container.innerHTML = `
    <div class="agenda-semana-dia-header">
      <strong>Mensais do mês</strong>
      <span>
        ${
          itens.length === 1
            ? "1 horário mensal encontrado"
            : `${itens.length} horários mensais encontrados`
        }
      </span>
    </div>

    ${
      itens.length
        ? itens.map(({
            mensalidade,
            jogo,
            horario,
            datas,
            pagamentoPrevisto
          }) => `
          <div
            class="agenda-mensal-item"
            data-id="${jogo.id}"
          >
            <div class="agenda-mensal-topo">
              <strong>${jogo.cliente_nome || "Mensalista"}</strong>
              <span>${formatarCompetenciaMensalidade(mensalidade.competencia)}</span>
            </div>

            <div class="agenda-mensal-info">
              ${horario.originalTexto} • ${jogo.local_recurso || "-"}
              • ${fmtAgenda(mensalidade.valor || jogo.valor_mensal || 0)}
            </div>

            <div class="agenda-mensal-datas">
              Jogos previstos:
              ${
                datas.length
                  ? datas.map(formatarDataCurtaAgenda).join(" • ")
                  : "sem datas previstas"
              }
            </div>

            <div class="agenda-mensal-pagamento">
              <i data-lucide="calendar-clock" width="15" height="15"></i>
              <span>
                Pagamento previsto:
                <strong>
                  ${
                    pagamentoPrevisto
                      ? formatarDataCompletaAgenda(pagamentoPrevisto)
                      : "sem previsão"
                  }
                </strong>
              </span>
            </div>
          </div>
        `).join("")
        : `
          <div class="agenda-gerenciar-sem-resultado">
            <strong>Nenhum mensalista encontrado neste mês.</strong>
            <small>Troque o mês pelo calendário ou limpe a busca.</small>
          </div>
        `
    }
  `;

  container
    .querySelectorAll(".agenda-mensal-item")
    .forEach(card => {
      card.addEventListener("click", () => {
        document.getElementById("modalSemanaAgenda")?.remove();

        abrirJogo(card.dataset.id, {
          forcarEdicao: true
        });
      });
    });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderizarDiaSemanaAgenda(dataISO) {
  const container =
    document.getElementById("agendaSemanaConteudo");

  if (!container) return;

  if (filtroTipoGerenciarHorariosAgenda === "mensais_mes") {
  renderizarMensaisDoMesAgenda(dataISO);
  return;
}

  const campos =
    obterLocaisAgenda();

  const slots =
    gerarSlotsPadraoArena();

  const dataFormatada =
    formatarDiaSemanaCurtoAgenda(dataISO);

  let jogosDia =
    agendaDados.filter(jogo => {
      return (
        String(jogo.data_agendamento || "").slice(0, 10) === dataISO &&
        jogo.status_jogo !== "cancelado"
      );
    });

  const totalJogosDia =
    jogosDia.length;

  container.innerHTML = `
    <div class="agenda-semana-dia-header">
      <strong>${dataFormatada}</strong>
      <span id="agendaGerenciarResumoDia">
        ${totalJogosDia} jogo(s) marcado(s)
      </span>
    </div>

    <div class="agenda-semana-grade">
      <table>
        <thead>
          <tr>
            <th>Horário</th>
            ${campos.map(campo => `<th>${campo}</th>`).join("")}
          </tr>
        </thead>

        <tbody>
          ${slots.map(([inicio, fim]) => `
            <tr>
              <td>
                <strong>${inicio}</strong>
                <small>${fim}</small>
              </td>

              ${campos.map(campo => {
                const jogo = jogosDia.find(j => {
                  return (
                    normalizarBuscaAgendaInline(j.local_recurso) === normalizarBuscaAgendaInline(campo) &&
                    horarioConflitaComJogo(inicio, fim, j)
                  );
                });

                if (!jogo) {
                  const textoLivre =
                    normalizarBuscaAgendaInline([
                      "livre",
                      campo,
                      inicio,
                      fim,
                      inicio.replace(":", ""),
                      fim.replace(":", "")
                    ].join(" "));

                  if (
                    filtroTipoGerenciarHorariosAgenda !== "todos" &&
                    filtroTipoGerenciarHorariosAgenda !== "livre"
                  ) {
                    return `<td class="agenda-semana-vazio"></td>`;
                  }

                  if (
                    buscaGerenciarHorariosAgenda &&
                    !textoLivre.includes(buscaGerenciarHorariosAgenda)
                  ) {
                    return `<td class="agenda-semana-vazio"></td>`;
                  }

                  return `
                    <td
                      class="agenda-semana-livre agenda-semana-clicavel"
                      data-campo="${campo}"
                      data-inicio="${inicio}"
                      data-fim="${fim}"
                    >
                      <strong>Livre</strong>
                      <small>Novo horário</small>
                    </td>
                  `;
                }

                const ehMensal =
                  jogoEhMensalAgenda(jogo);

                const tipo =
                  ehMensal ? "mensal" : "avulso";

                if (
                  filtroTipoGerenciarHorariosAgenda !== "todos" &&
                  filtroTipoGerenciarHorariosAgenda !== tipo
                ) {
                  return `<td class="agenda-semana-vazio"></td>`;
                }

                const jogadores =
                  (jogadoresPorAgenda[jogo.id] || [])
                    .filter(j => j.removido !== true);

                const textoBusca =
                  normalizarBuscaAgendaInline([
                    jogo.cliente_nome,
                    jogo.local_recurso,
                    tipo,
                    inicio,
                    fim,
                    jogadores.map(j => j.nome).join(" ")
                  ].join(" "));

                if (
                  buscaGerenciarHorariosAgenda &&
                  !textoBusca.includes(buscaGerenciarHorariosAgenda)
                ) {
                  return `<td class="agenda-semana-vazio"></td>`;
                }

                return `
                  <td
                    class="agenda-semana-ocupado ${ehMensal ? "mensal" : "avulso"}"
                    data-id="${jogo.id}"
                  >
                    <strong>${jogo.cliente_nome || "Jogo"}</strong>
                    <small>
                      ${ehMensal ? "Mensal" : "Avulso"}
                      •
                      ${formatarHora(jogo.hora_inicio)} às ${formatarHora(jogo.hora_fim)}
                    </small>
                  </td>
                `;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  container
    .querySelectorAll(".agenda-semana-ocupado")
    .forEach(td => {
      td.addEventListener("click", () => {
        document.getElementById("modalSemanaAgenda")?.remove();

        abrirJogo(td.dataset.id, {
          forcarEdicao: true
        });
      });
    });

  container
    .querySelectorAll(".agenda-semana-livre")
    .forEach(td => {
      td.addEventListener("click", () => {
        document.getElementById("modalSemanaAgenda")?.remove();

        abrirNovoJogo();

        document.getElementById("dataAgendamento").value =
          dataISO;

        popularSelectLocalRecurso(td.dataset.campo || "");

        document.getElementById("horaInicio").value =
          td.dataset.inicio || "";

        document.getElementById("horaFim").value =
          td.dataset.fim || "";

        aplicarValorPadraoAgendaNoModal();
      });
    });

    const resultadosGerenciar =
  container.querySelectorAll(".agenda-semana-ocupado, .agenda-semana-livre");

const resumoGerenciar =
  document.getElementById("agendaGerenciarResumoDia");

if (resumoGerenciar) {
  if (buscaGerenciarHorariosAgenda) {
    resumoGerenciar.textContent =
      resultadosGerenciar.length === 1
        ? "1 horário encontrado neste dia"
        : `${resultadosGerenciar.length} horários encontrados neste dia`;
  } else {
    resumoGerenciar.textContent =
      totalJogosDia === 1
        ? "1 jogo marcado"
        : `${totalJogosDia} jogo(s) marcado(s)`;
  }
}

if (
  buscaGerenciarHorariosAgenda &&
  resultadosGerenciar.length === 0
) {
  const aviso = document.createElement("div");

  aviso.className = "agenda-gerenciar-sem-resultado";

  aviso.innerHTML = `
    <strong>Nenhum horário encontrado neste dia.</strong>
    <small>
      Tente outro dia, use “Próximo dia” ou limpe a busca para ver todos os horários.
    </small>
  `;

  container.appendChild(aviso);
}

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderizarAgendaInline() {
  const tbody =
    document.getElementById("agendaInlineTabela");

  if (!tbody) return;

  garantirBotoesDataAgendaInline();

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

atualizarContadoresAgendaInline(linhas);

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
  .querySelectorAll(".btn-agenda-inline-caixa")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      abrirCobrancaAgendaInline(btn.dataset.id);
    });
  });

  tbody
  .querySelectorAll(".btn-agenda-inline-ver")
  .forEach(btn => {
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      abrirJogo(btn.dataset.id, {
        forcarEdicao: true
      });
    });
  });

tbody
  .querySelectorAll(".btn-agenda-inline-cancelar")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      cancelarJogo(btn.dataset.id);
    });
  });

tbody
  .querySelectorAll(".btn-agenda-inline-renovar")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      renovarMensalidadeAgenda(btn.dataset.id);
    });
  });

  tbody
    .querySelectorAll(".btn-agenda-inline-novo")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        abrirNovoJogo();

        document.getElementById("dataAgendamento").value =
          document.getElementById("filtroData")?.value || hojeISOAgenda();

popularSelectLocalRecurso(btn.dataset.campo || "");

        document.getElementById("horaInicio").value =
          btn.dataset.inicio || "";

        document.getElementById("horaFim").value =
          btn.dataset.fim || "";
          aplicarValorPadraoAgendaNoModal();

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

    const cicloMensal =
  mensalidade
    ? calcularIndiceJogoMensal(jogo, mensalidade)
    : null;

  const tipoTexto =
    ehMensal
      ? "Mensal"
      : jogo.tipo_jogo === "evento"
        ? "Evento"
        : jogo.tipo_jogo === "campeonato"
          ? "Campeonato"
          : "Avulso";

const resumoPagamento =
  obterResumoPagamentoAgenda(jogo);

const pagamentoTexto =
  ehMensal
    ? (
        mensalidade?.status === "pago"
          ? "Mensalidade paga"
          : "Mensalidade pendente"
      )
    : resumoPagamento.texto;

const pagamentoClasse =
  ehMensal
    ? (
        mensalidade?.status === "pago"
          ? "pago"
          : "pendente"
      )
    : resumoPagamento.classe;

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
          ${status === "cobranca" ? "Cobrança" : status === "fechado" ? "Pago" : status}
        </span>
      </td>

      <td>${jogadores.length}</td>

      <td>
        <span class="agenda-inline-pagamento ${pagamentoClasse}">
          ${pagamentoTexto}
        </span>
      </td>

      <td class="right">
  <div class="agenda-inline-actions-row">

    <button
      type="button"
      class="agenda-inline-action btn-agenda-inline-ver"
      data-id="${jogo.id}"
      title="Editar jogo"
    >
      <i data-lucide="pencil" width="16" height="16"></i>
    </button>

    ${
      pagamentoClasse === "pendente"
        ? `
          <button
            type="button"
            class="agenda-inline-action receber btn-agenda-inline-caixa"
            data-id="${jogo.id}"
            title="Receber no caixa"
          >
            <i data-lucide="wallet" width="16" height="16"></i>
          </button>
        `
          : ""
    }

${
ehMensal &&
mensalidade?.status === "pago" &&
cicloMensal &&
cicloMensal.atual >= cicloMensal.total &&
mensalidade.renovacao_status !== "renovada"
    ? `
      <button
        type="button"
        class="agenda-inline-action renovar btn-agenda-inline-renovar"
        data-id="${mensalidade.id}"
        title="Renovar próximo mês"
      >
        <i data-lucide="rotate-cw" width="16" height="16"></i>
      </button>
    `
    : ""
}

    <button
      type="button"
      class="agenda-inline-action cancelar btn-agenda-inline-cancelar"
      data-id="${jogo.id}"
      title="Cancelar jogo"
    >
      <i data-lucide="ban" width="16" height="16"></i>
    </button>

  </div>
</td>
    </tr>
  `;
}
