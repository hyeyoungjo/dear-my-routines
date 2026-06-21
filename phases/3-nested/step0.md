# Step 0: nested-render

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 로직 `core/` 분리, 부드러운 UX, UI 영어, Client Component)
- `/docs/ADR.md` (ADR-009 임의 깊이 트리), `/docs/PRD.md` (subproject격 task 감지)
- step2-calendar 산출물: `src/components/calendar/{CalendarGrid,CalendarBlock}.tsx`,
  `src/core/time/calendar.ts`(+test), `src/core/tree/`, `src/hooks/nodes.ts`, `src/db/schema.ts`

## 목표
캘린더 블록을 **재귀**로 만들어, task 블록 **안에** subtask를 **들여쓰기된 시간 블록**으로
그린다(frame-in-frame, 임의 깊이). subtask 시간은 부모 범위 안으로 **clamp(A)** 하되,
자식이 부모보다 길어지면 **부모가 자동으로 늘어난다**(이게 "subproject격 task"를 시각화).

## 작업
### 1. 부모-자식 시간 규칙 (`src/core/time/calendar.ts`, 순수 + 테스트)
- `clampChildToParent(child, parent)`: 자식 시간을 부모 [start,end] 안으로 제한.
- `fitParentToChildren(parent, children)`: 자식들의 `min(start)`~`max(end)`가 부모를 넘으면
  부모 `plannedStart/End`(또는 end만)를 확장해 자식을 감싸도록 반환 (순수). 부모가 자식을
  품도록 자동 확장하는 핵심 로직.
- 이 함수들에 Vitest 테스트 (경계: 자식 없음, 자식이 부모 초과, 정확히 일치).

### 2. 재귀 블록 렌더 (`CalendarBlock.tsx`)
- 블록이 자신의 `children`(subtask)을 **안쪽에 들여쓰기(inset, 예: 좌측 패딩 + 약간 작은 폭)**
  로 재귀 렌더. 자식도 시간 위치(top/height). 임의 깊이(ADR-009).
- 부모 블록 높이는 `fitParentToChildren` 결과를 반영 (자식이 넘치면 부모가 길어져 감싼다).
- 깊이에 따라 살짝 다른 음영/들여쓰기로 frame-in-frame이 보이게. 색은 테마 토큰.

### 3. subtask 생성
- 블록 내부 빈 영역 클릭(또는 블록의 "+ subtask") → 자식 노드 생성
  (`parentId` = 그 블록, type = 한 단계 아래, `plannedStart/End` = 부모 범위 안 기본값).
  `useAddNode`로 낙관적.

### 4. 적용
- Plan·Action 두 컬럼 모두에서 중첩 렌더 (예상/실제 둘 다).

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드 통과, `core/time` 새 함수 테스트 통과, 캘린더 블록 안에 subtask가 들여쓰기 시간 블록으로
보이고, 자식이 부모를 넘치면 부모가 늘어나야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `clampChildToParent`/`fitParentToChildren`가 순수 함수 + 테스트로 검증되는가?
   - task 블록 안에 subtask가 들여쓰기 시간 블록으로 재귀 렌더되는가? (임의 깊이)
   - 자식 합/범위가 부모를 넘으면 부모 블록이 자동 확장돼 감싸는가?
   - 블록 안에서 subtask를 생성할 수 있는가? (낙관적)
   - UI 영어, build 통과?
3. `phases/3-nested/index.json`의 step 0을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 중첩 드래그/리사이즈는 만들지 마라. 이유: step1 범위다. 이 step은 렌더 + 생성 + 자동확장.
- 시간/트리 로직을 컴포넌트에 새로 구현하지 마라 — `core/time`·`core/tree`·hooks 재사용.
- UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지. 기존 테스트/캘린더 깨뜨리지 마라.
