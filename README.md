# Dinghy Lab — 세일링 통합 사이트

**▶ 사이트 바로가기: https://dinghy-lab.netlify.app/**

권리정 시뮬레이터 + 2인 레이스 게임을 상단 바로 오가는 **하나의 정적 웹사이트**입니다.
5개 언어(한국어·영어·스페인어·프랑스어·독일어) 지원, AdSense 준비 완료, PWA(앱 설치) 지원.

Free sailing tools: an interactive right-of-way simulator and a 2-player dinghy race game
based on the World Sailing Racing Rules of Sailing 2025-2028.

```
index.html      홈 (두 도구 소개 + SEO 콘텐츠)
simulator.html  권리정 시뮬레이터 (RRS 10-18, 퀴즈, 3초 치트키)
game.html       2인 레이스 게임 (스타트 시퀀스, 벌칙, 마크 라운딩)
about / privacy / terms / 404.html
```

## 0. 현재 배포 상태

- **정식 주소 (canonical): https://dinghy-lab.netlify.app/** — `site-config.js`/`sitemap.xml`/`robots.txt`가 전부 이 주소로 설정되어 있습니다.
- **GitHub Pages: https://lkw5040.github.io/dinghy-lab/** — 같은 파일이 그대로 올라가 있어도 됩니다. 모든 페이지가 `<link rel="canonical">`로 위 Netlify 주소를 가리키므로, 검색엔진은 Netlify 쪽만 색인합니다(중복 콘텐츠 문제 없음). GitHub 저장소는 계속 "원본 소스 보관 + 다른 사람이 코드 보기용"으로 쓰면 됩니다.
- 둘 중 하나만 남기고 싶다면 GitHub Pages는 그대로 두어도 무방합니다(트래픽이 적어도 손해가 없음).

## 1. 배포 / 재배포 방법

**GitHub 저장소**: https://github.com 에서 저장소 페이지 열기 → 바뀐 파일을 다시 드래그해서 업로드(같은 이름이면 자동으로 덮어씀) → `Commit changes`. Settings → Pages에서 이미 켜져 있으면 1~2분 후 자동 반영됩니다.

**Netlify**: 사이트 대시보드에서 새 폴더를 다시 드래그하면 재배포됩니다. (Netlify를 GitHub 저장소와 연결해두면 `git push` 한 번으로 두 곳이 동시에 갱신되어 훨씬 편합니다 — `Site settings → Build & deploy → Link repository`에서 연결 가능.)

수정할 때마다 `sw.js` 맨 위 `VERSION`을 올려야 방문자 캐시가 새 버전으로 갱신됩니다.

## 1.5 색인 가속 (IndexNow — Bing/네이버 계열 즉시 알림)

이 저장소에는 IndexNow 키 파일(`8a1f40bb5e9670e57eee5fc39413b4bd.txt`)이 포함되어 있습니다.
**재배포 후** 아래 3개 주소를 브라우저에서 한 번씩 열면 Bing에 페이지가 즉시 통지됩니다
(응답이 200/202이면 성공. 흰 화면이 정상입니다):

- https://api.indexnow.org/indexnow?url=https%3A%2F%2Fdinghy-lab.netlify.app%2F&key=8a1f40bb5e9670e57eee5fc39413b4bd
- https://api.indexnow.org/indexnow?url=https%3A%2F%2Fdinghy-lab.netlify.app%2Fsimulator.html&key=8a1f40bb5e9670e57eee5fc39413b4bd
- https://api.indexnow.org/indexnow?url=https%3A%2F%2Fdinghy-lab.netlify.app%2Fgame.html&key=8a1f40bb5e9670e57eee5fc39413b4bd

**네이버 등록** (한국 사용자 유입에 중요): https://searchadvisor.naver.com → 웹마스터 도구에
`https://dinghy-lab.netlify.app` 등록 → HTML 메타태그 방식으로 소유 확인(발급된 태그를
`index.html`의 `<head>`에 추가 후 재배포) → 사이트맵 `sitemap.xml` 제출.

## 2. 지금 할 일 (SEO — 검색 노출 극대화)

1. **Google Search Console** (https://search.google.com/search-console)
   - `URL 접두어`로 `https://dinghy-lab.netlify.app/` 등록 → 소유권 확인은 "HTML 태그" 방식이 가장 쉬움: 발급된 `<meta name="google-site-verification" ...>` 한 줄을 모든 페이지 `<head>`에 추가(간단히는 `index.html`만 먼저)하고 재배포 후 확인
   - `Sitemaps` 메뉴에 `sitemap.xml` 제출 → `https://dinghy-lab.netlify.app/sitemap.xml`
   - `URL 검사` 도구로 홈/simulator.html/game.html 각각 "색인 생성 요청"을 눌러주면 더 빨리 검색에 반영됩니다
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters) — "Search Console에서 가져오기" 버튼 한 번이면 끝
3. **트래픽 시드 뿌리기**: 애초 계획대로 경희대 요트부 / 대학 요트부 연합회 단톡·공지에 `https://dinghy-lab.netlify.app/` 링크를 고정하세요. 검색 노출보다 이게 훨씬 빠르고 확실한 첫 방문자 확보 방법입니다.
4. 이미 되어 있는 것: 페이지별 메타/OG 태그, JSON-LD 구조화 데이터, 언어별 hreflang, robots 허용, canonical 자동 삽입, 시맨틱 HTML

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
