// ======================================================
// CRV PDV - COMANDAS
// Supabase + RLS por empresa
// ======================================================

let comandas = [];
let comandasFiltradas = [];
let comandaEditando = null;
let comandasInicializado = false;

// ======================================================
// FORMATADORES
// ======================================================

const fmt = valor => {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

function formatarDataHoraBrasil(data) {
  if (!data) return "—";

  let dataNormalizada = String(data);

  if (
    dataNormalizada.includes("T") &&
    !dataNormalizada.endsWith("Z") &&
    !dataNormalizada.includes("+")
  ) {
    dataNormalizada += "Z";
  }

  const objetoData = new Date(dataNormalizada);

  if (Number.isNaN(objetoData.getTime())) {
    return "—";
  }

  return objetoData.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  });
}

function obterEmpresaIdComandas() {
  return window.APP_EMPRESA_ID || APP_EMPRESA_ID || null;
}

function sistemaOnlineComandas() {
  return Boolean(
    window.APP_STATUS &&
    APP_STATUS.online &&
    APP_STATUS.supabase_ok &&
    window.sb &&
    obterEmpresaIdComandas()
  );
}

function logComandas(mensagem, tipo = "info") {
  if (typeof logSistema === "function") {
    logSistema("COMANDAS", mensagem, tipo);
  } else {
    console.log(`[CRV PDV][COMANDAS] ${mensagem}`);
  }
}

// ======================================================
// AGUARDAR CONTEXTO
// ======================================================

async function aguardarContextoComandas() {
  const tentativasMaximas = 40;
  let tentativa = 0;

  while (tentativa < tentativasMaximas) {
    if (sistemaOnlineComandas()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativa++;
  }

  return false;
}

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  logComandas("Inicializando tela...");

  setupEventosComandas();

  const pronto = await aguardarContextoComandas();

  if (!pronto) {
    logComandas("Supabase/Auth não ficou pronto a tempo.", "error");
    renderTabelaComandas();
    return;
  }

  await carregarComandas();

  comandasInicializado = true;

  logComandas("Tela pronta.", "success");
});

// ======================================================
// EVENTOS
// ======================================================

function setupEventosComandas() {
  const btnNova = document.getElementById("btnNovaComanda");
  const btnGerarLote = document.getElementById("btnGerarLote");

  const btnFecharModal = document.getElementById("btnFecharModalComanda");
  const btnCancelarModal = document.getElementById("btnCancelarModalComanda");
  const btnSalvar = document.getElementById("btnSalvarComanda");

  const btnFecharLote = document.getElementById("btnFecharModalLote");
  const btnCancelarLote = document.getElementById("btnCancelarModalLote");
  const btnConfirmarLote = document.getElementById("btnConfirmarLote");

  const inputBusca = document.getElementById("inputBuscaComanda");
  const filtroStatus = document.getElementById("filtroStatusComanda");

  const loteInicio = document.getElementById("loteInicio");
  const loteFim = document.getElementById("loteFim");
  const lotePrefixo = document.getElementById("lotePrefixo");
  const loteDigitos = document.getElementById("loteDigitos");

  if (btnNova) {
    btnNova.onclick = abrirModalNovaComanda;
  }

  if (btnGerarLote) {
    btnGerarLote.onclick = abrirModalLote;
  }

  if (btnFecharModal) {
    btnFecharModal.onclick = fecharModalComanda;
  }

  if (btnCancelarModal) {
    btnCancelarModal.onclick = fecharModalComanda;
  }

  if (btnSalvar) {
    btnSalvar.onclick = salvarComanda;
  }

  if (btnFecharLote) {
    btnFecharLote.onclick = fecharModalLote;
  }

  if (btnCancelarLote) {
    btnCancelarLote.onclick = fecharModalLote;
  }

  if (btnConfirmarLote) {
    btnConfirmarLote.onclick = gerarLoteComandas;
  }

  if (inputBusca) {
    inputBusca.addEventListener("input", aplicarFiltrosComandas);
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", aplicarFiltrosComandas);
  }

  [loteInicio, loteFim, lotePrefixo, loteDigitos].forEach(input => {
    if (input) {
      input.addEventListener("input", atualizarPreviewLote);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      fecharModalComanda();
      fecharModalLote();
    }
  });
}

// ======================================================
// SUPABASE
// ======================================================

async function carregarComandas() {
  try {
    const empresaId = obterEmpresaIdComandas();

    const { data, error } = await sb
      .from("comandas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("codigo", { ascending: true });

    if (error) throw error;

    comandas = Array.isArray(data) ? data : [];

    aplicarFiltrosComandas();

  } catch (err) {
    comandas = [];
    comandasFiltradas = [];

    logComandas("Erro ao carregar comandas: " + err.message, "error");
    alert("Erro ao carregar comandas: " + err.message);

    renderCardsComandas();
    renderTabelaComandas();
  }
}

// ======================================================
// FILTROS
// ======================================================

function aplicarFiltrosComandas() {
  const termo = String(
    document.getElementById("inputBuscaComanda")?.value || ""
  ).toLowerCase().trim();

  const status = String(
    document.getElementById("filtroStatusComanda")?.value || "todos"
  );

  comandasFiltradas = comandas.filter(comanda => {
    const codigo = String(comanda.codigo || "").toLowerCase();
    const nome = String(comanda.nome_cliente || "").toLowerCase();
    const obs = String(comanda.observacoes || "").toLowerCase();
    const statusAtual = String(comanda.status || "").toLowerCase();

    const bateBusca =
      !termo ||
      codigo.includes(termo) ||
      nome.includes(termo) ||
      obs.includes(termo);

    const bateStatus =
      status === "todos" ||
      statusAtual === status;

    return bateBusca && bateStatus;
  });

  renderCardsComandas();
  renderTabelaComandas();
}

// ======================================================
// RENDER CARDS
// ======================================================

function renderCardsComandas() {
  const total = comandas.length;

  const livres = comandas.filter(c => c.status === "livre").length;
  const abertas = comandas.filter(c => c.status === "aberta").length;

  const totalAberto = comandas
    .filter(c => c.status === "aberta")
    .reduce((acc, c) => acc + Number(c.total || 0), 0);

  const cardTotal = document.getElementById("cardTotalComandas");
  const cardLivres = document.getElementById("cardLivres");
  const cardAbertas = document.getElementById("cardAbertas");
  const cardTotalAberto = document.getElementById("cardTotalAberto");

  if (cardTotal) cardTotal.textContent = total;
  if (cardLivres) cardLivres.textContent = livres;
  if (cardAbertas) cardAbertas.textContent = abertas;
  if (cardTotalAberto) cardTotalAberto.textContent = fmt(totalAberto);
}

// ======================================================
// RENDER TABELA
// ======================================================

function renderTabelaComandas() {
  const tbody = document.getElementById("tbodyComandas");
  const totalLista = document.getElementById("totalListaComandas");

  if (!tbody) return;

  if (totalLista) {
    totalLista.textContent = `${comandasFiltradas.length} registros`;
  }

  if (!comandasFiltradas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <i data-lucide="ticket" width="32" height="32"></i>
            <p>Nenhuma comanda encontrada</p>
          </div>
        </td>
      </tr>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  tbody.innerHTML = "";

  comandasFiltradas.forEach(comanda => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <strong style="color:var(--text-primary);font-family:var(--font-display);">
          ${comanda.codigo || "—"}
        </strong>
      </td>

      <td>
        <span>${comanda.nome_cliente || "—"}</span>
        ${
          comanda.observacoes
            ? `<small style="display:block;color:var(--text-muted);margin-top:3px;">${comanda.observacoes}</small>`
            : ""
        }
      </td>

      <td>
        <span class="comanda-status-badge ${comanda.status || "livre"}">
          ${comanda.status || "livre"}
        </span>
      </td>

      <td>
        <strong style="color:var(--crv-green);font-family:var(--font-display);">
          ${fmt(comanda.total || 0)}
        </strong>
      </td>

      <td>${formatarDataHoraBrasil(comanda.data_abertura)}</td>

      <td>${formatarDataHoraBrasil(comanda.data_fechamento)}</td>

      <td class="text-right">
        <div class="comanda-actions-table">

          <button
            class="comanda-action-btn"
            title="Editar"
            onclick="editarComanda('${comanda.id}')"
          >
            <i data-lucide="pencil" width="15" height="15"></i>
          </button>

          <button
            class="comanda-action-btn"
            title="Liberar para novo uso"
            onclick="liberarComanda('${comanda.id}')"
          >
            <i data-lucide="refresh-cw" width="15" height="15"></i>
          </button>

          <button
            class="comanda-action-btn danger"
            title="Cancelar"
            onclick="cancelarComanda('${comanda.id}')"
          >
            <i data-lucide="ban" width="15" height="15"></i>
          </button>

          <button
            class="comanda-action-btn danger"
            title="Excluir"
            onclick="excluirComanda('${comanda.id}')"
          >
            <i data-lucide="trash-2" width="15" height="15"></i>
          </button>

        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// MODAL NOVA / EDITAR
// ======================================================

function abrirModalNovaComanda() {
  comandaEditando = null;

  const titulo = document.getElementById("modalComandaTitulo");
  const id = document.getElementById("comandaId");
  const codigo = document.getElementById("comandaCodigoInput");
  const nome = document.getElementById("comandaNomeInput");
  const obs = document.getElementById("comandaObservacoesInput");

  if (titulo) titulo.textContent = "Nova Comanda";
  if (id) id.value = "";
  if (codigo) codigo.value = "";
  if (nome) nome.value = "";
  if (obs) obs.value = "";

  const modal = document.getElementById("modalComanda");

  if (modal) {
    modal.style.display = "flex";
  }

  setTimeout(() => codigo?.focus(), 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function editarComanda(id) {
  const comanda = comandas.find(c => c.id === id);

  if (!comanda) {
    alert("Comanda não encontrada.");
    return;
  }

  comandaEditando = comanda;

  const titulo = document.getElementById("modalComandaTitulo");
  const inputId = document.getElementById("comandaId");
  const codigo = document.getElementById("comandaCodigoInput");
  const nome = document.getElementById("comandaNomeInput");
  const obs = document.getElementById("comandaObservacoesInput");

  if (titulo) titulo.textContent = "Editar Comanda";
  if (inputId) inputId.value = comanda.id;
  if (codigo) codigo.value = comanda.codigo || "";
  if (nome) nome.value = comanda.nome_cliente || "";
  if (obs) obs.value = comanda.observacoes || "";

  const modal = document.getElementById("modalComanda");

  if (modal) {
    modal.style.display = "flex";
  }

  setTimeout(() => codigo?.focus(), 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalComanda() {
  const modal = document.getElementById("modalComanda");

  if (modal) {
    modal.style.display = "none";
  }
}

async function salvarComanda() {
  if (!sistemaOnlineComandas()) {
    alert("Sistema sem conexão com Supabase.");
    return;
  }

  const id = String(document.getElementById("comandaId")?.value || "").trim();
  const codigo = String(document.getElementById("comandaCodigoInput")?.value || "").trim();
  const nome = String(document.getElementById("comandaNomeInput")?.value || "").trim();
  const obs = String(document.getElementById("comandaObservacoesInput")?.value || "").trim();

  if (!codigo) {
    alert("Informe o código da comanda.");
    return;
  }

  const empresaId = obterEmpresaIdComandas();

  try {
    if (id) {
      const { error } = await sb
        .from("comandas")
        .update({
          codigo: codigo,
          nome_cliente: nome || null,
          observacoes: obs || null
        })
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;
    } else {
      const { error } = await sb
        .from("comandas")
        .insert([
          {
            empresa_id: empresaId,
            codigo: codigo,
            nome_cliente: nome || null,
            observacoes: obs || null,
            status: "livre",
            total: 0
          }
        ]);

      if (error) throw error;
    }

    fecharModalComanda();
    await carregarComandas();

  } catch (err) {
    if (String(err.message || "").includes("duplicate")) {
      alert("Já existe uma comanda com esse código.");
    } else {
      alert("Erro ao salvar comanda: " + err.message);
    }

    console.error(err);
  }
}

// ======================================================
// LOTE DE COMANDAS
// ======================================================

function abrirModalLote() {
  const modal = document.getElementById("modalLoteComandas");

  if (modal) {
    modal.style.display = "flex";
  }

  atualizarPreviewLote();

  setTimeout(() => {
    document.getElementById("loteInicio")?.focus();
  }, 80);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function fecharModalLote() {
  const modal = document.getElementById("modalLoteComandas");

  if (modal) {
    modal.style.display = "none";
  }
}

function gerarCodigoLote(numero, digitos, prefixo) {
  const numeroFormatado = String(numero).padStart(digitos, "0");

  return `${prefixo || ""}${numeroFormatado}`;
}

function atualizarPreviewLote() {
  const inicio = Number(document.getElementById("loteInicio")?.value || 1);
  const fim = Number(document.getElementById("loteFim")?.value || 100);
  const prefixo = String(document.getElementById("lotePrefixo")?.value || "").trim();
  const digitos = Math.max(1, Number(document.getElementById("loteDigitos")?.value || 3));

  const preview = document.getElementById("lotePreview");

  if (!preview) return;

  const exemplo1 = gerarCodigoLote(inicio, digitos, prefixo);
  const exemplo2 = gerarCodigoLote(inicio + 1, digitos, prefixo);
  const exemplo3 = gerarCodigoLote(inicio + 2, digitos, prefixo);

  preview.textContent = `Exemplo: ${exemplo1}, ${exemplo2}, ${exemplo3}... até ${gerarCodigoLote(fim, digitos, prefixo)}`;
}

async function gerarLoteComandas() {
  if (!sistemaOnlineComandas()) {
    alert("Sistema sem conexão com Supabase.");
    return;
  }

  const inicio = Number(document.getElementById("loteInicio")?.value || 1);
  const fim = Number(document.getElementById("loteFim")?.value || 100);
  const prefixo = String(document.getElementById("lotePrefixo")?.value || "").trim();
  const digitos = Math.max(1, Number(document.getElementById("loteDigitos")?.value || 3));

  if (inicio <= 0 || fim <= 0 || fim < inicio) {
    alert("Informe um intervalo válido.");
    return;
  }

  const quantidade = fim - inicio + 1;

  if (quantidade > 500) {
    alert("Gere no máximo 500 comandas por vez.");
    return;
  }

  const confirmar = confirm(
    `Gerar ${quantidade} comandas?\n\nDe ${gerarCodigoLote(inicio, digitos, prefixo)} até ${gerarCodigoLote(fim, digitos, prefixo)}`
  );

  if (!confirmar) return;

  const empresaId = obterEmpresaIdComandas();

  const payload = [];

  for (let numero = inicio; numero <= fim; numero++) {
    payload.push({
      empresa_id: empresaId,
      codigo: gerarCodigoLote(numero, digitos, prefixo),
      status: "livre",
      total: 0
    });
  }

  try {
    const { error } = await sb
      .from("comandas")
      .upsert(payload, {
        onConflict: "empresa_id,codigo",
        ignoreDuplicates: true
      });

    if (error) throw error;

    fecharModalLote();
    await carregarComandas();

    alert("Lote de comandas gerado com sucesso.");

  } catch (err) {
    alert("Erro ao gerar lote: " + err.message);
    console.error(err);
  }
}

// ======================================================
// AÇÕES
// ======================================================

async function liberarComanda(id) {
  const comanda = comandas.find(c => c.id === id);

  if (!comanda) return;

  if (comanda.status === "aberta") {
    const confirmarAberta = confirm(
      `A comanda ${comanda.codigo} está aberta.\n\nLiberar mesmo assim apagará os itens vinculados a ela.`
    );

    if (!confirmarAberta) return;

    await apagarItensComanda(id);
  }

  if (comanda.status === "fechada" || comanda.status === "cancelada" || comanda.status === "aberta") {
    const confirmar = confirm(
      `Liberar comanda ${comanda.codigo} para novo uso?`
    );

    if (!confirmar) return;
  }

  try {
    const { error } = await sb
      .from("comandas")
      .update({
        status: "livre",
        data_abertura: null,
        data_fechamento: null,
        total: 0
      })
      .eq("id", id)
      .eq("empresa_id", obterEmpresaIdComandas());

    if (error) throw error;

    await apagarItensComanda(id);
    await carregarComandas();

  } catch (err) {
    alert("Erro ao liberar comanda: " + err.message);
    console.error(err);
  }
}

async function cancelarComanda(id) {
  const comanda = comandas.find(c => c.id === id);

  if (!comanda) return;

  if (comanda.status === "fechada") {
    alert("Comanda fechada não deve ser cancelada. Use liberar para novo uso.");
    return;
  }

  const confirmar = confirm(
    `Cancelar comanda ${comanda.codigo}?`
  );

  if (!confirmar) return;

  try {
    const { error } = await sb
      .from("comandas")
      .update({
        status: "cancelada",
        data_fechamento: new Date().toISOString()
      })
      .eq("id", id)
      .eq("empresa_id", obterEmpresaIdComandas());

    if (error) throw error;

    await carregarComandas();

  } catch (err) {
    alert("Erro ao cancelar comanda: " + err.message);
    console.error(err);
  }
}

async function excluirComanda(id) {
  const comanda = comandas.find(c => c.id === id);

  if (!comanda) return;

  if (comanda.status === "aberta") {
    alert("Não é recomendado excluir uma comanda aberta. Cancele ou libere antes.");
    return;
  }

  const confirmar = confirm(
    `Excluir comanda ${comanda.codigo}?\n\nEssa ação não poderá ser desfeita.`
  );

  if (!confirmar) return;

  try {
    await apagarItensComanda(id);

    const { error } = await sb
      .from("comandas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", obterEmpresaIdComandas());

    if (error) throw error;

    await carregarComandas();

  } catch (err) {
    alert("Erro ao excluir comanda: " + err.message);
    console.error(err);
  }
}

async function apagarItensComanda(id) {
  const { error } = await sb
    .from("comanda_itens")
    .delete()
    .eq("comanda_id", id)
    .eq("empresa_id", obterEmpresaIdComandas());

  if (error) {
    throw error;
  }
}