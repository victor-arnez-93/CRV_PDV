// ===== ESTADO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let periodoAtivo = 'hoje';
let chartHoras   = null;
let chartPagtos  = null;

// Dados mock de caixas anteriores (histórico)
const caixasHistorico = [
  { data: '2026-03-21', abertura: '08:00', fechamento: '18:30', valorInicial: 200, totalVendido: 1430, qtdVendas: 18 },
  { data: '2026-03-20', abertura: '08:00', fechamento: '19:00', valorInicial: 150, totalVendido: 2100, qtdVendas: 26 },
  { data: '2026-03-19', abertura: '08:15', fechamento: '17:45', valorInicial: 200, totalVendido: 1580, qtdVendas: 20 },
  { data: '2026-03-18', abertura: '08:00', fechamento: '18:00', valorInicial: 150, totalVendido: 760,  qtdVendas: 10 },
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('dataInicio').value = hoje;
  document.getElementById('dataFim').value    = hoje;
  atualizarStatusCaixa();
  renderRelatorio();
});

// ===== PERÍODO =====
function setPeriodo(btn, periodo) {
  document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  periodoAtivo = periodo;
  renderRelatorio();
}

function aplicarPeriodo() {
  periodoAtivo = 'custom';
  document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
  renderRelatorio();
}

// ===== DADOS =====
function getVendas() {
  return JSON.parse(localStorage.getItem('crv-vendas')) || [];
}

function getMockVendasExtras() {
  // Vendas mock para preencher gráficos com mais dados
  return [
    { hora: '08:30', total: 45,  formaPagamento: 'dinheiro', desconto: 0,   subtotal: 45,  itens: [{ nome: 'Café', quantidade: 2, preco: 4 }, { nome: 'Pão de Queijo', quantidade: 3, preco: 5 }] },
    { hora: '09:15', total: 94,  formaPagamento: 'pix',      desconto: 0,   subtotal: 94,  itens: [{ nome: 'Cerveja 600ml', quantidade: 5, preco: 12 }, { nome: 'Água Mineral', quantidade: 5, preco: 3 }] },
    { hora: '10:00', total: 72,  formaPagamento: 'cartao',   desconto: 0,   subtotal: 72,  itens: [{ nome: 'Suco Natural', quantidade: 3, preco: 8 }, { nome: 'Combo Arena', quantidade: 1, preco: 25 }, { nome: 'Água Mineral', quantidade: 3, preco: 3 }] },
    { hora: '10:45', total: 25,  formaPagamento: 'dinheiro', desconto: 0,   subtotal: 25,  itens: [{ nome: 'Combo Arena', quantidade: 1, preco: 25 }] },
    { hora: '11:30', total: 187, formaPagamento: 'cartao',   desconto: 0,   subtotal: 187, itens: [{ nome: 'Cerveja 600ml', quantidade: 8, preco: 12 }, { nome: 'Refrigerante Lata', quantidade: 5, preco: 6 }, { nome: 'Água Mineral', quantidade: 7, preco: 3 }] },
    { hora: '12:10', total: 48,  formaPagamento: 'pix',      desconto: 0,   subtotal: 48,  itens: [{ nome: 'Suco Natural', quantidade: 6, preco: 8 }] },
    { hora: '13:00', total: 96,  formaPagamento: 'dinheiro', desconto: 5,   subtotal: 101, itens: [{ nome: 'Cerveja 600ml', quantidade: 4, preco: 12 }, { nome: 'Combo Arena', quantidade: 2, preco: 25 }] },
    { hora: '14:20', total: 32,  formaPagamento: 'pix',      desconto: 0,   subtotal: 32,  itens: [{ nome: 'Refrigerante Lata', quantidade: 2, preco: 6 }, { nome: 'Pão de Queijo', quantidade: 4, preco: 5 }] },
  ];
}

function getTodasVendas() {
  const reais = getVendas();
  return reais.length > 0 ? reais : getMockVendasExtras();
}

// ===== RENDER PRINCIPAL =====
function renderRelatorio() {
  const vendas = getTodasVendas();

  // Cards resumo
  const total    = vendas.reduce((a, v) => a + v.total, 0);
  const qtd      = vendas.length;
  const ticket   = qtd > 0 ? total / qtd : 0;
  const descontos= vendas.reduce((a, v) => a + (v.desconto || 0), 0);

  document.getElementById('relFaturamento').textContent  = fmt(total);
  document.getElementById('relVendas').textContent       = qtd;
  document.getElementById('relTicket').textContent       = fmt(ticket);
  document.getElementById('relDescontos').textContent    = fmt(descontos);
  document.getElementById('relFaturamentoDelta').textContent =
    qtd > 0 ? `${qtd} transação(ões)` : 'sem vendas';

  const labels = { hoje: 'Hoje', semana: '7 dias', mes: '30 dias', custom: 'Personalizado' };
  document.getElementById('badgePeriodo').textContent = labels[periodoAtivo] || 'Hoje';
  document.getElementById('subtitleRelatorio').textContent =
    `Exibindo dados de: ${labels[periodoAtivo] || 'período selecionado'}`;

  renderGraficoHoras(vendas);
  renderGraficoPagamentos(vendas);
  renderTopProdutos(vendas);
  renderHistoricoCaixas();
}

// ===== GRÁFICO HORAS =====
function renderGraficoHoras(vendas) {
  const horas = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2,'0')}h`);
  const dados = Array(14).fill(0);

  vendas.forEach(v => {
    const h = parseInt((v.hora || '00:00').split(':')[0]);
    const idx = h - 7;
    if (idx >= 0 && idx < 14) dados[idx] += v.total;
  });

  const ctx = document.getElementById('chartHoras').getContext('2d');
  if (chartHoras) chartHoras.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0,   'rgba(108,99,255,0.4)');
  gradient.addColorStop(1,   'rgba(108,99,255,0)');

  chartHoras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [{
        data: dados,
        backgroundColor: dados.map(v => v > 0 ? 'rgba(249,137,72,0.7)' : 'rgba(255,255,255,0.05)'),
        borderColor:     dados.map(v => v > 0 ? '#F98948' : 'transparent'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(22,22,31,0.95)',
          borderColor: 'rgba(249,137,72,0.3)',
          borderWidth: 1,
          titleColor: '#F98948',
          bodyColor: '#F0F0F5',
          padding: 10,
          callbacks: { label: c => ' ' + fmt(c.parsed.y) }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556A', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556A', font: { size: 10 },
          callback: v => v > 0 ? 'R$' + (v/1).toFixed(0) : ''
        }}
      }
    }
  });
}

// ===== GRÁFICO PAGAMENTOS =====
function renderGraficoPagamentos(vendas) {
  const totais = { dinheiro: 0, cartao: 0, pix: 0 };
  vendas.forEach(v => { if (totais[v.formaPagamento] !== undefined) totais[v.formaPagamento] += v.total; });

  const total  = Object.values(totais).reduce((a,b) => a+b, 0);
  const cores  = { dinheiro: '#00FF9C', cartao: '#6C63FF', pix: '#00D4FF' };
  const labels = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };

  const ctx = document.getElementById('chartPagamentos').getContext('2d');
  if (chartPagtos) chartPagtos.destroy();

  chartPagtos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(totais).map(k => labels[k]),
      datasets: [{
        data: Object.values(totais),
        backgroundColor: Object.keys(totais).map(k => cores[k] + '33'),
        borderColor:     Object.keys(totais).map(k => cores[k]),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(22,22,31,0.95)',
          borderColor: 'rgba(249,137,72,0.3)',
          borderWidth: 1,
          titleColor: '#F0F0F5',
          bodyColor: '#9090A8',
          padding: 10,
          callbacks: { label: c => ` ${fmt(c.parsed)} (${total > 0 ? (c.parsed/total*100).toFixed(1) : 0}%)` }
        }
      }
    }
  });

  // Legenda manual
  const legenda = document.getElementById('pagamentoLegenda');
  legenda.innerHTML = Object.entries(totais).map(([k, v]) => `
    <div class="legenda-item">
      <div class="legenda-left">
        <span class="legenda-dot" style="background:${cores[k]}"></span>
        <span>${labels[k]}</span>
      </div>
      <span class="legenda-val">${fmt(v)}</span>
    </div>
  `).join('');
}

// ===== TOP PRODUTOS =====
function renderTopProdutos(vendas) {
  const contagem = {};
  vendas.forEach(v => {
    (v.itens || []).forEach(i => {
      if (!contagem[i.nome]) contagem[i.nome] = { qtd: 0, total: 0 };
      contagem[i.nome].qtd   += i.quantidade;
      contagem[i.nome].total += i.preco * i.quantidade;
    });
  });

  const lista = Object.entries(contagem)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  document.getElementById('badgeTopQtd').textContent = lista.length + ' produto(s)';

  const container = document.getElementById('topProdutos');
  if (!lista.length) {
    container.innerHTML = `<div class="empty-relatorio"><i data-lucide="package" width="28" height="28" style="opacity:0.3;"></i><p>Sem dados</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const maxTotal   = lista[0].total;
  const rankClass  = ['gold','silver','bronze'];
  const rankIcon   = ['🥇','🥈','🥉'];

  container.innerHTML = lista.map((p, i) => `
    <div class="top-produto-item">
      <span class="top-rank ${rankClass[i] || ''}">${rankIcon[i] || '#' + (i+1)}</span>
      <div class="top-produto-info">
        <div class="top-produto-nome">${p.nome}</div>
        <div class="top-produto-qtd">${p.qtd} unidade(s) vendida(s)</div>
      </div>
      <div class="top-bar-wrap">
        <div class="top-bar" style="width:${(p.total/maxTotal*100).toFixed(1)}%"></div>
      </div>
      <span class="top-produto-val">${fmt(p.total)}</span>
    </div>
  `).join('');
}

// ===== HISTÓRICO CAIXAS =====
function renderHistoricoCaixas() {
  const container = document.getElementById('historicoCaixas');
  if (!caixasHistorico.length) {
    container.innerHTML = `<div class="empty-relatorio"><p>Nenhum caixa fechado ainda</p></div>`;
    return;
  }

  container.innerHTML = caixasHistorico.map(c => {
    const saldo = c.valorInicial + c.totalVendido;
    const dataFmt = new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
    return `
      <div class="caixa-historico-item">
        <span class="caixa-hist-data">${dataFmt} · ${c.abertura}–${c.fechamento}</span>
        <div class="caixa-hist-info">
          <div class="caixa-hist-col">
            <span class="caixa-hist-label">Valor inicial</span>
            <span class="caixa-hist-val">${fmt(c.valorInicial)}</span>
          </div>
          <div class="caixa-hist-col">
            <span class="caixa-hist-label">Total vendido</span>
            <span class="caixa-hist-val green">${fmt(c.totalVendido)}</span>
          </div>
          <div class="caixa-hist-col">
            <span class="caixa-hist-label">Vendas</span>
            <span class="caixa-hist-val">${c.qtdVendas}</span>
          </div>
          <div class="caixa-hist-col">
            <span class="caixa-hist-label">Saldo final</span>
            <span class="caixa-hist-val green">${fmt(saldo)}</span>
          </div>
        </div>
        <span class="badge badge-success">Fechado</span>
      </div>`;
  }).join('');
}

// ===== EXPORTAR CSV =====
function exportarCSV() {
  const vendas = getTodasVendas();
  if (!vendas.length) { alert('Nenhuma venda para exportar.'); return; }

  const header = ['Hora','Forma Pagamento','Subtotal','Desconto','Total'];
  const linhas = vendas.map(v => [
    v.hora,
    v.formaPagamento,
    v.subtotal?.toFixed(2).replace('.',','),
    (v.desconto||0).toFixed(2).replace('.',','),
    v.total.toFixed(2).replace('.',',')
  ]);

  const csv = [header, ...linhas].map(r => r.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `crv-vendas-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
