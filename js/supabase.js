// ==========================================
// 🔌 SUPABASE CORE - CRV PDV
// ==========================================

(function () {

  // ==========================================
  // ⚙️ CONFIG
  // ==========================================
  const SUPABASE_URL = "COLE_SUA_URL_AQUI";
  const SUPABASE_ANON_KEY = "COLE_SUA_ANON_KEY_AQUI";


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
    supabase_ok: false
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
  async function testarSupabase() {
    try {
      logSistema("SUPABASE", "Testando conexão...");

      const { error } = await sb
        .from("produtos")
        .select("id")
        .limit(1);

      if (error) throw error;

      APP_STATUS.supabase_ok = true;
      logSistema("SUPABASE", "Conectado com sucesso", "success");

    } catch (err) {
      APP_STATUS.supabase_ok = false;
      logSistema("SUPABASE", "Erro: " + err.message, "error");
    }
  }

  window.testarSupabase = testarSupabase;


  // ==========================================
  // 🌐 ONLINE / OFFLINE
  // ==========================================
  window.addEventListener("online", () => {
    APP_STATUS.online = true;
    logSistema("REDE", "Conexão restaurada", "success");
    document.dispatchEvent(new Event("app:online"));
  });

  window.addEventListener("offline", () => {
    APP_STATUS.online = false;
    logSistema("REDE", "Modo OFFLINE", "warn");
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
  });

})();