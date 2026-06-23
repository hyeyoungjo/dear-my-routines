# Step 0: allowlist-schema

`allowed_emails` 테이블을 만든다. 이 테이블이 있는 유저만 앱을 사용할 수 있다(step 1 미들웨어가
체크한다). 관리자(Supabase 대시보드 또는 서비스 키)가 직접 행을 추가/삭제한다.

## 읽어야 할 파일

- `/docs/ADR.md` — ADR-003(RLS), 기존 RLS 패턴 파악
- `/src/db/schema.ts` — `ownerPolicies` 헬퍼, 기존 테이블 패턴, `createdOn` 네이밍 관습

## 작업

### 1. `src/db/schema.ts`에 `allowedEmails` 테이블 추가

```ts
export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    note: text("note"),   // 관리자 메모 (누구인지 기억용)
    createdOn: timestamp("created_on", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("allowed_emails_email_uq").on(t.email),
    // 인증된 유저는 자기 이메일 행만 SELECT 가능 — 다른 유저 목록 조회 불가
    pgPolicy("allowed_emails_self_read", {
      for: "select",
      to: authenticatedRole,
      using: sql`email = (select auth.email())`,
    }),
    // INSERT/UPDATE/DELETE 정책 없음 — 유저는 쓰기 불가, 관리자만
  ],
);

export type AllowedEmail = InferSelectModel<typeof allowedEmails>;
```

`ownerPolicies`를 **쓰지 마라** — 이 테이블에는 `user_id`가 없다. 정책은 위처럼 이메일 기준으로
직접 작성한다.

### 2. 마이그레이션 파일 직접 작성

`drizzle/0011_allowed_emails.sql`:

```sql
CREATE TABLE "allowed_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "note" text,
  "created_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allowed_emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX "allowed_emails_email_uq" ON "allowed_emails" USING btree ("email");
--> statement-breakpoint
CREATE POLICY "allowed_emails_self_read" ON "allowed_emails"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (email = (select auth.email()));
```

### 3. `drizzle/meta/_journal.json`에 항목 추가

```json
{
  "idx": 11,
  "version": "7",
  "when": 1782265000000,
  "tag": "0011_allowed_emails",
  "breakpoints": true
}
```

### 4. 사용자 본인 이메일을 `allowed_emails`에 수동 추가

step 1 미들웨어가 활성화되면 이 테이블에 없는 유저는 전부 차단된다.
`drizzle-kit migrate` 실행 후 반드시 Supabase 대시보드 → Table Editor → `allowed_emails`에서
자기 이메일을 먼저 INSERT해야 한다. 안 하면 본인도 잠긴다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - `allowed_emails`에 `user_id` 컬럼이 없는가? (`ownerPolicies`를 쓰지 않았는가?)
   - RLS SELECT 정책이 `email = auth.email()`로 자기 행만 읽게 되어 있는가?
   - INSERT/UPDATE/DELETE 정책이 없어 유저가 직접 추가/수정/삭제 불가한가?
   - `InferSelectModel` 타입 export가 있는가?
3. `phases/10-access-control/index.json` step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 실패 → `"status": "error"`, `"error_message": "..."`

## 금지사항

- `ownerPolicies()`를 사용하지 마라. 이유: 이 테이블에는 `user_id`가 없고 정책 기준이 `email`이다.
- 유저에게 INSERT/UPDATE/DELETE 정책을 주지 마라. 이유: 관리자만 행을 추가/삭제한다 — 유저가
  자신을 allowlist에 추가할 수 있으면 접근 제어가 무의미해진다.
- 기존 테스트를 깨뜨리지 마라.
