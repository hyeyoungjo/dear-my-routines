# Step 1: export-core

날짜 범위의 raw DB 데이터를 받아 export용 행(row)으로 변환하는 순수 함수를 만든다.
이 함수는 CSV 생성(step 2)과 AI 분석 인풋 구성(9-ai-review) 양쪽에서 재사용된다.

## 읽어야 할 파일

- `/src/db/schema.ts` — `PlanBlock`, `ActionBlock`, `Task`, `Project`, `DailyReview` 타입
- `/src/core/time/plan.ts` — `carryCountOf(taskPlans: PlanBlock[]): number` — missed plan_blocks 수를 반환하는 기존 순수 함수. 재사용하라.
- `/src/core/time/plan.test.ts` — 기존 테스트 패턴 참고
- `/docs/ARCHITECTURE.md` — `src/core/` 규칙: React/DB/network 없는 순수 함수만

## 작업

### 1. `src/core/export/types.ts` — ExportRow 타입 정의

```ts
export type CompletionStatus =
  | "completed_as_planned"   // plan_block + action_block 모두 있고 시간 변화 없음
  | "completed_with_changes" // plan_block + action_block 있지만 시간 차이 있음
  | "deferred"               // plan_block 있지만 action_block 없음 (missed)
  | "added_on_the_day";      // action_block 있지만 plan_block 없음 (당일 즉흥 추가)

export type ExportRow = {
  date: string;                        // "YYYY-MM-DD"
  task_name: string;
  project_name: string;
  task_category: string | null;        // AI write-back 전에는 null
  completion_status: CompletionStatus;
  planned_start_time: string | null;   // "HH:MM" 또는 null (deferred가 아닌데 plan 없으면 null)
  planned_end_time: string | null;
  planned_duration_min: number | null;
  actual_start_time: string | null;    // "HH:MM" 또는 null
  actual_end_time: string | null;
  actual_duration_min: number | null;
  duration_overrun_min: number | null; // actual - planned. deferred면 null
  times_carried_over: number;          // 이 task의 missed plan_block 수 (전체 기간)
  daily_journal: string | null;        // 해당 날짜의 daily_review.journal_text
};
```

### 2. `src/core/export/buildExportRows.ts` — 변환 함수

```ts
import type { Task, PlanBlock, ActionBlock, Project, DailyReview } from "@/db/schema";
import { carryCountOf } from "@/core/time/plan";
import type { ExportRow } from "./types";

export type ExportInput = {
  tasks: Task[];
  projects: Project[];
  planBlocks: PlanBlock[];          // 날짜 범위 내 전체
  actionBlocks: ActionBlock[];      // 날짜 범위 내 전체
  dailyReviews: DailyReview[];      // 날짜 범위 내 전체
  allTaskPlanBlocks: PlanBlock[];   // times_carried_over 계산용 — 날짜 범위 밖 포함 전체
};

export function buildExportRows(input: ExportInput): ExportRow[];
```

**변환 로직 (구현체는 에이전트 재량, 아래 규칙은 반드시 지킬 것):**

1. 대상 날짜 집합 = planBlocks + actionBlocks에 등장하는 모든 고유 날짜
2. 날짜 × task 조합을 순회하며 ExportRow 생성
3. `completion_status` 결정 규칙:
   - plan 있음 + action 있음 + `|actual_min - planned_min| < 5` → `completed_as_planned`
   - plan 있음 + action 있음 + 시간 차이 ≥ 5분 → `completed_with_changes`
   - plan 있음 + action 없음 → `deferred`
   - plan 없음 + action 있음 → `added_on_the_day`
4. 시간 포맷: `"HH:MM"` (예: `"09:30"`)
5. `duration_overrun_min`: `actual_duration_min - planned_duration_min`. deferred면 null.
6. `times_carried_over`: `carryCountOf(allTaskPlanBlocks.filter(p => p.taskId === task.id))`
7. `daily_journal`: 해당 날짜의 `DailyReview.journalText`. 없으면 null.
8. 결과는 date ASC, task_name ASC 정렬

### 3. `src/core/export/buildExportRows.test.ts` — 단위 테스트

아래 케이스를 반드시 포함:

- `completed_as_planned`: plan + action, 시간 차이 0
- `completed_with_changes`: plan + action, 60분 초과
- `deferred`: plan만 있고 action 없음
- `added_on_the_day`: action만 있고 plan 없음
- `times_carried_over`: missed plan_block 2개인 task → 2 반환
- `daily_journal`: 해당 날짜 review가 있으면 채워지고, 없으면 null
- 같은 날 여러 task → 각각 별도 row

### 4. `src/core/export/index.ts` — re-export

```ts
export { buildExportRows } from "./buildExportRows";
export type { ExportRow, CompletionStatus } from "./types";
```

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - `src/core/export/` 디렉토리 안에 파일이 있는가?
   - `buildExportRows`가 React/DB/network import 없이 순수 함수인가?
   - `carryCountOf`를 새로 만들지 않고 `src/core/time/plan.ts`에서 import해서 재사용하는가?
   - 모든 테스트 케이스가 통과하는가?
3. `phases/11-data-export/index.json` step 1 업데이트.

## 금지사항

- DB 쿼리, fetch, React hook을 `src/core/export/` 안에 넣지 마라. 이유: core는 순수 함수만.
- `carryCountOf`를 재구현하지 마라. 이유: `src/core/time/plan.ts`에 이미 있다.
- 기존 테스트를 깨뜨리지 마라.
