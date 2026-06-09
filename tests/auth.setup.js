require('dotenv').config();

const { test } = require('@playwright/test');

test('fazer login e salvar sessão', async ({ page }) => {
  await page.goto('http://localhost:5500/index.html');

  await page.getByRole('link', { name: 'Entrar', exact: true }).click();

  await page.getByRole('textbox', { name: 'admin@sistema.com' }).fill(process.env.LANDING_EMAIL);
  await page.getByRole('textbox', { name: 'Digite a senha' }).fill(process.env.LANDING_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('textbox', { name: 'E-mail' }).fill(process.env.TEST_EMAIL);
  await page.getByRole('textbox', { name: 'Senha' }).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'ENTRAR NO SISTEMA' }).click();

  await page.waitForURL(/dashboard\.html/);

  await page.context().storageState({ path: 'tests/.auth/session.json' });
});