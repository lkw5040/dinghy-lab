/* ============================================================
   Dinghy Lab — 사이트 설정 (배포 전 이 파일만 수정하면 됩니다)
   ============================================================ */
window.SITE_CONFIG = {
  // 배포 후 실제 주소를 입력하세요. 예: "https://username.github.io/dinghy-lab"
  // 입력하면 canonical/hreflang 링크가 자동 삽입되어 검색 노출에 유리합니다.
  // GitHub Pages(lkw5040.github.io/dinghy-lab)와 Netlify 두 곳에 배포되어 있어
  // 중복 콘텐츠를 피하기 위해 더 짧은 Netlify 주소를 정식 주소(canonical)로 지정합니다.
  siteUrl: "https://dinghy-lab.netlify.app",

  // Google AdSense 승인 후 발급받은 게시자 ID. 예: "ca-pub-1234567890123456"
  // 비워두면 광고 영역이 자동으로 숨겨져 UI가 깨지지 않습니다.
  adsensePublisherId: "",

  // AdSense 광고 단위(슬롯) ID. 숫자만 입력.
  adSlots: {
    home: "",
    simulator: "",
    game: "",
  },

  // (선택) Google Analytics 4 측정 ID. 예: "G-XXXXXXXXXX"
  analyticsMeasurementId: "",
};
