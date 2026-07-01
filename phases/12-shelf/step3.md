# Step 3: task-hooks-sweep

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026**, ADR-009/015/017(자동 이월 sweep), ADR-007(낙관적 업데이트+rollback)
- `/CLAUDE.md` — CRITICAL: 데이터 변경은 낙관적 업데이트, 실패 시 rollback
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts` — `useUpdateTask`(이미 존재: `Partial<Task>` 낙관적 PATCH), `UpdateTaskInput`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/useCarryOverSweep.ts` — 자동 이월 sweep 전체
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/planBlocks.ts` — `useAddPlanBlock`, `usePlanBlocks`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/plan.ts` — `findOverduePlans(plans, today, doneTaskIds)` (제외 Set을 받는다)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/shelf.ts` — step 1에서 만든 `shelvedTaskIds`, `freshPlanToday`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts`의 `useTasks` — task 목록 캐시

## 작업

내려놓은(shelved) task가 **자동 이월에서 빠지게** 하고, shelf 토글 mutation을 노출한다.

1. **sweep에서 shelved task 제외** — `src/hooks/useCarryOverSweep.ts`:
   - `useTasks()`로 task 목록을 가져온다(이미 다른 곳에서 쓰는 훅 재사용).
   - **세 리스트(plans, actions, tasks)가 모두 로드된 뒤에만** sweep을 실행하도록 가드를 확장한다.
     이유: tasks가 없으면 어떤 게 shelved인지 몰라 내려놓은 task를 다시 끌어오는 버그가 난다(기존
     "actions 없으면 done 판별 불가" 가드와 동일한 논리).
   - `shelvedTaskIds(tasks)`로 Set을 만들고, 기존 `doneTaskIds`와 **합집합**하여 `findOverduePlans`의
     세 번째 인자로 넘긴다. 즉 done이거나 shelved인 task의 plan은 끌어오지 않는다.
   - 기존 `sweptRef`(한 번만 실행) 가드와 멱등성 로직은 그대로 유지한다.

2. **shelf 토글은 기존 `useUpdateTask` 재사용** — 새 훅을 만들지 마라. `useUpdateTask`가 이미
   `{ taskId, patch: Partial<Task> }`를 낙관적으로 캐시에 머지하므로:
   - 올리기: `updateTask.mutate({ taskId, patch: { shelvedAt: new Date() } })`
   - 꺼내기: `updateTask.mutate({ taskId, patch: { shelvedAt: null } })`

   이 step에서는 **훅이 `shelvedAt` patch를 낙관적으로 처리하는지 확인만** 한다(이미 `Partial<Task>`라
   동작함). UI에서의 실제 호출은 step 5(올리기 버튼)·step 6(꺼내기)에서 한다. 단, 꺼내기는 plan 생성도
   함께 필요하므로 `useAddPlanBlock` + `freshPlanToday` 조합이 쓰인다는 점을 `useCarryOverSweep` 인접
   주석이나 본 step summary에 남겨 step 6이 참조하게 하라.

3. **낙관적 일관성 검증** — `shelvedAt`을 set/clear 했을 때 `useTasks` 캐시가 즉시 반영되고 실패 시
   rollback 되는지(기존 `useOptimisticTaskMutation` 경로) 코드로 확인한다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `useCarryOverSweep`이 (a) plans·actions·tasks 셋 다 준비된 뒤 실행되고, (b) `findOverduePlans`에
   done ∪ shelved 제외 Set을 넘기는지 코드로 확인한다.
3. 아키텍처 체크리스트: 낙관적 업데이트+rollback 유지 / sweep 멱등성(`sweptRef`) 유지 / core 순수성 유지.
4. `phases/12-shelf/index.json`의 step 3을 업데이트한다(성공 → `completed` + summary에 "un-shelve는
   step6에서 useAddPlanBlock+freshPlanToday로 오늘 plan 생성" 메모 포함, 실패 → `error`).

## 금지사항

- shelf 전용 새 mutation 훅을 만들지 마라. 이유: `useUpdateTask`가 이미 `Partial<Task>` 낙관 PATCH를 커버.
- tasks 로딩 가드 없이 sweep을 실행하지 마라. 이유: shelved 판별 불가 시 내려놓은 task를 다시 끌어오는 버그.
- `missed` 히스토리를 삭제하거나 sweep 멱등성 로직을 바꾸지 마라. 이유: ADR-018/ADR-017.
- 기존 테스트를 깨뜨리지 마라.
