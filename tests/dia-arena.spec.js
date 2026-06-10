import { test, expect } from '@playwright/test';

test.use({
  storageState: 'tests/.auth/session.json'
});

async function isVisible(locator) {
  return await locator.isVisible().catch(() => false);
}

async function clicarSeVisivel(locator) {
  if (await isVisible(locator)) {
    await locator.click();
    return true;
  }
  return false;
}

async function texto(locator) {
  return (await locator.textContent().catch(() => '') || '').trim();
}

async function confirmarModalOk(page) {
  const botoes = [
    page.locator('#btnOkConfirmCaixa'),
    page.getByRole('button', { name: /^OK$/i }),
    page.getByRole('button', { name: /Confirmar/i }).last()
  ];

  for (const botao of botoes) {
    if (await isVisible(botao)) {
      await botao.click();
      await page.waitForTimeout(300);
      return true;
    }
  }

  return false;
}

async function fecharModalSucessoSeExistir(page) {
  await clicarSeVisivel(page.getByRole('button', { name: /Nova Venda/i }));
  await clicarSeVisivel(page.getByRole('button', { name: /^OK$/i }));
}

async function garantirCaixaAberto(page) {
  await page.goto('http://localhost:5500/caixa.html');

  const statusText = page.locator('#statusText');
  const statusAtual = await texto(statusText);

  if (/Caixa aberto/i.test(statusAtual)) return;

  if (await isVisible(page.locator('#valorInicial'))) {
    await page.locator('#valorInicial').fill('10000');
  }

  await clicarSeVisivel(page.getByRole('button', { name: /Abrir Caixa/i }));
  await confirmarModalOk(page);

  await expect(statusText).toContainText(/Caixa aberto/i, { timeout: 10000 });
}

async function garantirModoVendaRapida(page) {
  await clicarSeVisivel(page.getByRole('button', { name: /Venda rápida/i }));
}

async function garantirModoComanda(page) {
  const btnComanda = page.getByRole('button', { name: /^Comanda$/i });
  await expect(btnComanda).toBeVisible({ timeout: 10000 });
  await btnComanda.click();
  await page.waitForTimeout(500);
}

async function botaoFinalizarEhFecharComanda(page) {
  const textoBotao = await texto(page.locator('#btnFinalizar'));
  return /Fechar Comanda/i.test(textoBotao);
}

async function ativarComandaPorCodigo(page, codigo = '001') {
  await garantirModoComanda(page);

  const inputBusca = page.locator('#inputBusca');
  await expect(inputBusca).toBeVisible({ timeout: 10000 });

  await inputBusca.fill(codigo);
  await inputBusca.press('Enter');
  await page.waitForTimeout(800);

  if (await clicarSeVisivel(page.locator('#btnAbrirSemIdentificacao'))) {
    await page.waitForTimeout(800);
  }

  if (await botaoFinalizarEhFecharComanda(page)) return;

  const opcoesComanda = [
    page.getByRole('button', { name: new RegExp(codigo, 'i') }).first(),
    page.getByText(new RegExp(`Comanda\\s*${codigo}`, 'i')).first(),
    page.getByText(new RegExp(codigo, 'i')).first()
  ];

  for (const opcao of opcoesComanda) {
    if (await isVisible(opcao)) {
      await opcao.click();
      await page.waitForTimeout(800);

      if (await clicarSeVisivel(page.locator('#btnAbrirSemIdentificacao'))) {
        await page.waitForTimeout(800);
      }

      if (await botaoFinalizarEhFecharComanda(page)) return;
    }
  }

  const estadoFinal = await texto(page.locator('#btnFinalizar'));

  throw new Error(
    `ERRO REAL: não foi possível ativar a comanda ${codigo}. Botão finalizar ficou como: "${estadoFinal}".`
  );
}

async function venderProdutoRapido(page, nomeProduto, formaPagamento = 'pix') {
  await garantirModoVendaRapida(page);

  const produto = page.getByText(nomeProduto, { exact: false }).first();
  await expect(produto).toBeVisible({ timeout: 10000 });
  await produto.click();

  if (formaPagamento === 'pix') {
    await page.getByRole('button', { name: /^PIX$/i }).click();
  }

  if (formaPagamento === 'dinheiro') {
    await page.getByRole('button', { name: /^Dinheiro$/i }).click();
  }

  if (formaPagamento === 'cartao') {
    await page.getByRole('button', { name: /^Cartão$/i }).click();
  }

  await page.getByRole('button', { name: /Finalizar Venda/i }).click();
  await confirmarModalOk(page);
  await fecharModalSucessoSeExistir(page);
}

async function ocultarComandaSePossivel(page) {
  await clicarSeVisivel(page.getByRole('button', { name: /Ocultar/i }));
}

async function adicionarProdutoNaComanda(page, nomeProduto) {
  const produto = page.getByText(nomeProduto, { exact: false }).first();
  await expect(produto).toBeVisible({ timeout: 10000 });
  await produto.click();

  await expect(page.locator('#btnFinalizar')).toContainText(/Fechar Comanda/i, {
    timeout: 10000
  });
}

async function abrirPrimeiroJogoDisponivel(page) {
  await page.getByRole('button', { name: /^Jogos$/i }).click();

  const primeiroJogo = page.locator('.jogo-ativo-item').first();

  await expect(primeiroJogo).toBeVisible({
    timeout: 10000
  });

  await primeiroJogo.click();

  await expect(page.locator('#modalFinalizarJogoCaixa')).toBeVisible({
    timeout: 10000
  });
}

async function aplicarRateio(page) {
  const btnRateio = page.getByRole('button', { name: /Dividir entre jogadores/i });

  if (await isVisible(btnRateio)) {
    await btnRateio.click();
  }

  await expect(page.locator('.jogo-caixa-jogador-row').first()).toBeVisible({
    timeout: 10000
  });
}

async function deixarUmPendente(page) {
  const checks = page.locator('.jogo-caixa-check:not(:disabled)');
  const qtd = await checks.count();

  if (qtd < 2) {
    throw new Error('ERRO REAL: teste precisa de pelo menos 2 jogadores pendentes para pagamento parcial.');
  }

  await checks.nth(qtd - 1).uncheck();
}

async function enviarJogadorParaComanda(page, codigoComanda = '001') {
  const botoesComanda = page.locator('.jogo-caixa-btn-comanda:not(:disabled)');
  const qtd = await botoesComanda.count();

  if (qtd < 1) {
    throw new Error('ERRO REAL: nenhum jogador disponível para enviar para comanda.');
  }

  await botoesComanda.nth(qtd - 1).click();

  const modalComanda = page.locator('#modalSelecionarComanda');
  await expect(modalComanda).toBeVisible({ timeout: 10000 });

  const inputBuscaComanda = page.locator('#inputBuscaModalComanda');

  if (await isVisible(inputBuscaComanda)) {
    await inputBuscaComanda.fill(codigoComanda);
    await page.waitForTimeout(500);
  }

  const botaoComanda = page.getByRole('button', { name: new RegExp(codigoComanda, 'i') }).first();
  await expect(botaoComanda).toBeVisible({ timeout: 10000 });
  await botaoComanda.click();

  await confirmarModalOk(page);
}

async function confirmarPagamentoJogo(page) {
  await page.getByRole('button', { name: /Confirmar pagamento/i }).click();
  await page.waitForTimeout(500);

  const btnConfirmarParcial = page.getByRole('button', { name: /Confirmar parcial/i });
  const btnOk = page.locator('#btnOkConfirmCaixa');
  const btnConfirmarGenerico = page.getByRole('button', { name: /Confirmar/i }).last();

  if (await isVisible(btnConfirmarParcial)) {
    await btnConfirmarParcial.click();
  } else if (await isVisible(btnOk)) {
    await btnOk.click();
  } else if (await isVisible(btnConfirmarGenerico)) {
    await btnConfirmarGenerico.click();
  }

  await page.waitForTimeout(500);
  await confirmarModalOk(page);
}

async function fecharComandaAtual(page, codigo = '001') {
  await ativarComandaPorCodigo(page, codigo);

  await page.getByRole('button', { name: /^Cartão$/i }).click();
  await page.getByRole('button', { name: /Fechar Comanda/i }).click();

  await confirmarModalOk(page);
  await fecharModalSucessoSeExistir(page);
}

async function finalizarUltimoPendenteDoJogo(page) {
  await abrirPrimeiroJogoDisponivel(page);

  const checks = page.locator('.jogo-caixa-check:not(:disabled)');
  const qtd = await checks.count();

  if (qtd < 1) {
    await clicarSeVisivel(page.locator('#btnFecharFinalizarJogo'));
    return;
  }

  await checks.first().check();

  await confirmarPagamentoJogo(page);
}

async function conferirVendasERelatorios(page) {
  await page.goto('http://localhost:5500/vendas.html');

  await expect(page.getByText(/Jogo|Comanda|Água|Salgadinho/i).first()).toBeVisible({
    timeout: 10000
  });

  await page.goto('http://localhost:5500/relatorios.html');

  await expect(page.getByText(/Faturamento|Relatórios|Ticket/i).first()).toBeVisible({
    timeout: 10000
  });
}

test('dia completo arena - caixa, jogos, comanda, vendas e relatórios', async ({ page }) => {
  await garantirCaixaAberto(page);

  await venderProdutoRapido(page, 'Água com gás', 'pix');

  await ativarComandaPorCodigo(page, '001');
  await adicionarProdutoNaComanda(page, 'Salgadinho');
  await ocultarComandaSePossivel(page);

  await abrirPrimeiroJogoDisponivel(page);
  await aplicarRateio(page);
  await deixarUmPendente(page);
  await enviarJogadorParaComanda(page, '001');
  await confirmarPagamentoJogo(page);

  await fecharComandaAtual(page, '001');

  await finalizarUltimoPendenteDoJogo(page);

  await conferirVendasERelatorios(page);
});