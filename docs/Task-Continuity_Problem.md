# Task Continuity Problem (작업 연속성 문제)

> 이 문서는 **해결책 확정이 아니라 문제 정의**다. 하나의 "할 일(task)"이 여러 날에 걸쳐
> [처음 계획 → 못 해서 미룸(반복) → 실제 실행]되는 **연속성**을 데이터·UI로 어떻게
> 표현할지가 반복적으로 어긋나 왔다. 다음 작업에서 한 번에 제대로 고치기 위한 기반 문서.
> 관련: ADR-009, ADR-013, ADR-014.

---

## 1. 한 줄 요약

**한 task는 "정체성은 하나(통계 단위)"인데 "시간 배치는 여러 날·여러 시점으로 흩어진다".**
이 1:N을 어떻게 묶고(통계) 펼칠지(날짜별 표시·수정)가 핵심이고, 여기서 계속 설계가 어긋났다.

## 2. 핵심 개념 — 한 task가 갖는 시점들

사용자가 명명한 날짜 축:

| 이름 | 의미 | 성질 |
|---|---|---|
| **Plan original date** | 처음 계획한 날 | 보존 + **수정 가능** |
| **Plan revised date** | 미룰 때마다 갱신되는 현재 목표 날 | 매번 갱신 |
| **(거쳐온 날들)** | original ~ revised 사이, 매일 "계획했지만 못함" | **전부 보존**(리뷰의 핵심) |
| **Plan executed date** (= actual) | 실제로 실행한 날 | 따로 기억, 없으면 찍어서 생성 |

이 시점들이 **한 task에 공존**하며, **각각 독립적으로 보존·수정·표시**되어야 한다.
거쳐온 날은 흐릿한 읽기전용 흔적이 아니라 **그날에 그대로(평소처럼) 보이고 따로 수정 가능**해야 한다.

### 왜 거쳐온 날 보존이 중요한가
제품의 핵심 가치가 **"예상 vs 실제로 과소예측 교정"**(PRD)인데, 이월로 과거 날의 계획 기록이
사라지면 *"그날 1.5h 계획했는데 0h 했다(못함)"* 는 **증거가 과거에서 증발**한다. 데일리 리뷰가
"그날 뭘 계획했고 못 넘겼나"를 볼 수 없게 된다.

## 3. 핵심 긴장 (왜 어려운가)

1. **정체성 1 ↔ 배치 N**: 통계(예상vs실제·카테고리·성장)는 task 하나로 묶여야 하는데,
   시간 배치는 여러 날로 흩어진다.
2. **Plan ≠ Action**: 계획(언제 하려 했나)과 실제(언제 했나)는 *다른 시점·다른 데이터*인데,
   한 곳에 합치면 의미 없는 강제 비교가 생긴다.
3. **보존 ↔ 편집**: 과거 기록은 리뷰를 위해 보존돼야 하지만, 동시에 각 날을 따로 수정할 수도
   있어야 한다(읽기전용으로 막으면 안 됨).

## 4. 그동안의 시도와 실패

### Phase 6 — carry-over: "노드를 다음날로 이동"
- ✕=이월 시 노드의 `plannedStart`를 다음날로 **이동**(carryCount++).
- **실패**: 어제(original) Plan에서 task가 **사라짐**. 거쳐온 날 기록이 남지 않아 리뷰·과소예측
  증거가 증발.

### Phase 7 — carry-trace: "carryHistory + 흐릿한 그림자" (폐기됨)
- 노드는 단일 유지, 거쳐온 날을 `carryHistory`(jsonb)에 기록, 과거 날엔 흐릿한 **읽기전용 그림자**
  (`opacity-40` + "✗ not done")로 표시.
- **실패**: 사용자는 "흐릿한 그림자"가 아니라 **각 날에 그대로 + 따로 수정 가능**을 원했다.
  읽기전용이 요구와 정면으로 불일치 → `feat-7-carry-trace` 폐기.

### carry-v2 (현재 `feat-7-carry-v2`) — "task_blocks: 한 행에 plan+actual"
- task 정체성 = `nodes`(시간 필드 제거), 날짜별 배치 = `task_blocks` 한 행
  (`node_id`, `grid_day`, `planned_start/end`, **`actual_start/end`**, `status` planned|done|missed).
- **부분 성공**: 각 날이 독립 행, original~revised는 `missed` block으로 보존, 통계는 `node_id`로 묶음.
- **남은 문제는 아래 5절** — 대부분 *plan과 actual을 한 행에 합친 데서* 비롯된다.

## 5. 현재 carry-v2의 미해결 문제

### (a) "2h → 9h" 강제 비교 라벨
- 한 `task_block`이 `planned` span과 `actual` span을 **둘 다** 들고 있어서, 둘을 비교하는 라벨이
  자동 생성된다(`CalendarGrid`의 `comparison`).
- planned(2h)와 actual(예: 9h)이 맥락 없이/거슬리게 캘린더 블록 위에 뜬다.
- **근본 원인: Plan과 Action을 한 행에 합쳤다.**

### (b) ✕로 삭제해도 박스가 남는다
- 현재 ✕ 동작이 맥락마다 다르다 (`CalendarBlock`):
  - **ghost(계획만, actual 없음)의 ✕** = **이월(carryOver)** → 이 block을 `missed`로 두고 다음날
    새 block 생성. 즉 **✕를 눌러도 박스가 `missed`로 그대로 남는다**.
  - **real 블록의 ✕** = Action이면 actual만 비우기, Plan이면 그 occurrence 삭제.
- 사용자 기대: "✕ = 삭제(박스 사라짐)". 지금은 ✕ 하나가 이월/clear/삭제를 맥락별로 해서 혼란.

### (c) undo(되돌리기)가 삭제와 충돌
- 정책: undo는 **핫키(Cmd/Ctrl+Z)로만**, **UI 버튼 없음**.
- 그런데 ✕로 지운 게 (이월로 남거나) 안 지워진 것처럼 보여 "되돌릴 게 남아있어" undo의 의미가 모호.
- **사용자 결정: undo 제거.** (현재 `src/components/undo.tsx`, `app/providers.tsx`,
  `ThemeMenu.tsx`(깊이 설정), `hooks/nodes.ts`·`hooks/blocks.ts`(`recordCommand`)에 퍼져 있음.)

## 6. 사용자가 제안한 방향

**Plan Task Data와 Action Task Data를 따로 관리한다.**

- **Plan 데이터**(계획: original / revised / 거쳐온 날들)와 **Action 데이터**(실제 실행)를 **분리**.
- 기대 효과:
  - (a) plan↔action **강제 비교(2h→9h)가 구조적으로 사라짐** — 별개 데이터라 한 블록에서 안 엮임.
  - (b) ✕ 동작이 plan/action 각각에서 **명확**해짐.
  - (c) 각 날·각 시점을 **독립 수정**하기 자연스러움.
- 예상 vs 실제 비교는 캘린더 블록 라벨이 아니라 **통계/리뷰에서 task 단위**로 한다.

## 7. 다음 작업이 만족해야 할 요구사항 (체크리스트)

- [ ] 한 task = 하나의 정체성(통계 단위). 여러 날 배치는 그것에 매달린다.
- [ ] **Plan original date**: 처음 계획일 보존 + 수정 가능.
- [ ] **Plan revised date**: 미룰 때마다 갱신, **거쳐온 모든 날 보존**(리뷰용).
- [ ] 거쳐온 각 날의 계획을 **각각 독립 수정/삭제** 가능 — 흐릿한 읽기전용 금지.
- [ ] **Plan executed date(actual)**: 실제 한 날 따로 기억, 없으면 모달에서 찍어서 **생성**.
- [ ] **Plan과 Action 데이터 분리** → 강제 비교 라벨 없음("2h→9h" 제거).
- [ ] **✕ 동작 일관**: 삭제는 삭제(박스가 실제로 사라짐). 이월은 *별도의 명시적 동작*으로 구분.
- [ ] **undo 제거**(또는 핫키 전용이되 삭제와 모순 없게).
- [ ] 모달(상세 편집) 변경은 **즉시 반영**(onBlur 의존 금지).
- [ ] 통계(예상vs실제·카테고리·성장)는 task 단위 집계로 무결.
- [ ] 부드러운 UX(낙관적 업데이트) 유지(ADR-007).

## 8. 열린 설계 질문 (다음 작업에서 결정)

> **갱신(2026-06-22) → 데이터 모델은 ADR-015에서 확정.** 핵심: `task_blocks` 한 행을 해체해
> **Task(`nodes`) / Plan(`plan_blocks`) / Action(`action_blocks`) 세 리스트로 분리**.
> Q1 = 별도 테이블(plan/action). Q2 = 날짜별 행 누적(Plan은 미룰 때마다 행, `missed`로 보존).
> Q3 = ✕는 "그 행 삭제"로 통일, 이월은 별도 명시 동작(UI는 동작 설계 단계). Q4 = action은 N행
> 가능. Q5 = carry-v2를 **진화**(정체성/배치 분리 유지, plan+actual 한 행 합침만 해체).
> 아래 원문은 사고 흐름 기록으로 보존.

1. **Plan/Action 분리를 어떻게 구현?**
   - (i) `task_blocks`에 `kind: plan | action` 컬럼을 두고 행을 분리?
   - (ii) `plan_blocks` / `action_blocks` 별도 테이블?
   - (iii) 그 외?
2. **"거쳐온 날" 표현**: 매일 행으로 누적(복제)할지, original~revised 범위로 파생할지?
   (사용자 요구는 "각 날 따로 수정 가능"이므로 **행 누적** 쪽에 가깝다.)
3. **✕ vs 이월 UI 구분**: 같은 ✕에 맥락을 줄지, 삭제(✕)와 이월(별도 버튼/제스처)을 나눌지?
4. **executed(actual)의 분할**: 하루에 다 못 해 이틀에 나눠 실행하면 actual이 여러 날일 수 있는가?
5. **carry-v2 처리**: 현재 `feat-7-carry-v2`를 **수정·진화**시킬지, 일부 되돌리고 재설계할지?
   (정체성=nodes / 배치=task_blocks 분리, original~revised 보존, 통계 묶음 등 **유지할 부분**과,
   plan+actual 한 행 합침 같은 **바꿀 부분**을 구분할 것.)

## 9. 현재 코드 상태 (다음 작업의 출발점)

- `feat-7-carry-v2` 브랜치 (main 미머지). main = phase 6(carry-over).
- `task_blocks` 테이블 + 마이그레이션 `0003` 적용, 기존 16개 task 이전 완료.
- 관련 파일: `src/db/schema.ts`(task_blocks), `src/core/time/blocks.ts`, `src/hooks/blocks.ts`,
  `src/app/api/blocks/*`, `src/components/calendar/CalendarGrid.tsx`·`CalendarBlock.tsx`,
  `src/components/calendar/NodeDetailModal.tsx`, `src/hooks/useCarryOverSweep.ts`.
- undo: `src/components/undo.tsx`, `app/providers.tsx`, `ThemeMenu.tsx`, `hooks/{nodes,blocks}.ts`.
