// ==========================================
// 🔌 SUPABASE CORE - CRV PDV
// ==========================================

(function () {

  // ==========================================
  // ⚙️ CONFIG
  // ==========================================
  const SUPABASE_URL = "https://qpytwbiiqixkitnpksna.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9Bc3KFSsNOQ3Qc9Q9DEfCQ_GBD-_K-F";


  // ==========================================
  // 🔗 CLIENTE GLOBAL
  // ==========================================
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.sb = sb;


  // ==========================================
  // 🌐 ESTADO GLOBAL
  // ==========================================
  window.APP_STATUS = {
    online: navigator.onLine,
    supabase_ok: false,
    supabase_testado: false
  };


  // ==========================================
  // 📡 LOG PADRÃO
  // ==========================================
  function logSistema(modulo, mensagem, tipo = "info") {
    const estilos = {
      info: "color: #00bcd4",
      success: "color: #4caf50",
      error: "color: #f44336",
      warn: "color: #ff9800"
    };

    console.log(
      `%c[CRV PDV][${modulo}] ${mensagem}`,
      estilos[tipo] || estilos.info
    );
  }

  window.logSistema = logSistema;


  // ==========================================
  // 🔍 TESTE SUPABASE
  // ==========================================
  async function testarSupabase(opcoes = {}) {
    const silencioso = opcoes.silencioso === true;

    try {
      if (!silencioso) {
        logSistema("SUPABASE", "Testando conexão...");
      }

      const { error } = await sb
        .from("produtos")
        .select("id")
        .limit(1);

      if (error) throw error;

      APP_STATUS.supabase_ok = true;
      APP_STATUS.online = navigator.onLine;
      APP_STATUS.supabase_testado = true;

      if (!silencioso) {
        logSistema("SUPABASE", "Conectado com sucesso", "success");
      }

      document.dispatchEvent(new CustomEvent("crv:supabase-status", {
        detail: { disponivel: true }
      }));

      return true;

    } catch (err) {
      APP_STATUS.supabase_ok = false;
      APP_STATUS.online = navigator.onLine;
      APP_STATUS.supabase_testado = true;

      if (!silencioso) {
        logSistema("SUPABASE", "Erro: " + err.message, "error");
      }

      document.dispatchEvent(new CustomEvent("crv:supabase-status", {
        detail: {
          disponivel: false,
          erro: err.message
        }
      }));

      return false;
    }
  }

  window.testarSupabase = testarSupabase;


  // ==========================================
  // 🌐 ONLINE / OFFLINE
  // ==========================================
  window.addEventListener("online", async () => {
    APP_STATUS.online = true;
    logSistema("REDE", "Conexão restaurada", "success");
    await testarSupabase({ silencioso: true });
    document.dispatchEvent(new Event("app:online"));
  });

  window.addEventListener("offline", () => {
    APP_STATUS.online = false;
    APP_STATUS.supabase_ok = false;
    logSistema("REDE", "Modo OFFLINE", "warn");
    document.dispatchEvent(new CustomEvent("crv:supabase-status", {
      detail: { disponivel: false }
    }));
    document.dispatchEvent(new Event("app:offline"));
  });


  // ==========================================
  // 🛟 FALLBACK (LOCAL)
  // ==========================================
  function salvarLocal(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
  }

  function obterLocal(chave) {
    const data = localStorage.getItem(chave);
    return data ? JSON.parse(data) : [];
  }

  window.localDB = {
    salvar: salvarLocal,
    obter: obterLocal
  };


  // ==========================================
  // 🚀 INIT
  // ==========================================
  document.addEventListener("DOMContentLoaded", async () => {
    logSistema("APP", "Inicializando Supabase...");
    await testarSupabase();

    window.setInterval(() => {
      if (navigator.onLine) {
        testarSupabase({ silencioso: true });
      }
    }, 30000);
  });

})();
