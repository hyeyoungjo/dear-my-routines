# Step 2: api-task-patch

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026**, ADR-003/010(서버가 userId 주입, RLS), ADR-007(낙관적 UX)
- `/CLAUDE.md` — CRITICAL: user_id + RLS, 비밀키 클라이언트 노출 금지(서버 전용)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/app/api/tasks/[id]/route.ts` — `parseTaskPatchInput`, `PATCH` 핸들러
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/app/api/tasks/route.ts` — `parseTaskCreateInput`(set/clear 패턴 참고), `GET`(select)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/db/schema.ts` — `tasks`, `NewTask` 타입

이전 step에서 `tasks.shelvedAt`(nullable timestamp)가 추가됐다.

## 작업

PATCH 라우트가 `shelvedAt`을 **세팅/해제** 모두 받게 한다. 와이어에서는 ISO 문자열(올리기) 또는 `null`(꺼내기)로 온다.

1. **`src/app/api/tasks/[id]/route.ts`의 `parseTaskPatchInput`에 `shelvedAt` 처리 추가** — 기존
   `projectId`의 set-or-clear 패턴을 그대로 따른다:

   ```ts
   if (typeof body.shelvedAt === "string") {
     values.shelvedAt = new Date(body.shelvedAt);
   } else if (body.shelvedAt === null) {
     values.shelvedAt = null;
   }
   ```

   - 다른 필드는 건드리지 마라. `shelvedAt` 한 줄 분기만 추가.
   - 기존 "빈 patch면 400" 가드, `updatedOn` 갱신, `userId` 일치(RLS 이중방어)는 그대로 둔다.

2. **GET 응답 확인** — `GET /api/tasks`와 `GET /api/tasks/[id]`(있다면)는 `db.select().from(tasks)`로
   전체 행을 반환하므로 `shelvedAt`이 자동 포함된다. 별도 작업 불필요 — 다만 select가 컬럼을 명시적으로
   골라내는 형태라면 `shelvedAt`을 빠뜨리지 않았는지 확인하라(현재는 `select()` 전체이므로 OK).

3. POST(create)는 `shelvedAt`을 받지 않는다 — 새 task는 항상 활성(null)이다. `parseTaskCreateInput`은
   건드리지 마라.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `parseTaskPatchInput`이 `shelvedAt`을 문자열→Date, `null`→null로 받아들이고, 그 외 타입은 무시하는지
   코드로 확인한다.
3. 아키텍처 체크리스트: userId는 세션에서만 주입(클라이언트가 못 보냄) / RLS(`and(eq(taskId), eq(userId))`)
   유지 / 비밀키 서버 전용 / ADR 이탈 없음.
4. `phases/12-shelf/index.json`의 step 2를 업데이트한다(성공 → `completed` + summary, 실패 → `error`).

## 금지사항

- POST(create) 입력에 `shelvedAt`을 추가하지 마라. 이유: 신규 task는 항상 활성.
- `userId`를 클라이언트 body에서 읽지 마라. 이유: 세션 주입 + RLS(CLAUDE.md CRITICAL).
- PATCH 화이트리스트를 넓혀 다른 필드를 임의로 받지 마라. 이유: 이 step 범위는 `shelvedAt` 한 필드.
- 기존 테스트를 깨뜨리지 마라.
