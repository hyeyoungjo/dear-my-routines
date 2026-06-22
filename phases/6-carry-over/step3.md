# Step 3: detail-modal

task를 더블클릭하면 열리는 **상세 편집 모달**을 만든다. 핵심은 계획일/실행일을
달력 UI(`MiniCalendar` 재사용)로 지정하는 것. 이월의 "수동" 짝꿍이다(자동 sweep과 별개로,
사용자가 직접 날짜를 옮기는 길).

## 읽어야 할 파일

먼저 아래를 읽고 맥락을 파악하라:

- `/docs/ADR.md` — ADR-009, ADR-007(부드러운 UX), ADR-013(날짜 모델).
- `CLAUDE.md` — CRITICAL: 낙관적 업데이트, UI 텍스트는 영어.
- `src/core/time/carry.ts` — **step 0.** `shiftPlannedToDate(node, toDate)` — 날짜만 옮기고 시각·duration 보존(이월이 아니므로 `carryCount`는 건드리지 않는다). 실행일(actual) 이동이 필요하면 동일한 보존 규칙으로 처리하라(필요 시 `shiftActualToDate` 같은 헬퍼를 `carry.ts`에 추가해도 된다 — 순수 함수 규칙 유지).
- `src/components/MiniCalendar.tsx` — `MiniCalendar({ selected, onSelect })`. 월 그리드 날짜 피커. **그대로 재사용**한다.
- `src/components/calendar/CalendarBlock.tsx` — **step 1·2에서 수정됨.** 블록 한 칸. 더블클릭 핸들러를 추가할 곳. 본문 textarea/✕ 버튼과 이벤트가 충돌하지 않게 한다.
- `src/hooks/nodes.ts` — `useUpdateNode()`(`{ id, patch, fromHistory? }`), `UpdateNodeInput`.
- `src/components/date.tsx` — `useSelectedDate`, `startOfDay`, `dayKey`.

이전 step들에서 만든/수정한 `carry.ts`·`CalendarBlock.tsx`를 먼저 읽어라.

## 작업

1. **상세 모달 컴포넌트** `src/components/calendar/NodeDetailModal.tsx`(또는 동등 위치):
   - props로 편집 대상 `node`(또는 `nodeId`)와 닫기 콜백을 받는다.
   - **계획일**과 **실행일**을 각각 `MiniCalendar`로 지정한다. 날짜를 고르면:
     - 계획일 → `updateNode.mutate({ id, patch: shiftPlannedToDate(node, picked) })`.
     - 실행일 → 동일한 시각·duration 보존 규칙으로 `actualStart`/`actualEnd`를 옮긴다.
   - 최소 제목 편집(textarea)도 둔다. 메모(`notes`) 편집은 선택사항.
   - 접근성: Esc로 닫기, 바깥 클릭으로 닫기, 열릴 때 포커스 이동.
2. **더블클릭으로 모달 열기** (`CalendarBlock.tsx`):
   - 블록 본문 더블클릭 시 모달을 연다. 인라인 제목 편집(단일 클릭/드래그)·리사이즈·✕와 충돌하지 않게 핸들러를 배치한다(`onDoubleClick`은 블록 컨테이너에, 단 드래그 시작과 구분).
   - 모달 상태는 가벼운 로컬 상태(`useState`)로 충분하다.

핵심 규칙:

- **수동 날짜 변경은 이월이 아니다.** 모달에서 날짜를 바꿀 때 `carryCount`를 증가시키거나 `status`를 `carried`로 만들지 마라. `shiftPlannedToDate`(carryCount/status 미변경)만 쓴다. 이유: 사용자가 일정을 직접 조정하는 것과, 못 해서 미뤄진 것(이월)은 데이터 의미가 다르다.
- **낙관적 업데이트 보존.** `useUpdateNode` 사용, 직접 `fetch` 금지.
- **시각·duration 보존.** 날짜 이동 산술은 `carry.ts`에 위임한다(컴포넌트에서 재구현 금지).

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
2. `npm run dev`로 수동 확인: task 블록을 더블클릭하면 모달이 열리고, `MiniCalendar`로 계획일을 다른 날로 바꾸면 블록이 그 날짜로 이동(시각 유지)하며 `carryCount`/점선은 변하지 않는지. Esc·바깥 클릭으로 닫히는지. 인라인 제목 편집·리사이즈·✕가 여전히 정상인지(충돌 없음).
3. 아키텍처 체크리스트:
   - 수동 날짜 변경이 `carryCount`/`status`를 건드리지 않는가?
   - `MiniCalendar`를 재사용했는가(새 피커를 만들지 않았는가)?
   - 낙관적 업데이트를 썼는가?
4. 결과에 따라 `phases/6-carry-over/index.json`의 step 3을 업데이트한다(성공 시 `summary`에 모달 파일과 더블클릭 배선을 적는다). 이 step이 마지막이므로, 완료 시 phase 전체가 끝난다.

## 금지사항

- 모달의 수동 날짜 변경에서 `carryCount++`나 `status: "carried"`를 하지 마라. 이유: 수동 재일정은 이월(못 함)이 아니다 — 의미가 섞이면 "subproject 감지" 신호(PRD-7)가 오염된다.
- `MiniCalendar` 대신 새 날짜 피커를 만들지 마라. 이유: 단일 UI 컴포넌트 재사용(중복·불일치 방지).
- 더블클릭 핸들러가 인라인 제목 편집/드래그/리사이즈/✕를 가로채게 만들지 마라. 이유: 기존 캘린더 인터랙션을 깨면 안 된다(ADR-007).
- 기존 테스트를 깨뜨리지 마라.
