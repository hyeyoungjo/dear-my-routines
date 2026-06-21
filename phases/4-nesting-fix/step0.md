# Step 0: block-layout

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 로직 `core/` 분리, 부드러운 UX, Client Component)
- `/docs/ADR.md` (ADR-009 임의 깊이 트리, ADR-007 UX)
- `/src/components/calendar/CalendarGrid.tsx`, `/src/components/calendar/CalendarBlock.tsx`
- `/src/core/time/calendar.ts`(+test) — 시간/픽셀 계산 순수 함수

## 문제 (스크린샷으로 확인됨)
중첩 캘린더에서 **부모 task 블록이 subtask를 감싸지 못하고 subtask가 블록 밖으로 넘쳐
잘린다.** 원인: 블록을 `[제목 헤더] + [자식영역(flex-1)]`으로 나눴는데 제목 헤더가
**시간 비례 공간을 잠식**해, 자식영역이 부모의 시간 span보다 작아진다. 게다가 자식 위치가
**부모 높이 기준 %**라, 헤더 잠식분이 깊은 중첩마다 누적돼 더 어긋난다.

## 목표
픽셀 기반으로 레이아웃을 재계산해, **제목을 가리지 않으면서 부모가 제목 + 자식 전체를
정확히 감싸도록** 한다 (임의 깊이, Plan·Action 둘 다).

## 작업
### 1. 픽셀 기반 높이 계산 (`src/core/time/calendar.ts`, 순수 + 테스트)
- 상수 `HEADER_PX`(제목 줄 고정 높이)와 `pxPerMinute`를 받아, 한 블록의 **전체 픽셀 높이**를
  계산하는 순수 함수: `blockPixelHeight(block, pxPerMinute, HEADER_PX)` =
  `HEADER_PX + (자식들을 감싼 시간 span 분)*pxPerMinute`, 자식은 재귀로 더함.
  (자식이 없으면 `HEADER_PX + ownMinutes*pxPerMinute`.)
- 자식의 **세로 오프셋(px)**: 부모 헤더 아래에서 시작해, 자식 시작 시각에 비례한 위치
  (`HEADER_PX + (childStart - parentStart)분 * pxPerMinute`).
- 이 함수들에 Vitest 테스트 (자식 없음 / 자식이 부모 초과 / 다단계 중첩).

### 2. CalendarBlock을 픽셀 기반으로
- `pxPerMinute`(+`HEADER_PX`)를 `CalendarGrid`에서 prop으로 받는다 (이미 grid에 PX_PER_MINUTE 있음).
- 자식 블록을 `%` 대신 **px**로 배치(top/height = 위 순수 함수 결과). 블록 전체 높이 =
  `blockPixelHeight(...)`. 제목 헤더는 고정 높이(`HEADER_PX`), 자식은 그 아래 영역에.
- 재귀적으로 부모가 자식+헤더를 감싸므로 어떤 깊이에서도 잘리지 않는다.

### 3. 그리드 정렬
- top-level 블록의 그리드 위치(`top` = 시작 시각 px)는 유지. 블록 높이만 `blockPixelHeight`로.
- 드래그/리사이즈(step 2/3-calendar 로직)는 그대로 동작해야 한다 — 분↔px 변환만 바뀜.

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드·테스트 통과, `core/time`의 새 픽셀 높이 함수 테스트 통과. (시각 확인은 사용자가 dev에서.)

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `blockPixelHeight`/자식 오프셋이 순수 함수 + 테스트로 검증되는가?
   - CalendarBlock이 자식을 px로 배치하고, 부모 높이가 `제목 + 자식 전체`를 감싸는가?
   - 제목이 자식에 가려지지 않는가?
   - 드래그/리사이즈가 여전히 동작하는가? build 통과?
3. `phases/4-nesting-fix/index.json`의 step 0을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 시간/높이 계산을 컴포넌트에 흩지 마라 — `core/time` 순수 함수로. 이유: 테스트·단일 출처(CLAUDE.md CRITICAL).
- 기능을 빼지 마라 (subtask 생성/삭제/드래그/리사이즈/placeholder 유지).
- UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지. 기존 테스트 깨뜨리지 마라.
