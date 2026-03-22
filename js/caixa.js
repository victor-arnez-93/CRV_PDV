// ===== ESTADO =====
let caixa = JSON.parse(localStorage.getItem('crv-caixa')) || null;
let carrinho = [];
let vendas = JSON.parse(localStorage.getItem('crv-vendas')) || [];
let metodoPagamento = 'dinheiro';

// Produtos mock — substituir por Supabase depois
const produtosMock = [
  { id: 1, nome: 'Água Mineral',    preco: 3.00,  codigo: '001' },
  { id: 2, nome: 'Refrigerante Lata', preco: 6.00, codigo: '002' },
  { id: 3, nome: 'Cerveja 600ml',   preco: 12.00, codigo: '003' },
  { id: 4, nome: 'Suco Natural',    preco: 8.00,  codigo: '004' },
  { id: 5, nome: 'Combo Arena',     preco: 25.00, codigo: '005' },
  { id: 6, nome: 'Café',            preco: 4.00,  codigo: '006' },
  { id: 7, nome: 'Pão de Queijo',   preco: 5.00,  codigo: '007' },
  { id: 8, nome: 'Coxinha',         preco: 6.00,  codigo: '008' },
];

const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  renderEstado();
  renderProdutosRapidos();
  setupBusca();
});

function renderEstado() {
  const aberto = document.getElementById('viewCaixaAberto');
  const fechado = document.getElementById('viewCaixaFechado');
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (caixa && caixa.status === 'aberto') {
    aberto.style.display = 'block';
    fechado.style.display = 'none';
    dot.classList.replace('closed', 'open');
    text.textContent = 'Caixa aberto';
    text.style.color = 'var(--crv-green)';
    document.getElementById('infoAbertura').textContent =
      new Date(caixa.dataAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('infoValorInicial').textContent = fmt(caixa.valorInicial);
    atualizarInfobar();
    renderHistorico();
  } else {
    aberto.style.display = 'none';
    fechado.style.display = 'block';
  }
}

// ===== ABRIR CAIXA =====
function abrirCaixa() {
  const valor = parseFloat(document.getElementById('valorInicial').value) || 0;
  caixa = {
    id: Date.now(),
    dataAbertura: new Date().toISOString(),
    valorInicial: valor,
    status: 'aberto'
  };
  localStorage.setItem('crv-caixa', JSON.stringify(caixa));
  vendas = [];
  localStorage.setItem('crv-vendas', JSON.stringify(vendas));
  renderEstado();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== PRODUTOS RÁPIDOS =====
function renderProdutosRapidos() {
  const grid = document.getElementById('produtosRapidos');
  if (!grid) return;
  grid.innerHTML = produtosMock.map(p => `
    <div class="quick-item" onclick='adicionarAoCarrinho(${JSON.stringify(p)})'>
      <span class="quick-item-name">${p.nome}</span>
      <span class="quick-item-price">${fmt(p.preco)}</span>
    </div>
  `).join('');
}

// ===== BUSCA =====
function setupBusca() {
  const input = document.getElementById('inputBusca');
  const sugest = document.getElementById('pdvSuggestions');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { sugest.classList.remove('open'); return; }
    const found = produtosMock.filter(p =>
      p.nome.toLowerCase().includes(q) || p.codigo.includes(q)
    );
    if (!found.length) { sugest.classList.remove('open'); return; }
    sugest.innerHTML = found.map(p => `
      <div class="suggestion-item" onclick='adicionarAoCarrinho(${JSON.stringify(p)}); limparBusca()'>
        <span>${p.nome}</span>
        <span class="suggestion-price">${fmt(p.preco)}</span>
      </div>
    `).join('');
    sugest.classList.add('open');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      const found = produtosMock.find(p => p.codigo === q || p.nome.toLowerCase() === q.toLowerCase());
      if (found) { adicionarAoCarrinho(found); limparBusca(); }
    }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !sugest.contains(e.target)) {
      sugest.classList.remove('open');
    }
  });
}

function limparBusca() {
  document.getElementById('inputBusca').value = '';
  document.getElementById('pdvSuggestions').classList.remove('open');
  document.getElementById('inputBusca').focus();
}

// ===== CARRINHO =====
function adicionarAoCarrinho(produto) {
  const existente = carrinho.find(i => i.id === produto.id);
  if (existente) {
    existente.quantidade++;
  } else {
    carrinho.push({ ...produto, quantidade: 1 });
  }
  renderCarrinho();
}

function adicionarManual() {
  const nome  = document.getElementById('manualNome').value.trim();
  const preco = parseFloat(document.getElementById('manualPreco').value) || 0;
  const qtd   = parseInt(document.getElementById('manualQtd').value) || 1;
  if (!nome || preco <= 0) return;
  carrinho.push({ id: Date.now(), nome, preco, quantidade: qtd });
  document.getElementById('manualNome').value  = '';
  document.getElementById('manualPreco').value = '';
  document.getElementById('manualQtd').value   = '1';
  renderCarrinho();
}

function alterarQtd(id, delta) {
  const item = carrinho.find(i => i.id === id);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) carrinho = carrinho.filter(i => i.id !== id);
  renderCarrinho();
}

function removerItem(id) {
  carrinho = carrinho.filter(i => i.id !== id);
  renderCarrinho();
}

function limparCarrinho() {
  carrinho = [];
  renderCarrinho();
}

function renderCarrinho() {
  const container = document.getElementById('cartItems');
  document.getElementById('cartCount').textContent = carrinho.reduce((a, i) => a + i.quantidade, 0);

  if (!carrinho.length) {
    container.innerHTML = `<div class="empty-state"><i data-lucide="shopping-cart" width="28" height="28"></i><p>Carrinho vazio</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    atualizarTotais();
    return;
  }

  container.innerHTML = carrinho.map(item => `
    <div class="cart-item">
      <span class="cart-item-name">${item.nome}</span>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="alterarQtd(${item.id}, -1)">−</button>
        <span class="qty-num">${item.quantidade}</span>
        <button class="qty-btn" onclick="alterarQtd(${item.id}, 1)">+</button>
      </div>
      <span class="cart-item-price">${fmt(item.preco * item.quantidade)}</span>
      <button class="cart-item-remove" onclick="removerItem(${item.id})">
        <i data-lucide="x" width="14" height="14"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
  atualizarTotais();
}

function atualizarTotais() {
  const subtotal  = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0);
  const desconto  = parseFloat(document.getElementById('inputDesconto')?.value) || 0;
  const total     = Math.max(0, subtotal - desconto);

  document.getElementById('subtotal').textContent     = fmt(subtotal);
  document.getElementById('descontoTotal').textContent = '- ' + fmt(desconto);
  document.getElementById('totalGeral').textContent   = fmt(total);

  calcularTroco();
}

// ===== PAGAMENTO =====
function selecionarPagamento(btn) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  metodoPagamento = btn.dataset.method;

  const trocoWrap = document.getElementById('cartTroco');
  trocoWrap.style.display = metodoPagamento === 'dinheiro' ? 'flex' : 'none';
}

function calcularTroco() {
  const subtotal = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0);
  const desconto = parseFloat(document.getElementById('inputDesconto')?.value) || 0;
  const total    = Math.max(0, subtotal - desconto);
  const recebido = parseFloat(document.getElementById('valorRecebido')?.value) || 0;
  const troco    = Math.max(0, recebido - total);
  const el = document.getElementById('trocoResult');
  if (el) el.innerHTML = `Troco: <strong>${fmt(troco)}</strong>`;
}

// ===== FINALIZAR VENDA =====
function finalizarVenda() {
  if (!carrinho.length) return alert('Adicione itens ao carrinho.');

  const subtotal = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0);
  const desconto = parseFloat(document.getElementById('inputDesconto')?.value) || 0;
  const total    = Math.max(0, subtotal - desconto);
  const recebido = parseFloat(document.getElementById('valorRecebido')?.value) || 0;
  const troco    = metodoPagamento === 'dinheiro' ? Math.max(0, recebido - total) : 0;

  const venda = {
    id: Date.now(),
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    itens: [...carrinho],
    subtotal,
    desconto,
    total,
    formaPagamento: metodoPagamento,
    troco
  };

  vendas.push(venda);
  localStorage.setItem('crv-vendas', JSON.stringify(vendas));
  atualizarInfobar();
  renderHistorico();

  // Modal sucesso
  const label = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
  document.getElementById('sucessoMsg').textContent =
    `${fmt(total)} · ${label[metodoPagamento]}`;

  const trocoEl = document.getElementById('sucessoTroco');
  if (metodoPagamento === 'dinheiro' && troco > 0) {
    trocoEl.textContent = `Troco: ${fmt(troco)}`;
    trocoEl.style.display = 'block';
  } else {
    trocoEl.style.display = 'none';
  }

  document.getElementById('modalSucesso').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function novaVenda() {
  carrinho = [];
  document.getElementById('inputDesconto').value = '';
  document.getElementById('valorRecebido').value = '';
  document.getElementById('modalSucesso').style.display = 'none';
  renderCarrinho();
  document.getElementById('inputBusca')?.focus();
}

// ===== INFOBAR =====
function atualizarInfobar() {
  const totalVendido = vendas.reduce((a, v) => a + v.total, 0);
  const saldo = (caixa?.valorInicial || 0) + totalVendido;
  document.getElementById('infoQtdVendas').textContent = vendas.length;
  document.getElementById('infoSaldo').textContent = fmt(saldo);
  document.getElementById('badgeVendas').textContent = vendas.length + ' venda' + (vendas.length !== 1 ? 's' : '');
}

// ===== HISTÓRICO =====
function renderHistorico() {
  const list = document.getElementById('historicoList');
  if (!list) return;
  if (!vendas.length) {
    list.innerHTML = `<div class="empty-state" style="padding:16px;"><p>Nenhuma venda ainda</p></div>`;
    return;
  }
  const label = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
  list.innerHTML = [...vendas].reverse().map(v => `
    <div class="historico-item">
      <div class="historico-item-left">
        <span class="historico-hora">${v.hora}</span>
        <span class="historico-pagto">${label[v.formaPagamento]} · ${v.itens.length} item(ns)</span>
      </div>
      <span class="historico-valor">${fmt(v.total)}</span>
    </div>
  `).join('');
}

// ===== FECHAR CAIXA =====
function confirmarFechamento() {
  const totalVendido = vendas.reduce((a, v) => a + v.total, 0);
  const saldoEsperado = (caixa?.valorInicial || 0) + totalVendido;
  document.getElementById('fechValorInicial').textContent  = fmt(caixa?.valorInicial || 0);
  document.getElementById('fechTotalVendido').textContent  = fmt(totalVendido);
  document.getElementById('fechQtdVendas').textContent     = vendas.length;
  document.getElementById('fechSaldoEsperado').textContent = fmt(saldoEsperado);
  document.getElementById('modalFechamento').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function calcularDiferenca() {
  const totalVendido  = vendas.reduce((a, v) => a + v.total, 0);
  const saldoEsperado = (caixa?.valorInicial || 0) + totalVendido;
  const contado       = parseFloat(document.getElementById('valorFechamento').value) || 0;
  const diff          = contado - saldoEsperado;
  const el = document.getElementById('fechDiferenca');
  if (contado === 0) { el.textContent = ''; return; }
  el.textContent = diff >= 0
    ? `Sobra: ${fmt(diff)}`
    : `Falta: ${fmt(Math.abs(diff))}`;
  el.style.background = diff >= 0 ? 'rgba(0,255,156,0.08)' : 'rgba(255,80,80,0.08)';
  el.style.color = diff >= 0 ? 'var(--crv-green)' : '#FF5050';
  el.style.border = diff >= 0 ? '1px solid rgba(0,255,156,0.2)' : '1px solid rgba(255,80,80,0.2)';
}

function fecharCaixa() {
  caixa.status = 'fechado';
  caixa.dataFechamento = new Date().toISOString();
  localStorage.setItem('crv-caixa', JSON.stringify(caixa));
  localStorage.removeItem('crv-caixa');
  caixa = null;
  vendas = [];
  localStorage.setItem('crv-vendas', JSON.stringify(vendas));
  fecharModal();
  renderEstado();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModal() {
  document.getElementById('modalFechamento').style.display = 'none';
  document.getElementById('modalSucesso').style.display    = 'none';
}
