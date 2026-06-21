# Step 1: supabase-auth

## 읽어야 할 파일
먼저 아래를 읽고 규칙·구조·결정을 파악하라:
- `/CLAUDE.md` (CRITICAL: 비밀키 클라이언트 노출 금지, RLS, 부드러운 UX)
- `/docs/ARCHITECTURE.md` (`src/services/supabase/` 위치, 디렉토리 구조)
- `/docs/ADR.md` (ADR-003 1인 매직링크 로그인, ADR-010 스택)
- step0 산출물: `src/` 디렉토리 구조, `package.json`, `next.config.ts`, `src/app/` (기존 `page.tsx`, `layout.tsx`)

## 사전 조건
- `.env`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 있다 (확인됨).
- Supabase 대시보드에서 Email(매직링크) 인증 활성화는 **사용자가 별도로** 한다. 이 step의 AC는
  코드 빌드/렌더까지만 검증하므로, 대시보드 설정이 없어도 step은 완료할 수 있다. 실제 로그인
  테스트는 사용자가 나중에 dev 서버에서 한다.

## 목표
Supabase 매직링크로 **"나만" 로그인**하는 인증을 붙인다. `@supabase/ssr` 기반
클라이언트(브라우저/서버/미들웨어) + 로그인 페이지 + 콜백 + 라우트 보호.

## 작업

### 1. 패키지 설치
- `npm install @supabase/supabase-js @supabase/ssr` (한 줄에 하나씩 실행해도 됨)

### 2. Supabase 클라이언트 (`src/services/supabase/`)
ARCHITECTURE.md에 따라 `src/services/supabase/`에 둔다 (Supabase 공식 App Router 패턴을 이
경로로). 환경변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 쓴다.
- `client.ts`: `createBrowserClient` 사용. `export const createClient = () => ...`.
- `server.ts`: `createServerClient` + `next/headers`의 `cookies`. `export async function createClient()`.
- `middleware.ts`: `createServerClient` + request/response 쿠키로 세션을 갱신하는 헬퍼
  `export async function updateSession(request: NextRequest)`.
- 시그니처·쿠키 처리는 Supabase 공식 Next.js(App Router) 가이드를 따른다.

### 3. 루트 미들웨어 (`src/middleware.ts`)
- `updateSession(request)`를 호출해 매 요청 세션을 갱신한다.
- **라우트 보호**: 로그인되지 않은 사용자가 `/login`·`/auth/callback` 외의 경로에 접근하면
  `/login`으로 리다이렉트한다. (로그인되면 통과.)
- `matcher`로 정적 파일·이미지·favicon은 제외한다.

### 4. 로그인 페이지 (`src/app/login/page.tsx`)
- 이메일 입력 + "매직링크 보내기" 버튼. Client Component(`'use client'`).
- 제출 시 `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <앱 origin>/auth/callback } })`.
- 발송 후 "메일함을 확인하세요" 안내 상태를 보여준다.
- Tailwind로 최소한의 깔끔한 스타일.

### 5. 콜백 (`src/app/auth/callback/route.ts`)
- 매직링크 클릭으로 들어온 `code`를 `exchangeCodeForSession`으로 세션과 교환한다.
- 성공 시 `/`로 리다이렉트한다.

### 6. 로그아웃
- `supabase.auth.signOut()`을 호출하는 간단한 로그아웃 동작을 둔다 (예: 홈 `page.tsx`에
  임시 버튼). 정교한 헤더 UI는 만들지 마라 — 그건 나중 phase.

### 7. `.env.example` 업데이트
- `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`를 값 없이 자리만 추가한다.

## Acceptance Criteria
아래를 한 줄에 하나씩 실행한다 (모두 에러 없이 통과해야 한다):
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고 `/login` 라우트가 렌더되어야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `src/services/supabase/{client,server,middleware}.ts`가 존재하는가?
   - `src/middleware.ts`가 미인증 사용자를 `/login`으로 리다이렉트하는가? (코드 확인)
   - 비밀키가 코드에 하드코딩되지 않고 `process.env`에서 오는가? (CLAUDE.md CRITICAL)
   - `NEXT_PUBLIC_` 접두사가 없는 비밀키를 클라이언트 번들에 노출하지 않았는가?
3. `phases/0-foundation/index.json`의 step 1을 업데이트한다:
   - 성공 → `"completed"` + `"summary"`(생성 파일·핵심 결정 한 줄)
   - 3회 실패 → `"error"` + `"error_message"`
   - 사용자 개입 필요 → `"blocked"` + `"blocked_reason"`

## 금지사항
- `service_role` key를 사용하거나 클라이언트에 노출하지 마라. 이유: 매직링크 인증엔
  publishable key로 충분하며, service_role 노출은 치명적 보안 사고다(CLAUDE.md CRITICAL).
- DB 테이블/스키마(`nodes` 등)를 만들지 마라. 이유: step2(db-schema)의 범위다.
- Plan/Act/Review 패널 UI를 만들지 마라. 이유: step3(panel-routes)의 범위다.
- 기존 파일(`docs/`, `scripts/`, `phases/`, `.env`, 우리 `.gitignore`)을 덮어쓰지 마라.
- 기존 테스트를 깨뜨리지 마라.
