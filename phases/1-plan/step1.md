# Step 1: nodes-api

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 모든 테이블 user_id+RLS, 비밀키는 서버만, 로직 `core/` 분리)
- `/docs/ARCHITECTURE.md` (`services/`, `db/`, Route Handlers, 데이터 흐름)
- `/docs/ADR.md` (ADR-003 user_id, ADR-010 Drizzle)
- `/src/db/schema.ts` (`nodes` 테이블 + 추론 타입)
- `/src/core/tree/` (step0 트리 로직 — 자손 삭제 등에 활용 가능)
- `/src/services/supabase/server.ts` (인증된 user 확인용)
- `/drizzle.config.ts` (세션 pooler 연결 방식 참고 — host는 NEXT_PUBLIC_SUPABASE_URL ref로 조립, password는 DB_PASSWORD)

## 목표
`nodes` CRUD를 **Route Handler**로 만든다. 서버에서 Drizzle로 DB에 접근하고, **인증된 user의
행만** 다룬다 (앱 레벨 `user_id` 필터 + DB의 RLS, 이중 방어).

## 작업

### 1. 런타임 DB 클라이언트 (`src/db/index.ts`)
- `postgres()` + `drizzle()`로 런타임 클라이언트를 만든다 (drizzle-kit config와 별개).
- 연결은 세션 pooler: host = `db.` 아님 — `aws-1-us-west-2.pooler.supabase.com`,
  port 5432, user = `postgres.<ref>` (ref는 `NEXT_PUBLIC_SUPABASE_URL`에서), database `postgres`,
  password = `process.env.DB_PASSWORD`, `ssl: "require"`. (drizzle.config.ts와 동일 패턴.)
- `export const db = drizzle(...)`. **이 파일은 서버에서만 import** (DB_PASSWORD가 들어가므로
  클라이언트 번들에 절대 포함되면 안 됨).

### 2. Route Handlers
- `src/app/api/nodes/route.ts`:
  - `GET`: 현재 user의 모든 nodes 반환 (flat 배열).
  - `POST`: 새 node 생성. body는 `title`, `parent_id`, `type` 등. `user_id`는 **서버가 주입**
    (body의 user_id를 신뢰하지 마라).
- `src/app/api/nodes/[id]/route.ts`:
  - `PATCH`: node 수정 (title/estimate_minutes/is_big3/status/category 등 부분 수정).
  - `DELETE`: node + **그 자손까지** 삭제 (core/tree의 자손 계산 또는 재귀 쿼리).

### 3. 인증 + 격리 (모든 핸들러 공통)
- `services/supabase/server.ts`의 클라이언트로 `const { data: { user } } = await supabase.auth.getUser()`.
- `user`가 없으면 **401** 반환.
- 모든 Drizzle 쿼리에 `eq(nodes.userId, user.id)`를 **명시**한다 (RLS와 별개로 앱 레벨에서도 격리).

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
   - `src/db/index.ts` 런타임 클라이언트가 있고 서버 전용인가?
   - `app/api/nodes/route.ts`(GET/POST), `app/api/nodes/[id]/route.ts`(PATCH/DELETE)가 있는가?
   - 모든 핸들러가 user 인증(401) + `user_id` 필터/주입을 하는가?
   - `DB_PASSWORD` 등 서버 비밀키가 클라이언트 번들에 노출되지 않는가?
   - `build`가 통과하는가?
3. `phases/1-plan/index.json`의 step 1을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- `DB_PASSWORD`/service 비밀키를 클라이언트(`NEXT_PUBLIC_` 아닌 곳)에 노출하지 마라. 이유: 보안(CLAUDE.md CRITICAL).
- `user_id` 필터 없는 nodes 쿼리를 만들지 마라. 이유: 데이터 격리(CLAUDE.md CRITICAL).
- TanStack Query 훅이나 UI를 만들지 마라. 이유: step2/step3 범위다.
- `.claude/settings.json`에 Stop 훅을 추가하지 마라. 이유: dev 서버와 충돌(확인된 문제).
- 기존 테스트/인증을 깨뜨리지 마라.
