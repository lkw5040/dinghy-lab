/* ============================================================
   Dinghy Lab — shared i18n engine
   - languages: en (default markup), ko, es, fr, de
   - order: URL ?lang= → localStorage → browser language → en
   - pages define window.PAGE_I18N = { en: {...}, ko: {...}, ... }
     BEFORE this script loads; it merges COMMON_I18N + PAGE_I18N.
   - dynamic modules use HubI18n.t(key, ...args) and
     HubI18n.onChange(cb) to re-render.
   ============================================================ */

(function () {
  "use strict";

  var LANGS = ["en", "ko", "es", "fr", "de"];
  var NATIVE = { en: "English", ko: "한국어", es: "Español", fr: "Français", de: "Deutsch" };
  var STORE_KEY = "hub-lang";

  var COMMON_I18N = {
    en: {
      navHome: "Home",
      navRulebook: "Rulebook",
      navSimulator: "Rules Simulator",
      navGame: "Race Game",
      navAbout: "About",
      installApp: "📱 Install app",
      footerLine: "© {year} Dinghy Lab — free sailing tools. Educational simplification of the Racing Rules of Sailing 2025-2028.",
      footerAbout: "About",
      footerPrivacy: "Privacy",
      footerTerms: "Terms",
      footerConsent: "Privacy settings",
      adLabel: "ADVERTISEMENT",
      adPlaceholder: "Ad placement",
      adPlaceholderNote: "Ads appear here automatically after AdSense approval.",
      consentTitle: "Ads & analytics",
      consentBody: "We may use advertising and anonymous analytics to keep these tools free. Everything works even if you decline.",
      consentMore: "Learn more",
      consentAccept: "Accept and continue",
      consentReject: "Decline optional",
    },
    ko: {
      navHome: "홈",
      navRulebook: "규칙집",
      navSimulator: "권리정 시뮬레이터",
      navGame: "레이스 게임",
      navAbout: "소개",
      installApp: "📱 앱 설치",
      footerLine: "© {year} Dinghy Lab — 무료 세일링 도구. Racing Rules of Sailing 2025-2028을 교육용으로 단순화했습니다.",
      footerAbout: "소개",
      footerPrivacy: "개인정보처리방침",
      footerTerms: "이용약관",
      footerConsent: "개인정보 설정",
      adLabel: "ADVERTISEMENT",
      adPlaceholder: "광고 게재 위치",
      adPlaceholderNote: "AdSense 승인 후 이 자리에 광고가 자동으로 표시됩니다.",
      consentTitle: "광고 및 분석 설정",
      consentBody: "무료 운영을 위해 광고와 익명 방문 분석을 사용할 수 있습니다. 거부해도 모든 기능을 그대로 이용할 수 있습니다.",
      consentMore: "자세히 보기",
      consentAccept: "동의하고 계속",
      consentReject: "선택 항목 거부",
    },
    es: {
      navHome: "Inicio",
      navRulebook: "Reglamento",
      navSimulator: "Simulador de reglas",
      navGame: "Juego de regatas",
      navAbout: "Acerca de",
      installApp: "📱 Instalar app",
      footerLine: "© {year} Dinghy Lab — herramientas de vela gratuitas. Simplificación educativa del Reglamento de Regatas a Vela 2025-2028.",
      footerAbout: "Acerca de",
      footerPrivacy: "Privacidad",
      footerTerms: "Términos",
      footerConsent: "Ajustes de privacidad",
      adLabel: "PUBLICIDAD",
      adPlaceholder: "Espacio publicitario",
      adPlaceholderNote: "Los anuncios aparecerán aquí tras la aprobación de AdSense.",
      consentTitle: "Anuncios y analítica",
      consentBody: "Podemos usar publicidad y analítica anónima para mantener estas herramientas gratuitas. Todo funciona aunque lo rechaces.",
      consentMore: "Más información",
      consentAccept: "Aceptar y continuar",
      consentReject: "Rechazar opcionales",
    },
    fr: {
      navHome: "Accueil",
      navRulebook: "Règlement",
      navSimulator: "Simulateur de règles",
      navGame: "Jeu de régate",
      navAbout: "À propos",
      installApp: "📱 Installer l'app",
      footerLine: "© {year} Dinghy Lab — outils de voile gratuits. Simplification pédagogique des Règles de Course à la Voile 2025-2028.",
      footerAbout: "À propos",
      footerPrivacy: "Confidentialité",
      footerTerms: "Conditions",
      footerConsent: "Paramètres de confidentialité",
      adLabel: "PUBLICITÉ",
      adPlaceholder: "Emplacement publicitaire",
      adPlaceholderNote: "Les annonces apparaîtront ici après l'approbation AdSense.",
      consentTitle: "Publicités et statistiques",
      consentBody: "Nous pouvons utiliser la publicité et des statistiques anonymes pour garder ces outils gratuits. Tout fonctionne même si vous refusez.",
      consentMore: "En savoir plus",
      consentAccept: "Accepter et continuer",
      consentReject: "Refuser les options",
    },
    de: {
      navHome: "Start",
      navRulebook: "Regelwerk",
      navSimulator: "Regel-Simulator",
      navGame: "Regatta-Spiel",
      navAbout: "Über",
      installApp: "📱 App installieren",
      footerLine: "© {year} Dinghy Lab — kostenlose Segel-Tools. Didaktische Vereinfachung der Wettfahrtregeln Segeln 2025-2028.",
      footerAbout: "Über",
      footerPrivacy: "Datenschutz",
      footerTerms: "Nutzungsbedingungen",
      footerConsent: "Datenschutz-Einstellungen",
      adLabel: "WERBUNG",
      adPlaceholder: "Werbeplatz",
      adPlaceholderNote: "Nach der AdSense-Freigabe erscheinen hier automatisch Anzeigen.",
      consentTitle: "Werbung & Analyse",
      consentBody: "Wir können Werbung und anonyme Analysen nutzen, um diese Tools kostenlos zu halten. Alles funktioniert auch bei Ablehnung.",
      consentMore: "Mehr erfahren",
      consentAccept: "Zustimmen und weiter",
      consentReject: "Optionales ablehnen",
    },
  };

  function detectLang() {
    try {
      var fromUrl = new URLSearchParams(location.search).get("lang");
      if (fromUrl && LANGS.indexOf(fromUrl) !== -1) return fromUrl;
    } catch (e) {}
    try {
      var stored = localStorage.getItem(STORE_KEY);
      if (stored && LANGS.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) !== -1 ? nav : "en";
  }

  var pageDict = window.PAGE_I18N || {};
  var listeners = [];
  var lang = detectLang();

  function lookup(key) {
    var p = pageDict[lang] || {};
    var c = COMMON_I18N[lang] || {};
    var v = p[key];
    if (v === undefined) v = c[key];
    if (v === undefined) v = (pageDict.en || {})[key];
    if (v === undefined) v = COMMON_I18N.en[key];
    return v !== undefined ? v : key;
  }

  function t(key) {
    var v = lookup(key);
    if (typeof v === "function") {
      return v.apply(null, Array.prototype.slice.call(arguments, 1));
    }
    return v;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.dataset.i18n;
      var v = lookup(key);
      if (typeof v === "function") return; // dynamic keys are rendered by page scripts
      if (key === "footerLine") {
        el.innerHTML = String(v).replace("{year}", '<span>' + new Date().getFullYear() + "</span>");
      } else if (typeof v === "string" && v.indexOf("<") !== -1) {
        el.innerHTML = v;
      } else {
        el.textContent = v;
      }
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      // data-i18n-attr="attribute:key"
      var parts = el.dataset.i18nAttr.split(":");
      if (parts.length === 2) el.setAttribute(parts[0], t(parts[1]));
    });
    // SEO: per-language title/description if the page dict provides them
    var metaTitle = lookup("metaTitle");
    if (typeof metaTitle === "string" && metaTitle !== "metaTitle") document.title = metaTitle;
    var metaDesc = lookup("metaDesc");
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl && typeof metaDesc === "string" && metaDesc !== "metaDesc") descEl.setAttribute("content", metaDesc);
    var picker = document.getElementById("hubLang");
    if (picker && picker.value !== lang) picker.value = lang;
  }

  function setLang(next) {
    if (LANGS.indexOf(next) === -1 || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    apply();
    listeners.forEach(function (cb) { cb(lang); });
  }

  /* hreflang + canonical for SEO (needs SITE_CONFIG.siteUrl) */
  function injectSeoLinks() {
    var cfg = window.SITE_CONFIG || {};
    var base = (cfg.siteUrl || "").replace(/\/$/, "");
    if (!/^https:\/\//.test(base)) return;
    var path = location.pathname.replace(/index\.html$/, "");
    var pageUrl = base + path;
    var canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = pageUrl;
    document.head.appendChild(canonical);
    LANGS.forEach(function (code) {
      var alt = document.createElement("link");
      alt.rel = "alternate";
      alt.hreflang = code;
      alt.href = pageUrl + "?lang=" + code;
      document.head.appendChild(alt);
    });
    var xd = document.createElement("link");
    xd.rel = "alternate";
    xd.hreflang = "x-default";
    xd.href = pageUrl;
    document.head.appendChild(xd);
  }

  function buildPicker() {
    var picker = document.getElementById("hubLang");
    if (!picker) return;
    picker.innerHTML = LANGS.map(function (code) {
      return '<option value="' + code + '">' + NATIVE[code] + "</option>";
    }).join("");
    picker.value = lang;
    picker.addEventListener("change", function () { setLang(picker.value); });
  }

  /* 규칙집(Rulebook) 링크가 없는 페이지(예: 사용자가 관리하는 index.html)에는
     헤더/푸터에 링크를 자동 삽입해 사이트 전체에서 접근·검색 노출되게 한다. */
  function injectRulebookNav() {
    var nav = document.querySelector(".hub-nav");
    if (nav && !nav.querySelector('a[href="rules.html"]')) {
      var a = document.createElement("a");
      a.href = "rules.html";
      a.setAttribute("data-i18n", "navRulebook");
      a.textContent = "Rulebook";
      var home = nav.querySelector('a[href="index.html"]');
      if (home && home.nextSibling) nav.insertBefore(a, home.nextSibling);
      else nav.appendChild(a);
    }
    var foot = document.querySelector(".hub-footer-links");
    if (foot && !foot.querySelector('a[href="rules.html"]')) {
      var fa = document.createElement("a");
      fa.href = "rules.html";
      fa.setAttribute("data-i18n", "navRulebook");
      fa.textContent = "Rulebook";
      foot.insertBefore(fa, foot.firstChild);
    }
  }

  window.HubI18n = {
    t: t,
    get lang() { return lang; },
    setLang: setLang,
    onChange: function (cb) { listeners.push(cb); },
    apply: apply,
    LANGS: LANGS,
  };

  buildPicker();
  injectRulebookNav();
  injectSeoLinks();
  apply();
})();
