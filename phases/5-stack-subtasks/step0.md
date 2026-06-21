# Step 0: stack-layout

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 로직 `core/` 분리, 부드러운 UX)
- `/docs/ADR.md` (ADR-009 임의 깊이, ADR-004 캘린더)
- `/src/core/time/calendar.ts`(+test) — `childOffsetPx`, `blockPixelHeight` (현재 시간-위치 기반)
- `/src/components/calendar/CalendarBlock.tsx`, `/src/components/calendar/CalendarGrid.tsx`

## 문제
subtask가 **시간 위치**에 배치되면서 각자 **제목 헤더(headerPx)** 를 가져, 순차로 붙은 두
subtask가 항상 헤더 높이만큼 겹친다 (박스 높이 = 헤더 + 길이 > 시간 간격 = 길이). 패딩으로는
못 고치는 구조적 문제.

## 목표
subtask를 시간 위치가 아니라 **시간순으로 정렬해 박스 높이만큼 누적 stack** 한다 — 겹침 0.
각 subtask의 height는 자기 예상시간을 반영(시간 블록 의미 유지)하되, 세로 위치는 형제들 사이
순서로 쌓는다. 정확한 벽시계 위치는 **최상위(task) 블록**만 갖는다.

## 작업
### 1. 누적 stack 계산 (`src/core/time/calendar.ts`, 순수 + 테스트 갱신)
- `childOffsetPx`를 **누적 기반**으로: 한 자식의 top = `headerPx + 앞선 형제들의 blockPixelHeight
  합 + (형제 수)*GAP`. (시간이 아니라 형제 순서로 쌓음. 형제는 시작 시각 순으로 정렬.)
  시그니처를 형제 배열/인덱스를 받도록 바꾸거나, 형제 누적 높이를 주는 헬퍼를 추가한다.
- `blockPixelHeight`(부모) = `headerPx + Σ(자식 blockPixelHeight) + (자식 수)*GAP`.
  자식이 없으면 `headerPx + 자기_분*pxPerMinute`(자기 길이).
- `GAP`(블록 사이 간격) 상수를 `core/time`에 둔다.
- **기존 테스트를 새 누적 공식에 맞게 갱신**하고, 케이스 추가(자식 2개가 안 겹치는지 = 둘째 top ≥
  첫째 top + 첫째 높이 + GAP).

### 2. 컴포넌트 적용
- `CalendarBlock`이 자식을 **시작 시각 순 정렬 → 누적 top**으로 렌더(위 헬퍼 사용). 더 이상 자식
  top을 시간 비례로 두지 않는다.
- 최상위 블록의 그리드 위치(top = 시작 시각 px)와 높이(blockPixelHeight)는 유지.
- 드래그/리사이즈: 최상위 블록의 시간 이동/길이 변경은 그대로. 자식의 길이 리사이즈는 height에
  반영되고 stack이 재계산되면 된다(시각 위치 드래그는 stack이라 의미가 줄어드니, 자식은 길이
  리사이즈 위주로 동작해도 무방 — 기존 동작을 깨지 않는 선에서).

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드·테스트 통과. `core/time` 누적 stack 테스트(자식들이 안 겹침)가 통과해야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `core/time`이 누적 stack으로 바뀌고 "자식 2개 비-겹침" 테스트가 있는가?
   - CalendarBlock이 자식을 시작 시각 순 + 누적 top으로 렌더하는가?
   - 부모가 헤더 + 자식 전체 + 간격을 감싸는가? (안 잘림)
   - build/test 통과?
3. `phases/5-stack-subtasks/index.json`의 step 0을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 시간/높이 계산을 컴포넌트에 흩지 마라 — `core/time` 순수 함수 + 테스트. 이유: 단일 출처(CLAUDE.md CRITICAL).
- 기능을 빼지 마라 (subtask 생성/삭제/placeholder/예상-실제 유지).
- UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지. 기존 인증/테스트 깨뜨리지 마라.
