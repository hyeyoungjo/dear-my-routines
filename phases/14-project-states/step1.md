# Step 1: schema-migration

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-028** — step 0에서 추가됨. 두 컬럼의 의미)
- `/docs/DATA-STRUCTURE.md` (projects 테이블)
- `src/db/schema.ts` (`projects = pgTable(...)` ~line 167. `tasks.shelvedAt`(~line 211)이 **똑같이 미러할
  선례** — nullable `timestamp(..., { withTimezone: true })` + 주석)
- `drizzle/0017_married_bucky.sql` (shelvedAt 마이그레이션 = **단일 `ALTER TABLE ADD COLUMN`** 한 줄. 이번에도
  이 형태를 따른다)
- `src/app/api/projects/[id]/route.ts` (`parseProjectPatchInput` — 지금 title·projectColor만 화이트리스트.
  새 필드를 여기서 받아줘야 UI 토글이 저장된다)
- `/Users/.../CLAUDE.md`의 **"DB 마이그레이션 주의"** 절 (이 프로젝트 고유 함정 — 아래 금지사항에 요약)

## 작업

### 1. `src/db/schema.ts` — projects에 컬럼 2개 추가

`projects` 테이블에 `tasks.shelvedAt`과 **동일한 스타일**로 nullable 컬럼 2개를 추가하라:

```ts
// ADR-028: 비활성(내려둠). null = 활성. 값 있으면 Shelf로 이동, legend/픽커에서 제외. task 무영향.
deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
// ADR-028: 캘린더 표시 여부. null = 표시. 값 있으면 그 프로젝트 task 블록을 캘린더에서 숨김.
hiddenAt: timestamp("hidden_at", { withTimezone: true }),
```

`Project` 타입은 `InferSelectModel<typeof projects>`라 자동으로 두 필드를 얻는다(수동 타입 수정 불필요).

### 2. 마이그레이션 SQL — 이번 변경분만

`drizzle/0017_married_bucky.sql`처럼 **이번 두 컬럼만** 담은 새 마이그레이션 파일을 만든다. 내용은 정확히:

```sql
ALTER TABLE "projects" ADD COLUMN "deactivated_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN "hidden_at" timestamp with time zone;
```

- 파일명은 기존 순번을 이어 `drizzle/00NN_*.sql`. `drizzle/meta/_journal.json`·스냅샷을 일관되게 갱신하라.
- `drizzle-kit generate`를 쓰면 **그동안 push로만 반영된 누적 드리프트가 한 파일에 몽땅 묶인다**. 그럴 경우
  생성된 SQL을 **위 두 줄만 남기고 트리밍**하라 (CLAUDE.md 함정 (a)).

### 3. PATCH API가 새 필드를 받게 한다 — `src/app/api/projects/[id]/route.ts`

`parseProjectPatchInput`에 `deactivatedAt`·`hiddenAt`를 추가하라. 클라이언트는 `new Date()`를 JSON으로
보내므로 **ISO string으로 도착**한다 → `Date`로 파싱해 넣고, `null`도 허용한다(활성/표시로 되돌리기):

```ts
if (typeof body.deactivatedAt === "string") values.deactivatedAt = new Date(body.deactivatedAt);
else if (body.deactivatedAt === null) values.deactivatedAt = null;
// hiddenAt도 동일
```

`projectId`/`userId`는 여전히 받지 마라(기존 정책 유지).

### 4. prod DB 적용은 하지 마라 (유저 몫)

이 세션은 운영 DB 자격증명이 없을 수 있고, `drizzle-kit migrate`는 이 프로젝트에서 **이미 있는 옛
마이그레이션을 재적용하려다 "already exists"로 조용히 실패(EXIT 1)** 한다(CLAUDE.md 함정 (b)). 따라서:

- **`drizzle-kit migrate`를 blind로 실행하지 마라.**
- 스키마 + 트리밍된 마이그레이션 파일까지만 준비한다. 운영 DB 반영은 유저가 추적행 seed(created_at =
  직전 저널 항목의 `when`)와 함께 수동으로 한다.
- 후속 step(core/UI)은 타입만 쓰므로 build/test는 DB 없이 통과한다.

## 금지사항

- `drizzle-kit migrate`를 운영 DB에 실행하지 마라. 이유: 추적 어긋남으로 옛 마이그레이션 재적용 → EXIT 1.
- 마이그레이션 SQL에 이번 두 컬럼 외 다른 변경(누적 드리프트)을 남기지 마라. 이유: 다른 테이블을 의도치 않게
  건드린다.
- 컬럼을 `notNull`로 만들지 마라. 이유: 기존 행이 있으므로 nullable이어야 한다(null=활성/표시 기본값).
- `projectColor`나 다른 기존 컬럼을 건드리지 마라.

## Acceptance Criteria

```bash
npm run build
```

```bash
npm test
```

```bash
grep -c "ADD COLUMN" drizzle/*projects*state* 2>/dev/null || grep -rl "deactivated_at" drizzle
```

## 검증 절차

1. `npm run build`·`npm test` 통과(스키마 타입 컴파일).
2. 체크리스트: 두 컬럼이 nullable·timestamptz·snake_case(`deactivated_at`/`hidden_at`)인가? 마이그레이션 SQL이
   딱 두 줄(ADD COLUMN)인가? `drizzle-kit migrate`를 운영 DB에 돌리지 않았는가?
3. `phases/14-project-states/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "projects.deactivatedAt·hiddenAt(nullable ts) 추가 + 트리밍 마이그레이션 SQL + PATCH route가 두 필드 허용(ISO→Date). prod 적용은 유저 수동(마이그레이션 함정)"`
   - DB 적용이 꼭 필요해 막히면 → `"status": "blocked"`, `"blocked_reason": "운영 DB에 마이그레이션 수동 적용 필요(추적행 seed)"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
