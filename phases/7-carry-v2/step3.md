# Step 3: calendar-blocks

캘린더(`CalendarGrid`/`CalendarBlock`)를 **`task_blocks` 기준으로 전환**한다. 지금까지는 노드의
시간 필드를 그렸지만, 이제 한 노드가 여러 날에 여러 block을 가지므로 **block을 그린다**. task의
이름·색은 `node`에서 조인해 온다. 이 step부터 캘린더가 carry-v2 데이터로 동작한다.

## 읽어야 할 파일

- `/docs/ADR.md` — **ADR-014**(각 block 독립 = 행 단위 편집), ADR-007(낙관적·부드러움), ADR-013(blocksForDay 조립).
- `CLAUDE.md` — CRITICAL: 낙관적 업데이트, 비즈니스 로직은 `core/`.
- `src/core/time/blocks.ts` — **step 1**: `blocksForDay`, `blockSpan`, `shiftBlockPlanned/Actual` 등.
- `src/hooks/blocks.ts` — **step 2**: `useBlocks`, `useAddBlock/useUpdateBlock/useRemoveBlock`(낙관적).
- `src/hooks/nodes.ts` — `useNodes`(task의 title·color·category 조인용으로 계속 사용).
- `src/components/calendar/CalendarGrid.tsx` — **현재 nodes 기준** 2열(Plan/Act) 그리드: `nodeBelongsToDay`로 그 날 노드 선별 → `readSpan`/`CalBlock` 변환 → 드래그(`commitDrag`가 `useUpdateNode`로 plan/actual 필드 patch). 이걸 **block 기준으로 갈아끼운다**.
- `src/components/calendar/CalendarBlock.tsx` — `CalBlock` 타입과 블록 렌더/드래그/리사이즈/✕/인라인 제목. 드래그 대상이 node→block이 된다.
- `src/components/date.tsx` — `useSelectedDate`.
- `src/components/calendar/ProjectLegend.tsx` — 색·project. (참고)

## 작업

1. **그 날의 block 선별·렌더** (`CalendarGrid.tsx`):
   - `useBlocks()` + `useNodes()`를 읽고, `blocksForDay(blocks, selectedDate)`로 그 날 block들을 모은다.
   - 각 block을 Plan/Act 두 열에 그린다: Plan = `blockSpan(block,"plan")`, Act = `blockSpan(block,"actual")`(없으면 ghost는 plan에서 파생 — 기존 정책 유지). 위치/높이/overlap은 `core/time/calendar.ts` geometry 재사용.
   - 블록의 색·제목은 `nodeId`로 `nodes`에서 조인한다(project 색 상속 그대로).
2. **편집을 block 대상으로** (드래그/리사이즈/추가):
   - 드래그·리사이즈 commit → `useUpdateBlock`으로 그 **block의** plan/actual span을 patch(기존 `useUpdateNode` 자리). 각 block이 독립 수정된다.
   - 빈 슬롯 클릭으로 새 block 추가 → `useAddBlock`(해당 `gridDay`·`nodeId`). 새 task를 만드는 흐름은 node 생성(useAddNode) 후 그 노드의 block 생성으로 잇는다(기존 UX 유지).
3. **carryCount/🔁 표시**: 그 block이 속한 node의 `carryCountOf(nodeBlocks)`로 🔁 뱃지(블록 위, 조용히).

핵심 규칙:

- **낙관적 업데이트 보존**(ADR-007): 모든 변경은 `useBlocks` 계열 mutation으로 즉시 반영·실패 시 롤백. 직접 fetch 금지.
- **geometry는 core 재사용**: top/height/overlap을 컴포넌트에서 새로 계산하지 마라(`calendar.ts`).
- **node 시간 필드를 더 이상 읽지 마라**: 이 step 이후 캘린더는 `task_blocks`만 읽는다(레거시 컬럼은 step 5에서 제거 — 미리 안 읽게).

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
2. `npm run dev`로 수동 확인: 기존 task들(step 0에서 이전된 block)이 각자 날짜에 그대로 보이는지. 드래그·리사이즈·새 추가가 부드럽게(낙관적) 동작하는지. 색·제목이 맞는지.
3. 아키텍처 체크리스트: 캘린더가 `task_blocks`만 읽는가(node 시간 필드 미사용)? geometry를 core에서 재사용했는가? 낙관적인가?
4. `phases/7-carry-v2/index.json`의 step 3 업데이트.

## 금지사항

- 캘린더에서 node의 `plannedStart`/`actualStart` 등 시간 필드를 읽지 마라. 이유: 이제 진실은 `task_blocks`다(레거시 컬럼은 곧 제거).
- block geometry를 컴포넌트에서 직접 계산하지 마라(`core/time/calendar.ts` 재사용).
- 낙관적 업데이트를 깨지 마라(드래그가 서버 대기로 버벅이면 안 됨, ADR-007).
- 모달/이월/sweep은 여기서 손대지 마라 — step 4. (단, 이 step에서 캘린더가 깨지지 않을 만큼만 최소 연결)
- 기존 테스트를 깨뜨리지 마라.
