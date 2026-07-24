/* Dinghy Lab — Rulebook page: national-authority link per language + print/PDF */
(function () {
  "use strict";

  // 언어별 회원 국가협회(공식 번역·규칙 발행처). 안정적인 대표 도메인만 사용.
  var MNA = {
    en: { label: "US Sailing", url: "https://www.ussailing.org/competition/rules-officiating/the-racing-rules-of-sailing-2025-2028/" },
    ko: { label: "대한요트협회 (KSAF)", url: "https://www.ksaf.org" },
    es: { label: "RFEV — Real Federación Española de Vela", url: "https://www.rfev.es" },
    fr: { label: "FFVoile — Fédération Française de Voile", url: "https://www.ffvoile.fr" },
    de: { label: "DSV — Deutscher Segler-Verband", url: "https://www.dsv.org" },
  };

  function applyMna(lang) {
    var link = document.getElementById("mnaLink");
    if (!link) return;
    var m = MNA[lang] || MNA.en;
    link.textContent = m.label;
    link.href = m.url;
  }

  var printBtn = document.getElementById("printBtn");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

  if (window.HubI18n) {
    applyMna(window.HubI18n.lang);
    window.HubI18n.onChange(applyMna);
  }
})();
