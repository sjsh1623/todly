# 프롬프트 — `todly`를 `https://mohe.today/todly` 경로에 배포 (공용 프록시 뒤)

> 이 파일 전체를 Claude Code(또는 담당 엔지니어)에게 작업 지시로 그대로 붙여넣으세요.
> 단독 실행 가능한 프롬프트입니다. `todly` 저장소에서 작업하며, 같은 서버에서 이미
> `mohe.today/withy`로 서비스 중인 **withy** 앱 패턴을 그대로 따릅니다.

## 목표

todly **웹 앱(PWA)** 을 경로 프리픽스 **`/todly`** 로, 즉 `https://mohe.today/todly`
에서 서비스한다. API는 `https://mohe.today/todly/api/v1`, WebSocket은
`https://mohe.today/todly/ws` 로 노출하며, 서버에 이미 떠 있는 **외부 리버스 프록시**
(공용 Docker 네트워크 `proxy_network`) 뒤에 둔다.

중요: 이 변경이 **Capacitor 네이티브 iOS/Android 빌드를 깨뜨리면 안 된다.**
네이티브는 번들을 기기 루트(`capacitor://localhost/`)에서 로드하고 API는 절대 URL로
호출한다. 따라서 경로 관련 값은 모두 **환경변수 기반(env-driven)** 으로 만들어,
네이티브는 루트(`/`)를 기본값으로 쓰고 **호스팅 웹 빌드일 때만** `/todly`를 쓰게 한다.

## 참고: withy가 하는 방식 (이 패턴을 그대로 복제)

- withy의 `apps/web/vite.config.ts`(=`web/vite.config.ts`)는 `base: '/withy/'` 로
  설정 → 에셋이 `/withy/...` 아래로 해석됨.
- withy 웹 nginx는 그냥 루트에서 SPA를 `try_files … /index.html` 로 서빙한다.
  **외부 프록시가 `/withy` 프리픽스를 떼고(strip)** 컨테이너로 넘기므로 컨테이너는
  루트 경로만 본다.
- withy `docker-compose.yml`: `withy-web`, `withy-spring` 가 외부 `proxy_network`
  에 합류하고, 웹 컨테이너는 **호스트 포트를 노출하지 않는다**(프록시가 앞단 처리).
  DB/Redis는 내부 네트워크에만 둔다.
- API CORS는 `CORS_ORIGINS=https://mohe.today,…` 로 설정.
- 서버 푸시는 **Firebase가 아니라 직접 APNs** 방식: `APNS_KEY_ID=5T5Q7ZZDYJ`,
  `APNS_TEAM_ID=B7JXA8GGC8`, `APNS_TOPIC=today.mohe.<app>`, `.p8`를
  `/run/secrets/apns.p8` 로 마운트.

withy는 `~/Desktop/Developer/Mohe/tossa` 에 있다 — 정확한 형태는 그 저장소의
`docker-compose.yml`, `web/vite.config.ts`, `web/nginx.conf` 를 읽어 확인할 것.

## 반드시 지킬 제약

1. 네이티브(Capacitor) 빌드는 base `/`, 라우터 basename `/`, **절대 URL** API
   (`https://mohe.today/todly/api/v1`) 를 유지한다. 기존처럼
   `npm run build && npx cap sync` 후 iOS/Android 빌드가 그대로 되어야 한다.
2. 호스팅 웹 빌드는 base `/todly/`, 라우터 basename `/todly`, **상대 경로** API
   (`/todly/api/v1`) 를 쓴다.
3. 웹 컨테이너는 호스트 포트를 노출하지 않고 `proxy_network` 에 붙는다. DB/Redis는
   내부 전용으로 유지한다.
4. PWA 서비스워커 scope, manifest `scope`/`start_url` 은 호스팅 빌드에서 `/todly/`
   아래에 있어야 한다(아니면 SW가 앱을 제어하지 못하고 홈화면 추가 scope가 틀림).

## 필요한 변경 사항

### 1. 환경변수 기반 base 경로 (`apps/web/vite.config.ts`)
- 빌드 타임 base를 읽는다. 예: `const base = process.env.VITE_DEPLOY_BASE || '/'`
  를 `defineConfig({ base, … })` 에 전달.
- vite-plugin-pwa: PWA `scope`/`start_url` 을 base에서 파생(`scope: base`,
  `start_url: base`), `workbox.navigateFallback` 을 `${base}index.html` 로,
  `navigateFallbackDenylist` 를 프리픽스가 붙은 API/WS 경로에 맞춘다
  (`new RegExp('^' + base + 'api')`, `… + 'ws')`). 개발용 proxy 블록은 그대로 둔다.

### 2. 라우터 basename (`apps/web/src/app/router.tsx`)
- `createBrowserRouter(routes, { basename: import.meta.env.VITE_ROUTER_BASE || '/' })`.

### 3. API + WS base URL
- axios 클라이언트가 `import.meta.env.VITE_API_BASE_URL` 을 읽고(현재 그렇게 되어
  있음: `apps/web/src/shared/lib/api.ts`), STOMP/WS 클라이언트가 `VITE_WS_URL` 을
  읽는지 확인.
- 호스팅 웹용 `.env.production`(신규): `VITE_API_BASE_URL=/todly/api/v1`,
  `VITE_WS_URL=/todly/ws`, `VITE_DEPLOY_BASE=/todly/`, `VITE_ROUTER_BASE=/todly`,
  웹 푸시를 켜면 `VITE_VAPID_PUBLIC_KEY=<키>` 도 추가.

### 4. 웹 nginx (`apps/web/nginx.conf`)
- withy처럼: 루트에서 SPA를 `try_files $uri $uri/ /index.html` 로 서빙,
  `/assets/` 장기 캐시, gzip. **`/api`, `/ws` proxy 블록은 제거** — 외부 프록시가
  그 경로를 곧장 `todly-api` 로 라우팅한다. (로컬은 Vite dev proxy가 `/api`+`/ws`
  를 계속 처리.)

### 5. 운영용 compose (`docker-compose.prod.yml`, 신규 — withy 복제)
- 서비스 `todly-web`, `todly-api`, `todly-db`, `todly-redis`.
- `todly-db`/`todly-redis` 는 내부 bridge 네트워크에만.
- `todly-api` + `todly-web` 은 **외부** `proxy_network` 에도 합류
  (`networks: proxy_network: { external: true, name: proxy_network }`).
- `todly-web` 에는 `ports:` 없음. `todly-api` 도 호스트 포트 불필요(프록시가
  `proxy_network` 로 접근).
- `todly-web` 은 `VITE_DEPLOY_BASE=/todly/` 등을 `--build-arg`/env로 주거나
  `.env.production` 을 빌드 스테이지에 포함해 빌드.
- `todly-api` env: `CORS_ORIGINS=https://mohe.today`, JWT 시크릿, DB/Redis,
  푸시(§7 참조).

### 6. 외부 리버스 프록시 (설정은 서버에 있고 이 저장소 밖)
기존 `/withy` 규칙 옆에 추가(`/todly` 프리픽스 strip, WS 업그레이드):
```nginx
location /todly/api/ { proxy_pass http://todly-api:8080/api/;  include proxy_params; }
location /todly/ws   { proxy_pass http://todly-api:8080/ws;    proxy_http_version 1.1;
                       proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
location /todly/     { proxy_pass http://todly-web/; }   # 끝 슬래시가 /todly 를 떼어냄
```
(실제 프록시 종류 — Traefik/Caddy/nginx-proxy — 에 맞춰, `/withy` 가 연결된 방식과
동일하게 조정. 컨테이너 이름이 `proxy_network` 에서 접근 가능해야 함.)

### 7. 서버 푸시
todly 백엔드에는 이미 `PushSender` → `WebPushSender`(VAPID) + `FcmSender`(Firebase)
가 있다. withy는 대신 공용 `.p8` 로 **직접 APNs** 를 쓴다. 하나를 골라 문서화:
- **Firebase 방식(현재 코드):** Firebase 프로젝트 생성 → `today.mohe.todly`
  (iOS+Android) 등록 → APNs 키 `AuthKey_5T5Q7ZZDYJ.p8` 를 Firebase에 업로드 →
  `PUSH_FCM_CREDENTIALS` 에 서비스계정 JSON 지정, 웹은 `PUSH_VAPID_PUBLIC/PRIVATE`
  설정. (`apps/web/MOBILE.md` 참고.)
- **직접 APNs 방식(withy와 동일):** 백엔드에 토큰 기반 APNs 전송기를 추가하고
  `APNS_KEY_ID=5T5Q7ZZDYJ`, `APNS_TEAM_ID=B7JXA8GGC8`, `APNS_TOPIC=today.mohe.todly`,
  `.p8` 를 읽기전용 마운트 → iOS 푸시에 Firebase 불필요(Android는 여전히 FCM 필요).

## 검증 (아래를 수행하고 결과 보고)

1. 네이티브 영향 없음: `cd apps/web && npm run build && npx cap sync` (기본 base `/`)
   후 iOS 시뮬레이터 빌드와 `./gradlew assembleDebug` 가 여전히 성공.
2. 호스팅 빌드: `VITE_DEPLOY_BASE=/todly/ VITE_ROUTER_BASE=/todly
   VITE_API_BASE_URL=/todly/api/v1 VITE_WS_URL=/todly/ws npm run build` 후,
   `dist/index.html` 이 `/todly/assets/...` 를 참조하고 생성된 `dist/sw.js` 의
   scope/manifest 가 `/todly/` 아래인지 확인.
3. `docker compose -f docker-compose.prod.yml up -d --build`; 서버에서
   `curl -sI https://mohe.today/todly/` 가 앱 HTML을 반환하고,
   `curl -s https://mohe.today/todly/api/v1` 가 API에 도달(프록시 404가 아니라
   401/200 등)하는지 확인.
4. 브라우저에서 `https://mohe.today/todly/`: 딥링크 새로고침(예: `/todly/groups`)이
   SPA를 서빙(404 아님), 에셋 로드, 프리픽스 API로 로그인 동작, WebSocket 연결 확인.

## 산출물
- 위 파일 변경(웹 설정, 라우터, nginx, `.env.production`,
  `docker-compose.prod.yml`), 외부 프록시 스니펫, 짧은 README 노트. 모든 경로 값은
  env 기반으로 유지해 네이티브 빌드에 영향이 없도록 한다.
