(function () {
  const DB_NAME = "CRV_PDV_OFFLINE";
  const DB_VERSION = 3;

  const STORE_QUEUE = "offline_queue";
  const STORE_CACHE = "offline_cache";
  const STORE_OPERATIONS = "offline_operations";

  let db = null;

  function logOffline(modulo, mensagem, tipo = "info") {
    if (typeof window.crvLog === "function") {
      window.crvLog(modulo, mensagem, tipo);
      return;
    }

    console[tipo === "error" ? "error" : "log"](
      `[CRV PDV][${modulo}] ${mensagem}`
    );
  }

  function gerarUUID() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  async function abrirDB() {
    if (db) {
      return db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logOffline("OFFLINE", "Erro ao abrir IndexedDB", "error");
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;

        db.onversionchange = () => {
          db.close();
          db = null;
        };

        logOffline("OFFLINE", "IndexedDB inicializado", "success");
        resolve(db);
      };

      request.onupgradeneeded = event => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(STORE_QUEUE)) {
          const queue = database.createObjectStore(STORE_QUEUE, {
            keyPath: "id",
            autoIncrement: true
          });

          queue.createIndex("tabela", "tabela", { unique: false });
          queue.createIndex("sincronizado", "sincronizado", { unique: false });
          queue.createIndex("empresa_id", "empresa_id", { unique: false });
        }

        if (!database.objectStoreNames.contains(STORE_CACHE)) {
          database.createObjectStore(STORE_CACHE, {
            keyPath: "chave"
          });
        }

        if (!database.objectStoreNames.contains(STORE_OPERATIONS)) {
          const operations = database.createObjectStore(STORE_OPERATIONS, {
            keyPath: "operacao_id"
          });

          operations.createIndex("status", "status", { unique: false });
          operations.createIndex("empresa_id", "empresa_id", { unique: false });
          operations.createIndex("usuario_id", "usuario_id", { unique: false });
          operations.createIndex("tipo", "tipo", { unique: false });
          operations.createIndex("criado_em", "criado_em", { unique: false });
        }
      };
    });
  }

  function executarRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function adicionarFilaOffline({
    tabela,
    operacao,
    payload,
    empresa_id,
    usuario_id = null,
    operador_id = null
  }) {
    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_QUEUE], "readwrite");
      const store = transaction.objectStore(STORE_QUEUE);

      const id = await executarRequest(store.add({
        tabela,
        operacao,
        payload,
        empresa_id,
        usuario_id,
        operador_id,
        criado_em: new Date().toISOString(),
        sincronizado: false
      }));

      logOffline("OFFLINE", `${operacao} salvo offline em ${tabela}`, "warn");
      return id;
    } catch (err) {
      logOffline("OFFLINE", err.message, "error");
      return null;
    }
  }

  async function obterFilaOffline() {
    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_QUEUE], "readonly");
      return await executarRequest(transaction.objectStore(STORE_QUEUE).getAll()) || [];
    } catch (err) {
      logOffline("OFFLINE", err.message, "error");
      return [];
    }
  }

  async function removerFilaOffline(id) {
    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_QUEUE], "readwrite");
      await executarRequest(transaction.objectStore(STORE_QUEUE).delete(id));
      return true;
    } catch (err) {
      logOffline("OFFLINE", err.message, "error");
      return false;
    }
  }

  async function salvarOperacaoOffline({
    operacao_id,
    tipo,
    payload,
    empresa_id,
    usuario_id,
    operador_id = null,
    criado_em = null
  }) {
    if (!operacao_id || !tipo || !empresa_id || !usuario_id) {
      throw new Error("Contexto incompleto para salvar a operação offline.");
    }

    const database = await abrirDB();
    const transactionLeitura = database.transaction([STORE_OPERATIONS], "readonly");
    const existente = await executarRequest(
      transactionLeitura.objectStore(STORE_OPERATIONS).get(operacao_id)
    );

    if (existente?.status === "sincronizada") {
      return existente;
    }

    const agora = new Date().toISOString();
    const registro = {
      ...existente,
      operacao_id,
      tipo,
      payload,
      empresa_id,
      usuario_id,
      operador_id,
      criado_em: existente?.criado_em || criado_em || agora,
      atualizado_em: agora,
      status: existente?.status || "pendente",
      tentativas: Number(existente?.tentativas || 0),
      ultimo_erro: existente?.ultimo_erro || null,
      sincronizado_em: existente?.sincronizado_em || null,
      resultado: existente?.resultado || null
    };

    const transactionEscrita = database.transaction([STORE_OPERATIONS], "readwrite");
    await executarRequest(
      transactionEscrita.objectStore(STORE_OPERATIONS).put(registro)
    );
    logOffline("OFFLINE", `${tipo} salvo com operação ${operacao_id}`, "warn");

    document.dispatchEvent(new CustomEvent("crv:pendencias-alteradas"));
    return registro;
  }

  async function obterOperacoesOffline({
    empresa_id = null,
    usuario_id = null,
    status = null
  } = {}) {
    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_OPERATIONS], "readonly");
      const registros = await executarRequest(
        transaction.objectStore(STORE_OPERATIONS).getAll()
      ) || [];

      const statusAceitos = Array.isArray(status)
        ? status
        : status
          ? [status]
          : null;

      return registros
        .filter(item => !empresa_id || String(item.empresa_id) === String(empresa_id))
        .filter(item => !usuario_id || String(item.usuario_id) === String(usuario_id))
        .filter(item => !statusAceitos || statusAceitos.includes(item.status))
        .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0));
    } catch (err) {
      logOffline("OFFLINE", err.message, "error");
      return [];
    }
  }

  async function obterOperacoesPendentes(escopo = {}) {
    return obterOperacoesOffline({
      ...escopo,
      status: ["pendente", "erro", "sincronizando"]
    });
  }

  async function atualizarOperacaoOffline(operacaoId, alteracoes) {
    const database = await abrirDB();
    const transactionLeitura = database.transaction([STORE_OPERATIONS], "readonly");
    const atual = await executarRequest(
      transactionLeitura.objectStore(STORE_OPERATIONS).get(operacaoId)
    );

    if (!atual) {
      return null;
    }

    const atualizado = {
      ...atual,
      ...alteracoes,
      atualizado_em: new Date().toISOString()
    };

    const transactionEscrita = database.transaction([STORE_OPERATIONS], "readwrite");
    await executarRequest(
      transactionEscrita.objectStore(STORE_OPERATIONS).put(atualizado)
    );
    document.dispatchEvent(new CustomEvent("crv:pendencias-alteradas"));
    return atualizado;
  }

  async function contarOperacoesPendentes(escopo = {}) {
    const operacoes = await obterOperacoesPendentes(escopo);
    return operacoes.length;
  }

  async function salvarCache(chave, dados) {
    if (!chave) {
      return false;
    }

    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_CACHE], "readwrite");
      const store = transaction.objectStore(STORE_CACHE);

      await executarRequest(store.put({
        chave,
        dados,
        atualizado_em: new Date().toISOString()
      }));

      return true;
    } catch (err) {
      logOffline("CACHE", err.message, "error");
      return false;
    }
  }

  async function obterCache(chave) {
    if (!chave) {
      return null;
    }

    try {
      const database = await abrirDB();
      const transaction = database.transaction([STORE_CACHE], "readonly");
      const resultado = await executarRequest(
        transaction.objectStore(STORE_CACHE).get(chave)
      );

      return resultado?.dados ?? null;
    } catch (err) {
      logOffline("CACHE", err.message, "error");
      return null;
    }
  }

  window.crvOfflineDB = {
    abrirDB,
    gerarUUID,
    adicionarFilaOffline,
    obterFilaOffline,
    removerFilaOffline,
    salvarOperacaoOffline,
    obterOperacoesOffline,
    obterOperacoesPendentes,
    atualizarOperacaoOffline,
    contarOperacoesPendentes,
    salvarCache,
    obterCache
  };
})();
