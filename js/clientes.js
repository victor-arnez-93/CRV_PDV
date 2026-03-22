// ===== ESTADO =====
let clientes = JSON.parse(localStorage.getItem('crv-clientes')) || [
  { id: 1, nome: 'João Silva',    telefone: '(15) 99812-3456', obs: 'Arena 28 — time azul',  data: '2026-03-20' },
  { id: 2, nome: 'Pedro Alves',   telefone: '(15) 99734-5678', obs: 'Jogador fut de areia',  data: '2026-03-21' },
  { id: 3, nome: 'Ana Souza',     telefone: '(15) 98801-2345', obs: 'Cliente padaria — VIP', data: '2026-03-22' },
  { id: 4, nome: 'Lucas Mendes',  telefone: '(15) 99923-4567', obs: '',                      data: '2026-03-22' },
];

let filtroAtivo = 'todos';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  salvarLocal();
  renderClientes();
  atualizarStatusCaixa();
});

function salvarLocal() {
  localStorage.setItem('crv-clientes', JSON.stringify(clientes));
}

// ===== FILTRO =====
function setFiltro(btn, filtro) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtivo = filtro;
  renderClientes();
}

function getClientesFiltrados() {
  const texto = document.getElementById('filtroTexto')?.value.toLowerCase().trim() || '';
  let lista = [...clientes];

  if (filtroAtivo === 'recentes') {
    const hoje = new Date().toISOString().slice(0, 10);
    lista = lista.filter(c => c.data === hoje);
  }

  if (texto) {
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(texto) ||
      c.telefone?.replace(/\D/g,'').includes(texto.replace(/\D/g,''))
    );
  }

  return lista;
}

// ===== RENDER =====
function renderClientes() {
  const container = document.getElementById('clientesLista');
  const lista     = getClientesFiltrados();

  document.getElementById('subtitleClientes').textContent =
    `${clientes.length} cliente(s) cadastrado(s)`;

  if (!lista.length) {
    container.innerHTML = `
      <div class="clientes-empty">
        <i data-lucide="users" width="40" height="40" style="opacity:0.3;"></i>
        <p>Nenhum cliente encontrado</p>
        <button class="btn-ghost" onclick="abrirModalNovo()">
          <i data-lucide="user-plus" width="14" height="14"></i> Adicionar cliente
        </button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = lista.map(c => {
    const iniciais = c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const dataFmt  = c.data
      ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR')
      : '—';

    return `
      <div class="cliente-card">
        <div class="cliente-avatar">${iniciais}</div>
        <div class="cliente-info">
          <span class="cliente-nome">${c.nome}</span>
          ${c.telefone ? `
            <span class="cliente-telefone">
              <i data-lucide="phone" width="11" height="11"></i>
              ${c.telefone}
            </span>` : ''}
          ${c.obs ? `<span class="cliente-obs">${c.obs}</span>` : ''}
          <span class="cliente-data">Cadastrado em ${dataFmt}</span>
        </div>
        <div class="cliente-actions">
          ${c.telefone ? `
            <button class="cliente-btn whatsapp" onclick="abrirWhatsApp('${c.telefone}')" title="WhatsApp">
              <i data-lucide="message-circle" width="13" height="13"></i>
            </button>` : ''}
          <button class="cliente-btn" onclick="abrirModalEditar(${c.id})" title="Editar">
            <i data-lucide="pencil" width="13" height="13"></i>
          </button>
          <button class="cliente-btn danger" onclick="confirmarExcluir(${c.id})" title="Remover">
            <i data-lucide="trash-2" width="13" height="13"></i>
          </button>
        </div>
      </div>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== MODAL NOVO =====
function abrirModalNovo() {
  document.getElementById('modalClienteTitulo').textContent = 'Novo Cliente';
  document.getElementById('clienteId').value        = '';
  document.getElementById('clienteNome').value      = '';
  document.getElementById('clienteTelefone').value  = '';
  document.getElementById('clienteObs').value       = '';
  document.getElementById('modalCliente').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('clienteNome').focus(), 100);
}

// ===== MODAL EDITAR =====
function abrirModalEditar(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modalClienteTitulo').textContent = 'Editar Cliente';
  document.getElementById('clienteId').value        = c.id;
  document.getElementById('clienteNome').value      = c.nome;
  document.getElementById('clienteTelefone').value  = c.telefone || '';
  document.getElementById('clienteObs').value       = c.obs || '';
  document.getElementById('modalCliente').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== SALVAR =====
function salvarCliente() {
  const nome     = document.getElementById('clienteNome').value.trim();
  const telefone = document.getElementById('clienteTelefone').value.trim();
  const obs      = document.getElementById('clienteObs').value.trim();

  if (!nome) { alert('Informe o nome do cliente.'); return; }

  const id = document.getElementById('clienteId').value;
  const hoje = new Date().toISOString().slice(0, 10);

  if (id) {
    const idx = clientes.findIndex(c => c.id == id);
    if (idx > -1) clientes[idx] = { ...clientes[idx], nome, telefone, obs };
  } else {
    clientes.push({ id: Date.now(), nome, telefone, obs, data: hoje });
  }

  salvarLocal();
  fecharModal();
  renderClientes();
}

// ===== EXCLUIR =====
function confirmarExcluir(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('msgExcluir').textContent =
    `"${c.nome}" será removido da lista de clientes.`;
  document.getElementById('btnConfirmarExcluir').onclick = () => excluirCliente(id);
  document.getElementById('modalExcluir').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function excluirCliente(id) {
  clientes = clientes.filter(c => c.id !== id);
  salvarLocal();
  fecharModal();
  renderClientes();
}

// ===== WHATSAPP =====
function abrirWhatsApp(telefone) {
  const num = telefone.replace(/\D/g, '');
  const completo = num.startsWith('55') ? num : '55' + num;
  window.open(`https://wa.me/${completo}`, '_blank');
}

// ===== MÁSCARA TELEFONE =====
function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (v.length > 6) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  } else {
    v = v.replace(/^(\d*)$/, '($1');
  }
  input.value = v;
}

// ===== STATUS CAIXA =====
function atualizarStatusCaixa() {
  const caixa = JSON.parse(localStorage.getItem('crv-caixa'));
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (caixa?.status === 'aberto') {
    dot.classList.replace('closed', 'open');
    text.textContent = 'Caixa aberto';
    text.style.color = 'var(--crv-green)';
  }
}

function fecharModal() {
  document.getElementById('modalCliente').style.display = 'none';
  document.getElementById('modalExcluir').style.display = 'none';
}
