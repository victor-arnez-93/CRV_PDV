(function () {

  let sincronizando = false;

  // ======================================================
  // PROCESSAR ITEM
  // ======================================================

  async function sincronizarItem(item) {

    try {

      if (!window.sb) {
        return false;
      }

      const tabela =
        item.tabela;

      const operacao =
        item.operacao;

      const payload =
        item.payload;

      // ==========================================
      // INSERT
      // ==========================================

      if (operacao === "insert") {

  const dadosInsert =
    Array.isArray(payload)
      ? payload
      : [payload];

  const { error } = await sb
    .from(tabela)
    .insert(dadosInsert);

  if (error) {
    throw error;
  }
}

      // ==========================================
      // UPDATE
      // ==========================================

      if (operacao === "update") {

        const { id, ...dados } = payload;

        const { error } = await sb
          .from(tabela)
          .update(dados)
          .eq("id", id);

        if (error) {
          throw error;
        }
      }

      // ==========================================
      // DELETE
      // ==========================================

      if (operacao === "delete") {

        const { error } = await sb
          .from(tabela)
          .delete()
          .eq("id", payload.id);

        if (error) {
          throw error;
        }
      }

      crvLog(
        "SYNC",
        `${operacao} sincronizado em ${tabela}`,
        "success"
      );

      return true;

    } catch (err) {

      crvLog(
        "SYNC",
        err.message,
        "error"
      );

      return false;
    }
  }

  // ======================================================
  // SINCRONIZAR FILA
  // ======================================================

  async function sincronizarPendencias() {

    if (sincronizando) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    sincronizando = true;

    try {

      crvLog(
        "SYNC",
        "Verificando pendências offline..."
      );

      const fila =
        await crvOfflineDB.obterFilaOffline();

      if (!fila.length) {

        crvLog(
          "SYNC",
          "Nenhuma pendência encontrada",
          "success"
        );

        sincronizando = false;

        return;
      }

      crvToast({
        titulo: "Sincronização iniciada",
        mensagem:
          `${fila.length} item(ns) pendente(s) encontrados.`,
        tipo: "info"
      });

      let sincronizados = 0;

      for (const item of fila) {

        const ok =
          await sincronizarItem(item);

        if (ok) {

          await crvOfflineDB
            .removerFilaOffline(item.id);

          sincronizados++;
        }
      }

      crvToast({
        titulo: "Sincronização concluída",
        mensagem:
          `${sincronizados} item(ns) sincronizado(s).`,
        tipo: "success"
      });

      crvLog(
        "SYNC",
        `${sincronizados} itens sincronizados`,
        "success"
      );

    } catch (err) {

      crvLog(
        "SYNC",
        err.message,
        "error"
      );

      crvToast({
        titulo: "Erro de sincronização",
        mensagem:
          err.message,
        tipo: "error"
      });

    } finally {

      sincronizando = false;
    }
  }

  // ======================================================
  // AUTO SYNC
  // ======================================================

  document.addEventListener(
    "crv:online",
    () => {

      setTimeout(() => {
        sincronizarPendencias();
      }, 1200);

    }
  );

  // ======================================================
  // INIT
  // ======================================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setTimeout(() => {
        sincronizarPendencias();
      }, 2500);

    }
  );

  // ======================================================
  // GLOBAL
  // ======================================================

  window.crvSync = {
    sincronizarPendencias
  };

})();