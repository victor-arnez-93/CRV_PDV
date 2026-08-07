const CACHE_PREFIX = "crv-pdv-caixa";
const CACHE_NAME = `${CACHE_PREFIX}-v1-20260806`;

const APP_SHELL = [
  "./caixa.html",
  "./css/main.css",
  "./css/caixa.css",
  "./assets/favicon.png",
  "./assets/logo1.png",
  "./assets/logo2.png",
  "./js/supabase.js",
  "./js/auth.js",
  "./js/app.js",
  "./js/caixa.js",
  "./js/core/boot.js",
  "./js/core/user.js",
  "./js/core/config.js",
  "./js/core/logger.js",
  "./js/core/offline-context.js",
  "./js/core/offline-db.js",
  "./js/core/sync.js",
  "./js/core/network.js",
  "./js/core/sw-register.js",
  "https://unpkg.com/lucide@latest",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.allSettled(
      APP_SHELL.map(async caminho => {
        const resposta = await fetch(new Request(caminho, { cache: "reload" }));

        if (!resposta.ok) {
          throw new Error(`Falha ao preparar ${caminho}`);
        }

        await cache.put(caminho, resposta);
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();

    await Promise.all(
      nomes
        .filter(nome => nome.startsWith(CACHE_PREFIX) && nome !== CACHE_NAME)
        .map(nome => caches.delete(nome))
    );

    await self.clients.claim();
  })());
});

function deveIgnorar(request, url) {
  if (request.method !== "GET") {
    return true;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return true;
  }

  if (
    request.mode === "navigate" &&
    !url.pathname.endsWith("/caixa.html")
  ) {
    return true;
  }

  return url.hostname.endsWith("supabase.co");
}

async function buscarOnlinePrimeiro(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const resposta = await fetch(request);

    if (resposta.ok || resposta.type === "opaque") {
      await cache.put(request, resposta.clone());
    }

    return resposta;
  } catch (err) {
    const respostaCache = await cache.match(request, {
      ignoreSearch: true
    });

    if (respostaCache) {
      return respostaCache;
    }

    if (request.mode === "navigate") {
      const caixaCache = await cache.match("./caixa.html");

      if (caixaCache) {
        return caixaCache;
      }
    }

    throw err;
  }
}

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (deveIgnorar(event.request, url)) {
    return;
  }

  event.respondWith(buscarOnlinePrimeiro(event.request));
});
