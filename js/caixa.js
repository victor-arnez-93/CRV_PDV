// ===== ESTADO =====
let caixa = null;
let carrinho = [];
let vendas = [];
let metodoPagamento = 'dinheiro';

// fallback local
function carregarLocal() {
  caixa = localDB.obter('caixa') || null;
  vendas = localDB.obter('vendas') || [];
}

// Produtos mock (por enquanto mantém)
const produtosMock = [
  { id: 1, nome: 'Água Mineral', preco: 3.00, codigo: '001' },
  { id: 2, nome: 'Refrigerante Lata', preco: 6.00, codigo: '002' },
  { id: 3, nome: 'Cerveja 600ml', preco: 12.00, codigo: '003' },
  { id: 4, nome: 'Suco Natural', preco: 8.00, codigo: '004' },
  { id: 5, nome: 'Combo Arena', preco: 25.00, codigo: '005' },
  { id: 6, nome: 'Café', preco: 4.00, codigo: '006' },
  { id: 7, nome: 'Pão de Queijo', preco: 5.00, codigo: '007' },
  { id: 8, nome: 'Coxinha', preco: 6.00, codigo: '008' },
];

const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  logSistema("CAIXA", "Inicializando...");

  if (APP_STATUS.online && APP_STATUS.supabase_ok) {
    await carregarDadosSupabase();
  } else {
    logSistema("CAIXA", "Modo offline", "warn");
    carregarLocal();
  }

  renderEstado();
  renderProdutosRapidos();
  setupBusca();
});

// ===== SUPABASE LOAD =====
async function carregarDadosSupabase() {
  try {
    logSistema("CAIXA", "Buscando dados...");

    const { data: caixaData } = await sb
      .from("caixa")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    caixa = caixaData?.[0] || null;

    const { data: vendasData } = await sb
      .from("vendas")
      .select("*");

    vendas = vendasData || [];

    localDB.salvar("caixa", caixa);
    localDB.salvar("vendas", vendas);

    logSistema("CAIXA", "Dados carregados", "success");

  } catch (err) {
    logSistema("CAIXA", "Erro: " + err.message, "error");
    carregarLocal();
  }
}

// ===== ESTADO UI =====
function renderEstado() {
  const aberto = document.getElementById('viewCaixaAberto');
  const fechado = document.getElementById('viewCaixaFechado');
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (caixa && caixa.status === 'aberto') {
    aberto.style.display = 'block';
    fechado.style.display = 'none';

    dot.classList.replace('closed', 'open');
    text.textContent = 'Caixa aberto';
    text.style.color = 'var(--crv-green)';

    document.getElementById('infoAbertura').textContent =
      new Date(caixa.data_abertura || caixa.dataAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('infoValorInicial').textContent = fmt(caixa.valor_inicial || caixa.valorInicial);

    atualizarInfobar();
    renderHistorico();

  } else {
    aberto.style.display = 'none';
    fechado.style.display = 'block';
  }
}

// ===== ABRIR CAIXA =====
async function abrirCaixa() {
  const valor = parseFloat(document.getElementById('valorInicial').value) || 0;

  try {
    if (APP_STATUS.online && APP_STATUS.supabase_ok) {

      const { data, error } = await sb
        .from("caixa")
        .insert([{
          valor_inicial: valor,
          status: 'aberto'
        }])
        .select();

      if (error) throw error;

      caixa = data[0];

      logSistema("CAIXA", "Caixa aberto (Supabase)", "success");

    } else {
      caixa = {
        id: Date.now(),
        dataAbertura: new Date().toISOString(),
        valorInicial: valor,
        status: 'aberto'
      };

      localDB.salvar('caixa', caixa);
      logSistema("CAIXA", "Caixa aberto (offline)", "warn");
    }

    vendas = [];
    renderEstado();

  } catch (err) {
    logSistema("CAIXA", "Erro ao abrir: " + err.message, "error");
  }
}

// ===== FINALIZAR VENDA =====
async function finalizarVenda() {
  if (!carrinho.length) return alert('Adicione itens ao carrinho.');

  const subtotal = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0);
  const desconto = parseFloat(document.getElementById('inputDesconto')?.value) || 0;
  const total = Math.max(0, subtotal - desconto);

  const venda = {
    caixa_id: caixa?.id,
    total: total,
    pagamento: metodoPagamento
  };

  try {
    if (APP_STATUS.online && APP_STATUS.supabase_ok) {

      const { data, error } = await sb
        .from("vendas")
        .insert([venda])
        .select();

      if (error) throw error;

      const vendaId = data[0].id;

      // inserir itens
      const itens = carrinho.map(i => ({
        venda_id: vendaId,
        produto_id: i.id,
        quantidade: i.quantidade,
        preco: i.preco
      }));

      await sb.from("vendas_itens").insert(itens);

      logSistema("VENDA", "Venda salva no Supabase", "success");

    } else {

      vendas.push({
        ...venda,
        id: Date.now(),
        itens: [...carrinho]
      });

      localDB.salvar("vendas", vendas);

      logSistema("VENDA", "Venda salva offline", "warn");
    }

    carrinho = [];
    renderCarrinho();
    atualizarInfobar();
    renderHistorico();

    document.getElementById('modalSucesso').style.display = 'flex';

  } catch (err) {
    logSistema("VENDA", "Erro: " + err.message, "error");
  }
}

// ===== FECHAR CAIXA =====
async function fecharCaixa() {
  try {

    if (APP_STATUS.online && APP_STATUS.supabase_ok) {

      await sb
        .from("caixa")
        .update({
          status: 'fechado',
          data_fechamento: new Date().toISOString()
        })
        .eq("id", caixa.id);

      logSistema("CAIXA", "Fechado no Supabase", "success");

    } else {
      logSistema("CAIXA", "Fechado offline", "warn");
    }

    caixa = null;
    vendas = [];

    localDB.salvar("vendas", vendas);
    localDB.salvar("caixa", null);

    fecharModal();
    renderEstado();

  } catch (err) {
    logSistema("CAIXA", "Erro ao fechar: " + err.message, "error");
  }
}