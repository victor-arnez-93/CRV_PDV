// ===== ESTADO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let vendasData = JSON.parse(localStorage.getItem('crv-vendas')) || [];
let filtroAtivo = 'todos';

const labelPagto = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
const iconPagto  = { dinheiro: 'banknote', cartao: 'credit-card', pix: 'zap' };

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  carregarVendas();
  renderResumo();
  renderTabela();
  atualizarStatusCaixa();
});

function carregarVendas() {
  vendasData = JSON.parse(localStorage.getItem('crv-vendas')) || [];
  const hoje = new Date().toLocaleDateString('pt-BR');
  document.getElementById('subtitleVendas').textContent =
    `${vendasData.length} venda(s) registrada(s) hoje · ${hoje}`;
}

// ===== RESUMO =====
function renderResumo() {
  const total    = vendasData.reduce((a, v) => a + v.total, 0);
  const qtd      = vendasData.length;
  const ticket   = qtd > 0 ? total / qtd : 0;
  const dinheiro = vendasData.filter(v => v.formaPagamento === 'dinheiro').reduce((a, v) => a + v.total, 0);
  const cartao   = vendasData.filter(v => v.formaPagamento === 'cartao').reduce((a, v) => a + v.total, 0);
  const pix      = vendasData.filter(v => v.formaPagamento === 'pix').reduce((a, v) => a + v.total, 0);

  document.getElementById('resumoTotal').textContent    = fmt(total);
  document.getElementById('resumoQtd').textContent      = qtd;
  document.getElementById('resumoTicket').textContent   = fmt(ticket);
  document.getElementById('resumoDinheiro').textContent = fmt(dinheiro);
  document.getElementById('resumoCartao').textContent   = fmt(cartao);
  document.getElementById('resumoPix').textContent      = fmt(pix);
}

// ===== FILTROS =====
function setFiltro(btn, filtro) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtivo = filtro;
  renderTabela();
}

function filtrarVendas() { renderTabela(); }

function getVendasFiltradas() {
  const texto = document.getElementById('filtroTexto')?.value.toLowerCase().trim() || '';
  return vendasData.filter(v => {
    const passaFiltro = filtroAtivo === 'todos' || v.formaPagamento === filtroAtivo;
    const passaTexto  = !texto ||
      v.itens.some(i => i.nome.toLowerCase().includes(texto)) ||
      fmt(v.total).includes(texto);
    return passaFiltro && passaTexto;
  });
}

// ===== TABELA =====
function renderTabela() {
  const tbody   = document.getElementById('vendasTableBody');
  const lista   = getVendasFiltradas();
  const reversed = [...lista].reverse();

  if (!reversed.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          <i data-lucide="inbox" width="28" height="28"></i>
          <p>Nenhuma venda encontrada</p>
        </td>
      </tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = reversed.map((v, idx) => {
    const num       = reversed.length - idx;
    const primeiro  = v.itens[0];
    const maisItens = v.itens.length > 1 ? `+${v.itens.length - 1} item(ns)` : '';

    return `
      <tr onclick="verDetalhe(${v.id})">
        <td><span class="venda-num">#${String(num).padStart(3,'0')}</span></td>
        <td><span class="venda-hora">${v.hora}</span></td>
        <td>
          <div class="venda-itens">
            <span class="venda-item-nome">${primeiro?.nome || '—'}</span>
            ${maisItens ? `<span class="venda-item-more">${maisItens}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="pagto-badge ${v.formaPagamento}">
            <i data-lucide="${iconPagto[v.formaPagamento]}" width="11" height="11"></i>
            ${labelPagto[v.formaPagamento]}
          </span>
        </td>
        <td>${v.desconto > 0 ? `<span class="venda-desconto">- ${fmt(v.desconto)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td><span class="venda-total">${fmt(v.total)}</span></td>
        <td>
          <button class="btn-ver" onclick="event.stopPropagation(); verDetalhe(${v.id})">
            <i data-lucide="eye" width="14" height="14"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== DETALHE =====
function verDetalhe(id) {
  const venda = vendasData.find(v => v.id === id);
  if (!venda) return;

  const body = document.getElementById('modalDetalheBody');
  body.innerHTML = `
    <div class="detalhe-row">
      <span>Horário</span>
      <span style="font-family:'Courier New',monospace;">${venda.hora}</span>
    </div>
    <div class="detalhe-row" style="margin-bottom:12px;">
      <span>Pagamento</span>
      <span class="pagto-badge ${venda.formaPagamento}">
        <i data-lucide="${iconPagto[venda.formaPagamento]}" width="11" height="11"></i>
        ${labelPagto[venda.formaPagamento]}
      </span>
    </div>

    <div class="detalhe-itens">
      ${venda.itens.map(i => `
        <div class="detalhe-item">
          <div>
            <div class="detalhe-item-nome">${i.nome}</div>
            <div class="detalhe-item-qty">x${i.quantidade} · ${fmt(i.preco)} un.</div>
          </div>
          <span class="detalhe-item-val">${fmt(i.preco * i.quantidade)}</span>
        </div>
      `).join('')}
    </div>

    <div class="detalhe-row">
      <span>Subtotal</span>
      <span>${fmt(venda.subtotal)}</span>
    </div>
    ${venda.desconto > 0 ? `
    <div class="detalhe-row">
      <span>Desconto</span>
      <span style="color:#FF5050;">- ${fmt(venda.desconto)}</span>
    </div>` : ''}
    ${venda.troco > 0 ? `
    <div class="detalhe-row">
      <span>Troco</span>
      <span style="color:var(--crv-green);">${fmt(venda.troco)}</span>
    </div>` : ''}
    <div class="divider" style="margin:8px 0;"></div>
    <div class="detalhe-row total">
      <span>TOTAL</span>
      <span>${fmt(venda.total)}</span>
    </div>
  `;

  document.getElementById('modalDetalhe').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModal() {
  document.getElementById('modalDetalhe').style.display = 'none';
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
