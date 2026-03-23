// ===== ESTADO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let periodoAtivo = 'hoje';
let chartHoras   = null;
let chartPagtos  = null;

let vendasData = [];
let caixasHistorico = [];


// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {

  logSistema("RELATORIOS", "Inicializando...");

  const hoje = new Date().toISOString().slice(0,10);

  document.getElementById('dataInicio').value = hoje;
  document.getElementById('dataFim').value    = hoje;

  await carregarDados();

  atualizarStatusCaixa();
  renderRelatorio();
});


// ===== CARREGAR =====
async function carregarDados() {

  try {

    if (APP_STATUS.online && APP_STATUS.supabase_ok) {

      logSistema("RELATORIOS", "Buscando dados...");

      const { data: vendas, error } = await sb
        .from("vendas")
        .select("*");

      if (error) throw error;

      const { data: itens } = await sb
        .from("vendas_itens")
        .select("*");

      const { data: caixas } = await sb
        .from("caixa")
        .select("*")
        .order("id", { ascending: false });

      // montar estrutura igual original
      vendasData = vendas.map(v => ({
        hora: new Date(v.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
        total: v.total,
        formaPagamento: v.pagamento,
        desconto: 0,
        subtotal: v.total,
        itens: itens
          .filter(i => i.venda_id === v.id)
          .map(i => ({
            nome: `Produto ${i.produto_id}`,
            quantidade: i.quantidade,
            preco: i.preco
          }))
      }));

      caixasHistorico = caixas
        .filter(c => c.status === 'fechado')
        .map(c => ({
          data: c.data_abertura?.slice(0,10),
          abertura: new Date(c.data_abertura).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
          fechamento: c.data_fechamento
            ? new Date(c.data_fechamento).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
            : '--:--',
          valorInicial: c.valor_inicial,
          totalVendido: c.total_vendido || 0,
          qtdVendas: c.qtd_vendas || 0
        }));

      localDB.salvar("vendas", vendasData);

      logSistema("RELATORIOS", "Dados carregados", "success");

    } else {

      logSistema("RELATORIOS", "Modo offline", "warn");

      vendasData = localDB.obter("vendas") || [];
      caixasHistorico = [];
    }

  } catch (err) {

    logSistema("RELATORIOS", "Erro: " + err.message, "error");

    vendasData = localDB.obter("vendas") || [];
    caixasHistorico = [];
  }
}


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
function getTodasVendas() {
  return vendasData || [];
}


// ===== RENDER =====
function renderRelatorio() {

  const vendas = getTodasVendas();

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

  chartHoras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [{
        data: dados,
        backgroundColor: dados.map(v => v > 0 ? 'rgba(249,137,72,0.7)' : 'rgba(255,255,255,0.05)'),
        borderColor: dados.map(v => v > 0 ? '#F98948' : 'transparent'),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}


// ===== GRÁFICO PAGAMENTOS =====
function renderGraficoPagamentos(vendas) {

  const totais = { dinheiro: 0, cartao: 0, pix: 0 };

  vendas.forEach(v => {
    if (totais[v.formaPagamento] !== undefined) {
      totais[v.formaPagamento] += v.total;
    }
  });

  const ctx = document.getElementById('chartPagamentos').getContext('2d');

  if (chartPagtos) chartPagtos.destroy();

  chartPagtos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Dinheiro','Cartão','PIX'],
      datasets: [{
        data: Object.values(totais),
        backgroundColor: ['#00FF9C','#6C63FF','#00D4FF']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
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
    container.innerHTML = `<div class="empty-relatorio"><p>Sem dados</p></div>`;
    return;
  }

  const maxTotal = lista[0].total;

  container.innerHTML = lista.map(p => `
    <div class="top-produto-item">
      <div class="top-produto-info">
        <div class="top-produto-nome">${p.nome}</div>
        <div class="top-produto-qtd">${p.qtd} unidade(s)</div>
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

    return `
      <div class="caixa-historico-item">
        <span>${c.data}</span>
        <span>${fmt(saldo)}</span>
      </div>
    `;
  }).join('');
}


// ===== STATUS CAIXA =====
function atualizarStatusCaixa() {

  const caixa = localDB.obter('caixa');

  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (caixa?.status === 'aberto') {
    dot.classList.replace('closed', 'open');
    text.textContent = 'Caixa aberto';
    text.style.color = 'var(--crv-green)';
  }
}