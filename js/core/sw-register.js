(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!window.isSecureContext) {
    console.warn("[CRV OFFLINE] Service Worker exige HTTPS ou localhost.");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./"
      });
    } catch (err) {
      console.warn("[CRV OFFLINE] Service Worker não registrado.", err);
    }
  });
})();
