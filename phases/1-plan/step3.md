# Step 3: plan-panel

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: UI 텍스트 영어, 로직 `core/`/hooks 분리, 부드러운 UX, Client Component)
- `/docs/PRD.md` (Plan 패널: 트리로 할 일, 예상 시간, 빅3)
- `/docs/ARCHITECTURE.md`, `/docs/ADR.md` (ADR-004 Plan, ADR-009 트리)
- `/src/core/tree/` (step0), `/src/app/api/nodes/` (step1), `/src/hooks` 또는 `/src/services` (step2 훅)
- `/src/components/panels/PlanPanel.tsx` (step0-foundation의 빈 버전 — 이걸 채운다)

## 목표
Plan 패널을 **실제로 동작**하게 만든다. 트리로 할 일을 적고/표시하고, 예상 시간을 넣고,
빅3를 고른다. step2의 훅을 호출하며, 모든 변경은 낙관적 업데이트로 즉시 반영된다.
**드래그/리사이즈/타이머는 이 step 범위가 아니다(phase 2).**

## 작업

### 1. PlanPanel 구현 (`src/components/panels/PlanPanel.tsx`)
- `useNodes`로 트리를 가져와 렌더한다 (Client Component).
- 트리는 **재귀 컴포넌트**로 들여쓰기 표시 (Area > Project > Task > Subtask, 임의 깊이).
- 각 노드 행:
  - **제목 인라인 편집** (클릭/포커스 시 수정 → `useUpdateNode`).
  - **예상 시간**(`estimate_minutes`) 입력.
  - **빅3 토글**(별 아이콘 등, `is_big3`).
  - **자식 추가** 버튼(하위 node 생성, `parent_id`/`type` 지정) + **삭제** 버튼(`useRemoveNode`).
- 최상위에 "프로젝트 추가" 같은 진입점.

### 2. 트리 컴포넌트
- 재귀 렌더 컴포넌트를 `src/components/`에 둔다. 깊이에 따라 들여쓰기.

### 3. 규칙
- **모든 UI 텍스트 영어** (CLAUDE.md).
- 비즈니스 로직은 `core/tree`·step2 훅을 호출만 — 패널 안에 새로 구현하지 마라.
- Tailwind로 깔끔하게, 최소한의 스타일.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고, Plan 패널이 nodes 트리를 렌더하며 추가/편집/삭제/빅3가 동작해야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - PlanPanel이 `useNodes`로 트리를 렌더하는가? (재귀, 들여쓰기)
   - 제목 인라인 편집 / 예상시간 / 빅3 토글 / 추가 / 삭제가 step2 mutation으로 동작하는가?
   - UI 텍스트가 전부 영어인가?
   - 로직을 패널에 중복 구현하지 않고 `core/tree`·훅을 쓰는가?
   - `build`가 통과하는가?
3. `phases/1-plan/index.json`의 step 3을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 드래그/리사이즈/타이머/실제시간을 만들지 마라. 이유: phase 2 범위다. 이 step은 트리 CRUD + 예상시간 + 빅3까지.
- Act/Review 패널을 건드리지 마라. 이유: 범위 밖.
- UI 텍스트에 한글을 쓰지 마라. 이유: 이 프로젝트 UI는 영어(CLAUDE.md).
- 비즈니스 로직을 패널에 새로 구현하지 마라 — `core/tree`·step2 훅 재사용. 이유: 단일 출처/재사용.
- `.claude/settings.json`에 Stop 훅을 추가하지 마라. 이유: dev 서버와 충돌(확인된 문제).
- 인증/미들웨어/기존 테스트를 깨뜨리지 마라.
