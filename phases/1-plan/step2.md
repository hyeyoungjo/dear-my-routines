# Step 2: query-hooks

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 낙관적 업데이트로 즉시 갱신 + 실패 시 rollback, Client Component)
- `/docs/ARCHITECTURE.md` (상태 관리: TanStack Query, 데이터 흐름)
- `/docs/ADR.md` (ADR-007 부드러운 UX)
- `/src/core/tree/` (step0 트리 조작 함수 — 캐시 낙관적 갱신에 재사용)
- `/src/app/api/nodes/` (step1 API — 훅이 호출할 엔드포인트)

## 목표
TanStack Query로 nodes 데이터 훅을 만들고, 모든 변경에 **낙관적 업데이트**를 적용한다.
사용자가 편집하면 화면이 **서버 응답을 기다리지 않고 즉시** 갱신되고, 실패하면 rollback한다
(ADR-007, CLAUDE.md CRITICAL).

## 작업

### 1. QueryClient provider
- `npm install @tanstack/react-query`
- Client Component provider(예: `src/app/providers.tsx`, `'use client'`)에 `QueryClientProvider`를
  두고, `src/app/layout.tsx`에서 children을 감싼다.

### 2. nodes 훅 (`src/hooks/` 또는 `src/services/`)
- `useNodes()`: `GET /api/nodes`로 flat nodes를 가져온다. 필요하면 `core/tree`의 `buildTree`로
  트리로 변환해 노출(또는 flat 그대로 두고 소비처에서 변환 — 일관되게).
- mutation 훅: `useAddNode`, `useUpdateNode`, `useRemoveNode`, `useMoveNode`.
- **각 mutation에 낙관적 업데이트**:
  - `onMutate`: 진행 중인 쿼리 취소 → 이전 캐시 스냅샷 저장 → `core/tree` 함수로 캐시를 **즉시**
    갱신(예: add는 `addNode`, remove는 `removeNode`, move는 `moveNode`).
  - `onError`: 스냅샷으로 **rollback**.
  - `onSettled`: nodes 쿼리 `invalidateQueries`로 서버와 최종 동기화.

### 3. 부드러움
- 서버 응답을 기다리며 UI를 막지 마라. 낙관적 갱신이 핵심 경험이다.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
```

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `QueryClientProvider`가 layout에 적용되었는가?
   - `useNodes` + add/update/remove/move mutation 훅이 있는가?
   - 각 mutation이 `onMutate`(즉시 갱신) + `onError`(rollback) + `onSettled`(invalidate)를 갖는가?
   - 캐시 조작에 step0의 `core/tree` 함수를 재사용하는가? (로직 중복 금지)
   - `build`가 통과하는가?
3. `phases/1-plan/index.json`의 step 2를 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 서버 응답을 기다리며 UI를 멈추지 마라(비낙관적). 이유: 부드러운 UX(CLAUDE.md CRITICAL).
- 트리 조작 로직을 훅 안에 새로 구현하지 마라 — step0 `core/tree`를 재사용하라. 이유: 단일 출처.
- UI 컴포넌트(Plan 패널)를 만들지 마라. 이유: step3 범위다. 훅까지만.
- `.claude/settings.json`에 Stop 훅을 추가하지 마라. 이유: dev 서버와 충돌(확인된 문제).
- 기존 테스트를 깨뜨리지 마라.
