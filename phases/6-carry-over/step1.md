# Step 1: action-x-carry

Action 컬럼의 ✕("오늘 못 함")를 **다음 날로 이월**하도록 바꾸고, 지금 있는 `dropped`
(취소선 + ↺복원) 로직을 **걷어낸다**. 이월의 의미를 "버림"에서 "미룸"으로 바로잡는 단계다.

## 읽어야 할 파일

먼저 아래를 읽고 맥락을 파악하라:

- `/docs/ADR.md` — ADR-009(자동 이월), ADR-007(낙관적 업데이트, 부드러운 UX).
- `CLAUDE.md` — CRITICAL: 데이터 변경은 TanStack Query 낙관적 업데이트로 즉시 갱신·실패 시 rollback.
- `src/core/time/carry.ts` — **step 0에서 생성됨.** `carryOverNode(node, toDate)`, `shiftPlannedToDate`. 이번 step이 이걸 호출한다.
- `src/core/time/day.ts` — `addDays`, `startOfDay`, `gridDayOf`, `dayKey`.
- `src/components/calendar/CalendarBlock.tsx` — 블록 한 칸. **현재 동작**: `isPlaceholder`(ghost: 계획만, 실제 없음)일 때 ✕ → `updateNode.mutate({ id, patch: { status: "dropped" } })`(약 209행). `status === "dropped"`면 취소선 텍스트(약 189행)와 ↺복원 버튼(약 221행). 일반 블록의 ✕는 Plan=삭제 / Action=actual만 비우기(약 235행~).
- `src/components/calendar/CalendarGrid.tsx` — `status === "dropped"`인 노드를 Action 컬럼에서 빼는 필터(약 363행)와 ghost/commit 로직.
- `src/hooks/nodes.ts` — `useUpdateNode()`(낙관적 patch, undo 자동 기록). `UpdateNodeInput = { id, patch, fromHistory? }`.
- `src/components/date.tsx` — `useSelectedDate()` → `{ selectedDate, ... }`. 현재 보고 있는 날.

이전 step에서 만든 `carry.ts`를 먼저 읽고 그 patch 반환 형태를 이해한 뒤 작업하라.

## 작업

1. **Action ghost ✕ → 이월로 교체** (`CalendarBlock.tsx`):
   - 지금 `status: "dropped"`로 patch하는 ghost ✕ 핸들러를, 이월 patch로 바꾼다:
     `updateNode.mutate({ id: node.id, patch: carryOverNode(node, addDays(selectedDate, 1)) })`.
   - `selectedDate`는 `useSelectedDate()`에서 가져온다(현재 보고 있는 날 + 1 = "다음 날").
   - 버튼의 `aria-label`/`title`을 "Didn't do it"에서 이월 의미("Carry to tomorrow" 등)로 갱신한다.
2. **`dropped` 잔재 제거**:
   - 취소선 스타일 분기(약 189행), ↺복원 버튼 분기(약 221~234행)를 제거한다. `status === "dropped"`를 더 이상 만들지 않으므로 그 표시 경로도 없앤다.
   - `CalendarGrid.tsx`의 `action && status === "dropped"` 필터(약 363행)를 제거한다.
3. **일반 ✕ 동작은 유지**: Plan 블록 ✕ = 노드 삭제(`removeNode`), Action 실제 블록 ✕ = actual 필드만 비우기. 이 분기는 건드리지 마라.

핵심 규칙:

- **낙관적 업데이트 보존.** `useUpdateNode`가 이미 `onMutate`에서 캐시를 즉시 갱신하고 `onError`로 rollback한다. 그 파이프라인을 그대로 쓰고, 직접 `fetch`하거나 서버 응답을 기다려 UI를 멈추지 마라(CLAUDE.md CRITICAL, ADR-007).
- **이월 날짜 계산은 `carry.ts`에 맡긴다.** 컴포넌트에서 `plannedStart`를 직접 분해해 날짜를 더하지 마라 — `carryOverNode(node, toDate)`가 시각·duration 보존을 책임진다(단일 진실원).

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
2. `npm run dev`로 띄워(localhost:3000) 수동 확인: Action 컬럼 ghost에서 ✕를 누르면 그 블록이 사라지고, **다음 날**로 이동했는지(날짜를 넘겨 확인). 취소선/↺복원 UI가 더 이상 나타나지 않는지.
3. 아키텍처 체크리스트:
   - 데이터 변경이 낙관적 업데이트로 즉시 반영되는가?
   - 이월 날짜 로직을 `carry.ts`에 위임했는가(컴포넌트에서 날짜 산술을 재구현하지 않았는가)?
4. 결과에 따라 `phases/6-carry-over/index.json`의 step 1을 업데이트한다(성공 시 `summary`에 수정한 파일과 제거한 `dropped` 경로를 적는다).

## 금지사항

- `status: "dropped"`를 새로 만드는 코드를 남기지 마라. 이유: 이 phase의 목적이 "버림(dropped)"을 "미룸(carried)"으로 대체하는 것이다.
- Action ✕에서 노드를 삭제하지 마라(`removeNode` 호출 금지). 이유: 이월은 task를 보존한 채 날짜만 미루는 것이다. 삭제는 Plan ✕의 몫이다.
- 컴포넌트 안에서 `plannedStart`/`plannedEnd`를 직접 분해해 +1일 날짜 계산을 하지 마라. 이유: 시각·duration 보존과 그리드 경계 규칙이 `carry.ts`에 모여 있어야 한다.
- 기존 테스트를 깨뜨리지 마라.
