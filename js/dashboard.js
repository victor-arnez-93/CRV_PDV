// ===== FORMATAÇÃO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== INIT =====
async function initDashboard() {
  logSistema("DASHBOARD", "Inicializando dashboard...");

  try {

    // ==========================================
    // 🔍 BUSCAR DADOS REAIS
    // ==========================================

    let vendas = [];
    let itens = [];
    let caixaAtual = null;

    if (APP_STATUS.online && APP_STATUS.supabase_ok) {

      logSistema("DASHBOARD", "Buscando dados do Supabase...");

      // Buscar vendas do dia
      const { data: vendasData, error: vendasError } = await sb
        .from("vendas")
        .select("*")
        .order("created_at", { ascending: false });

      if (vendasError) throw vendasError;

      vendas = vendasData || [];

      // Buscar itens
      const { data: itensData } = await sb
        .from("vendas_itens")
        .select("*");

      itens = itensData || [];

      // Buscar caixa
      const { data: caixaData } = await sb
        .from("caixa")
        .select("*")
        .order("id", { ascending: false })
        .limit(1);

      caixaAtual = caixaData?.[0] || null;

      logSistema("DASHBOARD", "Dados carregados do Supabase", "success");

      // salvar fallback
      localDB.salvar("vendas", vendas);
      localDB.salvar("itens", itens);
      localDB.salvar("caixa", caixaAtual);

    } else {

      logSistema("DASHBOARD", "Modo offline - usando localStorage", "warn");

      vendas = localDB.obter("vendas");
      itens = localDB.obter("itens");
      caixaAtual = localDB.obter("caixa");

    }


    // ==========================================
    // 📊 PROCESSAMENTO
    // ==========================================

    const hoje = new Date().toISOString().slice(0, 10);

    const vendasHoje = vendas.filter(v => v.created_at?.startsWith(hoje));

    const faturamento = vendasHoje.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalVendas = vendasHoje.length;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

    // pagamentos
    const pagamentos = {
      dinheiro: 0,
      cartao: 0,
      pix: 0
    };

    vendasHoje.forEach(v => {
      const tipo = (v.pagamento || "").toLowerCase();

      if (tipo.includes("dinheiro")) pagamentos.dinheiro += v.total || 0;
      else if (tipo.includes("cart")) pagamentos.cartao += v.total || 0;
      else if (tipo.includes("pix")) pagamentos.pix += v.total || 0;
    });


    // últimas vendas
    const ultimas = vendas.slice(0, 5).map(v => ({
      hora: new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      desc: `${v.total_itens || 1} itens`,
      valor: v.total,
      pagto: v.pagamento
    }));


    // ==========================================
    // 🧾 UI (SEM ALTERAR ESTRUTURA)
    // ==========================================

    document.getElementById('faturamentoDia').textContent = fmt(faturamento);
    document.getElementById('totalVendas').textContent    = totalVendas;
    document.getElementById('ticketMedio').textContent    = fmt(ticketMedio);
    document.getElementById('saldoCaixa').textContent     = fmt(caixaAtual?.saldo_atual || 0);

    document.getElementById('deltaDia').textContent       = 'dados reais';
    document.getElementById('deltaDia').classList.add('positive');
    document.getElementById('deltaVendas').textContent    = 'vendas hoje';
    document.getElementById('deltaTicket').textContent    = 'por venda';
    document.getElementById('deltaSaldo').textContent     = caixaAtual?.status === 'aberto' ? 'caixa aberto' : 'caixa fechado';


    // ==========================================
    // 🟢 STATUS CAIXA (CORRIGIDO)
    // ==========================================

    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (caixaAtual?.status === 'aberto') {
      dot.classList.replace('closed', 'open');
      text.textContent = 'Caixa aberto';
      text.style.color = 'var(--crv-green)';
    } else {
      dot.classList.replace('open', 'closed');
      text.textContent = 'Caixa fechado';
      text.style.color = '';
    }


    // ==========================================
    // 💳 PAGAMENTOS
    // ==========================================

    const totalPag = pagamentos.dinheiro + pagamentos.cartao + pagamentos.pix;
    const pct = v => totalPag > 0 ? (v / totalPag * 100).toFixed(1) + '%' : '0%';

    document.getElementById('valDinheiro').textContent = fmt(pagamentos.dinheiro);
    document.getElementById('valCartao').textContent   = fmt(pagamentos.cartao);
    document.getElementById('valPix').textContent      = fmt(pagamentos.pix);

    setTimeout(() => {
      document.getElementById('barDinheiro').style.width = pct(pagamentos.dinheiro);
      document.getElementById('barCartao').style.width   = pct(pagamentos.cartao);
      document.getElementById('barPix').style.width      = pct(pagamentos.pix);
    }, 300);


    // ==========================================
    // 🧾 ÚLTIMAS VENDAS
    // ==========================================

    const container = document.getElementById('recentSales');
    container.innerHTML = '';

    ultimas.forEach(v => {
      container.innerHTML += `
        <div class="sale-item">
          <div class="sale-item-left">
            <span class="sale-item-hora">${v.hora} · ${v.pagto}</span>
            <span class="sale-item-desc">${v.desc}</span>
          </div>
          <span class="sale-item-value">${fmt(v.valor)}</span>
        </div>`;
    });


    // ==========================================
    // 📈 GRÁFICO (mantido)
    // ==========================================

    initChart(vendas);


  } catch (err) {
    logSistema("DASHBOARD", "Erro: " + err.message, "error");
  }
}


// ===== CHART =====
function initChart(vendas) {

  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const semana = [0,0,0,0,0,0,0];

  vendas.forEach(v => {
    const d = new Date(v.created_at).getDay();
    semana[d] += v.total || 0;
  });

  const ctx = document.getElementById('chartFaturamento').getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(249,137,72,0.35)');
  gradient.addColorStop(1, 'rgba(249,137,72,0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dias,
      datasets: [{
        data: semana,
        borderColor: '#F98948',
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: '#F98948',
        pointRadius: 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}


// ===== INIT =====
document.addEventListener('DOMContentLoaded', initDashboard);