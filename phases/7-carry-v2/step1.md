# Step 1: blocks-core

`task_blocks`를 다루는 **순수 비즈니스 로직**을 `src/core/`에 만든다. 날짜 귀속·이월·파생값
(planned/revised/actual·carryCount) 계산이 전부 여기 모인다. UI·DB·네트워크 비의존(테스트 우선).

## 읽어야 할 파일

- `/docs/ADR.md` — **ADR-014**(이월=missed+새 block, planned/revised/actual·carryCount 파생, 비교는 한 block에 plan+actual 둘 다일 때만), ADR-013(그리드 하루 경계), ADR-009.
- `/docs/ARCHITECTURE.md` — `core/`는 React·DB·네트워크 import 금지.
- `CLAUDE.md` — 핵심 로직은 테스트 먼저/함께.
- `src/db/schema.ts` — **step 0에서 추가된** `task_blocks`·`blockStatus`·`TaskBlock` 타입.
- `src/core/time/day.ts` — `gridDayOf`, `dayKey`, `addDays`, `startOfDay`, `dayFromKey`. **재사용**(날짜 경계 복제 금지).
- `src/core/time/calendar.ts` — `Span`, 블록 위치·높이 geometry(`blockTopMinutes`/`durationMinutes`/`moveBlock`/`resizeBlockEnd`/`layoutOverlaps` 등). **블록 시각 계산은 이걸 재사용**.
- `src/core/time/carry.ts` — phase 6의 노드 기준 carry 로직(참고용 — 같은 개념을 block 기준으로 옮긴다).
- `src/core/time/carry.test.ts`, `src/core/time/day.test.ts` — 테스트 스타일.

## 작업

`src/core/time/blocks.ts`(+`blocks.test.ts`)를 만든다. 클라이언트 wire 형태의 타입과 순수 함수들을 둔다. 시그니처는 가이드이며 내부는 재량, **핵심 규칙은 준수**.

```ts
import type { Span } from "@/core/time/calendar";

/** A task_block as it arrives over the wire (timestamps may be ISO strings). */
export type FlatBlock = {
  id: string; nodeId: string; gridDay: string;
  plannedStart: string | null; plannedEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  status: "planned" | "done" | "missed";
  sortOrder: number;
};

/** Does a block belong to the given day? (grid-day rule via day.ts) */
export function blockBelongsToDay(block: FlatBlock, date: Date): boolean;
export function blocksForDay(blocks: FlatBlock[], date: Date): FlatBlock[];

/** The plan or actual span of a block, or null if that pair is unset. */
export function blockSpan(block: FlatBlock, kind: "plan" | "actual"): Span | null;

/** Manual reschedule: shift a block's plan/actual span to toDate (clock+duration kept, status untouched). */
export function shiftBlockPlanned(block: FlatBlock, toDate: Date): Partial<FlatBlock>;
export function shiftBlockActual(block: FlatBlock, toDate: Date): Partial<FlatBlock>;

/** Carry an undone block forward: returns the patch to mark THIS block missed AND
 *  the data for a NEW planned block on toDate (same nodeId, plan span shifted). */
export function carryOverBlock(
  block: FlatBlock, toDate: Date,
): { missedPatch: Partial<FlatBlock>; nextBlock: Omit<FlatBlock, "id"> };

/** Past-due, not-done, not-missed plan blocks the day-boundary sweep should carry to today. */
export function findOverdueBlocks(blocks: FlatBlock[], today: Date): FlatBlock[];

/** Per-task derived dates from that node's blocks (null when none). */
export function plannedDateOf(nodeBlocks: FlatBlock[]): string | null;  // earliest gridDay
export function revisedDateOf(nodeBlocks: FlatBlock[]): string | null;  // latest still-planned gridDay
export function actualDateOf(nodeBlocks: FlatBlock[]): string | null;   // gridDay of the block with actual
export function carryCountOf(nodeBlocks: FlatBlock[]): number;          // count of missed
```

핵심 규칙:

1. **순수 함수만.** React·DB·`fetch` import 금지. 날짜는 `day.ts`, 시각 geometry는 `calendar.ts` 재사용(복제 금지 — 단일 진실원).
2. **시각·duration 보존.** 모든 shift/carry는 *날짜만* 옮기고 시/분·길이를 유지(`carry.ts`의 기존 규칙과 동일).
3. **이월의 멱등성.** `findOverdueBlocks`는 `grid_day`가 today의 그리드 하루보다 **이전**이고 `status === 'planned'`(done/missed 제외)인 block만 반환한다 → 이미 오늘로 온 block은 다시 끌려오지 않는다.
4. **timestamp 정규화.** ISO 문자열로 올 수 있으니 `new Date(...)`로 정규화 후 다룬다(day.ts 패턴).

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

1. 위 AC를 한 줄씩 실행한다(모두 통과).
2. `blocks.test.ts`가 최소 커버: shift의 시각·duration 보존, `carryOverBlock`이 (missed patch + 다음날 새 block) 둘 다 만드는지, `findOverdueBlocks` 멱등(이미 오늘/done/missed 제외), 파생값(planned=가장 이른·revised=마지막 planned·actual·carryCount=missed 수).
3. 아키텍처 체크리스트: `blocks.ts`가 순수한가? `day.ts`/`calendar.ts`를 재사용(복제 안 함)했는가?
4. `phases/7-carry-v2/index.json`의 step 1 업데이트(성공 시 `summary`에 파일·export 함수).

## 금지사항

- `blocks.ts`에서 React·DB·`fetch`를 import하지 마라. 이유: `core/`는 순수 레이어(테스트·모바일 재사용).
- 날짜 경계(`gridDayOf` 등)·블록 geometry(`blockTopMinutes` 등)를 복붙해 다시 구현하지 마라. import해서 써라.
- 컴포넌트·hooks·API·스키마를 수정하지 마라. 이번 step은 순수 로직 + 테스트만.
- 기존 테스트를 깨뜨리지 마라.
