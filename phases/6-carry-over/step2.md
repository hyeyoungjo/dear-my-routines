# Step 2: auto-carry-sweep

날짜 경계 자동 이월(PRD-4: "미완료 task는 다음 날 Plan에 **자동으로** 떠오른다")과
이월된 블록의 시각 표시(점선 + 🔁 carryCount 뱃지)를 만든다.

## 읽어야 할 파일

먼저 아래를 읽고 맥락을 파악하라:

- `/docs/ADR.md` — ADR-009(자동 이월, `carryCount`는 조용한 백그라운드 메타데이터 — UX 부담 0), ADR-013, ADR-007.
- `/docs/PRD.md` — 핵심기능 4(자동 이월), 7(이월 횟수가 "이건 subproject격 task다"의 신호).
- `CLAUDE.md` — CRITICAL: 낙관적 업데이트, 비즈니스 로직 분리.
- `src/core/time/carry.ts` — **step 0.** `findOverdueUncarried(nodes, today)`, `carryOverNode(node, toDate)`.
- `src/components/calendar/CalendarBlock.tsx` — **step 1에서 수정됨**(dropped 제거, ✕=이월). 블록 렌더. 여기에 carried 표시를 추가한다.
- `src/hooks/nodes.ts` — `useNodes()`(쿼리), `useUpdateNode()`. `UpdateNodeInput`에 `fromHistory?: boolean`이 있고, `true`면 undo 스택에 기록되지 않는다(`useOptimisticNodeMutation`의 `onSuccess` 참고).
- `src/components/date.tsx` — `useSelectedDate()`, `startOfDay`. 트리거를 어디서 마운트할지 판단.
- `src/app/page.tsx` — 최상위 클라이언트 트리. sweep 훅을 마운트할 자리.

이전 step들에서 만든 `carry.ts`와 수정된 `CalendarBlock.tsx`를 먼저 읽어라.

## 작업

1. **자동 이월 sweep** — 앱이 켜질 때(오늘 기준) 지난 미완료 task를 오늘로 끌어온다:
   - 새 훅 `src/hooks/useCarryOverSweep.ts`(또는 동등한 위치)를 만든다. `useNodes()`로 노드를 읽고, 로드 완료 후 **딱 한 번** `findOverdueUncarried(nodes, startOfDay(new Date()))`를 구해, 각 노드를 `updateNode.mutate({ id, patch: carryOverNode(node, today), fromHistory: true })`로 이월한다.
   - `src/app/page.tsx`(또는 적절한 client 컴포넌트)에서 이 훅을 마운트한다.
2. **carried 시각 표시** (`CalendarBlock.tsx`):
   - `status === "carried"`인 블록은 **점선 테두리**로 그린다(계획됐지만 아직 안 한, 미뤄온 일).
   - `carryCount > 0`이면 작은 **🔁{carryCount} 뱃지**를 블록에 붙인다(예: `🔁2`). 조용한 메타데이터이므로 시각적으로 과하지 않게.

핵심 규칙:

- **멱등성(가장 중요).** sweep은 앱이 열릴 때마다 돌 수 있다. `carryCount`가 폭증하면 안 된다. 두 겹으로 막는다:
  1. `findOverdueUncarried`가 이미 오늘인 노드를 제외하므로(step 0), 한 번 옮겨진 노드는 다음 실행에서 대상이 아니다.
  2. 그래도 effect가 같은 마운트에서 중복 실행되지 않도록 **1회 가드**(예: `useRef` 플래그, 또는 nodes가 처음 성공 로드된 시점에만)를 둔다. React Strict Mode의 이중 마운트에도 한 번만 돌아야 한다.
- **자동 sweep은 undo에 기록하지 않는다.** `fromHistory: true`로 보낸다. 이유: 사용자가 직접 한 동작이 아니라 시스템이 조용히 정리한 것이라, Cmd+Z로 되돌릴 대상이 아니다(ADR-009 "UX 부담 0").
- **낙관적 업데이트 보존.** 직접 `fetch` 금지, `useUpdateNode` 파이프라인 사용.

## Acceptance Criteria

```bash
npm run build
```
```bash
npm test
```
```bash
npm run lint
```

## 검증 절차

1. 위 AC를 한 줄씩 실행한다(모두 통과).
2. `npm run dev`로 수동 확인: 어제 날짜에 미완료(actual 없는) task를 만들어 두고, 오늘로 이동하면 그 task가 오늘 grid에 점선 + 🔁 뱃지로 떠오르는지. **앱을 새로고침해도 `carryCount`가 한 번만 증가하는지**(멱증 확인 — 새로고침 여러 번 후에도 뱃지 숫자가 안 늘어야 함).
3. 아키텍처 체크리스트:
   - 멱등성이 지켜지는가(carryCount 폭증 없음)?
   - 자동 sweep이 undo 스택을 오염시키지 않는가(`fromHistory: true`)?
   - 낙관적 업데이트를 썼는가?
4. 결과에 따라 `phases/6-carry-over/index.json`의 step 2를 업데이트한다(성공 시 `summary`에 sweep 훅 위치와 carried 렌더 방식을 적는다).

## 금지사항

- sweep을 `useEffect` 안에서 가드 없이 돌리지 마라. 이유: Strict Mode 이중 마운트·재렌더로 같은 노드가 여러 번 이월돼 `carryCount`가 폭증한다(데이터 무결성 위반).
- 자동 sweep을 `fromHistory: true` 없이 보내지 마라. 이유: 사용자가 의도하지 않은 시스템 정리가 undo 히스토리를 더럽힌다.
- 이월 날짜·carryCount 산술을 컴포넌트/훅에서 직접 하지 마라. `carry.ts`에 위임하라. 이유: 단일 진실원.
- 기존 테스트를 깨뜨리지 마라.
