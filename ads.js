/* ============================================================
   Dinghy Lab — consent + AdSense/Analytics loader
   - GDPR-style consent banner (required for EU visitors)
   - Ads/analytics load ONLY after consent is granted
   - Invalid/empty IDs → ad sections stay hidden, UI intact
   ============================================================ */

(function () {
  "use strict";

  var config = window.SITE_CONFIG || {};
  var CONSENT_KEY = "hub-consent-v1";
  var banner = document.getElementById("hubConsent");
  var acceptButton = document.getElementById("hubConsentAccept");
  var rejectButton = document.getElementById("hubConsentReject");
  var settingsButton = document.getElementById("hubConsentSettings");

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });

  function validPublisherId(value) { return /^ca-pub-\d{10,}$/.test(value || ""); }
  function validMeasurementId(value) { return /^G-[A-Z0-9]+$/.test(value || ""); }

  function storedConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function storeConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
  }

  function addScript(src, attributes) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    Object.keys(attributes || {}).forEach(function (key) {
      script.setAttribute(key, attributes[key]);
    });
    document.head.appendChild(script);
  }

  function loadAnalytics() {
    var id = config.analyticsMeasurementId;
    if (!validMeasurementId(id)) return;
    addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip: true });
  }

  function activateAdSlots() {
    var client = config.adsensePublisherId;
    if (!validPublisherId(client)) return;
    addScript(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client),
      { crossorigin: "anonymous" }
    );
    document.querySelectorAll("[data-ad-position]").forEach(function (container) {
      var slot = (config.adSlots || {})[container.dataset.adPosition];
      if (!/^\d+$/.test(slot || "")) return;
      container.classList.add("ad-active");
      container.replaceChildren();
      var ad = document.createElement("ins");
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.style.width = "100%";
      ad.dataset.adClient = client;
      ad.dataset.adSlot = slot;
      ad.dataset.adFormat = "auto";
      ad.dataset.fullWidthResponsive = "true";
      container.appendChild(ad);
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    });
  }

  function hideAdSectionsIfUnconfigured() {
    if (validPublisherId(config.adsensePublisherId)) return;
    document.querySelectorAll(".hub-ad-section").forEach(function (el) { el.hidden = true; });
  }

  function updateConsent(granted) {
    window.gtag("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
      ad_user_data: granted ? "granted" : "denied",
      ad_personalization: granted ? "granted" : "denied",
      analytics_storage: granted ? "granted" : "denied",
    });
  }

  function setConsent(value) {
    var granted = value === "granted";
    storeConsent(value);
    updateConsent(granted);
    if (banner) banner.hidden = true;
    if (granted) {
      loadAnalytics();
      activateAdSlots();
    }
  }

  if (acceptButton) acceptButton.addEventListener("click", function () { setConsent("granted"); });
  if (rejectButton) rejectButton.addEventListener("click", function () { setConsent("denied"); });
  if (settingsButton) settingsButton.addEventListener("click", function () {
    if (banner) banner.hidden = false;
  });

  hideAdSectionsIfUnconfigured();

  var needsBanner = validPublisherId(config.adsensePublisherId) || validMeasurementId(config.analyticsMeasurementId);
  var consent = storedConsent();
  if (consent === "granted") {
    updateConsent(true);
    loadAnalytics();
    activateAdSlots();
  } else if (consent === "denied") {
    updateConsent(false);
  } else if (banner && needsBanner) {
    banner.hidden = false;
  }
})();
