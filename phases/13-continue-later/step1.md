# Step 1: core-continue

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (디렉토리 구조 — 순수 로직은 `src/core/`)
- `/docs/ADR.md` (특히 **ADR-027** — step 0에서 추가됨. 이 기능의 결정·동작 매트릭스가 담겨 있다)
- `src/core/time/calendar.ts` (`Span` 타입, `DEFAULT_GRID_END_HOUR`, `SNAP_MINUTES`, `MIN_BLOCK_MINUTES`,
  `snapMinutes` 등 — 재사용할 상수/헬퍼)
- `src/core/time/plan.ts` (여기에 함수를 추가한다. 기존 `planSpan`, `carryOverPlan`, `shiftPlan` 패턴을 본다)
- `src/core/time/carry.ts` (`shiftSpanOntoGridDay` — 벽시계·길이 유지 shift)
- `src/core/time/plan.test.ts` (테스트를 여기에 추가한다. 기존 테스트 스타일을 따른다)

이 step은 **순수 로직 + 테스트만** 담당한다. React/DB/네트워크 코드는 절대 넣지 마라 (CLAUDE.md CRITICAL:
비즈니스 로직은 `src/core/` 순수 함수). CLAUDE.md CRITICAL: 시간 계산은 **테스트를 먼저/함께** 작성한다(TDD).

## 작업

### 1. `continueLaterSpan` 추가 — `src/core/time/plan.ts`

"오늘 이따가 이어하기"가 만들 새 plan 블록의 **span(시각 범위)** 을 계산하는 순수 함수. 시그니처:

```ts
/**
 * The span for a "continue later today" plan block: placed one gap after the
 * source block's END (block-relative, NOT now-relative — this is called from
 * both plan and action blocks, and a plan block is unrelated to wall-clock now).
 * Default 60-minute gap + 60-minute block. Clamped so the block's end never
 * exceeds the grid window end for `day`.
 */
export function continueLaterSpan(
  sourceEnd: Date,
  day: Date,
  gridEndHour?: number,       // default DEFAULT_GRID_END_HOUR
  gapMinutes?: number,        // default 60
  durationMinutes?: number,   // default 60 (일관성: CalendarGrid의 DEFAULT_BLOCK_MINUTES와 같은 값)
): Span
```

배치 규칙 (우선순위 순서대로 적용):

1. `start = snap(sourceEnd + gapMinutes)` — `SNAP_MINUTES`(15분)의 가장 가까운 배수로 스냅.
2. `end = start + durationMinutes`.
3. **그리드 끝 clamp**: `day`의 그리드 윈도우 끝 = `자정(day) + gridEndHour*3_600_000`ms. `end`가 이걸
   넘으면 길이를 유지한 채 뒤로 밀어 `end = windowEnd`, `start = windowEnd - durationMinutes`.
4. **과거 방지**: 3의 clamp로 `start < sourceEnd`가 되면 `start = sourceEnd`, `end = start + durationMinutes`
   (이 경우 end가 윈도우를 약간 넘을 수 있으나, 이어할 블록이 원본보다 앞서는 것보다 낫다 — 드문 엣지).

`Date`는 로컬 시각 기준(`day.ts`의 `startOfDay` 등과 동일 규약). 벽시계·길이 유지 로직이 이미
`carry.ts`에 있으니 필요하면 재사용하고, 새 규칙(스냅·clamp)만 여기서 구현한다.

### 2. 테스트 — `src/core/time/plan.test.ts`

`continueLaterSpan`에 대해 최소 아래 케이스를 **먼저** 작성하고 통과시켜라 (값은 `gridEndHour=24` 기준):

- **정상 배치**: `sourceEnd = 14:00` → `start = 15:00`, `end = 16:00`.
- **스냅**: `sourceEnd = 14:07` → `sourceEnd+60 = 15:07` → 15분 스냅 → `start = 15:00`, `end = 16:00`.
- **그리드 끝 clamp**: `sourceEnd = 22:30` → `+60 = 23:30`, end `00:30`(다음날) > 윈도우끝(24:00) →
  `start = 23:00`, `end = 24:00`.
- **커스텀 gap/duration**: `gapMinutes`·`durationMinutes`를 넘겼을 때 반영되는지 1개.

### 3. (선택) `carryOverPlan` 회귀 테스트

`carryOverPlan(plan, toDate)`는 **이미 임의 날짜를 받으므로 수정하지 마라**. 다만 "내일이 아닌 임의
미래 날짜"로도 올바르게 동작함을 보장하는 회귀 테스트를 1개 추가해도 좋다(원본 `missedPatch.status ===
"missed"`, `nextPlan.date === dayKey(toDate)`, 벽시계 시각 유지).

## 금지사항

- `carryOverPlan`·`shiftSpanOntoGridDay`의 시그니처나 동작을 바꾸지 마라. 이유: "내일/특정 날짜"는 이들을
  그대로 재사용한다. 바꾸면 sweep(`useCarryOverSweep`)·ghost carry 등 기존 호출부가 깨진다.
- `src/core/`에 React/DB/fetch를 넣지 마라. 이유: CLAUDE.md CRITICAL — core는 순수 함수여야 모바일 재사용·
  테스트가 가능하다.
- 남은 분량(잔여 시간)을 계산해 옮기는 로직을 만들지 마라. 이유: ADR-013/018 "파생값 저장/계산 안 함" —
  "오늘 이따가"는 고정 길이 새 조각을 추가할 뿐이다(ADR-027).
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm test
```

```bash
npm run build
```

## 검증 절차

1. 위 AC 커맨드를 실행한다 (`npm test` = 신규 + 기존 테스트 전부 통과, `npm run build` = 타입/컴파일 통과).
2. 아키텍처 체크리스트를 확인한다:
   - `continueLaterSpan`이 `src/core/time/plan.ts`에 있고 순수 함수인가(부작용·import된 React/DB 없음)?
   - 테스트가 정상/스냅/clamp 케이스를 덮는가?
   - `carryOverPlan`을 수정하지 않았는가?
3. 결과에 따라 `phases/13-continue-later/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "core/time/plan.ts에 continueLaterSpan 추가(블록끝+60, 60분, 그리드끝 clamp) + plan.test.ts 테스트. carryOverPlan 무변경"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
