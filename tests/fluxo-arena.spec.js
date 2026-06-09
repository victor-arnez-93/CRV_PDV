const { test, expect } = require('@playwright/test');

const produtos = [
  {
    nome: 'Salgadinho',
    venda: '0,500',
    custo: '0,250',
    estoque: '30',
    categoria: 'alimentos',
    codigo: '00000928000066',
    rapido: true
  },
  {
    nome: 'Salgado',
    venda: '0,1000',
    custo: '0,500',
    estoque: '30',
    categoria: 'alimentos',
    codigo: '00000928000077',
    rapido: true
  },
  {
    nome: 'Gatorade',
    venda: '0,1000',
    custo: '0,550',
    estoque: '20',
    categoria: 'bebidas',
    codigo: '00000928000088',
    rapido: false
  },
  {
    nome: 'Guaravita',
    venda: '0,800',
    custo: '0,350',
    estoque: '30',
    categoria: 'bebidas',
    codigo: '00000928000099',
    rapido: false
  },
  {
    nome: 'Água sem gás',
    venda: '0,600',
    custo: '0,250',
    estoque: '30',
    categoria: 'bebidas',
    codigo: '00000928000100',
    rapido: true
  },
  {
    nome: 'Água com gás',
    venda: '0,600',
    custo: '0,250',
    estoque: '30',
    categoria: 'bebidas',
    codigo: '00000928000111',
    rapido: true
  }
];

async function criarComandas(page) {
  await page.goto('http://localhost:5500/comandas.html');

  await page.getByRole('button', { name: 'Gerar Lote' }).click();
  await page.getByRole('spinbutton', { name: 'Número final' }).fill('20');
  await page.getByRole('button', { name: 'Gerar Comandas' }).click();

  const botaoConfirmar = page.locator('#btnOkConfirmComanda');

  if (await botaoConfirmar.isVisible()) {
    await botaoConfirmar.click();
  }

  await page.getByRole('button', { name: 'Fechar' }).click();
}

async function cadastrarProduto(page, produto) {
  await page.goto('http://localhost:5500/produtos.html');

  await page.getByRole('button', { name: 'Novo Produto' }).click();

  await page.getByRole('textbox', { name: 'Nome do produto *' }).fill(produto.nome);
  await page.getByRole('textbox', { name: 'Preço de venda *' }).fill(produto.venda);
  await page.getByRole('textbox', { name: 'Preço de custo' }).fill(produto.custo);
  await page.getByRole('spinbutton', { name: 'Estoque' }).fill(produto.estoque);
  await page.getByLabel('Categoria', { exact: true }).selectOption(produto.categoria);
  await page.getByRole('textbox', { name: 'Código de barras' }).fill(produto.codigo);

  if (produto.rapido) {
    await page.locator('div:nth-child(10) > .toggle > .toggle-slider').click();
  }

  await page.getByRole('button', { name: 'Salvar' }).click();
}

test('01 - preparar ambiente da arena com comandas e produtos', async ({ page }) => {
  // await criarComandas(page);

  for (const produto of produtos) {
    await cadastrarProduto(page, produto);
  }

  await page.goto('http://localhost:5500/caixa.html');

  await expect(page).toHaveURL(/caixa\.html/);
});