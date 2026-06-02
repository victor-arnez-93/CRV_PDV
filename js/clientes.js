// ======================================================
// CRV PDV - CLIENTES
// Supabase real + empresa_id + RLS por empresa
// ======================================================

// ===== ESTADO =====
let clientes = [];
let filtroAtivo = "todos";
let idExcluirCliente = null;

// ======================================================
// HELPERS
// ======================================================

function logClientes(mensagem, tipo = "info") {
  if (typeof logSistema === "function") {
    logSistema("CLIENTES", mensagem, tipo);
  } else {
    console.log(`[CRV PDV][CLIENTES] ${mensagem}`);
  }
}

function obterEmpresaIdClientes() {
  return window.APP_EMPRESA_ID || APP_EMPRESA_ID || null;
}

function sistemaOnlineClientes() {
  return Boolean(
    window.APP_STATUS &&
    APP_STATUS.online &&
    APP_STATUS.supabase_ok &&
    window.sb &&
    obterEmpresaIdClientes()
  );
}

async function aguardarContextoClientes() {
  let tentativas = 0;

  while (tentativas < 40) {
    if (sistemaOnlineClientes()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    tentativas++;
  }

  return false;
}

function formatarDataCliente(valor) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleDateString("pt-BR");
}

function normalizarTelefone(valor) {
  return String(valor || "").trim();
}

function formatarNomeCliente(nome, finalizar = false) {
  const excecoes = ["da", "das", "de", "do", "dos", "e"];

  let texto = String(nome || "").toLowerCase();

  if (finalizar) {
    texto = texto.trim().replace(/\s+/g, " ");
  }

  return texto
    .split(" ")
    .map((parte, indice) => {
      if (!parte) return parte;

      if (
        indice > 0 &&
        excecoes.includes(parte)
      ) {
        return parte;
      }

      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(" ");
}

// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  logClientes("Inicializando...");

  const pronto = await aguardarContextoClientes();

  if (!pronto) {
    logClientes("Supabase/Auth não ficou pronto a tempo.", "error");
    renderClientes();

    if (typeof crvAtualizarStatusCaixaGlobal === "function") {
      crvAtualizarStatusCaixaGlobal();
    }

    return;
  }

  await carregarClientes();

  renderClientes();

  if (typeof crvAtualizarStatusCaixaGlobal === "function") {
    crvAtualizarStatusCaixaGlobal();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
});

// ======================================================
// SUPABASE - CARREGAR
// ======================================================

async function carregarClientes() {
  try {
    if (!sistemaOnlineClientes()) {
      throw new Error("Sistema sem conexão com Supabase.");
    }

    const empresaId = obterEmpresaIdClientes();

    logClientes("Buscando clientes do Supabase...");

    const { data, error } = await sb
      .from("clientes")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    clientes = Array.isArray(data)
      ? data.map(cliente => ({
          id: cliente.id,
          empresa_id: cliente.empresa_id,
          nome: cliente.nome || "",
          telefone: cliente.telefone || "",
          obs: cliente.obs || "",
          created_at: cliente.created_at || null,
          data: cliente.created_at
            ? String(cliente.created_at).slice(0, 10)
            : ""
        }))
      : [];

    logClientes(`${clientes.length} cliente(s) carregado(s).`, "success");

  } catch (err) {
    clientes = [];

    logClientes("Erro ao carregar clientes: " + err.message, "error");
  }
}

// ======================================================
// FILTROS
// ======================================================

function setFiltro(btn, filtro) {
  document
    .querySelectorAll(".filtro-btn")
    .forEach(botao => botao.classList.remove("active"));

  if (btn) {
    btn.classList.add("active");
  }

  filtroAtivo = filtro;
  renderClientes();
}

function getClientesFiltrados() {
  const texto = String(
    document.getElementById("filtroTexto")?.value || ""
  )
    .toLowerCase()
    .trim();

  let lista = [...clientes];

  if (filtroAtivo === "recentes") {
    const hoje = new Date().toISOString().slice(0, 10);

    lista = lista.filter(cliente => {
      const dataCliente = cliente.created_at
        ? String(cliente.created_at).slice(0, 10)
        : cliente.data;

      return dataCliente === hoje;
    });
  }

  if (texto) {
    const textoNumerico = texto.replace(/\D/g, "");

    lista = lista.filter(cliente => {
      const nome = String(cliente.nome || "").toLowerCase();
      const telefone = String(cliente.telefone || "").replace(/\D/g, "");

      return (
        nome.includes(texto) ||
        telefone.includes(textoNumerico)
      );
    });
  }

  return lista;
}

// ======================================================
// RENDER
// ======================================================

function renderClientes() {
  const container = document.getElementById("clientesLista");
  const subtitle = document.getElementById("subtitleClientes");

  if (!container) return;

  const lista = getClientesFiltrados();

  if (subtitle) {
    subtitle.textContent = `${clientes.length} cliente(s) cadastrado(s)`;
  }

  if (!lista.length) {
    container.innerHTML = `
      <div class="clientes-empty">
        <i data-lucide="users" width="40" height="40" style="opacity:0.3;"></i>
        <p>Nenhum cliente encontrado</p>

        <button class="btn-ghost" onclick="abrirModalNovo()">
          <i data-lucide="user-plus" width="14" height="14"></i>
          Adicionar cliente
        </button>
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  container.innerHTML = lista.map(cliente => {
    const nome = cliente.nome || "Cliente";
    const iniciais = nome
      .split(" ")
      .filter(Boolean)
      .map(parte => parte[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const dataFmt = formatarDataCliente(cliente.created_at || cliente.data);

    return `
      <div class="cliente-card">

        <div class="cliente-avatar">
          ${iniciais || "CL"}
        </div>

        <div class="cliente-info">
          <span class="cliente-nome">${nome}</span>

          ${
            cliente.telefone
              ? `
                <span class="cliente-telefone">
                  <i data-lucide="phone" width="11" height="11"></i>
                  ${cliente.telefone}
                </span>
              `
              : ""
          }

          ${
            cliente.obs
              ? `<span class="cliente-obs">${cliente.obs}</span>`
              : ""
          }

          <span class="cliente-data">
            Cadastrado em ${dataFmt}
          </span>
        </div>

        <div class="cliente-actions">
          ${
            cliente.telefone
              ? `
                <button
                  class="cliente-btn whatsapp"
                  onclick="abrirWhatsApp('${cliente.telefone}')"
                  title="WhatsApp"
                >
                  <i data-lucide="message-circle" width="13" height="13"></i>
                </button>
              `
              : ""
          }

          <button
            class="cliente-btn"
            onclick="abrirModalEditar('${cliente.id}')"
            title="Editar"
          >
            <i data-lucide="pencil" width="13" height="13"></i>
          </button>

          <button
            class="cliente-btn danger"
            onclick="confirmarExcluir('${cliente.id}')"
            title="Remover"
          >
            <i data-lucide="trash-2" width="13" height="13"></i>
          </button>
        </div>

      </div>
    `;
  }).join("");

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// MODAL NOVO
// ======================================================

function abrirModalNovo() {
  const titulo = document.getElementById("modalClienteTitulo");

  if (titulo) {
    titulo.textContent = "Novo Cliente";
  }

  document.getElementById("clienteId").value = "";
  document.getElementById("clienteNome").value = "";
  document.getElementById("clienteTelefone").value = "";
  document.getElementById("clienteObs").value = "";

  const modal = document.getElementById("modalCliente");

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }

setTimeout(() => {

  const campoNome =
    document.getElementById("clienteNome");

  if (campoNome) {

    campoNome.addEventListener("input", () => {

      const cursor = campoNome.selectionStart;

    campoNome.value =
      formatarNomeCliente(campoNome.value, false);

      campoNome.setSelectionRange(
        cursor,
        cursor
      );
    });

    campoNome.focus();
  }

}, 100);
}

// ======================================================
// MODAL EDITAR
// ======================================================

function abrirModalEditar(id) {
  const cliente = clientes.find(item => item.id === id);

  if (!cliente) {
    alert("Cliente não encontrado.");
    return;
  }

  document.getElementById("modalClienteTitulo").textContent = "Editar Cliente";
  document.getElementById("clienteId").value = cliente.id;
  document.getElementById("clienteNome").value = cliente.nome || "";
  document.getElementById("clienteTelefone").value = cliente.telefone || "";
  document.getElementById("clienteObs").value = cliente.obs || "";

  const modal = document.getElementById("modalCliente");

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ======================================================
// SALVAR
// ======================================================

async function salvarCliente() {
  const nome = formatarNomeCliente(
    document.getElementById("clienteNome")?.value,
    true
  );

  const telefone = normalizarTelefone(
    document.getElementById("clienteTelefone")?.value
  );

  const obs = String(
    document.getElementById("clienteObs")?.value || ""
  ).trim();

  const id = String(
    document.getElementById("clienteId")?.value || ""
  ).trim();

  if (!nome) {
    alert("Informe o nome do cliente.");
    return;
  }

  if (!sistemaOnlineClientes()) {
    alert("Sistema sem conexão com Supabase. Aguarde e tente novamente.");
    return;
  }

  try {
    const empresaId = obterEmpresaIdClientes();

    const payload = {
      empresa_id: empresaId,
      nome: nome,
      telefone: telefone || null,
      obs: obs || null
    };

    if (id) {
      const { error } = await sb
        .from("clientes")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      logClientes("Cliente atualizado.", "success");

    } else {
      const { error } = await sb
        .from("clientes")
        .insert([payload]);

      if (error) throw error;

      logClientes("Cliente criado.", "success");
    }

    fecharModal();

    await carregarClientes();
    renderClientes();

  } catch (err) {
    logClientes("Erro ao salvar cliente: " + err.message, "error");
    alert("Erro ao salvar cliente: " + err.message);
  }
}

// ======================================================
// EXCLUIR
// ======================================================

function confirmarExcluir(id) {
  const cliente = clientes.find(item => item.id === id);

  if (!cliente) {
    alert("Cliente não encontrado.");
    return;
  }

  idExcluirCliente = id;

  const msg = document.getElementById("msgExcluir");

  if (msg) {
    msg.textContent = `"${cliente.nome}" será removido da lista de clientes.`;
  }

  const btn = document.getElementById("btnConfirmarExcluir");

  if (btn) {
    btn.onclick = () => excluirCliente(id);
  }

  const modal = document.getElementById("modalExcluir");

  if (modal) {
    modal.style.display = "flex";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

async function excluirCliente(id) {
  if (!sistemaOnlineClientes()) {
    alert("Sistema sem conexão com Supabase.");
    return;
  }

  try {
    const empresaId = obterEmpresaIdClientes();

    const { error } = await sb
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;

    logClientes("Cliente removido.", "success");

    idExcluirCliente = null;

    fecharModal();

    await carregarClientes();
    renderClientes();

  } catch (err) {
    logClientes("Erro ao excluir cliente: " + err.message, "error");
    alert("Erro ao excluir cliente: " + err.message);
  }
}

// ======================================================
// WHATSAPP
// ======================================================

function abrirWhatsApp(telefone) {
  const numero = String(telefone || "").replace(/\D/g, "");

  if (!numero) return;

  const completo = numero.startsWith("55")
    ? numero
    : "55" + numero;

  window.open(`https://wa.me/${completo}`, "_blank");
}

// ======================================================
// MÁSCARA TELEFONE
// ======================================================

function mascaraTelefone(input) {
  let valor = String(input.value || "")
    .replace(/\D/g, "")
    .slice(0, 11);

  if (valor.length > 10) {
    valor = valor.replace(
      /^(\d{2})(\d{5})(\d{4})$/,
      "($1) $2-$3"
    );
  } else if (valor.length > 6) {
    valor = valor.replace(
      /^(\d{2})(\d{4})(\d{0,4})$/,
      "($1) $2-$3"
    );
  } else if (valor.length > 2) {
    valor = valor.replace(
      /^(\d{2})(\d{0,5})$/,
      "($1) $2"
    );
  } else {
    valor = valor.replace(
      /^(\d*)$/,
      "($1"
    );
  }

  input.value = valor;
}

// ======================================================
// STATUS CAIXA
// ======================================================

function atualizarStatusCaixa() {
  if (typeof crvAtualizarStatusCaixaGlobal === "function") {
    crvAtualizarStatusCaixaGlobal();
  }
}

// ======================================================
// MODAIS
// ======================================================

function fecharModal() {
  const modalCliente = document.getElementById("modalCliente");
  const modalExcluir = document.getElementById("modalExcluir");

  if (modalCliente) {
    modalCliente.style.display = "none";
  }

  if (modalExcluir) {
    modalExcluir.style.display = "none";
  }
}

// ======================================================
// CONFIG GLOBAL
// ======================================================

setTimeout(() => {
  if (typeof crvCarregarConfiguracoesEmpresa === "function") {
    crvCarregarConfiguracoesEmpresa();
  }
}, 900);