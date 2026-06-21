# todly — 우리, 함께 살아가요.

가족·룸메이트·커플·친구가 **공동 목표(그룹)** 를 함께 수행하고, **실시간으로 함께하며(라이브 룸)**, **꾸준함을 게임처럼 시각화**하는 협업형 생활관리 웹앱(PWA).

UI 단일 진실 소스: **`design/Tudly.dc.html`** (Claude Design 내보내기, 19개 화면). 스크린샷/이미지 미사용 — Claude Code가 HTML을 직접 읽어 React로 옮깁니다.

## 모노레포 구조
```
todly/
├─ apps/web/     # React 18 + TS + Vite + Tailwind + PWA
├─ apps/api/     # Spring Boot 3 (Java 21)
├─ design/       # Tudly.dc.html · TudlyNav.dc.html · support.js (UI 원본)
├─ docs/         # 00~05 기획·설계·빌드 프롬프트 (md)
├─ .claude/agents/  # 서브에이전트 정의
├─ docker-compose.yml
└─ .env.example
```

## 기술 스택
| 레이어 | 기술 |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind · PWA · TanStack Query · Zustand · @stomp/stompjs |
| Backend | Spring Boot 3.x · Java 21 · Spring Security · Spring Data JPA · WebSocket(STOMP) · Flyway |
| Data | PostgreSQL 16 · Redis 7 |
| 인증 | JWT(Access 15분 + Refresh 14일 회전) + OAuth2/OIDC(Apple·Google) |

## 빠른 시작
```bash
cp .env.example .env        # 값 채우기(시크릿)
docker compose up --build   # web:5173 · api:8080 · db:5432 · redis:6379
```
- 프론트 개발(핫리로드): `cd apps/web && npm install && npm run dev`
- 백엔드 개발: `cd apps/api && ./gradlew bootRun`

## API 문서
- Swagger UI: http://localhost:8080/swagger-ui.html (Authorize 버튼으로 JWT Bearer 토큰 입력)
- OpenAPI JSON: http://localhost:8080/v3/api-docs
- springdoc-openapi 기반 자동 생성. 문서 엔드포인트는 인증 없이 공개.

## CI
GitHub Actions(`.github/workflows/ci.yml`) — `main`/`master` push·PR 시 실행.
- **api**: JDK 21(temurin) + Gradle 캐시 → `./gradlew build`(Testcontainers는 러너 내장 Docker 사용).
- **web**: Node 20 + npm 캐시 → `npm ci && npm run build && npm test -- --run`(Vitest).

## 디자인 토큰 (실측 — `design/Tudly.dc.html` 추출)
- Primary `#2E86E6` / 강조·네비 활성 `#1366CE` / 비활성 `#AEB9CC`
- 상태: 마감 `#FF7A6B` · 지남 `#FFB23E` · 완료 `#46D38A`
- 프로필 4색: blue `#2E86E6` · mint `#2BC4B0` · orange `#FF9D52` · purple `#6B5BD0`
- 5테마: ocean / mint / violet / coral / sunset (+ 다크모드)
- 폰트: Pretendard(본문) · Sora(로고/디스플레이) · 라운드 카드 18~24px / 폰 프레임 28px

## 빌드 진행 (PHASE)
`docs/05_빌드_프롬프트.md` 참고. PHASE 0(스캐폴드/토큰) → 1(DB) → 2(인증) → 3(그룹/초대) →
4(투두) → 5(실시간) → 6(라이브 룸) → 7(활동/루틴/알림) → 8(친구) → 9(게이미피케이션/투두상세) →
10(프로필/설정·5테마) → 11(PWA/접근성/마무리).

> 현재: **PHASE 0** — 모노레포 스캐폴드 + 디자인 토큰 + 공용 UI + 빈 5탭 라우팅.
