# Step 0: carry-core

미완료 task 이월(carry-over, ADR-009)의 **순수 비즈니스 로직**을 `src/core/`에 만든다.
UI·DB·네트워크를 전혀 건드리지 않는다. 이번 step의 산출물은 다음 step들이 import해서 쓴다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 디렉토리 규칙, 특히 "`core/`는 React·DB·네트워크를 import하지 않는 순수 함수만".
- `/docs/ADR.md` — 특히 **ADR-009**(단순 자동 이월: 미완료 task는 다음 날로 자동 이월, `carryCount`는 백그라운드 메타데이터)와 **ADR-013**(정규화 rows가 진실, "하루"는 조립한 view; **그리드 하루 경계** 07:00~익일 02:00).
- `CLAUDE.md` — CRITICAL 규칙(비즈니스 로직을 UI에서 분리, 핵심 로직은 테스트 먼저/함께).
- `src/core/time/day.ts` — `dayKey`, `gridDayOf`, `addDays`, `startOfDay`, `nodeBelongsToDay`, `nodesForDay`. **이번 step에서 재사용한다** (날짜 경계 로직을 절대 복제하지 마라).
- `src/core/time/calendar.ts` — `GRID_START_HOUR`, `durationMinutes` 등 시간 수학 헬퍼.
- `src/core/tree/types.ts` — `FlatNode` 타입(이월 함수의 입출력 단위).
- `src/db/schema.ts` — `nodes` 테이블의 필드 확인: `plannedStart` / `plannedEnd` / `actualStart` / `actualEnd`(timestamptz, nullable), `plannedDate`(date, `YYYY-MM-DD` 문자열), `carryCount`(integer, default 0), `status`(enum: `pending`|`in_progress`|`done`|`carried`|`dropped`).
- `src/core/time/day.test.ts` — 이 프로젝트의 Vitest 작성 스타일(파일명·구조)을 참고하라.

이전에 만들어진 `core/time` 코드를 꼼꼼히 읽고 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/core/time/carry.ts`(구현)와 `src/core/time/carry.test.ts`(테스트)를 만든다. **테스트를 함께 작성**한다(TDD 지향).

아래 세 함수를 export한다. 시그니처는 가이드이며, 내부 구현은 재량이다. 단 **핵심 규칙**은 반드시 지킨다.

```ts
import type { FlatNode } from "@/core/tree/types";

/**
 * Move a node's planned span to `toDate`, keeping the clock time and duration.
 * Only the calendar date changes — a task planned 14:00–15:30 carried to the
 * next day becomes 14:00–15:30 on that day. If the node has no plannedStart but
 * has a plannedDate, shift plannedDate instead. Returns ONLY the changed fields
 * (a patch), so callers can hand it straight to an update mutation.
 */
export function shiftPlannedToDate(node: FlatNode, toDate: Date): Partial<FlatNode>;

/**
 * Carry an undone task forward: shiftPlannedToDate(node, toDate) PLUS
 * carryCount + 1 and status "carried". This is the patch applied both when the
 * user explicitly says "didn't do it" (step 1) and when the day-boundary sweep
 * pulls a past-due task forward (step 2).
 */
export function carryOverNode(node: FlatNode, toDate: Date): Partial<FlatNode>;

/**
 * The nodes that the day-boundary sweep should pull forward to `today`:
 * past-due, not done, not yet acted on.
 */
export function findOverdueUncarried(nodes: FlatNode[], today: Date): FlatNode[];
```

핵심 규칙(반드시 준수):

1. **순수 함수만.** `carry.ts`는 React·DB·`fetch`·Drizzle을 import하지 않는다. 날짜 경계는 `day.ts`의 `gridDayOf`/`dayKey`/`addDays`/`startOfDay`를 import해 재사용한다.
2. **시각·duration 보존.** 이월은 *날짜만* 옮긴다. `plannedStart`의 시/분과 `plannedEnd - plannedStart` 간격은 그대로 유지한다.
3. **timestamp 정규화.** wire를 거쳐 온 `plannedStart` 등은 `Date`가 아니라 ISO 문자열일 수 있다. `day.ts`가 하듯 `new Date(span)`으로 정규화한 뒤 다뤄라.
4. **`findOverdueUncarried` 조건** — 다음을 *모두* 만족하는 노드만 반환한다:
   - `plannedStart`(없으면 `plannedDate`)의 그리드 하루가 `today`의 그리드 하루보다 **이전**일 것. 같거나 이후면 제외(= **멱등성의 핵심**: 이미 오늘로 옮겨진 노드는 다시 끌려오지 않는다).
   - `status`가 `pending` 또는 `in_progress`일 것(`done`·`carried`·`dropped` 제외).
   - `actualStart`가 없을 것(이미 손댄 일은 끌어오지 않는다).
   - `type`이 `task` 또는 `subtask`일 것(area·project 컨테이너는 이월 대상 아님).

## Acceptance Criteria

```bash
npm run build
```
```bash
npm test
```
```bash
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 한 줄씩 실행한다(모두 통과해야 한다).
2. `carry.test.ts`가 최소 다음을 커버하는지 확인한다: 시각·duration 보존, 자정~06:59 블록의 그리드 하루 귀속(ADR-013), `carryOverNode`의 `carryCount++`·`status="carried"`, `findOverdueUncarried`가 이미 오늘인 노드/`actualStart` 있는 노드/`done`을 제외(멱등성).
3. 아키텍처 체크리스트:
   - `core/`가 React·DB·네트워크를 import하지 않는가?
   - `day.ts` 함수를 재사용했는가(복제하지 않았는가)?
   - CLAUDE.md CRITICAL(비즈니스 로직 분리)을 지켰는가?
4. 결과에 따라 `phases/6-carry-over/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(생성 파일·export 함수 포함)"`
   - 수정 3회 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "사유"` 후 즉시 중단

## 금지사항

- `carry.ts`에서 React·DB·`fetch`·Drizzle을 import하지 마라. 이유: `core/`는 UI·DB 비의존 순수 레이어여야 단위 테스트가 쉽고 나중에 모바일에서 재사용된다(ARCHITECTURE, CLAUDE.md CRITICAL).
- `day.ts`의 날짜 경계 로직(`gridDayOf` 등)을 복붙해 다시 구현하지 마라. import해서 써라. 이유: 단일 진실원 — 경계 규칙이 한 곳에만 있어야 어긋나지 않는다.
- 컴포넌트·hooks·API 라우트를 수정하지 마라. 이번 step은 순수 로직 + 테스트만. 이유: scope 최소화. ✕ 동작 교체는 step 1, sweep은 step 2다.
- 기존 테스트를 깨뜨리지 마라.
