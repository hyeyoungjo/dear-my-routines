# Step 5: nodes-cleanup

점진 전환의 마지막 — 이제 아무도 읽지 않는 `nodes`의 **레거시 시간 컬럼을 제거**한다.
모든 시간/상태/이월 데이터는 `task_blocks`로 옮겨졌으므로(step 0~4), `nodes`는 task 정체성과
트리·통계 단위로만 남는다(ADR-014).

## 읽어야 할 파일

- `/docs/ADR.md` — **ADR-014**(nodes는 정체성·통계 단위, 시간은 task_blocks), ADR-013.
- `CLAUDE.md` — 마이그레이션 OS 비종속, 인코딩 명시.
- `src/db/schema.ts` — `nodes`의 제거 대상 컬럼: `plannedStart`/`plannedEnd`/`actualStart`/`actualEnd`/`plannedDate`/`status`/`actualMinutes`/`carryCount`. **`estimateMinutes`·`category`·`color`·`isBig3`·트리(`parentId`)·`title`/`notes`/`links`/`sortOrder`는 남긴다**(통계·정체성).
- `src/core/time/blocks.ts`, `src/hooks/blocks.ts`, `src/components/calendar/*`, `src/components/calendar/NodeDetailModal.tsx`, `src/hooks/useCarryOverSweep.ts` — **step 1~4에서 task_blocks로 전환됨.** 레거시 컬럼을 아직 참조하는 곳이 없는지 확인.
- `src/hooks/nodes.ts`, `src/app/api/nodes/[id]/route.ts`, `src/app/api/nodes/route.ts` — `AddNodeInput`/`parsePatchInput`/`optimisticNode`에서 레거시 시간 필드를 빼야 한다.
- `drizzle.config.ts` — 마이그레이션 방식.

## 작업

1. **참조 제거 확인**: 위 컬럼들을 읽거나 쓰는 곳이 남아있으면(타입·hooks·API·컴포넌트) 모두 `task_blocks` 경로로 정리한다. (정상 전환됐다면 대부분 이미 없음 — 잔재만 청소.)
2. **스키마에서 컬럼 제거** (`src/db/schema.ts`): 위 레거시 시간/상태/이월 컬럼 삭제. `nodeStatus` enum이 더 이상 쓰이지 않으면 함께 정리.
3. **마이그레이션 생성·적용**: drizzle 방식대로 컬럼 drop 마이그레이션 생성 후 DB 적용.
4. **타입 정리**: `Node`/`NewNode` 추론 타입, `AddNodeInput`, `optimisticNode` 등에서 제거된 필드 흔적을 없앤다.

핵심 규칙:

- **남길 것과 지울 것을 정확히**: `estimateMinutes`(예상 시간 — task 통계의 예상치)·`category`·`color`·`isBig3`·트리·`title`/`notes`/`links`/`sortOrder`는 **남긴다**. 시간 배치(planned/actual)·`status`·`carryCount`·`plannedDate`만 제거.
- **데이터 손실 주의**: 제거 전에 step 0의 이전이 끝나 있어야 한다(시간 데이터가 task_blocks에 있다). drop은 되돌리기 어려우니, 이전 완료를 먼저 확인.

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

1. 위 AC를 한 줄씩 실행(모두 통과 — 레거시 필드 참조가 남아있으면 컴파일 에러로 잡힌다).
2. `npm run dev` 수동 확인: 캘린더·모달·이월·sweep이 전부 정상(레거시 컬럼 없이도 동작).
3. 아키텍처 체크리스트: `nodes`에 시간/이월 컬럼이 없는가? 통계용 `estimateMinutes`·`category` 등은 남았는가? 마이그레이션이 적용됐는가?
4. `phases/7-carry-v2/index.json`의 step 5 업데이트. 이 step이 마지막이므로 완료 시 phase 전체가 끝난다.
   - **DB 적용이 막히면** → `"blocked"` + 사유(컬럼 drop 마이그레이션 파일은 생성, 적용만 사용자 필요).

## 금지사항

- `estimateMinutes`·`category`·`color`·`isBig3`·트리(`parentId`)·`title`/`notes`/`links`/`sortOrder`를 지우지 마라. 이유: task 정체성·통계(예상 vs 실제·카테고리·성장)의 소스다.
- step 0의 데이터 이전이 끝나지 않았는데 컬럼을 drop하지 마라. 이유: 시간 데이터 영구 손실.
- 컬럼 제거로 빌드가 깨진 채 두지 마라(참조 잔재를 먼저 정리).
- 기존 테스트를 깨뜨리지 마라.
