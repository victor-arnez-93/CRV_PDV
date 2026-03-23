// ===== DADOS MOCK =====
const mockData = {
  faturamento:  1_847.50,
  totalVendas:  23,
  ticketMedio:  80.33,
  saldoCaixa:   2_150.00,
  saldoCaixa:   2_150.00,
  pagamentos: {
    dinheiro: 620.00,
    cartao:   780.50,
    pix:      447.00
  },
  ultimas: [
    { hora: '11:48', desc: '3 itens', valor: 94.00,  pagto: 'PIX' },
    { hora: '11:32', desc: '1 item',  valor: 25.00,  pagto: 'Dinheiro' },
    { hora: '11:10', desc: '5 itens', valor: 187.50, pagto: 'Cartão' },
    { hora: '10:55', desc: '2 itens', valor: 48.00,  pagto: 'PIX' },
    { hora: '10:30', desc: '1 item',  valor: 32.00,  pagto: 'Dinheiro' },
  ],
  semana: [980, 1240, 760, 1580, 2100, 1430, 1847]
};

// ===== FORMATAÇÃO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== INICIALIZAR DASHBOARD =====
function initDashboard() {
  // Cards
  document.getElementById('faturamentoDia').textContent = fmt(mockData.faturamento);
  document.getElementById('totalVendas').textContent    = mockData.totalVendas;
  document.getElementById('ticketMedio').textContent    = fmt(mockData.ticketMedio);
  document.getElementById('saldoCaixa').textContent     = fmt(mockData.saldoCaixa);
  document.getElementById('deltaDia').textContent       = '↑ 12% em relação a ontem';
  document.getElementById('deltaDia').classList.add('positive');
  document.getElementById('deltaVendas').textContent    = 'vendas hoje';
  document.getElementById('deltaTicket').textContent    = 'por venda';
  document.getElementById('deltaSaldo').textContent     = mockData.caixaAberto ? 'caixa aberto' : 'caixa fechado';

  // Status caixa
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const caixa = JSON.parse(localStorage.getItem('crv-caixa'));

if (caixa?.status === 'aberto') {
  dot.classList.replace('closed', 'open');
  text.textContent = 'Caixa aberto';
  text.style.color = 'var(--crv-green)';
} else {
  dot.classList.replace('open', 'closed');
  text.textContent = 'Caixa fechado';
  text.style.color = '';
}

  // Pagamentos
  const total = mockData.pagamentos.dinheiro + mockData.pagamentos.cartao + mockData.pagamentos.pix;
  const pct = v => total > 0 ? (v / total * 100).toFixed(1) + '%' : '0%';

  document.getElementById('valDinheiro').textContent = fmt(mockData.pagamentos.dinheiro);
  document.getElementById('valCartao').textContent   = fmt(mockData.pagamentos.cartao);
  document.getElementById('valPix').textContent      = fmt(mockData.pagamentos.pix);

  setTimeout(() => {
    document.getElementById('barDinheiro').style.width = pct(mockData.pagamentos.dinheiro);
    document.getElementById('barCartao').style.width   = pct(mockData.pagamentos.cartao);
    document.getElementById('barPix').style.width      = pct(mockData.pagamentos.pix);
  }, 300);

  // Últimas vendas
  const container = document.getElementById('recentSales');
  container.innerHTML = '';
  mockData.ultimas.forEach(v => {
    container.innerHTML += `
      <div class="sale-item">
        <div class="sale-item-left">
          <span class="sale-item-hora">${v.hora} · ${v.pagto}</span>
          <span class="sale-item-desc">${v.desc}</span>
        </div>
        <span class="sale-item-value">${fmt(v.valor)}</span>
      </div>`;
  });

  // Gráfico
  initChart();
}

// ===== CHART.JS =====
function initChart() {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const ctx    = document.getElementById('chartFaturamento').getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0,   'rgba(249,137,72,0.35)');
  gradient.addColorStop(1,   'rgba(249,137,72,0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data:            mockData.semana,
        borderColor:     '#F98948',
        backgroundColor: gradient,
        borderWidth:     2,
        pointBackgroundColor: '#F98948',
        pointRadius:     4,
        pointHoverRadius: 6,
        tension:         0.4,
        fill:            true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(22,22,31,0.95)',
        borderColor:     'rgba(249,137,72,0.3)',
        borderWidth:     1,
        titleColor:      '#F98948',
        bodyColor:       '#F0F0F5',
        padding:         10,
        callbacks: {
          label: ctx => ' ' + fmt(ctx.parsed.y)
        }
      }},
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55556A', font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#55556A', font: { family: 'Inter', size: 11 },
          callback: v => 'R$ ' + (v/1000).toFixed(1) + 'k'
        }}
      }
    }
  });
}

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initDashboard);
