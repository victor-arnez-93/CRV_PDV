// ===== ESTADO =====
const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let produtos = JSON.parse(localStorage.getItem('crv-produtos')) || [
  { id: 1, nome: 'Água Mineral',      preco: 3.00,  estoque: 50, codigo: '001', categoria: 'bebidas',   ativo: true },
  { id: 2, nome: 'Refrigerante Lata', preco: 6.00,  estoque: 30, codigo: '002', categoria: 'bebidas',   ativo: true },
  { id: 3, nome: 'Cerveja 600ml',     preco: 12.00, estoque: 24, codigo: '003', categoria: 'bebidas',   ativo: true },
  { id: 4, nome: 'Suco Natural',      preco: 8.00,  estoque: 15, codigo: '004', categoria: 'bebidas',   ativo: true },
  { id: 5, nome: 'Combo Arena',       preco: 25.00, estoque: 0,  codigo: '005', categoria: 'combos',    ativo: true },
  { id: 6, nome: 'Café',              preco: 4.00,  estoque: 99, codigo: '006', categoria: 'bebidas',   ativo: true },
  { id: 7, nome: 'Pão de Queijo',     preco: 5.00,  estoque: 20, codigo: '007', categoria: 'alimentos', ativo: true },
  { id: 8, nome: 'Coxinha',           preco: 6.00,  estoque: 3,  codigo: '008', categoria: 'alimentos', ativo: true },
];

let filtroAtivo = 'todos';
let idExcluir   = null;

const categoriaLabel = {
  bebidas: 'Bebidas', alimentos: 'Alimentos',
  combos: 'Combos', servicos: 'Serviços', outros: 'Outros', '': '—'
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  salvarProdutosLocal();
  renderProdutos();
  atualizarStatusCaixa();
});

function salvarProdutosLocal() {
  localStorage.setItem('crv-produtos', JSON.stringify(produtos));
}

// ===== FILTROS =====
function setFiltro(btn, filtro) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtivo = filtro;
  renderProdutos();
}

function getProdutosFiltrados() {
  const texto = document.getElementById('filtroTexto')?.value.toLowerCase().trim() || '';
  return produtos.filter(p => {
    const passaFiltro =
      filtroAtivo === 'todos' ||
      (filtroAtivo === 'ativos'   &&  p.ativo) ||
      (filtroAtivo === 'inativos' && !p.ativo);
    const passaTexto = !texto ||
      p.nome.toLowerCase().includes(texto) ||
      p.codigo?.toLowerCase().includes(texto);
    return passaFiltro && passaTexto;
  });
}

// ===== RENDER =====
function renderProdutos() {
  const grid  = document.getElementById('produtosGrid');
  const lista = getProdutosFiltrados();

  document.getElementById('subtitleProdutos').textContent =
    `${produtos.length} produto(s) cadastrado(s) · ${produtos.filter(p=>p.ativo).length} ativo(s)`;

  if (!lista.length) {
    grid.innerHTML = `
      <div class="produtos-empty">
        <i data-lucide="package" width="40" height="40" style="opacity:0.3;"></i>
        <p>Nenhum produto encontrado</p>
        <button class="btn-ghost" onclick="abrirModalNovo()">
          <i data-lucide="plus" width="14" height="14"></i> Adicionar produto
        </button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  grid.innerHTML = lista.map(p => {
    const estoqueClass = p.estoque === 0 ? 'estoque-zero' : p.estoque <= 5 ? 'estoque-low' : 'estoque-ok';
    const estoqueIcon  = p.estoque === 0 ? 'alert-circle' : p.estoque <= 5 ? 'alert-triangle' : 'check-circle';
    return `
      <div class="produto-card ${p.ativo ? '' : 'inativo'}">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${p.categoria ? `<span class="produto-categoria">${categoriaLabel[p.categoria]}</span>` : '<span></span>'}
          ${!p.ativo ? '<span class="badge badge-danger">Inativo</span>' : ''}
        </div>
        <div class="produto-nome">${p.nome}</div>
        ${p.codigo ? `<span class="produto-codigo">${p.codigo}</span>` : ''}
        <div class="produto-preco">${fmt(p.preco)}</div>
        <div class="produto-footer">
          <div class="produto-estoque ${estoqueClass}">
            <i data-lucide="${estoqueIcon}" width="13" height="13"></i>
            ${p.estoque} em estoque
          </div>
          <div class="produto-actions">
            <button class="produto-btn" onclick="abrirModalEditar(${p.id})" title="Editar">
              <i data-lucide="pencil" width="13" height="13"></i>
            </button>
            <button class="produto-btn danger" onclick="confirmarExcluir(${p.id})" title="Excluir">
              <i data-lucide="trash-2" width="13" height="13"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== MODAL NOVO =====
function abrirModalNovo() {
  document.getElementById('modalProdutoTitulo').textContent = 'Novo Produto';
  document.getElementById('produtoId').value        = '';
  document.getElementById('produtoNome').value      = '';
  document.getElementById('produtoPreco').value     = '';
  document.getElementById('produtoEstoque').value   = '';
  document.getElementById('produtoCodigo').value    = '';
  document.getElementById('produtoCategoria').value = '';
  document.getElementById('produtoAtivo').checked   = true;
  document.getElementById('modalProduto').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('produtoNome').focus(), 100);
}

// ===== MODAL EDITAR =====
function abrirModalEditar(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modalProdutoTitulo').textContent = 'Editar Produto';
  document.getElementById('produtoId').value        = p.id;
  document.getElementById('produtoNome').value      = p.nome;
  document.getElementById('produtoPreco').value     = p.preco;
  document.getElementById('produtoEstoque').value   = p.estoque;
  document.getElementById('produtoCodigo').value    = p.codigo || '';
  document.getElementById('produtoCategoria').value = p.categoria || '';
  document.getElementById('produtoAtivo').checked   = p.ativo;
  document.getElementById('modalProduto').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== SALVAR =====
function salvarProduto() {
  const nome  = document.getElementById('produtoNome').value.trim();
  const preco = parseFloat(document.getElementById('produtoPreco').value);
  if (!nome || isNaN(preco) || preco < 0) {
    alert('Preencha nome e preço corretamente.');
    return;
  }

  const id       = document.getElementById('produtoId').value;
  const estoque  = parseFloat(document.getElementById('produtoEstoque').value) || 0;
  const codigo   = document.getElementById('produtoCodigo').value.trim();
  const categoria= document.getElementById('produtoCategoria').value;
  const ativo    = document.getElementById('produtoAtivo').checked;

  if (id) {
    const idx = produtos.findIndex(p => p.id == id);
    if (idx > -1) produtos[idx] = { ...produtos[idx], nome, preco, estoque, codigo, categoria, ativo };
  } else {
    produtos.push({ id: Date.now(), nome, preco, estoque, codigo, categoria, ativo });
  }

  salvarProdutosLocal();
  fecharModal();
  renderProdutos();
}

// ===== EXCLUIR =====
function confirmarExcluir(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  idExcluir = id;
  document.getElementById('msgExcluir').textContent =
    `"${p.nome}" será removido permanentemente.`;
  document.getElementById('btnConfirmarExcluir').onclick = () => excluirProduto(id);
  document.getElementById('modalExcluir').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function excluirProduto(id) {
  produtos = produtos.filter(p => p.id !== id);
  salvarProdutosLocal();
  fecharModal();
  renderProdutos();
}

function fecharModal() {
  document.getElementById('modalProduto').style.display = 'none';
  document.getElementById('modalExcluir').style.display = 'none';
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
