# Step 1: allowlist-middleware

미들웨어에서 `allowed_emails` 테이블을 조회해, 허용되지 않은 유저를 `/unauthorized`로 차단한다.
step 0에서 테이블과 RLS 정책이 완성된 상태에서 실행한다.

## 읽어야 할 파일

- `/src/middleware.ts` — 현재 미들웨어 진입점
- `/src/services/supabase/middleware.ts` — `updateSession` 구현. **이 파일을 수정한다.**
- `/src/app/login/page.tsx` — 로그인 페이지 패턴 참고(간단한 페이지 구조)
- `/docs/ADR.md` — ADR-003(인증·RLS)

## 작업

### 1. `src/services/supabase/middleware.ts` 수정

`updateSession` 함수 안에서 세션 확인 이후, 인증된 유저에 대해 `allowed_emails` 조회를 추가한다.

흐름:
1. `supabase.auth.getUser()` — 기존 코드 그대로
2. 미인증 유저 → `/login` 리다이렉트 — 기존 코드 그대로
3. **인증된 유저** → `supabase.from("allowed_emails").select("id").eq("email", user.email).maybeSingle()`
   - 행이 없으면(`data === null`) → `/unauthorized` 리다이렉트
   - 행이 있으면 → 기존처럼 `supabaseResponse` 반환
4. `/unauthorized`는 퍼블릭 라우트로 취급 — 무한 리다이렉트 방지

퍼블릭 라우트 목록(`isPublicRoute`):
```ts
const isPublicRoute =
  pathname === "/login" ||
  pathname === "/unauthorized" ||
  pathname.startsWith("/auth");
```

주의: `supabase.from("allowed_emails")` 쿼리는 현재 유저의 인증 컨텍스트로 실행된다.
step 0의 RLS SELECT 정책(`email = auth.email()`)이 자기 행만 반환하므로 안전하다.

### 2. `src/app/unauthorized/page.tsx` 생성

로그인된 상태지만 허용 목록에 없는 유저에게 보여줄 페이지.

```tsx
// 간단한 안내 페이지 — 로그인 상태이므로 로그아웃 버튼 포함
export default function UnauthorizedPage() { ... }
```

요구사항:
- "서비스 준비 중" 또는 "비공개 베타" 안내 문구 (영어)
- 로그아웃 버튼 (현재 `page.tsx`의 `signOut` Server Action 패턴 참고)
- 로그인 페이지로 돌아가는 링크

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - `/unauthorized`가 `isPublicRoute`에 포함되어 무한 리다이렉트가 없는가?
   - `allowed_emails`를 서비스 키로 조회하지 않고 Supabase 클라이언트(유저 컨텍스트)로 조회하는가?
   - 리다이렉트 시 `supabaseResponse`의 쿠키를 복사하는가? (기존 패턴과 동일)
   - `/unauthorized` 페이지에 로그아웃 수단이 있는가?
3. **로컬 테스트 전 반드시**: Supabase 대시보드에서 본인 이메일을 `allowed_emails`에 추가할 것.
   안 하면 본인도 잠긴다.
4. `phases/10-access-control/index.json` step 1 업데이트.

## 금지사항

- `SUPABASE_SERVICE_ROLE_KEY`를 미들웨어에서 사용하지 마라. 이유: 서비스 키는 RLS를 우회하며
  클라이언트에 노출될 위험이 있다. 유저 컨텍스트 클라이언트로 충분하다(RLS가 자기 행만 반환).
- `/unauthorized`를 `isPublicRoute`에 추가하지 않으면 무한 리다이렉트가 발생한다. 반드시 추가하라.
- 기존 테스트를 깨뜨리지 마라.
