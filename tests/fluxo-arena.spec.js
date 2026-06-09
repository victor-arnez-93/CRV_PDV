const { test, expect } = require('@playwright/test');

test('01 - deve abrir dashboard já logado', async ({ page }) => {
  await page.goto('http://localhost:5500/dashboard.html');

  await expect(page).toHaveURL(/dashboard\.html/);
});

test('02 - deve abrir tela de produtos já logado', async ({ page }) => {
  await page.goto('http://localhost:5500/produtos.html');

  await expect(page).toHaveURL(/produtos\.html/);
});

test('03 - deve abrir tela de caixa já logado', async ({ page }) => {
  await page.goto('http://localhost:5500/caixa.html');

  await expect(page).toHaveURL(/caixa\.html/);
});

test('04 - deve abrir tela de comandas já logado', async ({ page }) => {
  await page.goto('http://localhost:5500/comandas.html');

  await expect(page).toHaveURL(/comandas\.html/);
});

test('05 - deve abrir tela de agenda já logado', async ({ page }) => {
  await page.goto('http://localhost:5500/agenda.html');

  await expect(page).toHaveURL(/agenda\.html/);
});