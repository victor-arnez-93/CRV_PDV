(function () {
  let sincronizando = false;
  let avisoFilaLegadaExibido = false;

  const RPC_POR_TIPO = {
    caixa_abertura: "crv_sincronizar_abertura_caixa_offline",
    venda: "crv_registrar_venda_offline",
    caixa_fechamento: "crv_sincronizar_fechamento_caixa_offline"
  };

  function emitirStatus(estado, detalhes = {}) {
    document.dispatchEvent(new CustomEvent("crv:sync-status", {
      detail: {
        estado,
        ...detalhes
      }
    }));
  }

  function logSync(mensagem, tipo = "info") {
    if (typeof window.crvLog === "function") {
      window.crvLog("SYNC", mensagem, tipo);
      return;
    }

    console[tipo === "error" ? "error" : "log"](`[CRV PDV][SYNC] ${mensagem}`);
  }

  function obterEscopoAtual() {
    return window.crvOfflineContext?.obterEscopo?.() || null;
  }

  async function supabaseDisponivel() {
    if (!navigator.onLine || !window.sb) {
      return false;
    }

    if (typeof window.testarSupabase === "function") {
      return await window.testarSupabase({ silencioso: true });
    }

    return window.APP_STATUS?.supabase_ok === true;
  }

  async function sincronizarOperacao(item) {
    const rpc = RPC_POR_TIPO[item.tipo];

    if (!rpc) {
      throw new Error(`Tipo de operação offline não suportado: ${item.tipo}`);
    }

    await crvOfflineDB.atualizarOperacaoOffline(item.operacao_id, {
      status: "sincronizando",
      tentativas: Number(item.tentativas || 0) + 1,
      ultimo_erro: null
    });

    const { data, error } = await sb.rpc(rpc, {
      p_operacao_id: item.operacao_id,
      p_empresa_id: item.empresa_id,
      p_payload: item.payload
    });

    if (error) {
      throw error;
    }

    await crvOfflineDB.atualizarOperacaoOffline(item.operacao_id, {
      status: "sincronizada",
      sincronizado_em: new Date().toISOString(),
      ultimo_erro: null,
      resultado: data || null
    });

    return data;
  }

  async function avisarFilaLegada(escopo) {
    if (avisoFilaLegadaExibido) {
      return;
    }

    const filaLegada = await crvOfflineDB.obterFilaOffline();
    const quantidade = filaLegada.filter(item => {
      return (
        !item.sincronizado &&
        String(item.empresa_id || "") === String(escopo.empresa_id)
      );
    }).length;

    if (!quantidade) {
      return;
    }

    avisoFilaLegadaExibido = true;
    logSync(
      `${quantidade} pendência(s) da fila antiga foram preservadas para revisão.`,
      "warn"
    );

    if (typeof window.crvToast === "function") {
      window.crvToast({
        titulo: "Pendências antigas preservadas",
        mensagem: "Operações da versão offline anterior não foram reenviadas automaticamente para evitar duplicidade.",
        tipo: "warn",
        tempo: 8000
      });
    }
  }

  async function sincronizarPendencias() {
    if (sincronizando) {
      return;
    }

    const escopo = obterEscopoAtual();

    if (!escopo || !(await supabaseDisponivel())) {
      return;
    }

    sincronizando = true;

    try {
      await avisarFilaLegada(escopo);

      const fila = await crvOfflineDB.obterOperacoesPendentes({
        empresa_id: escopo.empresa_id,
        usuario_id: escopo.usuario_id
      });

      if (!fila.length) {
        emitirStatus("sincronizado", { pendentes: 0 });
        return;
      }

      emitirStatus("sincronizando", {
        pendentes: fila.length,
        total: fila.length
      });

      if (typeof window.crvToast === "function") {
        window.crvToast({
          titulo: "Sincronização iniciada",
          mensagem: `${fila.length} operação(ões) pendente(s).`,
          tipo: "info"
        });
      }

      let sincronizadas = 0;

      for (const item of fila) {
        try {
          await sincronizarOperacao(item);
          sincronizadas++;

          emitirStatus("sincronizando", {
            pendentes: fila.length - sincronizadas,
            total: fila.length,
            sincronizadas
          });
        } catch (err) {
          await crvOfflineDB.atualizarOperacaoOffline(item.operacao_id, {
            status: "erro",
            ultimo_erro: err.message || "Falha de sincronização"
          });

          logSync(err.message || "Falha de sincronização", "error");
          emitirStatus("erro", {
            pendentes: fila.length - sincronizadas,
            erro: err.message || "Falha de sincronização"
          });

          if (typeof window.crvToast === "function") {
            window.crvToast({
              titulo: "Sincronização pendente",
              mensagem: `${err.message || "Uma operação não pôde ser sincronizada."} Nada foi descartado.`,
              tipo: "error",
              tempo: 9000
            });
          }

          break;
        }
      }

      if (sincronizadas === fila.length) {
        emitirStatus("sincronizado", {
          pendentes: 0,
          sincronizadas
        });

        document.dispatchEvent(new CustomEvent("crv:sync-concluido", {
          detail: { sincronizadas }
        }));

        if (typeof window.crvToast === "function") {
          window.crvToast({
            titulo: "Sincronização concluída",
            mensagem: `${sincronizadas} operação(ões) sincronizada(s) com segurança.`,
            tipo: "success"
          });
        }
      }
    } catch (err) {
      logSync(err.message || "Erro ao sincronizar", "error");
      emitirStatus("erro", {
        erro: err.message || "Erro ao sincronizar"
      });
    } finally {
      sincronizando = false;
    }
  }

  document.addEventListener("crv:online", () => {
    setTimeout(sincronizarPendencias, 800);
  });

  document.addEventListener("crv:contexto-offline-pronto", () => {
    setTimeout(sincronizarPendencias, 500);
  });

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(sincronizarPendencias, 2500);
  });

  window.addEventListener("crv:forcar-sync", sincronizarPendencias);

  window.crvSync = {
    sincronizarPendencias
  };
})();
