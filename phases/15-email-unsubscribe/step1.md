# Step 1: schema-migration

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-029** — step 0)
- `src/db/schema.ts` (`ownerPolicies` 헬퍼 ~line 27, 그리고 테이블 정의 스타일. 이 테이블은 **ownerPolicies를
  쓰지 않는다** — user_id가 없다)
- `drizzle/0018_projects_states.sql` (직전 마이그레이션 — 트리밍 형식 참고)
- `/Users/.../CLAUDE.md` "DB 마이그레이션 주의" 절 (함정 요약은 아래 금지사항)

## 작업

### 1. `src/db/schema.ts` — `emailUnsubscribes` 테이블 추가

```ts
export const emailUnsubscribes = pgTable("email_unsubscribes", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
// RLS ON, 정책 없음: 클라이언트 접근 전면 차단, 서버(Drizzle db)만 접근 (ADR-029).
```

- **RLS를 켜되 owner 정책은 붙이지 마라.** user_id가 없으므로 `ownerPolicies`를 쓰면 안 된다. Drizzle에서
  RLS-on을 표현하는 방법(예: 테이블에 `.enableRLS()`)을 사용하거나, 마이그레이션 SQL에서 직접
  `ENABLE ROW LEVEL SECURITY`를 넣는다. 정책이 없으므로 anon/authenticated 클라이언트는 이 테이블에 접근 불가.
- 서버 라우트는 `src/db`의 Drizzle 연결(서버 전용, 다른 라우트가 쓰는 것과 동일 role)로 읽고 쓴다 — 이 연결은
  RLS를 우회하므로 정책이 없어도 동작한다. (다른 서버 라우트가 이미 이 방식으로 동작함을 확인하라.)
- `EmailUnsubscribe` 타입은 `InferSelectModel`로 export한다(기존 타입들 근처).

### 2. 마이그레이션 SQL — 이번 변경분만

새 번호 파일 `drizzle/00NN_*.sql`에 **정확히** 아래만:

```sql
CREATE TABLE "email_unsubscribes" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_unsubscribes" ENABLE ROW LEVEL SECURITY;
```

- `drizzle-kit generate`가 누적 드리프트를 묶으면 **위 내용만 남기고 트리밍**하라. `_journal.json`·스냅샷을
  일관되게 갱신한다.

### 3. prod DB 적용은 하지 마라 (유저 몫)

`drizzle-kit migrate`를 blind로 실행하지 마라 — 이 프로젝트는 추적 어긋남으로 옛 마이그레이션 재적용 → EXIT 1.
스키마 + 트리밍 마이그레이션 파일까지만 준비한다. 운영 반영은 유저가 수동으로 한다.

## 금지사항

- `ownerPolicies`를 이 테이블에 쓰지 마라. 이유: user_id가 없다. owner 정책은 user_id를 참조한다.
- 이 테이블에 select/insert 정책을 추가하지 마라. 이유: 클라이언트 직접 접근을 막고 서버만 접근하는 게 설계다.
- `drizzle-kit migrate`를 운영 DB에 실행하지 마라. 이유: 추적 어긋남 → EXIT 1.
- 마이그레이션 SQL에 이번 테이블 외 변경을 남기지 마라.

## Acceptance Criteria

```bash
npm run build
```

```bash
npm test
```

```bash
grep -rl "email_unsubscribes" drizzle
```

## 검증 절차

1. build·test 통과(타입 컴파일).
2. 체크리스트: RLS on·정책 없음? ownerPolicies 미사용? 마이그레이션 SQL이 CREATE TABLE + ENABLE RLS 딱 그것뿐?
   `migrate`를 운영 DB에 안 돌렸는가?
3. `phases/15-email-unsubscribe/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "email_unsubscribes(email PK, created_at) + RLS on/정책없음 + 트리밍 마이그레이션. prod 적용은 유저 수동"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
