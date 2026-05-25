(function () {

  // ======================================================
  // CONFIG
  // ======================================================

  const DB_NAME = "CRV_PDV_OFFLINE";
  const DB_VERSION = 1;

  const STORE_QUEUE = "offline_queue";
  const STORE_CACHE = "offline_cache";

  let db = null;

  // ======================================================
  // OPEN DB
  // ======================================================

  async function abrirDB() {

    if (db) {
      return db;
    }

    return new Promise((resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onerror = () => {

        crvLog(
          "OFFLINE",
          "Erro ao abrir IndexedDB",
          "error"
        );

        reject(request.error);
      };

      request.onsuccess = () => {

        db = request.result;

        crvLog(
          "OFFLINE",
          "IndexedDB inicializado",
          "success"
        );

        resolve(db);
      };

      request.onupgradeneeded = event => {

        const database =
          event.target.result;

        // ====================================
        // FILA OFFLINE
        // ====================================

        if (
          !database.objectStoreNames.contains(STORE_QUEUE)
        ) {

          const queue =
            database.createObjectStore(
              STORE_QUEUE,
              {
                keyPath: "id",
                autoIncrement: true
              }
            );

          queue.createIndex(
            "tabela",
            "tabela",
            { unique: false }
          );

          queue.createIndex(
            "sincronizado",
            "sincronizado",
            { unique: false }
          );

          queue.createIndex(
            "empresa_id",
            "empresa_id",
            { unique: false }
          );
        }

        // ====================================
        // CACHE LOCAL
        // ====================================

        if (
          !database.objectStoreNames.contains(STORE_CACHE)
        ) {

          database.createObjectStore(
            STORE_CACHE,
            {
              keyPath: "chave"
            }
          );
        }
      };

    });
  }

  // ======================================================
  // ADICIONAR À FILA
  // ======================================================

  async function adicionarFilaOffline({
    tabela,
    operacao,
    payload,
    empresa_id
  }) {

    try {

      const database =
        await abrirDB();

      return new Promise((resolve, reject) => {

        const transaction =
          database.transaction(
            [STORE_QUEUE],
            "readwrite"
          );

        const store =
          transaction.objectStore(STORE_QUEUE);

        const request =
          store.add({

            tabela,
            operacao,
            payload,
            empresa_id,

            criado_em:
              new Date().toISOString(),

            sincronizado:
              false
          });

        request.onsuccess = () => {

          crvLog(
            "OFFLINE",
            `${operacao} salvo offline em ${tabela}`,
            "warn"
          );

          resolve(true);
        };

        request.onerror = () => {
          reject(request.error);
        };

      });

    } catch (err) {

      crvLog(
        "OFFLINE",
        err.message,
        "error"
      );

      return false;
    }
  }

  // ======================================================
  // LISTAR FILA
  // ======================================================

  async function obterFilaOffline() {

    try {

      const database =
        await abrirDB();

      return new Promise((resolve, reject) => {

        const transaction =
          database.transaction(
            [STORE_QUEUE],
            "readonly"
          );

        const store =
          transaction.objectStore(STORE_QUEUE);

        const request =
          store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };

      });

    } catch (err) {

      crvLog(
        "OFFLINE",
        err.message,
        "error"
      );

      return [];
    }
  }

  // ======================================================
  // REMOVER FILA
  // ======================================================

  async function removerFilaOffline(id) {

    try {

      const database =
        await abrirDB();

      return new Promise((resolve, reject) => {

        const transaction =
          database.transaction(
            [STORE_QUEUE],
            "readwrite"
          );

        const store =
          transaction.objectStore(STORE_QUEUE);

        const request =
          store.delete(id);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(request.error);
        };

      });

    } catch (err) {

      crvLog(
        "OFFLINE",
        err.message,
        "error"
      );

      return false;
    }
  }

  // ======================================================
  // CACHE
  // ======================================================

  async function salvarCache(chave, dados) {

    try {

      const database =
        await abrirDB();

      return new Promise((resolve, reject) => {

        const transaction =
          database.transaction(
            [STORE_CACHE],
            "readwrite"
          );

        const store =
          transaction.objectStore(STORE_CACHE);

        const request =
          store.put({
            chave,
            dados,
            atualizado_em:
              new Date().toISOString()
          });

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(request.error);
        };

      });

    } catch (err) {

      crvLog(
        "CACHE",
        err.message,
        "error"
      );

      return false;
    }
  }

  async function obterCache(chave) {

    try {

      const database =
        await abrirDB();

      return new Promise((resolve, reject) => {

        const transaction =
          database.transaction(
            [STORE_CACHE],
            "readonly"
          );

        const store =
          transaction.objectStore(STORE_CACHE);

        const request =
          store.get(chave);

        request.onsuccess = () => {

          resolve(
            request.result?.dados || null
          );

        };

        request.onerror = () => {
          reject(request.error);
        };

      });

    } catch (err) {

      crvLog(
        "CACHE",
        err.message,
        "error"
      );

      return null;
    }
  }

  // ======================================================
  // GLOBAL
  // ======================================================

  window.crvOfflineDB = {

    abrirDB,

    adicionarFilaOffline,
    obterFilaOffline,
    removerFilaOffline,

    salvarCache,
    obterCache
  };

})();