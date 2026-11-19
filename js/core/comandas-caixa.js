/* Recebimentos de comanda: online, transacionais e com confirmação idempotente. */
window.crvComandasCaixa = (() => {
  let dialogo, detalhe, ocupado = false, abrindo = false, foco, contexto;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moeda = v => Number(v || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const valor = v => {
    const s = String(v ?? '').trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
    if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d+(?:[.,]\d{1,2})?$/.test(s)) return Number(s.replace(',', '.'));
    return NaN;
  };
  const campoMoeda = v => moeda(v).replace(/\u00a0/g, ' ');
  function mascararMoeda(input) {
    const digitos = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = digitos ? campoMoeda(Number(digitos) / 100) : '';
  }
  function formatarPagador(nome) {
    const minusculas = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
    return String(nome || '').toLocaleLowerCase('pt-BR').replace(/\S+/g, (parte, inicio) =>
      inicio > 0 && minusculas.has(parte) ? parte : parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1)
    );
  }
  function novaConfirmacao() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  const $ = id => dialogo.querySelector('#'+id);
  const chave = () => `crv:comanda:pendente:${contexto.empresa}:${detalhe.comanda.id}`;
  function erro(e) {
    const aviso = $('ccErro');
    aviso.textContent = e?.message || String(e);
    aviso.scrollIntoView({ block: 'nearest' });
  }
  function criar() {
    if(dialogo) return;
    dialogo=document.createElement('dialog');dialogo.className='crv-comanda-dialog';
    dialogo.setAttribute('aria-labelledby','ccTitulo');
    document.body.appendChild(dialogo);
    dialogo.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
    dialogo.addEventListener('close',()=>{foco?.focus?.();});
  }
  function pendente() {try{return JSON.parse(sessionStorage.getItem(chave())||'null');}catch{return null;}}
  async function consultar(id) {
    if(!sistemaOnline())throw Error('Conecte-se à internet para consultar e receber comandas.');
    const {data,error}=await sb.rpc('crv_comanda_detalhes',{p_comanda_id:id});
    if(error)throw Error(error.code==='PGRST202'?'O banco de dados ainda não disponibiliza a consulta de comandas. Avise o responsável pelo sistema.':error.message);
    return data;
  }
  async function abrir(id) {
    if(ocupado||abrindo||dialogo?.open)return;
    abrindo=true;
    try {
      await aguardarOperacoesComandaCaixa();
      // Recupera inclusive fechamento cuja resposta se perdeu e já saiu das abertas.
      const key=`crv:comanda:pendente:${obterEmpresaId()}:${id}`;
      const anterior=JSON.parse(sessionStorage.getItem(key)||'null');
      if(anterior){
        if(anterior.p_operador_id!==obterOperadorAtualId())throw Error('Há confirmação pendente de outro operador neste dispositivo. Entre com esse operador para consultá-la.');
        if(!sistemaOnline())throw Error('Reconecte para consultar a confirmação pendente.');
        const {data,error}=await sb.rpc('crv_receber_comanda',anterior);
        if(error){if(/^[0-9A-Z]{5}$/.test(error.code||'')&&!/^08/.test(error.code))sessionStorage.removeItem(key);throw error;}
        sessionStorage.removeItem(key);
        if(data.fechada){
          if(comandaAtiva?.id===id && (!comandaAtiva.crv_atendimento_id||comandaAtiva.crv_atendimento_id===anterior.p_atendimento_id)){comandaAtiva=null;carrinho=[];comandaOculta=false;}
          await sincronizar();await alertaCaixa('Confirmação recuperada','O fechamento foi confirmado. Nenhum recebimento foi duplicado.');return;
        }
        await sincronizar();
        await alertaCaixa('Pagamento parcial confirmado', `Recebimento recuperado: ${moeda(data.valor)}. A comanda continua aberta. Nenhum pagamento foi duplicado.`);
      }
      const dados=await consultar(id); criar(); detalhe=dados;
      contexto={empresa:obterEmpresaId(),operador:obterOperadorAtualId(),caixa:caixa?.id};
      foco=document.activeElement; desenhar();dialogo.showModal();$('ccFechar').focus();
    }catch(e){await alertaCaixa('Detalhes da comanda',esc(e.message));}finally{abrindo=false;}
  }
  function desenhar() {
    const d = detalhe;
    const c = d.comanda;
    const caixaAberto = caixa?.status === 'aberto';
    const pend = pendente();
    const temItens = d.itens.length > 0;
    const podeDesconto = temItens && caixaAberto && !pend && Number(d.recebido) === 0
      && window.crvOperadorPodeEspecial?.('desconto');
    dialogo.innerHTML = `
      <header class="cc-header">
        <div>
          <small>Comanda aberta</small>
          <h2 id="ccTitulo"><b>${esc(c.codigo)}</b> <span>${esc(c.nome_cliente || 'Sem identificação')}</span></h2>
        </div>
        <div class="cc-header-acoes">
          <button type="button" id="ccAtualizar" class="btn-ghost">Recarregar comanda</button>
          <button type="button" id="ccFechar" class="btn-ghost" aria-label="Fechar detalhes">✕</button>
        </div>
      </header>
      <div class="cc-corpo">
        <form id="ccForm" class="cc-receber" novalidate>
          <dl class="cc-resumo">
            <div class="cc-consumo-total"><dt>Consumo</dt><dd>${moeda(d.consumo)}</dd></div>
            <div class="cc-recebido"><dt>Já recebido</dt><dd>${moeda(d.recebido)}</dd></div>
            <div class="cc-desconto">
              <dt>${podeDesconto ? '<label for="ccDesconto">Desconto total</label>' : 'Desconto total'}</dt>
              <dd>${podeDesconto ? `<input id="ccDesconto" inputmode="decimal" autocomplete="off" value="${campoMoeda(d.desconto)}" />` : moeda(d.desconto)}</dd>
            </div>
            <div class="cc-saldo"><dt>Falta pagar</dt><dd id="ccSaldo">${moeda(d.saldo)}</dd></div>
          </dl>
          <p id="ccStatus" class="cc-feedback" role="status" tabindex="-1"></p>
          ${!caixaAberto ? '<p class="cc-aviso">Abra o caixa para receber ou encerrar a comanda.</p>' : ''}
          ${pend ? '<p class="cc-aviso">Consulte a confirmação pendente antes de receber novamente.</p><button type="button" class="btn-primary" id="ccRetomar"><span>Consultar confirmação</span></button>' : ''}
          <fieldset class="cc-campos" ${!temItens || pend ? 'hidden' : ''} ${!caixaAberto || pend ? 'disabled' : ''}>
            <legend class="cc-visually-hidden">Recebimento</legend>
            <div id="ccModos" class="cc-modos" role="group" aria-label="Tipo de recebimento">
              <button type="button" class="btn-primary" id="ccModoIntegral" aria-pressed="true"><span>Quitar saldo</span></button>
              <button type="button" class="btn-primary" id="ccModoParcial" aria-pressed="false"><span>Pagamento parcial</span></button>
            </div>
            <div id="ccDados" class="cc-dados">
              <label id="ccParcialLabel" class="cc-parcial-valor" hidden>Valor do pagamento parcial
                <input id="ccValor" inputmode="decimal" autocomplete="off" placeholder="R$ 0,00" />
              </label>
              <label>Forma de pagamento
                <select id="ccForma">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="debito">Cartão de débito</option>
                  <option value="credito">Cartão de crédito</option>
                </select>
              </label>
              <label>Quem pagou
                <select id="ccPagadorOpcao" required>
                  <option value="">Selecione</option>
                  ${c.nome_cliente?.trim() ? `<option value="responsavel">${esc(c.nome_cliente)}</option>` : ''}
                  <option value="outro">Outra pessoa</option>
                </select>
              </label>
              <label id="ccPagadorLabel" class="cc-pagador-nome" hidden>Nome de quem pagou
                <input id="ccPagador" maxlength="120" autocomplete="off" />
              </label>
              <div id="ccDinheiro" class="cc-dinheiro">
                <label>Dinheiro entregue <span class="cc-opcional">(opcional)</span>
                  <input id="ccEntregue" inputmode="decimal" autocomplete="off" placeholder="Valor exato" aria-describedby="ccAjudaDinheiro" />
                </label>
                <div class="cc-troco"><span>Troco</span><strong id="ccTroco">${moeda(0)}</strong></div>
                <p id="ccAjudaDinheiro" class="cc-sub">Preencha se precisar calcular o troco.</p>
              </div>
            </div>
            <p id="ccAjudaAcao" class="cc-sub"></p>
            <button class="btn-secondary" id="ccConfirmar" type="submit"><span></span></button>
          </fieldset>
          ${!temItens && !pend ? `<p class="cc-sub" id="ccAjudaVazia">Adicione produtos para cobrar ou encerre a comanda vazia.</p>
            <button type="button" id="ccEncerrarVazia" class="btn-ghost" ${!caixaAberto ? 'disabled' : ''}>Encerrar comanda vazia</button>` : ''}
          <p id="ccErro" class="cc-feedback cc-feedback-erro" role="alert"></p>
        </form>
        <div class="cc-consumo">
          ${c.data_abertura ? `<p class="cc-sub">Aberta em ${esc(new Date(c.data_abertura).toLocaleString('pt-BR'))}</p>` : ''}
          ${c.observacoes ? `<p class="cc-observacoes">${esc(c.observacoes)}</p>` : ''}
          <section class="cc-painel">
            <div class="cc-section-title">
              <h3>Itens da comanda</h3>
              <button type="button" id="ccConsumir" class="btn-primary"><span>Editar consumo</span></button>
            </div>
            <div class="cc-itens">${d.itens.length ? d.itens.map(i => `
              <div class="cc-item">
                <span><b>${esc(i.quantidade)} × ${esc(i.nome)}</b><small>${moeda(i.preco)} cada</small></span>
                <strong>${moeda(i.preco * i.quantidade)}</strong>
              </div>`).join('') : '<p class="cc-vazio">Nenhum item lançado.</p>'}</div>
          </section>
          <section class="cc-painel">
            <div class="cc-section-title"><h3>Histórico de pagamentos</h3></div>
            <div class="cc-historico">${d.pagamentos.length ? d.pagamentos.map(p => `
              <div class="cc-item ${p.status_operacional === 'cancelada' ? 'cc-cancelado' : ''}">
                <span><b>${moeda(p.total)} · ${esc(p.forma_pagamento)}</b>
                  <small>${esc(new Date(p.data).toLocaleString('pt-BR'))}${p.comanda_pagador ? ' · ' + esc(p.comanda_pagador) : ''} · ${p.status_operacional === 'cancelada' ? 'Estornado' : 'Recebido'} · ${esc(p.id.slice(0, 8))}</small>
                </span>
                ${window.crvEstornos?.permitido(p, caixa?.id) ? `<button type="button" class="btn-ghost" data-estorno="${esc(p.id)}">Estornar</button>` : ''}
              </div>`).join('') : '<p class="cc-vazio">Nenhum pagamento registrado.</p>'}</div>
          </section>
        </div>
      </div>`;

    $('ccFechar').onclick = () => { if (!ocupado) dialogo.close(); };
    $('ccAtualizar').onclick = atualizar;
    $('ccConsumir').onclick = async () => {
      if (ocupado) return;
      if (carrinho.length && !comandaAtiva) {
        erro('Finalize ou limpe a venda atual antes de trocar para esta comanda.');
        return;
      }
      try {
        dialogo.close();
        await selecionarComandaCaixa(c);
      } catch (e) {
        await alertaCaixa('Editar consumo', esc(e.message));
      }
    };
    $('ccForm').onsubmit = event => {
      event.preventDefault();
      if (temItens && !$('ccConfirmar').matches(':disabled')) confirmar(!pagamentoParcial());
    };
    $('ccModoIntegral').onclick = () => selecionarModo(false);
    $('ccModoParcial').onclick = () => selecionarModo(true);
    $('ccForma').onchange = atualizarPagamento;
    $('ccPagadorOpcao').onchange = () => {
      const outro = $('ccPagadorOpcao').value === 'outro';
      $('ccPagadorLabel').hidden = !outro;
      $('ccPagador').required = outro;
      if (outro) $('ccPagador').focus();
    };
    $('ccPagador').oninput = () => { $('ccPagador').value = formatarPagador($('ccPagador').value); };
    ['ccValor', 'ccEntregue', 'ccDesconto'].forEach(id => {
      const campo = $(id);
      if (!campo) return;
      campo.oninput = () => {
        mascararMoeda(campo);
        atualizarPagamento();
      };
      campo.onfocus = () => campo.select();
    });
    $('ccForm').oninput = () => { $('ccErro').textContent = ''; };
    $('ccEncerrarVazia')?.addEventListener('click', () => {
      const botao = $('ccEncerrarVazia');
      if (botao.dataset.confirmar === 'sim') {
        confirmar(true);
        return;
      }
      botao.dataset.confirmar = 'sim';
      botao.textContent = 'Confirmar encerramento';
      $('ccAjudaVazia').textContent = 'A comanda será encerrada sem registrar uma venda.';
    });
    $('ccRetomar')?.addEventListener('click', () => enviar(pendente()));
    dialogo.querySelectorAll('[data-estorno]').forEach(botao => {
      botao.onclick = () => {
        const p = d.pagamentos.find(p => p.id === botao.dataset.estorno);
        window.crvEstornos.abrir(p, caixa?.id, async () => {
          await sincronizar();
          await atualizar();
        });
      };
    });
    atualizarPagamento();
  }

  const pagamentoParcial = () => $('ccModoParcial').getAttribute('aria-pressed') === 'true';
  const descontoAtual = () => $('ccDesconto') ? valor($('ccDesconto').value || '0') : Number(detalhe.desconto || 0);
  function saldoAtual() {
    const desconto = descontoAtual();
    if (desconto === Number(detalhe.desconto || 0)) return Number(detalhe.saldo);
    return Math.round((Number(detalhe.consumo) - desconto - Number(detalhe.recebido)) * 100) / 100;
  }

  function selecionarModo(parcial) {
    if (parcial !== pagamentoParcial()) $('ccEntregue').value = '';
    $('ccModoIntegral').setAttribute('aria-pressed', String(!parcial));
    $('ccModoParcial').setAttribute('aria-pressed', String(parcial));
    $('ccErro').textContent = '';
    atualizarPagamento();
    if (parcial) $('ccValor').focus();
  }

  function atualizarPagamento() {
    const saldo = saldoAtual();
    const saldoValido = Number.isFinite(saldo) && saldo >= 0;
    const temSaldo = saldo > 0;
    if (!temSaldo) {
      $('ccModoIntegral').setAttribute('aria-pressed', 'true');
      $('ccModoParcial').setAttribute('aria-pressed', 'false');
      $('ccEntregue').value = '';
    }
    const parcial = temSaldo && pagamentoParcial();
    const pagar = parcial ? valor($('ccValor').value) : saldo;
    const entregue = valor($('ccEntregue').value);
    const dinheiro = $('ccForma').value === 'dinheiro';
    $('ccSaldo').textContent = saldoValido ? moeda(saldo) : 'Desconto inválido';
    $('ccModos').hidden = !temSaldo;
    $('ccDados').hidden = !temSaldo;
    $('ccParcialLabel').hidden = !parcial;
    $('ccValor').required = parcial;
    $('ccDinheiro').hidden = !dinheiro;
    $('ccTroco').textContent = moeda(Number.isFinite(pagar) && Number.isFinite(entregue)
      ? Math.max(0, entregue - pagar) : 0);
    const confirmar = $('ccConfirmar');
    confirmar.disabled = !saldoValido;
    let texto = 'Encerrar comanda';
    if (temSaldo) {
      texto = parcial ? 'Registrar parcial' : 'Receber e encerrar';
      if (Number.isFinite(pagar) && pagar > 0 && (!parcial || pagar < saldo)) texto += ' · ' + moeda(pagar);
    }
    confirmar.querySelector('span').textContent = texto;
    const ajuda = $('ccAjudaAcao');
    ajuda.textContent = saldo === 0 ? 'Encerramento sem nova cobrança.'
      : !temSaldo ? 'Confira o desconto aplicado.'
      : parcial ? 'A comanda continua aberta.' : '';
    if (temSaldo && !dinheiro) {
      const meio = $('ccForma').value === 'pix' ? 'o Pix' : 'a aprovação do cartão';
      ajuda.textContent += (ajuda.textContent ? ' ' : '') + `Confira ${meio} antes de registrar.`;
    }
    ajuda.hidden = !ajuda.textContent;
  }

  function informar(mensagem) {
    const status = $('ccStatus');
    status.textContent = mensagem;
    status.focus();
  }

  function bloquearControles() {
    const controles = [...dialogo.querySelectorAll('button, input, select')].map(campo => [campo, campo.disabled]);
    controles.forEach(([campo]) => { campo.disabled = true; });
    dialogo.setAttribute('aria-busy', 'true');
    return () => {
      controles.forEach(([campo, desabilitado]) => { campo.disabled = desabilitado; });
      dialogo.removeAttribute('aria-busy');
    };
  }

  function atendimentoAberto(dados, atendimento) {
    const comanda = dados?.comanda;
    return comanda && comanda.crv_atendimento_id === atendimento && (!comanda.status || comanda.status === 'aberta');
  }

  async function atualizar() {
    if (ocupado) return;
    ocupado = true;
    const desbloquear = bloquearControles();
    $('ccErro').textContent = '';
    try {
      const novo = await consultar(detalhe.comanda.id);
      if (!atendimentoAberto(novo, detalhe.comanda.crv_atendimento_id)) {
        dialogo.close();
        await alertaCaixa('Comanda atualizada', 'O atendimento mudou ou foi encerrado. Confira a lista de comandas.');
        return;
      }
      if (JSON.stringify(novo) === JSON.stringify(detalhe)) {
        informar('Comanda atualizada.');
      } else {
        detalhe = novo;
        desenhar();
        informar('A comanda mudou. Confira o novo saldo e preencha o pagamento novamente.');
      }
    } catch (e) {
      erro(e);
    } finally {
      desbloquear();
      ocupado = false;
    }
  }

  async function confirmar(fechar) {
    if (ocupado) return;
    $('ccErro').textContent = '';
    try {
      if (pendente()) throw Error('Consulte a confirmação pendente primeiro.');
      const desconto = descontoAtual();
      const saldo = saldoAtual();
      const pagar = fechar ? saldo : valor($('ccValor').value);
      const forma = $('ccForma').value;
      if (!Number.isFinite(saldo) || desconto < 0 || saldo < 0) throw Error('O desconto não pode superar o saldo da comanda.');
      if (!fechar && (!Number.isFinite(pagar) || pagar <= 0 || pagar >= saldo)) {
        $('ccValor').focus();
        throw Error(`Informe um valor maior que zero e menor que ${moeda(saldo)}. Para receber tudo, selecione Quitar saldo.`);
      }
      const dinheiroInformado = pagar > 0 && forma === 'dinheiro' && $('ccEntregue').value.trim();
      const entregue = dinheiroInformado ? valor($('ccEntregue').value) : pagar;
      if (!Number.isFinite(entregue) || entregue < pagar) {
        $('ccEntregue').focus();
        throw Error(`O dinheiro entregue deve ser de pelo menos ${moeda(pagar)}.`);
      }
      const opcao = $('ccPagadorOpcao').value;
      const c = detalhe.comanda;
      const pagador = opcao === 'responsavel' ? c.nome_cliente : $('ccPagador').value.trim();
      if (pagar > 0 && (!opcao || !pagador)) {
        (opcao === 'outro' ? $('ccPagador') : $('ccPagadorOpcao')).focus();
        throw Error('Informe quem pagou para registrar o recebimento.');
      }
      const pedido = {
        p_comanda_id: c.id, p_caixa_id: contexto.caixa, p_atendimento_id: c.crv_atendimento_id,
        p_revisao: c.crv_revisao, p_valor: pagar, p_forma: forma, p_desconto: desconto,
        p_entregue: entregue, p_fechar: fechar, p_operacao_id: novaConfirmacao(),
        p_operador_id: contexto.operador, p_pagador: pagar > 0 ? formatarPagador(pagador) : null
      };
      sessionStorage.setItem(chave(), JSON.stringify(pedido));
      await enviar(pedido);
    } catch (e) {
      erro(e);
    }
  }
  async function enviar(pedido) {
    if(ocupado||!pedido)return;
    ocupado=true;
    const recuperando = Boolean($('ccRetomar'));
    const desbloquear = bloquearControles();
    let confirmado=false;
    try {
      if(!sistemaOnline())throw Error('Sem conexão. Reconecte e consulte esta mesma confirmação; não registre novamente.');
      if(obterEmpresaId()!==contexto.empresa||obterOperadorAtualId()!==contexto.operador)throw Error('Sessão alterada. Entre novamente com o operador que iniciou o recebimento.');
      const {data,error}=await sb.rpc('crv_receber_comanda',pedido);
      if(error){
        // Erro SQL explícito garante rollback; falha de transporte mantém a mesma chave.
        if(/^[0-9A-Z]{5}$/.test(error.code||'')&&!/^08/.test(error.code))sessionStorage.removeItem(chave());
        throw Error(error.message||'Resposta não confirmada. Consulte a confirmação pendente.');
      }
      confirmado=true;sessionStorage.removeItem(chave());
      if(data.venda){const ix=vendas.findIndex(v=>v.id===data.venda.id);if(ix>=0)vendas[ix]=data.venda;else vendas.unshift(data.venda);}
      if(data.fechada&&comandaAtiva?.id===pedido.p_comanda_id){comandaAtiva=null;carrinho=[];comandaOculta=false;}
      await sincronizar();
      const troco = pedido.p_forma === 'dinheiro' && Number(data.troco) > 0 ? ` Troco: ${moeda(data.troco)}.` : '';
      if (data.fechada) {
        dialogo.close();
        await alertaCaixa('Comanda encerrada', Number(data.valor) > 0 ? `Recebido: ${moeda(data.valor)}.${troco}` : 'Encerrada sem nova cobrança.');
      } else {
        const novo = await consultar(pedido.p_comanda_id);
        if (!atendimentoAberto(novo, pedido.p_atendimento_id)) {
          dialogo.close();
          await alertaCaixa('Parcial registrada', `Recebido: ${moeda(data.valor)}.${troco} O atendimento mudou. Confira a lista de comandas.`);
          return;
        }
        detalhe = novo;
        desenhar();
        informar(`Parcial de ${moeda(data.valor)} registrada. Falta pagar ${moeda(detalhe.saldo)}.${troco}`);
      }
    }catch(e){
      if(confirmado){dialogo.close();await alertaCaixa('Recebimento confirmado', 'O pagamento foi salvo, mas a tela não foi atualizada. Atualize o Caixa antes de continuar. Não repita a cobrança.');}
      else{
        if (recuperando || pendente()) desenhar();
        erro(e);
      }
    } finally {
      desbloquear();
      ocupado = false;
    }
  }
  async function sincronizar() {
    await carregarDadosSupabase();
    // Não confirma saldo financeiro a partir de cache após uma mutação.
    if(caixa?.id){
      const {data,error}=await sb.from('vendas').select('*').eq('empresa_id',obterEmpresaId()).eq('caixa_id',caixa.id);
      if(error)throw error;
      vendas=data||[];await salvarCacheCaixa('caixa_vendas',vendas);
    }
    await carregarComandasCaixa({forcar:true});
    if(comandaAtiva?.id)await carregarItensComanda();else renderCarrinho();
    atualizarInfobar();renderHistorico();atualizarInterfaceModoPDV();await atualizarBadgesModosCaixa();await carregarProdutos();renderProdutosRapidos();
  }
  return {abrir,esc};
})();
