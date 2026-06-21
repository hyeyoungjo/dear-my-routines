# Step 2: google-oauth

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 비밀키 클라이언트 노출 금지, 부드러운 UX)
- `/docs/ADR.md` (ADR-003 매직링크, **ADR-011 Google OAuth 병행**)
- `/docs/ARCHITECTURE.md`
- step1 산출물: `src/services/supabase/{client,server,middleware}.ts`,
  `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/middleware.ts`

## 사전 조건
사용자가 별도로 설정한다 (이 step의 AC는 빌드/렌더까지만 검증하므로, 설정이 없어도 step은
완료 가능. 실제 Google 로그인 테스트는 사용자가 나중에 한다):
- Google Cloud Console에서 OAuth 2.0 클라이언트를 만들고 redirect URI에 Supabase 콜백
  (`https://<project-ref>.supabase.co/auth/v1/callback`)을 추가.
- Supabase 대시보드 → Authentication → Providers → Google에 client ID/secret 입력 후 활성화.

## 목표
기존 **매직링크 로그인을 그대로 유지**하면서(ADR-011), 로그인 페이지에 **"Google로 로그인"
버튼**을 추가한다. 콜백·미들웨어·클라이언트는 step1 것을 재사용한다.

## 작업

### 1. 로그인 페이지 보강 (`src/app/login/page.tsx`)
- 기존 매직링크 이메일 폼은 **유지**한다.
- "Google로 로그인" 버튼을 추가한다 (이메일 폼과 "또는" 구분선으로 분리, 과한 디자인 금지).
- 버튼 클릭 시:
  `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <앱 origin>/auth/callback } })`
- Client Component(`'use client'`) 유지. Tailwind로 최소 스타일.

### 2. 콜백 확인 (`src/app/auth/callback/route.ts`)
- step1에서 만든 `exchangeCodeForSession` 로직은 OAuth code 교환에도 동일하게 쓰인다.
- 코드를 확인하고, OAuth 리다이렉트(code 쿼리 파라미터)도 올바르게 처리되는지 검증한다.
  필요한 보정만 하고, 동작하면 그대로 둔다.

### 3. `.env.example` 확인
- Google client ID/secret은 **Supabase 대시보드에 저장**되므로 앱 `.env`에는 불필요하다.
  추가하지 마라.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고 `/login`에 **Google 버튼과 이메일 폼이 모두** 렌더되어야 한다.

## 검증 절차
1. AC 커맨드 실행.
2. 체크리스트:
   - `/login`에 "Google로 로그인" 버튼이 있는가?
   - `signInWithOAuth({ provider: 'google', ... })` 호출이 있는가?
   - 매직링크 이메일 폼이 여전히 남아 있는가? (제거하면 안 됨)
   - 콜백이 OAuth code도 처리하는가?
   - `service_role` key를 쓰지 않았는가?
3. `phases/0-foundation/index.json`의 step 2를 업데이트한다:
   - 성공 → `"completed"` + `"summary"`
   - 3회 실패 → `"error"` + `"error_message"`
   - 사용자 개입 필요 → `"blocked"` + `"blocked_reason"`

## 금지사항
- 매직링크 로그인을 제거하지 마라. 이유: ADR-011에 따라 둘을 병행한다.
- `service_role` key를 사용하거나 노출하지 마라. 이유: 보안(CLAUDE.md CRITICAL).
- DB 스키마(`nodes` 등)나 Plan/Act/Review 패널을 만들지 마라. 이유: step3/step4 범위다.
- 기존 테스트를 깨뜨리지 마라.
