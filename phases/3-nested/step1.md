# Step 1: nested-drag

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 부드러운 UX/낙관적, 로직 `core/` 분리)
- `/docs/ADR.md` (ADR-007, ADR-009)
- step0 산출물: 재귀 `CalendarBlock`, `core/time/calendar.ts`(clampChildToParent/fitParentToChildren),
  `src/hooks/nodes.ts`, step2-calendar의 드래그/리사이즈 로직(moveBlock/resizeBlockEnd/snapMinutes)

## 목표
중첩된 subtask 블록도 **드래그 이동 + 외곽 리사이즈**가 되게 한다. 자식은 부모 범위 안으로
**clamp(A)** 하되, 자식이 부모를 넘치면 **부모가 자동 확장**된다(step0의 fitParentToChildren).

## 작업
### 1. 중첩 드래그/리사이즈
- step2-calendar의 dnd-kit 드래그/리사이즈를 **자식 블록에도** 적용. 깊이·컬럼이 섞이지 않게
  dnd-kit id를 컬럼+노드로 네임스페이스.
- 15분 스냅, 낙관적 업데이트(`useUpdateNode`), 라이브 미리보기 — step2와 동일 감각.

### 2. clamp + 부모 자동 확장
- 자식 드래그/리사이즈 결과를 `clampChildToParent`로 부모 안에 제한.
- 자식이 부모 끝을 넘기면 `fitParentToChildren`로 **부모 `plannedEnd`(필요 시 start)도 함께
  갱신** (낙관적). 즉 자식을 부모 밖으로 끌면 부모가 늘어나 감싼다.
- 부모가 늘어나면 그 부모의 부모도 연쇄적으로 fit (재귀, 임의 깊이).

### 3. Plan·Action 둘 다
- 예상(plannedStart/End)과 실제(actualStart/End) 컬럼 모두에서 동작.

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드 통과, 중첩 블록 드래그/리사이즈가 동작하고, 자식이 부모를 넘치면 부모가 따라 늘어나야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - subtask 블록을 드래그 이동/리사이즈할 수 있는가? (15분 스냅, 낙관적)
   - 자식이 부모 범위로 clamp되는가?
   - 자식이 부모를 넘치면 부모(및 상위)가 자동 확장돼 감싸는가?
   - 예상·실제 컬럼 모두 동작하는가?
   - build 통과?
3. `phases/3-nested/index.json`의 step 1을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 서버 응답 대기로 UI를 멈추지 마라(낙관적). 트리/시간 로직 재구현 금지 — `core/` 재사용.
- AI/리뷰는 만들지 마라(phase 4+). UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지.
- 기존 테스트/캘린더/인증 깨뜨리지 마라.
