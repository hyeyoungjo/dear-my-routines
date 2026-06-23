# Step 2: blocks-api-hooks

`task_blocks`의 서버 API와 TanStack Query **낙관적** hooks를 만든다. 기존 `nodes` API/hooks와
**공존**한다(아직 캘린더는 nodes 기준 — 전환은 step 3).

## 읽어야 할 파일

- `/docs/ADR.md` — ADR-007(낙관적 업데이트), ADR-003/010(서버에서 user_id 강제·RLS), ADR-014.
- `CLAUDE.md` — CRITICAL: 낙관적 업데이트, 비밀키 서버 전용, RLS.
- `src/db/schema.ts` — `task_blocks`·`TaskBlock`/`NewTaskBlock`(step 0).
- `src/core/time/blocks.ts` — `FlatBlock` 타입(step 1).
- `src/app/api/nodes/route.ts`, `src/app/api/nodes/[id]/route.ts` — **그대로 본뜰 패턴**: `createClient()`로 인증, `user`로 RLS, `parseCreateInput`/`parsePatchInput` 검증, timestamp는 ISO 문자열로 받아 `new Date()`.
- `src/hooks/nodes.ts` — **그대로 본뜰 패턴**: `useOptimisticNodeMutation`(onMutate 캐시 즉시 갱신·onError 롤백·onSuccess undo 기록·onSettled invalidate), `fromHistory` 플래그, query key.
- `src/components/undo.tsx` — `useUndo`, `UndoCommand`(이미 nodes hooks가 통합).

## 작업

1. **API 라우트**:
   - `src/app/api/blocks/route.ts` — `GET`(현재 user의 task_blocks, RLS 필터), `POST`(생성, `userId` 서버 주입).
   - `src/app/api/blocks/[id]/route.ts` — `PATCH`(부분 수정), `DELETE`.
   - 입력 검증 함수(`parseBlockCreateInput`/`parseBlockPatchInput`): `nodeId`·`gridDay`·`status`(enum)·`sortOrder`·시각 필드. **시각은 ISO 문자열로 받아 `new Date()`로 변환**(nodes 라우트와 동일). `id`/`userId`는 body에서 절대 받지 않는다.
2. **Hooks** (`src/hooks/blocks.ts`):
   - `useBlocks()` 쿼리(키 `["blocks"]`), `useAddBlock()`/`useUpdateBlock()`/`useRemoveBlock()` — `nodes.ts`의 낙관적 lifecycle을 그대로 따른다(캐시 즉시 갱신·롤백·undo 기록·invalidate). `fromHistory`로 undo 재기록 억제.

핵심 규칙:

- **낙관적 업데이트 필수**(ADR-007). 직접 `fetch`로 UI를 멈추지 마라 — `nodes.ts`와 같은 mutation lifecycle.
- **RLS / 보안**: 서버에서 `auth.getUser()`로 인증하고 `userId`를 주입한다. 클라가 `userId`를 못 정한다. 비밀키는 서버에서만.
- **undo 통합**: nodes hooks처럼 `recordCommand`로 inverse를 기록한다(생성↔삭제, patch↔이전값).

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
2. 아키텍처 체크리스트: API가 `auth.getUser()`로 user를 강제하고 RLS 대상인가? hooks가 낙관적(onMutate/onError/onSettled) 패턴인가? 비밀키가 클라에 노출되지 않는가?
3. `phases/7-carry-v2/index.json`의 step 2 업데이트(성공 시 `summary`에 라우트·hooks 파일).

## 금지사항

- 캘린더/모달 컴포넌트를 `task_blocks`로 전환하지 마라. 이번 step은 API+hooks까지. 전환은 step 3·4.
- 서버에서 `userId`를 body 값으로 신뢰하지 마라(항상 `auth.getUser()`에서). 이유: RLS·보안(CLAUDE.md CRITICAL).
- 낙관적 업데이트 없이 서버 응답을 기다려 UI를 멈추지 마라.
- 기존 nodes API/hooks를 깨뜨리지 마라(공존해야 한다).
