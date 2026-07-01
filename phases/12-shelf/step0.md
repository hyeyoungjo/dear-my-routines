# Step 0: schema-migration

## 읽어야 할 파일

먼저 아래를 읽고 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — 특히 **ADR-026(Shelf)**, ADR-016(tasks = 정체성+stats 단위), ADR-018(missed는 데이터)
- `/CLAUDE.md` — CRITICAL 규칙(모든 테이블 user_id + RLS, 비밀키 클라이언트 노출 금지)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/db/schema.ts` — 특히 `tasks` 테이블 정의(약 195줄)와 `timestamp(...)` 사용 패턴
- `/Users/hyeyoungjo/Projects/dear-my-routines/drizzle.config.ts` — 마이그레이션 생성 설정
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts` — `optimisticTask` 함수(약 110줄): `Task` 객체 리터럴을 만든다

## 작업

Shelf 기능(ADR-026)의 **단 하나의 저장 컬럼**을 추가한다. "내가 일부러 내려놨다"는 의도는 plan/action
에서 derive 불가하므로 task에 저장한다.

1. **`src/db/schema.ts`의 `tasks` 테이블에 nullable 컬럼 추가** — `createdOn` 바로 위에 둔다:

   ```ts
   // ADR-026: when the user shelves this task (intentionally parks it). null =
   // active. A shelved task is skipped by the carry-over sweep and hidden from
   // the calendar; its plan/action history is kept intact.
   shelvedAt: timestamp("shelved_at", { withTimezone: true }),
   ```

   - `.notNull()`을 붙이지 마라. 이유: null이 "활성"을 의미하는 핵심 설계다.
   - 기존 컬럼의 `timestamp(..., { withTimezone: true })` 패턴과 동일하게 맞춘다.
   - `tasks` 테이블 상단 JSDoc 주석에 shelvedAt이 derive되지 않는 유일한 상태 플래그임을 한 줄 덧붙인다.

2. **드리즐 마이그레이션 SQL 생성** — 스키마만으로 생성한다(DB 연결 불필요):

   ```bash
   npx drizzle-kit generate
   ```

   `drizzle/` 아래에 `00NN_*.sql`이 새로 생기는지 확인한다. 이 SQL은 `ALTER TABLE "tasks" ADD COLUMN
   "shelved_at" timestamp with time zone;` 형태여야 한다(nullable이라 DEFAULT/NOT NULL 없음).

3. **타입 깨짐 1곳만 수정(빌드 그린 유지)** — 새 컬럼이 생기면 `Task` 타입에 `shelvedAt`이 필수
   프로퍼티로 들어가, `Task` 객체 **리터럴**을 만드는 곳이 컴파일 에러가 난다. `src/hooks/tasks.ts`의
   `optimisticTask`가 유일한 그런 곳이다. 거기에 `shelvedAt: null,`을 추가한다. (낙관적 신규 task는
   당연히 활성이므로 null.) **이 외의 hooks/UI 로직은 이 step에서 건드리지 마라** — 후속 step 소관이다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다(둘 다 성공해야 함).
2. `drizzle/` 아래 새 마이그레이션 `.sql` 파일이 생성됐고 `tasks`에 `shelved_at` nullable 컬럼을
   추가하는 내용인지 확인한다.
3. 아키텍처 체크리스트: ARCHITECTURE.md 디렉토리 구조 준수 / ADR 스택 이탈 없음 / CLAUDE.md CRITICAL
   위반 없음(user_id/RLS는 기존 `ownerPolicies`가 그대로 적용되므로 별도 작업 불필요).
4. 결과에 따라 `phases/12-shelf/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성된 마이그레이션 파일명과 컬럼명 기록.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message"`에 구체적 에러.
   - 사용자 개입 필요(DB 비밀번호/연결 등) → `"status": "blocked"`, `"blocked_reason"` 후 중단.

## 금지사항

- `shelvedAt`에 `.notNull()`이나 DEFAULT를 붙이지 마라. 이유: null = "활성"이 설계의 핵심.
- 실제 DB에 `migrate`/`push`를 실행하지 마라. 이유: 이 step은 스키마+마이그레이션 SQL 생성까지만.
  DB 적용은 사용자가 환경 변수를 갖춘 곳에서 따로 한다(blocked 사유 아님).
- `optimisticTask` 외의 hooks/sweep/UI 로직을 손대지 마라. 이유: step 1~6의 범위.
- 기존 테스트를 깨뜨리지 마라.
