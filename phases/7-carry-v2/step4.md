# Step 4: modal-carry-sweep

carry-v2의 동작을 완성한다: **상세 모달**(각 날 block 따로 수정·actual 찍기·선택 즉시 저장),
**이월**(못한 block을 missed로 두고 다음날 새 block), **자동 sweep**, **비교 라벨**(한 block에
plan+actual 둘 다일 때만)을 전부 `task_blocks` 기준으로 맞춘다. 앞서 보고된 모달 버그·"2h→9h"
라벨도 여기서 해결된다.

## 읽어야 할 파일

- `/docs/ADR.md` — **ADR-014**(이월=missed+새 block, planned/revised/actual 파생, 비교는 한 block에 plan+actual 둘 다일 때만), ADR-009, ADR-007.
- `CLAUDE.md` — CRITICAL: 낙관적 업데이트, UI 텍스트 영어.
- `src/core/time/blocks.ts` — **step 1**: `carryOverBlock`(missedPatch + nextBlock), `shiftBlockPlanned/Actual`, `findOverdueBlocks`, 파생값.
- `src/hooks/blocks.ts` — **step 2**: `useAddBlock`/`useUpdateBlock`/`useRemoveBlock`.
- `src/components/calendar/CalendarGrid.tsx`, `CalendarBlock.tsx` — **step 3에서 block 기준으로 전환됨.** Action ghost ✕(현재 phase 6에서는 노드 carryOver) 자리, 비교 라벨(`comparison`) 자리, 더블클릭 모달 연결.
- `src/components/calendar/NodeDetailModal.tsx` — **현재 노드 기준** 상세 모달(`shiftPlannedToDate`/`shiftActualToDate`, onBlur 저장). 이걸 block 기준으로 고친다.
- `src/hooks/useCarryOverSweep.ts` — **현재 노드 기준** 자동 sweep. block 기준으로 고친다.
- `src/components/MiniCalendar.tsx` — 날짜 피커(`{selected, onSelect}`), 모달에서 재사용.
- `src/components/date.tsx` — `useSelectedDate`.

## 작업

1. **상세 모달**을 block 기준으로 (`NodeDetailModal.tsx`, 또는 block용으로 이름/props 조정):
   - **각 날의 block을 따로** 편집한다(ADR-014: 각 occurrence 독립). 한 block에 대해: planned 날짜·actual 날짜를 `MiniCalendar`로 지정, 제목/메모(=node) 편집.
   - **actual "찍기"**: actual이 아직 없으면 `shiftBlockActual`이 빈 patch라 안 되던 버그를 고친다 — actual_start가 없을 때 actual 날짜를 고르면 **그 날에 actual span을 새로 만든다**(planned 시각을 기본값으로). actual이 채워지면 `status='done'`.
   - **선택 즉시 저장**: 날짜 선택·제목 변경을 `onBlur`에 의존하지 말고 변경 즉시 `useUpdateBlock`(또는 node title은 `useUpdateNode`)로 반영한다(모달 닫는 방식과 무관하게 저장되게).
2. **이월** (`CalendarGrid`/`CalendarBlock`의 Action ghost ✕ 또는 명시적 이월 동작):
   - `carryOverBlock(block, addDays(selectedDate,1))`를 써서 **이 block을 `missed`로 patch**(`useUpdateBlock`) **+ 다음날 새 planned block 생성**(`useAddBlock`). 못한 날 block은 그 자리에 `missed`로 **그대로 남는다**(리뷰용).
3. **자동 sweep** (`useCarryOverSweep.ts`):
   - `findOverdueBlocks(blocks, startOfDay(now))`로 과거의 안 한 planned block을 찾아, 각각 `carryOverBlock(block, today)` 적용(missed + 오늘 새 block). **첫 로드 1회·멱등**(useRef 가드) + undo 미기록(`fromHistory:true`).
4. **비교 라벨** (`CalendarBlock.tsx`):
   - "예상→실제"(예: `1.5h → 2h`) 라벨은 **한 block에 `plannedStart`와 `actualStart`가 둘 다 있을 때만** 띄운다. 그 외(계획만/실제만, 다른 날 occurrence)에는 **숨긴다** → "2h→9h" 같은 엉뚱한 비교가 사라진다.

핵심 규칙:

- **각 block 독립 편집**: 모달은 특정 block 하나를 고친다(다른 날 block에 영향 없음). planned도 수정 가능(ADR-014).
- **수동 재일정 ≠ 이월**: 모달에서 날짜를 바꾸는 건 `shiftBlock*`(status·carryCount 불변). 이월(`carryOverBlock`)만 missed/새 block을 만든다.
- **멱등 sweep**: `carryCount` 폭증 금지(findOverdueBlocks가 today 이전·planned만), useRef 1회 가드, `fromHistory:true`.
- **낙관적 업데이트 보존**.

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

1. 위 AC를 한 줄씩 실행(모두 통과).
2. `npm run dev` 수동 확인:
   - 모달에서 제목·planned 날짜·actual 날짜를 바꾸면 **즉시** 반영된다(닫는 방식 무관). actual이 없던 task에 actual 날짜를 찍으면 그 날 실제 블록이 생긴다.
   - Action ✕로 이월하면 오늘 block은 `missed`로 남고 다음날에 새 계획 block이 생긴다. 어제 날짜로 가면 "계획했는데 못함"(missed)이 그대로 보인다.
   - 새로고침해도 carryCount(🔁)가 안 늘어난다(멱등).
   - "2h→9h" 같은 라벨이 더는 안 뜬다(같은 block에 plan+actual 둘 다일 때만).
3. 아키텍처 체크리스트: 각 block 독립 편집? 수동 재일정이 carryCount/status 안 건드림? sweep 멱등·undo 미기록? 낙관적?
4. `phases/7-carry-v2/index.json`의 step 4 업데이트.

## 금지사항

- 모달 저장을 `onBlur`에만 의존하지 마라. 이유: Esc·바깥클릭으로 닫으면 유실된다(보고된 버그).
- actual이 없을 때 actual 날짜 지정을 무시하지 마라(빈 patch 반환 금지) — 새로 만들어라. 이유: "못한 task를 나중에 한 날 찍기"가 핵심 요구다.
- 수동 날짜 변경에서 `carryCount`/`status:'missed'`를 건드리지 마라(이월이 아니다).
- sweep을 가드 없이/`fromHistory` 없이 돌리지 마라(carryCount 폭증·undo 오염).
- 비교 라벨을 plan/actual 한쪽만 있을 때 띄우지 마라.
- 기존 테스트를 깨뜨리지 마라.
