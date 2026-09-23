// Estorno integral, online, de venda/comanda sem vínculos com Agenda, no caixa aberto.
// Toda mutação é feita em uma única transação no servidor; nunca há fallback local.
window.crvEstornos = (() => {
  let contexto = null;
  let ocupado = false;
  let abrindo = false;
  let dialogo = null;
  let focoAnterior = null;
  const dinheiro = valor => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const texto = valor => String(valor || "").toLowerCase();

  function permitido(venda, caixaId) {
    if (!venda || venda.offline || texto(venda.status_operacional) === "cancelada") return false;
    if (!window.APP_STATUS?.online || !window.APP_STATUS?.supabase_ok || !window.sb) return false;
    if (window.crvFeatureAtiva?.("cancelamento_venda") !== true ||
        window.crvOperadorPodeEspecial?.("cancelar_venda") !== true) return false;
    if (!caixaId || String(venda.caixa_id) !== String(caixaId)) return false;
    if (!["pdv", "comanda"].includes(texto(venda.origem || "pdv"))) return false;
    if (venda.agenda_id || venda.agenda_jogador_id) return false;
    return !(venda.itens || []).some(item => item.agenda_id || item.agenda_jogador_id ||
      texto(item.origem).startsWith("agenda") || texto(item.nome).startsWith("jogo -"));
  }

  function avisar(mensagem, tipo = "warn") {
    if (window.crvToast) window.crvToast({ titulo: "Estorno de venda", mensagem, tipo, tempo: 7000 });
  }

  function criarDialogo() {
    if (dialogo) return;
    dialogo = document.createElement("dialog");
    dialogo.className = "crv-estorno-dialog";
    dialogo.setAttribute("aria-labelledby", "estornoTitulo");
    dialogo.innerHTML = `
      <form id="estornoForm">
        <h2 id="estornoTitulo">Estornar venda</h2>
        <p id="estornoResumo"></p>
        <p id="estornoEfeito">O lançamento permanece no histórico, sai dos totais ativos e os produtos baixados retornam ao estoque. A comanda não é reaberta.</p>
        <p class="estorno-aviso">Pix e cartão: faça a devolução também no banco ou na maquininha. Este registro não devolve dinheiro automaticamente.</p>
        <label for="estornoMotivo">Motivo do estorno *</label>
        <textarea id="estornoMotivo" class="input" rows="3" minlength="3" maxlength="240" required placeholder="Ex.: venda lançada duas vezes"></textarea>
        <label class="estorno-check"><input id="estornoEstoque" type="checkbox" required /> Os produtos não foram entregues ou voltaram ao estoque em condição de venda.</label>
        <p id="estornoErro" role="alert"></p>
        <div class="estorno-acoes">
          <button type="button" class="btn-ghost" id="estornoVoltar">Voltar</button>
          <button type="submit" class="btn-danger" id="estornoConfirmar">Confirmar estorno integral</button>
        </div>
      </form>`;
    document.body.appendChild(dialogo);
    dialogo.querySelector("form").addEventListener("submit", event => { event.preventDefault(); confirmar(); });
    dialogo.querySelector("#estornoVoltar").onclick = fechar;
    dialogo.addEventListener("cancel", event => { if (ocupado) event.preventDefault(); });
    dialogo.addEventListener("close", () => { contexto = null; focoAnterior?.focus?.(); });
  }

  async function abrir(venda, caixaId, aposEstorno) {
    if (ocupado || abrindo || dialogo?.open) return;
    if (!permitido(venda, caixaId)) { avisar("Estorno indisponível para esta venda, conexão ou permissão."); return; }
    abrindo = true;
    try {
      // Exibe dados atuais; o servidor volta a validar tudo sob bloqueio na confirmação.
      const empresa = window.APP_EMPRESA_ID;
      const { data, error } = await window.sb.from("vendas").select("*, vendas_itens(*)")
        .eq("empresa_id", empresa).eq("id", venda.id).single();
      if (error) throw error;
      const atual = { ...data, itens: data.vendas_itens || [] };
      if (!permitido(atual, caixaId)) throw new Error("A venda mudou ou contém cobrança de jogo. O estorno foi bloqueado.");
      criarDialogo();
      contexto = { venda: atual, caixaId, aposEstorno, operadorId: sessionStorage.getItem("CRV_OPERADOR_ID") || null, empresa };
      focoAnterior = document.activeElement;
      dialogo.querySelector("#estornoResumo").textContent =
        `${atual.descricao || (atual.origem === "comanda" ? "Comanda fechada" : "Venda rápida")} · ${dinheiro(atual.total)} · ${atual.forma_pagamento || ""} · ${new Date(atual.data).toLocaleString("pt-BR")} · ${String(atual.id).slice(0, 8)}`;
      const parcial = atual.comanda_evento === "parcial";
      dialogo.querySelector("#estornoEfeito").textContent = parcial
        ? "Estorna somente este recebimento. O saldo a pagar aumenta, a comanda continua aberta e o consumo e o estoque permanecem iguais."
        : atual.comanda_evento === "fechamento"
          ? "Estorna o fechamento e todas as parciais deste atendimento, desde que recebidas neste mesmo caixa aberto. Devolve os produtos ao estoque; a comanda não é reaberta."
          : "O lançamento permanece no histórico, sai dos totais ativos e os produtos baixados retornam ao estoque. A comanda não é reaberta.";
      const check = dialogo.querySelector("#estornoEstoque");
      check.required = !parcial; check.closest("label").hidden = parcial;
      dialogo.querySelector("#estornoMotivo").value = "";
      dialogo.querySelector("#estornoEstoque").checked = false;
      dialogo.querySelector("#estornoErro").textContent = "";
      dialogo.showModal();
      dialogo.querySelector("#estornoMotivo").focus();
    } catch (err) { avisar(err.message || "Não foi possível consultar a venda.", "error"); }
    finally { abrindo = false; }
  }

  function fechar() { if (!ocupado) dialogo?.close(); }

  async function atualizarCaches(resultado) {
    const db = window.crvOfflineDB;
    if (!db) return;
    const chaves = ["vendas_lista", "dashboard_vendas", "relatorios_vendas"];
    const caixaKey = window.crvOfflineContext?.chaveEscopo?.("caixa:caixa_vendas");
    if (caixaKey) chaves.push(caixaKey);
    for (const chave of chaves) {
      const lista = await db.obterCache(chave);
      if (!Array.isArray(lista)) continue;
      const nova = lista.map(v => { const atual = (resultado.vendas || [resultado.venda]).find(x => String(x.id) === String(v.id)); return atual ? { ...v, ...atual } : v; });
      if (await db.salvarCache(chave, nova) === false) throw new Error("Cache não atualizado");
    }
    const produtos = new Map((resultado.produtos || []).map(p => [String(p.id), p]));
    if (produtos.size) {
      const produtoChaves = ["produtos_lista", "caixa_produtos", "caixa_catalogo_itens"];
      for (const nome of ["caixa_produtos", "caixa_catalogo_itens"]) {
        const chave = window.crvOfflineContext?.chaveEscopo?.(`caixa:${nome}`);
        if (chave) produtoChaves.push(chave);
      }
      for (const chave of produtoChaves) {
        const lista = await db.obterCache(chave);
        if (!Array.isArray(lista)) continue;
        const nova = lista.map(p => produtos.has(String(p.id)) ? { ...p, estoque: produtos.get(String(p.id)).estoque } : p);
        if (await db.salvarCache(chave, nova) === false) throw new Error("Cache de estoque não atualizado");
      }
    }
  }

  async function confirmar() {
    if (ocupado || !contexto || !dialogo?.open) return;
    const erro = dialogo.querySelector("#estornoErro");
    const motivo = dialogo.querySelector("#estornoMotivo").value.trim();
    if (motivo.length < 3 || motivo.length > 240) { erro.textContent = "Informe um motivo entre 3 e 240 caracteres."; return; }
    if (contexto.venda.comanda_evento !== "parcial" && !dialogo.querySelector("#estornoEstoque").checked) { erro.textContent = "Confirme a situação dos produtos antes de continuar."; return; }
    if (!permitido(contexto.venda, contexto.caixaId) || contexto.empresa !== window.APP_EMPRESA_ID ||
        contexto.operadorId !== (sessionStorage.getItem("CRV_OPERADOR_ID") || null)) {
      erro.textContent = "A conexão, empresa ou operador mudou. Feche e abra o estorno novamente."; return;
    }
    ocupado = true;
    const controles = dialogo.querySelectorAll("button, textarea, input");
    controles.forEach(el => { el.disabled = true; });
    erro.textContent = "";
    let concluido = false;
    try {
      const { data, error } = await window.sb.rpc("crv_estornar_venda_caixa", {
        p_venda_id: contexto.venda.id, p_caixa_id: contexto.caixaId,
        p_motivo: motivo, p_operador_id: contexto.operadorId
      });
      if (error) {
        if (["PGRST202", "42883"].includes(error.code)) {
          throw new Error("O estorno ainda não está disponível nesta instalação. Solicite a atualização do sistema. Nenhuma alteração foi feita por esta tentativa.");
        }
        throw error;
      }
      if (!data?.venda_id || !data?.venda) throw new Error("Resposta incompleta. Consulte o histórico antes de repetir.");
      concluido = true;
      const callback = contexto.aposEstorno;
      let falhaAtualizacao = false;
      try { await atualizarCaches(data); } catch (_) { falhaAtualizacao = true; }
      try { await callback?.(data); } catch (_) { falhaAtualizacao = true; }
      ocupado = false;
      dialogo.close();
      avisar(falhaAtualizacao
        ? "Estorno confirmado no banco. Recarregue as telas com conexão antes de continuar; parte dos dados locais não atualizou."
        : data.ja_estornada ? "Esta venda já estava estornada. Nenhuma devolução foi duplicada."
        : "Estorno registrado. Totais atualizados; estoque tratado conforme o tipo do lançamento.", falhaAtualizacao ? "warn" : "success");
    } catch (err) {
      erro.textContent = err.message || "Não foi possível confirmar. Consulte o histórico antes de repetir.";
    } finally {
      ocupado = false;
      controles.forEach(el => { el.disabled = false; });
      if (!concluido) dialogo.querySelector("#estornoMotivo").focus();
    }
  }
  return { permitido, abrir, fechar, confirmar };
})();
