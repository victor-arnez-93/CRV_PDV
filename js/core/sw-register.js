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
        const registration =
          await navigator.serviceWorker.register(
            "./service-worker.js",
            {
              scope: "./",
              updateViaCache: "none"
            }
          );

        await registration.update();
    } catch (err) {
      console.warn("[CRV OFFLINE] Service Worker não registrado.", err);
    }
  });
})();
