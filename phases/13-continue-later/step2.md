# Step 2: ui-destination-picker

## 읽어야 할 파일

먼저 아래 파일들을 읽고 아키텍처·설계 의도를 파악하라. 특히 기존 → 버튼(`faCircleArrowRight`)과 ✕
버튼(`faXmark`)이 어떤 블록에서 어떻게 동작하는지 코드로 확인한 뒤 작업하라:

- `/docs/ADR.md` (**ADR-027** — 이 기능의 결정·**동작 매트릭스**. 반드시 먼저 읽어라)
- `/docs/ARCHITECTURE.md` (컴포넌트는 `components/`, 순수 로직은 `core/`)
- `src/components/calendar/CalendarBlock.tsx` (블록 1개 렌더 — 버튼들이 여기 있다. `CalBlock` 타입,
  `onContinueTomorrow`/`onCarryOver`/`onConfirm` props, 삭제 버튼, → 버튼, ghost 분기)
- `src/components/calendar/CalendarGrid.tsx` (핸들러: `continueTomorrow`, `carryGhost`, `confirmGhost`,
  `createAt`; 블록 렌더 시 props 배선 부분 ~line 481-503; `gridEndHour`/`gridStartHour`/`selectedDate`)
- `src/core/time/plan.ts` (**step 1에서 추가된 `continueLaterSpan`**, 기존 `carryOverPlan`)
- `src/components/MiniCalendar.tsx` (`MiniCalendar({ selected, onSelect })` — 날짜 선택에 재사용)
- `src/hooks/planBlocks.ts` (`useAddPlanBlock`, `useUpdatePlanBlock`) · `src/hooks/actionBlocks.ts`
  (`useUpdateActionBlock`) — 이미 CalendarGrid에서 쓰는 낙관적 mutation들
- `src/i18n/messages/en.json` · `src/i18n/messages/ko.json` (블록 라벨: `continueTomorrow`, `deletePlan`,
  `deleteAction`, `carryOverToNext` 있는 네임스페이스에 새 키 추가)

## 배경 (ADR-027 요약)

→ 버튼을 **목적지 선택 팝오버**로 바꾼다. 지금은 action 블록에만 있고 무조건 내일로 간다. 바꿀 것:

1. → 버튼을 **plan·action 실블록 모두** + **ghost** 에 단다.
2. 누르면 팝오버가 뜨고 `오늘 이따가` / `내일` / `특정 날짜`(MiniCalendar) 중 고른다.
3. 삭제 버튼 아이콘 `faXmark` → **`faTrashCan`**. ✕는 "닫기" 전용(팝오버 닫기 버튼)으로만 쓴다.

**동작 매트릭스** (ADR-027):

| 목적지 | ACTION 블록 | PLAN 블록 / ghost(밑의 plan row) |
|---|---|---|
| 오늘 이따가 | 같은 task 새 **plan 블록**(span=`continueLaterSpan(블록끝, 오늘, gridEndHour)`). 원본 그대로 | 같은 task 새 **plan 블록**(위와 동일). 원본 `planned` 그대로 |
| 내일 | action `partial` + 내일 plan(같은 시각) = 기존 `continueTomorrow` | `carryOverPlan(plan, 내일)`: 원본→`missed` + 내일 새 `planned` = 기존 `carryGhost` |
| 특정 날짜 | action `partial` + 그날 plan(같은 시각) | `carryOverPlan(plan, 그날)`: 원본→`missed` + 그날 새 `planned` |

핵심: **오늘 이따가는 miss/partial 딱지를 안 붙인다**(같은 날은 놓침이 아님). **내일/특정날짜는 기존
carry 의미 그대로**, 목적지 날짜만 일반화(`carryOverPlan`·`addDays`는 이미 임의 날짜 지원).

## 작업

### 1. `CalendarBlock.tsx`

- 목적지 타입 추가 (파일 내 export):
  ```ts
  export type ContinueDest =
    | { when: "today" }
    | { when: "tomorrow" }
    | { when: "date"; date: Date };
  ```
- prop 교체: `onContinueTomorrow?: () => void` → `onContinue?: (dest: ContinueDest) => void`.
  (ghost의 carry도 이 하나로 흡수하므로 `onCarryOver`는 제거하고 `onContinue`로 통합한다. `onConfirm`은 유지.)
- **→ 버튼 렌더 조건 확장**: 지금 `kind === "action" && !isGhost` 게이트를 없애고, `onContinue`가 있으면
  **plan·action 실블록과 ghost 모두** 렌더한다. 클릭 시 인라인 팝오버(아래)를 연다.
- **삭제 버튼**: 실블록의 삭제 아이콘을 `faXmark` → `faTrashCan`로 교체(`@fortawesome/free-solid-svg-icons`).
  라벨 키(`deletePlan`/`deleteAction`)는 그대로. ghost는 더 이상 삭제/✕ 버튼을 두지 않는다(carry는 →로 이동).
- **목적지 팝오버**: 블록에 앵커된 작은 메뉴. 항목 3개(`오늘 이따가`/`내일`/`특정 날짜`). `특정 날짜`를 누르면
  `MiniCalendar`를 펼쳐 날짜를 고르고 `onContinue({ when: "date", date })` 호출. 나머지 둘은 각각
  `onContinue({ when: "today" })`, `{ when: "tomorrow" })`. 팝오버 **닫기 버튼은 ✕(faXmark)** 사용.
  - 팝오버는 별도 작은 컴포넌트로 분리해도 되고 CalendarBlock 내부에 둬도 된다. 드래그와 충돌하지 않게
    버튼/메뉴의 `onPointerDown`에 `e.stopPropagation()`를 건다(기존 버튼들이 하는 방식과 동일).
  - 팝오버가 열려 있을 때 바깥 클릭/ESC로 닫히게 한다.

### 2. `CalendarGrid.tsx`

- **단일 핸들러**로 통합: `const continueBlock = (block: CalBlock, dest: ContinueDest) => { ... }`. 위
  매트릭스대로 분기한다:
  - `dest.when === "today"`: `continueLaterSpan(block.span.end, selectedDate, gridEndHour)`로 span을 만들고
    **같은 task 새 plan 블록** 생성(`addPlanBlock.mutate({ taskId: block.taskId, date: dayKey(selectedDate),
    startAt, endAt })`). action/plan/ghost 구분 없이 동일 — 원본은 건드리지 않는다.
  - `dest.when === "tomorrow"` 또는 `"date"`: 목적지 날짜 `target = when==="date" ? dest.date :
    addDays(selectedDate, 1)`.
    - **action 블록**: 기존 `continueTomorrow` 로직을 재사용하되 목적지를 `target`으로 — action `partial`
      패치 + `target`에 같은 시각 plan 추가.
    - **plan 블록 / ghost**: 밑의 plan row를 찾아(`allPlans.find(p => p.planBlockId === block.blockId)`)
      `carryOverPlan(plan, target)` → `updatePlanBlock`(missed) + `addPlanBlock`(nextPlan). (기존 `carryGhost`
      일반화.)
- 블록 렌더 배선(현재 `onContinueTomorrow`/`onCarryOver` 넘기는 곳)을 `onContinue={(dest) =>
  continueBlock(block, dest)}`로 교체. 기존 `continueTomorrow`·`carryGhost` 함수는 `continueBlock` 안으로
  흡수하거나 그 내부 헬퍼로 유지한다(중복 로직 남기지 마라).
- 모든 mutation은 기존과 같이 **낙관적**이어야 한다(CLAUDE.md CRITICAL, ADR-007). 새 fetch/await로 UI를
  막지 마라 — 기존 `useAddPlanBlock` 등이 이미 낙관적이니 그대로 쓴다.

### 3. i18n — `src/i18n/messages/en.json`, `ko.json`

`continueTomorrow`가 있는 **같은 네임스페이스**에 키를 추가하고 en·ko **양쪽** 채운다(빠짐 없이):
- `continueLater` — → 버튼 aria/title. en: "Continue later" / ko: "이어서 하기"
- `continueToday` — en: "Later today" / ko: "오늘 이따가"
- `continuePickDate` — en: "Pick a date…" / ko: "날짜 선택…"
- (`continueTomorrow`는 기존 값 재사용: "Continue tomorrow" / "내일 이어서")
- 팝오버 닫기 aria가 필요하면 기존 close 계열 키를 재사용하거나 `close`(en: "Close" / ko: "닫기") 추가.

## 금지사항

- 스키마·DB 컬럼을 추가하지 마라. 이유: ADR-027 — 이번 기능은 기존 plan/action 테이블만 재사용한다.
- `continueLaterSpan`·`carryOverPlan`을 재구현하지 마라. 이유: step 1의 순수 함수를 그대로 호출한다. 시각
  계산 로직을 컴포넌트 안에 인라인으로 다시 짜지 마라(CLAUDE.md CRITICAL: 계산은 `core/`).
- "오늘 이따가"에서 원본 블록에 `missed`/`partial`을 붙이지 마라. 이유: 같은 날 이어하기는 놓침이 아니다.
- 서버 응답을 await 하며 UI를 멈추지 마라. 이유: ADR-007 부드러운 UX — 낙관적 업데이트 유지.
- ✕(faXmark)를 삭제 용도로 다시 쓰지 마라. 이유: 이번 변경의 목적이 "✕=닫기 / 🗑=삭제 / →=이어하기"로
  아이콘 뜻을 가르는 것이다.
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm test
```

```bash
npm run build
```

```bash
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 모두 실행한다(테스트·타입/컴파일·lint 통과).
2. 아키텍처 체크리스트를 확인한다:
   - → 버튼이 plan·action 실블록과 ghost에 모두 뜨는가? 팝오버에 3개 목적지가 있는가?
   - 삭제 아이콘이 `faTrashCan`인가? ✕는 팝오버 닫기(닫기 전용)로만 쓰이는가?
   - `continueBlock`이 [동작 매트릭스]대로 분기하는가(오늘=원본유지·새 plan, 내일/날짜=기존 carry 의미)?
   - 시각 계산이 `continueLaterSpan`/`carryOverPlan`(core) 호출로 이뤄지는가(컴포넌트 인라인 계산 없음)?
   - i18n en·ko 키가 둘 다 채워졌는가?
   - 모든 변경이 낙관적 mutation을 유지하는가?
3. 결과에 따라 `phases/13-continue-later/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "→ 목적지 팝오버(오늘/내일/날짜) plan·action·ghost에 배선, 삭제 아이콘 faTrashCan, i18n en/ko. continueBlock가 매트릭스대로 분기"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 중단
