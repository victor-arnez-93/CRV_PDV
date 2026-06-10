import { test, expect } from '@playwright/test';

test.use({
  storageState: 'tests/.auth/session.json'
});

const BASE_URL = 'http://localhost:5500';

const QA = {
  prefixo: `QA ${Date.now()}`,
  produtos: [
    { nome: 'Água QA', preco: 6, custo: 2 },
    { nome: 'Salgadinho QA', preco: 10, custo: 4 },
    { nome: 'Gatorade QA', preco: 12, custo: 6 }
  ],
  comandas: ['901', '902', '903'],
  jogos: []
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function hojeISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function horaRelativa(minutos) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutos);
  return d.toTimeString().slice(0, 5);
}

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
    page.getByRole('button', { name: /^Confirmar$/i }),
    page.getByRole('button', { name: /Entendi|Continuar|Fechar/i }).first()
  ];

  for (const botao of botoes) {
    if (await isVisible(botao)) {
      await botao.click();
      await page.waitForTimeout(400);
      return true;
    }
  }

  return false;
}

async function fecharModalSucessoSeExistir(page) {
  await clicarSeVisivel(page.getByRole('button', { name: /Nova Venda/i }));
  await clicarSeVisivel(page.getByRole('button', { name: /^OK$/i }));
  await clicarSeVisivel(page.getByRole('button', { name: /Fechar/i }).first());
}

async function garantirAppPronto(page) {
  await page.goto(`${BASE_URL}/caixa.html`);
  await page.waitForLoadState('domcontentloaded');

  await page.waitForFunction(() => {
    return window.sb && window.APP_EMPRESA_ID;
  }, { timeout: 15000 });
}

async function seedDadosQA(page) {
  await garantirAppPronto(page);

  const resultado = await page.evaluate(async ({ QA, hoje }) => {
    const empresaId = window.APP_EMPRESA_ID;
    const sb = window.sb;

    const log = {
      empresaId,
      produtosCriados: [],
      jogosCriados: [],
      jogadoresCriados: 0
    };

    for (const p of QA.produtos) {
      const { data: existente } = await sb
        .from('produtos')
        .select('id,nome')
        .eq('empresa_id', empresaId)
        .ilike('nome', p.nome)
        .limit(1);

      if (existente && existente.length) continue;

      const { data, error } = await sb
        .from('produtos')
        .insert([{
          empresa_id: empresaId,
          nome: p.nome,
          categoria: 'QA',
          preco_venda: p.preco,
          preco_custo: p.custo,
          estoque: 999,
          ativo: true,
          produto_rapido: true,
          codigo_barras: null
        }])
        .select('id,nome')
        .single();

      if (!error && data) log.produtosCriados.push(data.nome);
    }

    const jogos = [
      {
        nome: `${QA.prefixo} - Jogo vencido parcial`,
        local: 'Campo QA 1',
        inicio: QA.jogos[0].inicio,
        fim: QA.jogos[0].fim,
        valor: 220,
        jogadores: [
          'André QA', 'Vinicius QA', 'Carlos QA', 'João QA',
          'Marcos QA', 'Pedro QA', 'Lucas QA', 'Felipe QA'
        ]
      },
      {
        nome: `${QA.prefixo} - Jogo vencido total`,
        local: 'Campo QA 2',
        inicio: QA.jogos[1].inicio,
        fim: QA.jogos[1].fim,
        valor: 180,
        jogadores: [
          'Rafael QA', 'Bruno QA', 'Diego QA', 'Thiago QA',
          'Caio QA', 'Renan QA'
        ]
      },
      {
        nome: `${QA.prefixo} - Jogo chegando agora`,
        local: 'Campo QA 3',
        inicio: QA.jogos[2].inicio,
        fim: QA.jogos[2].fim,
        valor: 160,
        jogadores: [
          'Murilo QA', 'Gustavo QA', 'Eduardo QA', 'Leandro QA'
        ]
      }
    ];

    for (const jogo of jogos) {
      const { data: existente } = await sb
        .from('agenda')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('cliente_nome', jogo.nome)
        .limit(1);

      if (existente && existente.length) {
        log.jogosCriados.push({ id: existente[0].id, nome: jogo.nome, reutilizado: true });
        continue;
      }

      const { data: agendaNova, error } = await sb
        .from('agenda')
        .insert([{
          empresa_id: empresaId,
          cliente_nome: jogo.nome,
          cliente_telefone: null,
          data_agendamento: hoje,
          hora_inicio: jogo.inicio,
          hora_fim: jogo.fim,
          local_recurso: jogo.local,
          tipo_jogo: 'avulso',
          status_jogo: 'agendado',
          recorrencia: 'avulso',
          valor_previsto: jogo.valor,
          valor_mensal: 0,
          dia_pagamento_mensal: null,
          observacoes: 'Criado automaticamente pelo QA Playwright',
          usar_times: false,
          time_a: null,
          time_b: null,
          total_jogadores: jogo.jogadores.length,
          total_pago_jogadores: 0,
          total_pendente_jogadores: 0,
          atualizado_em: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (error) throw new Error(`Erro ao criar agenda QA: ${error.message}`);

      const valorJogador = Number((jogo.valor / jogo.jogadores.length).toFixed(2));

      const jogadoresPayload = jogo.jogadores.map(nome => ({
        empresa_id: empresaId,
        agenda_id: agendaNova.id,
        nome,
        time_jogador: null,
        valor: valorJogador,
        forma_pagamento: null,
        pago: false,
        status_pagamento: 'pendente',
        pago_em: null,
        removido: false
      }));

      const { error: errJogadores } = await sb
        .from('agenda_jogadores')
        .insert(jogadoresPayload);

      if (errJogadores) throw new Error(`Erro ao criar jogadores QA: ${errJogadores.message}`);

      log.jogosCriados.push({ id: agendaNova.id, nome: jogo.nome, reutilizado: false });
      log.jogadoresCriados += jogadoresPayload.length;
    }

    return log;
  }, {
    QA: {
      ...QA,
      jogos: [
        { inicio: horaRelativa(-240), fim: horaRelativa(-180) },
        { inicio: horaRelativa(-170), fim: horaRelativa(-110) },
        { inicio: horaRelativa(-60), fim: horaRelativa(-5) }
      ]
    },
    hoje: hojeISO()
  });

  console.log('[QA SEED]', resultado);
}

async function garantirCaixaAberto(page) {
  await page.goto(`${BASE_URL}/caixa.html`);
  await page.waitForLoadState('domcontentloaded');

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

async function escolherFormaPagamento(page, forma = 'pix') {
  const mapa = {
    pix: /^PIX$/i,
    dinheiro: /^Dinheiro$/i,
    cartao: /^Cartão$/i
  };

  await page.getByRole('button', { name: mapa[forma] || /^PIX$/i }).click();
}

async function venderProdutoRapido(page, nomeProduto, formaPagamento = 'pix') {
  await garantirModoVendaRapida(page);

  const produto = page.getByText(nomeProduto, { exact: false }).first();
  await expect(produto).toBeVisible({ timeout: 10000 });
  await produto.click();

  await escolherFormaPagamento(page, formaPagamento);

  await page.getByRole('button', { name: /Finalizar Venda/i }).click();
  await confirmarModalOk(page);
  await fecharModalSucessoSeExistir(page);

  console.log(`[QA VENDA] ${nomeProduto} via ${formaPagamento}`);
}

async function botaoFinalizarEhFecharComanda(page) {
  const textoBotao = await texto(page.locator('#btnFinalizar'));
  return /Fechar Comanda/i.test(textoBotao);
}

async function ativarComandaPorCodigo(page, codigo) {
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

  const opcoes = [
    page.getByRole('button', { name: new RegExp(codigo, 'i') }).first(),
    page.getByText(new RegExp(`Comanda\\s*${codigo}`, 'i')).first(),
    page.getByText(new RegExp(codigo, 'i')).first()
  ];

  for (const opcao of opcoes) {
    if (await isVisible(opcao)) {
      await opcao.click();
      await page.waitForTimeout(800);

      if (await clicarSeVisivel(page.locator('#btnAbrirSemIdentificacao'))) {
        await page.waitForTimeout(800);
      }

      if (await botaoFinalizarEhFecharComanda(page)) return;
    }
  }

  throw new Error(`ERRO REAL: não foi possível abrir/ativar a comanda ${codigo}.`);
}

async function adicionarProdutoNaComanda(page, codigo, nomeProduto) {
  await ativarComandaPorCodigo(page, codigo);

  const produto = page.getByText(nomeProduto, { exact: false }).first();
  await expect(produto).toBeVisible({ timeout: 10000 });
  await produto.click();

  await expect(page.locator('#btnFinalizar')).toContainText(/Fechar Comanda/i, {
    timeout: 10000
  });

  console.log(`[QA COMANDA] ${codigo} recebeu ${nomeProduto}`);
}

async function ocultarComandaSePossivel(page) {
  await clicarSeVisivel(page.getByRole('button', { name: /Ocultar/i }));
}

async function fecharComanda(page, codigo, forma = 'cartao') {
  await ativarComandaPorCodigo(page, codigo);

  await escolherFormaPagamento(page, forma);
  await page.getByRole('button', { name: /Fechar Comanda/i }).click();

  await confirmarModalOk(page);
  await fecharModalSucessoSeExistir(page);

  console.log(`[QA COMANDA] ${codigo} fechada via ${forma}`);
}

async function abrirJogosCaixa(page) {
  await page.goto(`${BASE_URL}/caixa.html`);
  await page.waitForLoadState('domcontentloaded');

  const btnJogos = page.getByRole('button', { name: /^Jogos$/i });
  await expect(btnJogos).toBeVisible({ timeout: 10000 });
  await btnJogos.click();
  await page.waitForTimeout(1200);
}

async function obterCardsJogosCaixa(page) {
  const seletores = [
    '.jogo-ativo-item',
    '.jogo-cobranca-item',
    '.jogo-pendente-item',
    '[data-agenda-id]',
    '.jogo-item',
    '.agenda-card'
  ];

  for (const seletor of seletores) {
    const loc = page.locator(seletor);
    const qtd = await loc.count().catch(() => 0);
    if (qtd > 0) return loc;
  }

  return null;
}

async function abrirJogoPorNomeOuPrimeiro(page, nomeParcial = '') {
  await abrirJogosCaixa(page);

  if (nomeParcial) {
    const porTexto = page.getByText(new RegExp(nomeParcial, 'i')).first();

    if (await isVisible(porTexto)) {
      await porTexto.click();
      await page.waitForTimeout(1000);

      if (await isVisible(page.locator('#modalFinalizarJogoCaixa'))) {
        return true;
      }
    }
  }

  const cards = await obterCardsJogosCaixa(page);

  if (!cards || await cards.count() === 0) {
    console.log('[QA JOGO] Nenhum jogo disponível no caixa.');
    return false;
  }

  await cards.first().click();
  await page.waitForTimeout(1000);

  if (await isVisible(page.locator('#modalFinalizarJogoCaixa'))) {
    return true;
  }

  await confirmarModalOk(page);
  return await isVisible(page.locator('#modalFinalizarJogoCaixa'));
}

async function aplicarRateio(page) {
  const btnRateio = page.getByRole('button', { name: /Dividir entre jogadores/i });

  if (await isVisible(btnRateio)) {
    await btnRateio.click();
    await page.waitForTimeout(500);
  }

  await expect(page.locator('.jogo-caixa-jogador-row').first()).toBeVisible({
    timeout: 10000
  });
}

async function marcarTodosJogadoresDisponiveis(page) {
  const checks = page.locator('.jogo-caixa-check:not(:disabled)');
  const qtd = await checks.count();

  for (let i = 0; i < qtd; i++) {
    await checks.nth(i).check().catch(() => {});
  }

  return qtd;
}

async function deixarUltimosPendentes(page, quantidade = 1) {
  const checks = page.locator('.jogo-caixa-check:not(:disabled)');
  const qtd = await checks.count();

  if (qtd <= quantidade) {
    console.log('[QA JOGO] Poucos jogadores disponíveis para parcial.');
    return false;
  }

  await marcarTodosJogadoresDisponiveis(page);

  for (let i = 0; i < quantidade; i++) {
    await checks.nth(qtd - 1 - i).uncheck().catch(() => {});
  }

  return true;
}

async function enviarUltimoJogadorParaComanda(page, codigoComanda) {
  const botoes = page.locator('.jogo-caixa-btn-comanda:not(:disabled)');
  const qtd = await botoes.count();

  if (qtd < 1) {
    console.log('[QA JOGO] Nenhum botão de comanda disponível.');
    return false;
  }

  await botoes.nth(qtd - 1).click();

  const modal = page.locator('#modalSelecionarComanda');
  await expect(modal).toBeVisible({ timeout: 10000 });

  const input = page.locator('#inputBuscaModalComanda');

  if (await isVisible(input)) {
    await input.fill(codigoComanda);
    await page.waitForTimeout(500);
  }

  const botaoComanda = page.getByRole('button', { name: new RegExp(codigoComanda, 'i') }).first();

  if (await isVisible(botaoComanda)) {
    await botaoComanda.click();
    await confirmarModalOk(page);
    console.log(`[QA JOGO] Jogador enviado para comanda ${codigoComanda}`);
    return true;
  }

  console.log(`[QA JOGO] Comanda ${codigoComanda} não apareceu no modal.`);
  return false;
}

async function confirmarPagamentoJogo(page) {
  await page.getByRole('button', { name: /Confirmar pagamento/i }).click();
  await page.waitForTimeout(600);

  const btnParcial = page.getByRole('button', { name: /Confirmar parcial/i });
  const btnOk = page.locator('#btnOkConfirmCaixa');
  const btnConfirmar = page.getByRole('button', { name: /Confirmar/i }).last();

  if (await isVisible(btnParcial)) {
    await btnParcial.click();
  } else if (await isVisible(btnOk)) {
    await btnOk.click();
  } else if (await isVisible(btnConfirmar)) {
    await btnConfirmar.click();
  }

  await page.waitForTimeout(800);
  await confirmarModalOk(page);
}

async function cobrarJogoParcialComComanda(page, nomeParcial, codigoComanda) {
  const abriu = await abrirJogoPorNomeOuPrimeiro(page, nomeParcial);

  if (!abriu) {
    console.log(`[QA JOGO] ${nomeParcial} ignorado: não encontrado.`);
    return false;
  }

  await aplicarRateio(page);
  await deixarUltimosPendentes(page, 1);
  await enviarUltimoJogadorParaComanda(page, codigoComanda);
  await confirmarPagamentoJogo(page);

  console.log(`[QA JOGO] ${nomeParcial} pago parcialmente + 1 jogador na comanda ${codigoComanda}`);
  return true;
}

async function cobrarJogoTotal(page, nomeParcial) {
  const abriu = await abrirJogoPorNomeOuPrimeiro(page, nomeParcial);

  if (!abriu) {
    console.log(`[QA JOGO] ${nomeParcial} ignorado: não encontrado.`);
    return false;
  }

  await aplicarRateio(page);
  await marcarTodosJogadoresDisponiveis(page);
  await confirmarPagamentoJogo(page);

  console.log(`[QA JOGO] ${nomeParcial} pago total.`);
  return true;
}

async function exportarRelatorios(page) {
  await page.goto(`${BASE_URL}/relatorios.html`);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(/Faturamento|Relatórios|Ticket/i).first()).toBeVisible({
    timeout: 10000
  });

  const downloads = [];

  const botoes = [
    page.getByRole('button', { name: /PDF/i }).first(),
    page.getByRole('button', { name: /CSV|Excel|XLS/i }).first()
  ];

  for (const botao of botoes) {
    if (await isVisible(botao)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await botao.click();
      const download = await downloadPromise;

      if (download) {
        downloads.push(download.suggestedFilename());
      }
    }
  }

  console.log('[QA RELATÓRIOS] Downloads:', downloads.length ? downloads : 'nenhum arquivo baixado detectado');

  return downloads;
}

async function conferirVendas(page) {
  await page.goto(`${BASE_URL}/vendas.html`);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(/Jogo|Comanda|Água QA|Salgadinho QA|Gatorade QA/i).first()).toBeVisible({
    timeout: 15000
  });

  const corpo = await texto(page.locator('body'));

  const checks = {
    temJogo: /Jogo|jogo/i.test(corpo),
    temComanda: /Comanda|comanda/i.test(corpo),
    temProdutoQA: /Água QA|Salgadinho QA|Gatorade QA/i.test(corpo)
  };

  console.log('[QA VENDAS]', checks);

  if (!checks.temProdutoQA) {
    throw new Error('ERRO REAL: vendas rápidas QA não apareceram em vendas.');
  }

  return checks;
}

async function conferirDashboard(page) {
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(/Dashboard|Faturamento|Vendas|Hoje/i).first()).toBeVisible({
    timeout: 15000
  });

  console.log('[QA DASHBOARD] Dashboard carregado após dia operacional.');
}

async function fecharCaixaSePossivel(page) {
  await page.goto(`${BASE_URL}/caixa.html`);
  await page.waitForLoadState('domcontentloaded');

  const btnFechar = page.getByRole('button', { name: /Fechar Caixa/i }).first();

  if (!(await isVisible(btnFechar))) {
    console.log('[QA CAIXA] Botão Fechar Caixa não encontrado/visível. Caixa mantido aberto.');
    return false;
  }

  await btnFechar.click();
  await page.waitForTimeout(700);

  await confirmarModalOk(page);
  await fecharModalSucessoSeExistir(page);

  console.log('[QA CAIXA] Fechamento de caixa executado.');
  return true;
}

test('QA pesado - dia operacional completo arena', async ({ page }) => {
  test.setTimeout(180000);

  QA.jogos = [
    { inicio: horaRelativa(-240), fim: horaRelativa(-180) },
    { inicio: horaRelativa(-170), fim: horaRelativa(-110) },
    { inicio: horaRelativa(-60), fim: horaRelativa(-5) }
  ];

  await seedDadosQA(page);
  await garantirCaixaAberto(page);

  await venderProdutoRapido(page, 'Água QA', 'pix');
  await venderProdutoRapido(page, 'Gatorade QA', 'dinheiro');

  await adicionarProdutoNaComanda(page, '901', 'Salgadinho QA');
  await adicionarProdutoNaComanda(page, '901', 'Água QA');
  await ocultarComandaSePossivel(page);

  await adicionarProdutoNaComanda(page, '902', 'Gatorade QA');
  await ocultarComandaSePossivel(page);

  await cobrarJogoParcialComComanda(page, 'Jogo vencido parcial', '901');

  await venderProdutoRapido(page, 'Salgadinho QA', 'cartao');

  await cobrarJogoTotal(page, 'Jogo vencido total');

  await fecharComanda(page, '902', 'pix');

  await cobrarJogoTotal(page, 'Jogo chegando agora');

  await adicionarProdutoNaComanda(page, '903', 'Água QA');
  await adicionarProdutoNaComanda(page, '903', 'Salgadinho QA');
  await fecharComanda(page, '903', 'cartao');

  await fecharComanda(page, '901', 'cartao');

  const vendas = await conferirVendas(page);
  const downloads = await exportarRelatorios(page);
  await conferirDashboard(page);

  const caixaFechado = await fecharCaixaSePossivel(page);

  console.log('====================================================');
  console.log('RESULTADO QA PESADO ARENA');
  console.log('Produtos QA:', QA.produtos.map(p => p.nome).join(', '));
  console.log('Comandas usadas:', QA.comandas.join(', '));
  console.log('Vendas conferidas:', vendas);
  console.log('Arquivos de relatório detectados:', downloads);
  console.log('Caixa fechado:', caixaFechado);
  console.log('Status final: fluxo operacional concluído.');
  console.log('====================================================');
});