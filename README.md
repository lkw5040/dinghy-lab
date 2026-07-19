# Dinghy Lab — 세일링 통합 사이트

권리정 시뮬레이터 + 2인 레이스 게임을 상단 바로 오가는 **하나의 정적 웹사이트**입니다.
5개 언어(한국어·영어·스페인어·프랑스어·독일어) 지원, AdSense 준비 완료, PWA(앱 설치) 지원.

```
index.html      홈 (두 도구 소개 + SEO 콘텐츠)
simulator.html  권리정 시뮬레이터 (RRS 10-18, 퀴즈, 3초 치트키)
game.html       2인 레이스 게임 (스타트 시퀀스, 벌칙, 마크 라운딩)
about / privacy / terms / 404.html
```

## 1. GitHub Pages 무료 배포 (5분)

1. https://github.com 가입 → 우측 상단 `+` → `New repository`
   - 이름 예: `dinghy-lab` · Public 선택 → `Create repository`
2. `uploading an existing file` 링크 클릭 → **이 폴더의 파일 전부**를 드래그해서 업로드 → `Commit changes`
   - `assets` 폴더는 웹 업로드 시 폴더째 드래그하면 됩니다.
3. 저장소 `Settings` → 왼쪽 메뉴 `Pages` → Source: `Deploy from a branch`, Branch: `main` / `(root)` → `Save`
4. 1~2분 뒤 `https://아이디.github.io/dinghy-lab/` 주소가 생깁니다.

**수정 배포**: 파일을 다시 업로드(같은 이름이면 덮어쓰기)하고, `sw.js` 맨 위 `VERSION`을 올리세요.

## 2. 배포 직후 할 일 (SEO — 검색 노출 극대화)

1. **주소 넣기**: 아래 3곳의 `https://YOUR-USERNAME.github.io/YOUR-REPO` 를 실제 주소로 바꿔 재업로드
   - `site-config.js` 의 `siteUrl` (→ canonical/hreflang 자동 삽입)
   - `sitemap.xml` (전체 치환)
   - `robots.txt` 의 Sitemap 줄
2. **Google Search Console** (https://search.google.com/search-console)
   - `URL 접두어`로 사이트 주소 등록 → 소유권 확인(HTML 태그 방식이 쉬움: 메타 태그를 index.html <head>에 붙여넣고 재업로드)
   - `Sitemaps` 메뉴에 `sitemap.xml` 제출
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters) — Search Console 가져오기 한 번이면 끝
4. 이미 되어 있는 것: 페이지별 메타/OG 태그, JSON-LD 구조화 데이터, 언어별 hreflang, robots 허용, 시맨틱 HTML

## 3. 광고 붙이기 (Google AdSense)

1. 사이트를 먼저 배포하고 2주쯤 방문 기록을 만든 뒤 https://adsense.google.com 에서 신청
2. 승인 후 `site-config.js`에 입력:
   ```js
   adsensePublisherId: "ca-pub-발급받은번호",
   adSlots: { home: "슬롯ID", simulator: "슬롯ID", game: "슬롯ID" },
   ```
3. `ads.txt` 파일의 주석을 지우고 본인 ID로 수정
4. `sw.js` VERSION 올리고 재업로드

- ID를 비워두면 광고 영역이 자동으로 숨겨져 UI가 깨지지 않습니다.
- EU 방문자(스페인어/프랑스어/독일어 사용자)를 위한 **쿠키 동의 배너가 내장**되어 있어, 동의한 방문자에게만 광고가 로드됩니다. (AdSense/GDPR 요건)
- 개인정보처리방침·이용약관 페이지 포함 (승인 요건).

## 4. 언어 지원

- 우측 상단 셀렉터로 전환: English / 한국어 / Español / Français / Deutsch
- 첫 방문 시 브라우저 언어를 자동 감지, 선택은 기기에 저장됩니다.
- `?lang=ko` 식의 주소로 특정 언어 페이지를 공유할 수 있습니다 (hreflang과 연동).
- 번역 수정: `simulator-i18n.js`, `game-i18n.js`, `i18n.js`(공통), `index.html`(홈) 안의 사전만 고치면 됩니다.

## 5. 앱으로 쓰기

- PWA: 방문자가 브라우저에서 "홈 화면에 추가" 또는 헤더의 "앱 설치" 버튼으로 설치, 오프라인 동작.
- Google Play 등록을 원하면: 배포 주소를 https://www.pwabuilder.com 에 넣고 Android 패키지 생성 → Play Console($25 1회) 업로드.

## 6. 구조 메모 (수정할 때)

- 판정 엔진: `simulator.js` 상단 (순수 함수) — 시뮬레이터와 퀴즈가 같은 엔진 사용
- 게임 로직: `game.js` — 모든 표시 문구는 `game-i18n.js` 키를 통해서만 출력
- 스타일: 페이지별 `sim.css`/`game.css` + 공통 크롬(헤더/푸터/광고/동의) `hub.css`
- 광고/동의 로직: `ads.js` · 언어 엔진: `i18n.js` · PWA: `pwa.js` + `sw.js`
