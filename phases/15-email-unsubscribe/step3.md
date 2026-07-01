# Step 3: api-route

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-029** — 엔드포인트 GET/POST, 확인 페이지)
- `src/app/api/feedback/route.ts` (라우트 핸들러 스타일 참고 — Resend/서버 패턴)
- `src/app/api/projects/route.ts` (Drizzle `db.insert(...)` 패턴)
- `src/db/schema.ts` (step 1의 `emailUnsubscribes`)
- `src/lib/unsubscribe.ts` (step 2의 `verifyUnsubscribeToken`)

## 작업

### `src/app/api/unsubscribe/route.ts` — GET + POST

수신거부 링크를 처리한다. **인증 불필요**(수신자가 로그인 안 했을 수 있음). 토큰 검증으로 보호한다.

- **GET** `/api/unsubscribe?e=<email>&t=<token>` (사용자가 링크 클릭):
  1. `e`, `t`를 읽는다. 없으면 400.
  2. `verifyUnsubscribeToken(email, t)` 실패 → 400(또는 중립적 에러 페이지). 성공 시에만 진행.
  3. `db.insert(emailUnsubscribes).values({ email: normalized }).onConflictDoNothing()` — **멱등**(이미 있으면 무시).
  4. 간단한 **확인 HTML** 반환(`Content-Type: text/html`): "구독을 취소했습니다 / You've been unsubscribed."
     (영/한 한 줄씩이면 충분, 앱 스타일 흉내 안 내도 됨.)
- **POST** `/api/unsubscribe?e=&t=` (RFC 8058 one-click, Gmail이 자동 호출):
  - 동일하게 검증·upsert 후 **200**(본문 불필요). List-Unsubscribe-Post 대응.

이메일은 검증·저장 전에 **정규화**(trim+lowercase, step 2와 동일 규칙)한다.

주의: 이 라우트는 `db`(서버 Drizzle)로 직접 insert한다. `email_unsubscribes`는 RLS on·정책 없음이지만 서버
연결은 우회하므로 동작한다(step 1). 클라이언트에서 이 테이블에 직접 접근하는 코드를 만들지 마라.

## 금지사항

- 인증(`getUser`)을 요구하지 마라. 이유: 수신거부 클릭 시 비로그인일 수 있다. 대신 HMAC 토큰으로 보호한다.
- 토큰 검증 없이 email만으로 수신거부 처리하지 마라. 이유: 누구나 남을 수신거부시킬 수 있다.
- 이 테이블에 대한 client 측 쿼리(Supabase anon)나 RLS 정책을 만들지 마라. 이유: 서버 전용 설계(ADR-029).
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

## 검증 절차

1. build·lint·test 통과.
2. 체크리스트: GET(확인 HTML)·POST(200) 둘 다? 토큰 검증 필수? `onConflictDoNothing` 멱등? 이메일 정규화?
   인증 미요구? 서버 db로 insert?
3. `phases/15-email-unsubscribe/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "/api/unsubscribe GET(확인HTML)+POST(one-click), HMAC 검증, emailUnsubscribes onConflictDoNothing 멱등, 인증불요·토큰보호"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
