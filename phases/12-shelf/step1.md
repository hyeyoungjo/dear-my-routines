# Step 1: core-shelf

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026(Shelf)**, ADR-015/018(plan은 별도 리스트, missed는 데이터), ADR-025(데이터=사실, 화면=해석)
- `/CLAUDE.md` — CRITICAL: 비즈니스 로직(시간 계산·트리 조작)은 `src/core/` 순수 함수로, **테스트를 먼저/함께**(TDD)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/plan.ts` — `PlanBlock` 타입, `carryOverPlan`(나란히 둘 빌더 패턴 참고), `findOverduePlans`, `shiftPlan`, `originalDateOf`/`revisedDateOf`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/carry.ts` — `shiftSpanOntoGridDay(rawStart, rawEnd, toDate)` (clock+duration 보존 이동)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/day.ts` — `dayKey`, `gridDayOf`, `startOfDay`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/calendar.ts` — `DEFAULT_GRID_START_HOUR` 등 기본 슬롯 상수
- 기존 테스트 한 개(예: `src/core/time/plan.test.ts`가 있으면)로 vitest 패턴을 확인하라.

이전 step(0)에서 `tasks.shelvedAt`(nullable timestamp) 컬럼이 추가됐다. `Task` 타입에 `shelvedAt: Date | null`이 있다.

## 작업

Shelf의 **순수 로직**을 `src/core/`에 추가한다. React/DB/네트워크 금지. 각 함수에 vitest 테스트를 함께 작성한다(TDD).

새 파일 `src/core/time/shelf.ts`를 만들고 아래 순수 함수를 구현한다. (`Task` 타입은 `@/db/schema`에서 import. 이 함수들은 `Task` 전체가 아니라 필요한 필드만 받는 좁은 타입을 써도 좋다 — 코어를 DB 스키마에 과하게 묶지 않는 쪽을 선호.)

```ts
/** A task is shelved when it has a shelvedAt timestamp (ADR-026). */
export function isShelved(task: { shelvedAt: Date | string | null }): boolean

/** The set of taskIds currently shelved — fed to the carry-over sweep's skip set. */
export function shelvedTaskIds(tasks: ReadonlyArray<{ taskId: string; shelvedAt: Date | string | null }>): Set<string>

/**
 * Build the fresh `planned` plan an un-shelve drops onto `today` (ADR-026).
 * Returns a new plan's data (no planBlockId — caller/optimistic layer mints it),
 * exactly the shape `carryOverPlan` returns for `nextPlan`.
 *  - If the task has prior plans, preserve the clock of its most recent plan
 *    (latest `date`, tie-break latest startAt) shifted onto `today` via
 *    shiftSpanOntoGridDay — re-plan it at the hour the user used to do it.
 *  - If the task has NO prior plans, place a default 1-hour slot starting at
 *    DEFAULT_GRID_START_HOUR on `today`.
 * Do NOT resurrect old `missed` plans — un-shelve is a clean restart (ADR-026).
 */
export function freshPlanToday(
  taskId: string,
  taskPlans: PlanBlock[],
  today: Date,
): Omit<PlanBlock, "planBlockId">
```

테스트(`src/core/time/shelf.test.ts`)에 최소 아래 케이스를 포함하라:

- `isShelved`: shelvedAt=null → false; Date 또는 ISO 문자열 → true.
- `shelvedTaskIds`: 섞인 목록에서 shelved만 모은 Set, 활성만 있으면 빈 Set.
- `freshPlanToday`(prior plans 있음): status가 `"planned"`, `date`가 `dayKey(today)`, clock(시:분)이
  가장 최근 plan과 동일, duration 보존.
- `freshPlanToday`(prior plans 없음): `today`의 DEFAULT_GRID_START_HOUR에 1시간 슬롯, status `"planned"`.
- `freshPlanToday`는 입력 `taskPlans` 배열을 변형(mutate)하지 않는다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. 새 테스트가 실제로 돌고 통과하는지 확인한다(`npm test` 출력에 shelf 테스트가 보여야 함).
2. 아키텍처 체크리스트: 순수 함수만(React/DB/fetch import 없음) / `core/time/` 위치 / ADR 이탈 없음.
3. `phases/12-shelf/index.json`의 step 1을 업데이트한다:
   - 성공 → `"completed"`, `"summary"`에 추가한 함수명과 파일 경로(`src/core/time/shelf.ts`, 테스트) 기록.
   - 실패 → `"error"` + `error_message`.

## 금지사항

- `shelf.ts`에서 React/TanStack/DB/네트워크를 import 하지 마라. 이유: core는 순수 함수(CLAUDE.md CRITICAL, 모바일 재사용).
- 옛 `missed` plan을 부활/수정하는 로직을 넣지 마라. 이유: un-shelve는 깨끗한 재시작(ADR-026).
- 테스트 없이 함수만 추가하지 마라. 이유: 핵심 로직 TDD(CLAUDE.md CRITICAL).
- 기존 테스트를 깨뜨리지 마라.
