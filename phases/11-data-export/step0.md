# Step 0: category-schema

`tasks` 테이블에 `category` 컬럼(nullable text)을 추가한다. AI 분석이 실행될 때 이 컬럼에
task의 카테고리를 write back하고, CSV export 시 `task_category` 헤더로 포함된다.

## 읽어야 할 파일

- `/src/db/schema.ts` — `tasks` 테이블 정의, `ownerPolicies` 패턴, 컬럼 네이밍 관습
- `/drizzle/meta/_journal.json` — 현재 마지막 migration idx 확인

## 작업

### 1. `src/db/schema.ts` — `tasks` 테이블에 `category` 컬럼 추가

기존 `tasks` 테이블 정의에 다음 컬럼을 추가한다:

```ts
category: text("category"),   // AI가 분석 시 write back; 미분석이면 null
```

`Tasks` 타입(= `InferSelectModel<typeof tasks>`)에 자동 반영된다.

### 2. 마이그레이션 파일 직접 작성

`drizzle/0012_tasks_category.sql`:

```sql
ALTER TABLE "tasks" ADD COLUMN "category" text;
```

### 3. `drizzle/meta/_journal.json`에 항목 추가

현재 마지막 idx에 +1한 값으로:

```json
{
  "idx": 12,
  "version": "7",
  "when": 1782270000000,
  "tag": "0012_tasks_category",
  "breakpoints": true
}
```

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - `tasks` 테이블에 `category: text("category")` 컬럼이 nullable로 추가됐는가?
   - `InferSelectModel<typeof tasks>`에 `category: string | null`이 포함되는가?
   - migration SQL이 `ALTER TABLE "tasks" ADD COLUMN "category" text;` 한 줄인가?
3. `phases/11-data-export/index.json` step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "tasks 테이블에 nullable category 컬럼 추가, migration 0012"`
   - 실패 → `"status": "error"`, `"error_message": "..."`

## 금지사항

- `category`에 NOT NULL 제약을 넣지 마라. 이유: AI 분석 전에는 null이어야 한다.
- `ownerPolicies`를 수정하지 마라. 이유: tasks의 RLS 정책은 변경이 없다.
- 기존 테스트를 깨뜨리지 마라.
