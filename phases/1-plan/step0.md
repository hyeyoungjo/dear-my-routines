# Step 0: core-tree

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 비즈니스 로직을 UI에서 분리 → `core/`, TDD 지향, OS 비종속)
- `/docs/ARCHITECTURE.md` (`core/tree` 위치, `nodes` 데이터 모델)
- `/docs/ADR.md` (ADR-009 유연한 트리 모델)
- `/src/db/schema.ts` (step0-foundation에서 만든 `nodes` 테이블 + 추론 타입)

## 목표
"할 일 트리"를 다루는 **순수 함수**와 타입을 `src/core/tree/`에 만든다. **화면도 DB도
네트워크도 없이** 로직만 — 입력을 받아 새 값을 반환하는 순수 함수. 이래야 단위 테스트가
쉽고, 나중에 모바일에서도 그대로 재사용한다(CLAUDE.md CRITICAL).

`nodes`는 self-referencing flat 테이블(각 행이 `id`, `parent_id`)인데, UI는 중첩 트리로
다뤄야 한다. 이 step은 그 둘 사이를 오가는 변환 + 트리 조작을 담당한다.

## 작업

### 1. 타입 (`src/core/tree/types.ts` 또는 `src/types`)
- DB의 flat node 타입은 `src/db/schema.ts`의 추론 타입(`InferSelectModel<typeof nodes>`)을
  재사용한다. 그것을 가리키는 별칭(예: `FlatNode`)을 둔다.
- 중첩용 타입: `TreeNode = FlatNode & { children: TreeNode[] }`.

### 2. 순수 함수 (`src/core/tree/`)
모두 **순수**(입력을 변형하지 말고 새 값 반환). 시그니처 수준 예시:
- `buildTree(nodes: FlatNode[]): TreeNode[]` — flat 배열을 `parent_id`/`sort_order` 기준으로
  중첩 트리로. 최상위는 `parent_id == null`.
- `flattenTree(tree: TreeNode[]): FlatNode[]` — 트리를 다시 flat으로 (역변환).
- `addNode(nodes, newNode): FlatNode[]` — 노드 추가.
- `removeNode(nodes, id): FlatNode[]` — 노드 + **그 모든 자손**을 제거.
- `moveNode(nodes, id, newParentId, newIndex): FlatNode[]` — 부모 변경 + 형제 내 위치 변경
  (`sort_order` 재계산). 순환(자기 자손 밑으로 이동) 금지 — 그 경우 변경 없이 원본 반환.
- `reorderSiblings(nodes, parentId, orderedIds): FlatNode[]` — 같은 부모 자식들의 순서 재배열.
- 깊이가 임의로 깊을 수 있다(ADR-009). 재귀로 처리하라.

### 3. 테스트 (`src/core/tree/*.test.ts`) — TDD
각 함수에 Vitest 테스트를 작성한다. 최소 케이스:
- `buildTree`/`flattenTree`가 서로 역(round-trip)인지.
- `removeNode`가 자손까지 지우는지.
- `moveNode`가 순환을 거부하는지, `sort_order`가 맞는지.
- 빈 입력·단일 노드 같은 경계.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run test
npm run build
```
`src/core/tree`의 테스트가 실제로 존재하고 통과해야 한다 (`--passWithNoTests`에 기대지 말 것).

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `src/core/tree/`에 함수 + 테스트가 있는가?
   - 함수가 React/DB/네트워크를 import하지 않는 **순수 함수**인가?
   - `buildTree`/`flattenTree` round-trip, `removeNode` 자손 제거, `moveNode` 순환 거부가
     테스트로 검증되는가?
3. `phases/1-plan/index.json`의 step 0을 업데이트한다:
   - 성공 → `"completed"` + `"summary"`(만든 함수·파일 요약)
   - 3회 실패 → `"error"` + `"error_message"`
   - 사용자 개입 필요 → `"blocked"` + `"blocked_reason"`

## 금지사항
- `src/core/tree`에서 React, Drizzle, fetch, Supabase 등을 import하지 마라. 이유: 순수
  로직만 둬야 테스트·재사용이 가능하다(CLAUDE.md CRITICAL).
- DB 쿼리나 API(Route Handler)를 만들지 마라. 이유: step1(nodes-api) 범위다.
- UI 컴포넌트를 만들지 마라. 이유: step3(plan-panel) 범위다.
- `.claude/settings.json`에 Stop 훅을 추가하지 마라. 이유: dev 서버와 충돌(확인된 문제).
- 기존 테스트를 깨뜨리지 마라.
