/* Recebimentos de comanda: online, transacionais e com confirmação idempotente. */
window.crvComandasCaixa = (() => {
  let dialogo, detalhe, ocupado = false, abrindo = false, foco, contexto;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moeda = v => Number(v || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const valor = v => { const s=String(v??'').trim().replace(/R\$\s*/g,''); return /^\d+(?:[.,]\d{1,2})?$/.test(s) ? Math.round(Number(s.replace(',','.'))*100)/100 : NaN; };
  function novaConfirmacao() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  const $ = id => dialogo.querySelector('#'+id);
  const chave = () => `crv:comanda:pendente:${contexto.empresa}:${detalhe.comanda.id}`;
  const erro = e => { $('ccErro').textContent = e?.message || String(e); };
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
    if(error)throw Error(error.code==='PGRST202'?'Aplique o SQL deste patch antes de usar os novos recebimentos.':error.message);
    return data;
  }
  async function abrir(id) {
    if(ocupado||abrindo||dialogo?.open)return;
    abrindo=true;
    try {
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
      }
      const dados=await consultar(id); criar(); detalhe=dados;
      contexto={empresa:obterEmpresaId(),operador:obterOperadorAtualId(),caixa:caixa?.id};
      foco=document.activeElement; desenhar();dialogo.showModal();$('ccFechar').focus();
    }catch(e){await alertaCaixa('Detalhes da comanda',e.message);}finally{abrindo=false;}
  }
  function desenhar(aviso='') {
    const d=detalhe, c=d.comanda, aberto=caixa?.status==='aberto', pend=pendente();
    dialogo.innerHTML=`<header class="cc-header"><div><small>COMANDA ABERTA</small><h2 id="ccTitulo">${esc(c.codigo)} <span>${esc(c.nome_cliente||'Sem identificação')}</span></h2></div><button type="button" id="ccFechar" class="btn-ghost" aria-label="Fechar detalhes">✕</button></header>
    <div class="cc-corpo"><div class="cc-consumo"><p class="cc-sub">${c.data_abertura?'Aberta em '+esc(new Date(c.data_abertura).toLocaleString('pt-BR')):''}</p>${c.observacoes?`<p>${esc(c.observacoes)}</p>`:''}
    <div class="cc-section-title"><h3>Consumo</h3><button type="button" id="ccConsumir" class="btn-ghost">Adicionar / corrigir itens</button></div>
    <div class="cc-itens">${d.itens.length?d.itens.map(i=>`<div class="cc-item"><span><b>${esc(i.quantidade)} × ${esc(i.nome)}</b><small>${moeda(i.preco)} cada</small></span><strong>${moeda(i.preco*i.quantidade)}</strong></div>`).join(''):'<p>Nenhum consumo lançado.</p>'}</div>
    <h3>Pagamentos</h3><div class="cc-historico">${d.pagamentos.length?d.pagamentos.map(p=>`<div class="cc-item ${p.status_operacional==='cancelada'?'cc-cancelado':''}"><span><b>${moeda(p.total)} · ${esc(p.forma_pagamento)}</b><small>${esc(new Date(p.data).toLocaleString('pt-BR'))}${p.comanda_pagador?' · '+esc(p.comanda_pagador):''} · ${p.status_operacional==='cancelada'?'Estornado':'Recebido'} · ${esc(p.id.slice(0,8))}</small></span>${window.crvEstornos?.permitido(p,caixa?.id)?`<button type="button" class="btn-ghost" data-estorno="${esc(p.id)}">Estornar</button>`:''}</div>`).join(''):'<p>Nenhum pagamento registrado.</p>'}</div>
    <p class="cc-sub">Cada parcial entra no caixa em que foi recebida. Os produtos são baixados uma única vez, no fechamento.</p></div>
    <form id="ccForm" class="cc-receber"><div class="cc-resumo"><div><span>Consumo</span><b>${moeda(d.consumo)}</b></div><div><span>Já recebido</span><b>${moeda(d.recebido)}</b></div><label>Desconto total${d.recebido>0?" (fixo após parcial)":""}<input id="ccDesconto" inputmode="decimal" value="${Number(d.desconto).toFixed(2)}" ${d.recebido>0?'readonly':''} /></label><div class="cc-saldo"><span>Falta pagar</span><strong id="ccSaldo">${moeda(d.saldo)}</strong></div></div>
    ${!aberto?'<p class="cc-aviso">Abra o caixa para receber.</p>':''}
    ${pend?'<p class="cc-aviso">Há uma confirmação sem resposta neste dispositivo. Consulte o resultado antes de fazer outro recebimento.</p><button type="button" class="btn-primary" id="ccRetomar">Consultar confirmação pendente</button>':''}
    <fieldset ${!aberto||pend?'disabled':''}><label>Valor a pagar agora<input id="ccValor" inputmode="decimal" autocomplete="off" value="${Math.max(0,Number(d.saldo)).toFixed(2)}" /></label>
    <label>Forma de pagamento<select id="ccForma"><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option></select></label>
    <label id="ccDinheiroLabel">Dinheiro entregue<input id="ccEntregue" inputmode="decimal" autocomplete="off" placeholder="Igual ao valor a pagar" /></label><p id="ccTroco" class="cc-sub">Troco: ${moeda(0)}</p>
    <label>Quem pagou <small>(opcional)</small><input id="ccPagador" maxlength="120" placeholder="Ex.: João" autocomplete="off" /></label>
    <button class="btn-primary" type="submit">Receber e manter aberta</button><button class="btn-secondary" id="ccQuitar" type="button">${d.itens.length?'Quitar saldo e fechar':'Liberar comanda vazia'}</button></fieldset>
    <p class="cc-sub">Confira o recebimento na maquininha ou no banco antes de registrar cartão/Pix.</p>
    <p id="ccErro" role="alert">${esc(aviso)}</p><button type="button" id="ccAtualizar" class="btn-ghost">Atualizar detalhes</button></form></div>`;
    $('ccFechar').onclick=()=>{if(!ocupado)dialogo.close();};
    $('ccAtualizar').onclick=atualizar;
    $('ccConsumir').onclick=async()=>{
      if(ocupado)return;
      if(modoPDV!=='comanda'&&carrinho.length){erro(Error('Finalize ou limpe a venda atual antes de trocar para esta comanda.'));return;}
      try {const novo=await consultar(c.id);comandaAtiva=novo.comanda;comandaOculta=false;modoPDV='comanda';dialogo.close();await carregarItensComanda();atualizarInterfaceModoPDV();}catch(e){erro(e);}
    };
    $('ccForm').onsubmit=e=>{e.preventDefault();confirmar(false);};$('ccQuitar').onclick=()=>confirmar(true);
    $('ccDesconto').oninput=()=>{const x=saldoAtual();$('ccSaldo').textContent=Number.isFinite(x)?moeda(x):'Valor inválido';};
    const troco=()=>{const dinheiro=$('ccForma').value==='dinheiro';$('ccDinheiroLabel').hidden=!dinheiro;$('ccTroco').hidden=!dinheiro;const a=valor($('ccValor').value),b=valor($('ccEntregue').value);$('ccTroco').textContent='Troco: '+moeda(Math.max(0,(Number.isFinite(b)?b:a)-a));};
    $('ccForma').onchange=troco;$('ccEntregue').oninput=troco;$('ccValor').oninput=troco;
    $('ccRetomar')?.addEventListener('click',()=>enviar(pendente()));
    dialogo.querySelectorAll('[data-estorno]').forEach(b=>b.onclick=()=>{
      const p=d.pagamentos.find(x=>x.id===b.dataset.estorno);
      window.crvEstornos.abrir(p,caixa?.id,async()=>{await sincronizar();await atualizar();});
    });
  }
  const saldoAtual=()=>Math.round((Number(detalhe.consumo)-valor($('ccDesconto').value)-Number(detalhe.recebido))*100)/100;
  async function atualizar() {
    if(ocupado)return;
    try{detalhe=await consultar(detalhe.comanda.id);desenhar();}catch(e){erro(e);}
  }
  async function confirmar(fechar) {
    if(ocupado)return;
    try {
      if(pendente())throw Error('Consulte a confirmação pendente primeiro.');
      const desconto=valor($('ccDesconto').value),saldo=saldoAtual(),pagar=fechar?saldo:valor($('ccValor').value),forma=$('ccForma').value;
      const entregue=forma==='dinheiro'&&$('ccEntregue').value.trim()?valor($('ccEntregue').value):pagar;
      if(![desconto,saldo,pagar,entregue].every(Number.isFinite)||desconto<0||saldo<0||pagar<0||pagar>saldo||(!fechar&&pagar===0)||entregue<pagar)throw Error('Confira o desconto, o valor a pagar e o dinheiro entregue.');
      if(fechar&&Number($('ccValor').value.replace(',','.'))!==saldo&&detalhe.itens.length){$('ccValor').value=saldo.toFixed(2);throw Error('O fechamento recebe todo o saldo restante. Confira o valor atualizado e confirme novamente.');}
      const c=detalhe.comanda;
      const pedido={p_comanda_id:c.id,p_caixa_id:contexto.caixa,p_atendimento_id:c.crv_atendimento_id,p_revisao:c.crv_revisao,p_valor:pagar,p_forma:forma,p_desconto:desconto,p_entregue:entregue,p_fechar:fechar,p_operacao_id:novaConfirmacao(),p_operador_id:contexto.operador,p_pagador:$('ccPagador').value.trim()||null};
      sessionStorage.setItem(chave(),JSON.stringify(pedido));await enviar(pedido);
    }catch(e){erro(e);}
  }
  async function enviar(pedido) {
    if(ocupado||!pedido)return;
    ocupado=true;dialogo.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);
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
      if(data.fechada){dialogo.close();await alertaCaixa('Comanda encerrada',`Recebido neste fechamento: ${moeda(data.valor)}. Troco: ${moeda(data.troco)}.`);}
      else{detalhe=await consultar(pedido.p_comanda_id);desenhar(`Pagamento registrado: ${moeda(data.valor)}. Troco: ${moeda(data.troco)}. A comanda continua aberta.`);}
    }catch(e){
      if(confirmado){dialogo.close();await alertaCaixa('Recebimento confirmado', 'O pagamento foi salvo, mas a tela não foi atualizada. Atualize o Caixa antes de continuar. Não repita a cobrança.');}
      else{desenhar(e.message);}
    }finally{ocupado=false;if(dialogo.open){$('ccFechar').disabled=false;$('ccAtualizar').disabled=false;}}
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
