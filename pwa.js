/* Dinghy Lab — PWA: service worker + install button */
(function () {
  "use strict";
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  var deferredInstall = null;
  var button = document.getElementById("installApp");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    if (button) button.hidden = false;
  });
  if (button) {
    button.addEventListener("click", function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () {
        deferredInstall = null;
        button.hidden = true;
      });
    });
  }
})();
