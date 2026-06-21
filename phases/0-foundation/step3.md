# Step 3: db-schema

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 모든 테이블에 `user_id` + RLS, 비즈니스 로직 `core/` 분리)
- `/docs/ARCHITECTURE.md` (데이터 모델: `nodes` / `time_logs` / `daily_reviews` / `category_stats`)
- `/docs/ADR.md` (ADR-009 유연한 트리 모델, ADR-003 user_id, ADR-006 3층 메모리)
- step0~2 산출물: `src/db/`(현재 비어 있음), `src/services/supabase/`, `package.json`

## 사전 조건
- Drizzle이 Supabase Postgres에 **실제로 연결**해 마이그레이션을 적용하려면 connection
  string이 필요하다. 사용자가 `.env`에 `DATABASE_URL`을 추가하면 push까지 가능하다
  (Supabase → Project Settings → Database → Connection string → URI, `[YOUR-PASSWORD]` 치환).
- **이 step의 AC는 schema 정의 + 마이그레이션 SQL 생성 + build까지만** 검증한다
  (`drizzle-kit generate`는 DB 연결 없이 schema만으로 SQL을 만든다). 실제 DB 적용(push)은
  `DATABASE_URL`이 있으면 시도하고, 없으면 생성된 SQL만 남기고 step을 completed로 둔다.

## 목표
Drizzle ORM으로 ARCHITECTURE.md의 데이터 모델을 정의하고 마이그레이션을 생성한다.
**모든 테이블에 `user_id` + RLS**(CLAUDE.md CRITICAL).

## 작업

### 1. Drizzle 설치 + 설정
- `npm install drizzle-orm postgres`
- `npm install -D drizzle-kit`
- `drizzle.config.ts`: `schema: "./src/db/schema.ts"`, `out: "./drizzle"`,
  `dialect: "postgresql"`, `dbCredentials: { url: process.env.DATABASE_URL! }`.

### 2. 스키마 (`src/db/schema.ts`)
ARCHITECTURE.md 데이터 모델대로 `pgTable`로 정의한다. enum은 `pgEnum`.
- **`nodes`** (유연한 트리, self-reference):
  `id`(uuid pk), `user_id`(uuid not null), `parent_id`(uuid nullable, nodes 자기참조),
  `type`(enum: area|project|task|subtask), `title`(text), `notes`(text null),
  `links`(text[] 또는 jsonb null), `estimate_minutes`(int null), `actual_minutes`(int null),
  `status`(enum: pending|in_progress|done|carried|dropped, default pending),
  `category`(text null), `is_big3`(boolean default false), `planned_date`(date null),
  `carry_count`(int default 0), `sort_order`(int default 0),
  `created_at`/`updated_at`(timestamptz default now).
- **`time_logs`**: `id`, `user_id`, `node_id`(nodes 참조), `start_at`(timestamptz),
  `end_at`(timestamptz null).
- **`daily_reviews`**: `id`, `user_id`, `date`(date), `journal_text`(text),
  `ai_analysis`(jsonb null), `created_at`.
- **`category_stats`**: `id`, `user_id`, `category`(text), `avg_estimate`(real null),
  `avg_actual`(real null), `ratio`(real null), `sample_count`(int default 0),
  `trend`(jsonb null), `updated_at`.
- 각 테이블의 추론 타입을 export 한다 (`InferSelectModel`/`InferInsertModel`).

### 3. RLS 정책
모든 테이블에 행수준 보안을 건다. Drizzle의 `pgPolicy`로 schema에 정의하거나, 별도
`src/db/rls.sql`에 작성한다. 정책 원칙:
- 각 테이블 `ENABLE ROW LEVEL SECURITY`.
- select/insert/update/delete 모두 `user_id = auth.uid()` 인 행만 허용.

### 4. 마이그레이션 생성
- `npx drizzle-kit generate` 로 `drizzle/`에 SQL 마이그레이션을 만든다.
- RLS를 별도 SQL로 뒀다면 그 파일도 `drizzle/`에 포함되도록 한다.
- `DATABASE_URL`이 있으면 `npx drizzle-kit migrate`(또는 push)를 시도한다. 없으면 생략.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
npx drizzle-kit generate
```
`drizzle/` 디렉토리에 마이그레이션 SQL이 생성되어야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `src/db/schema.ts`에 4개 테이블이 있고 **전부 `user_id` 컬럼**이 있는가?
   - RLS 정책(`auth.uid()` 기반)이 정의되어 있는가?
   - `drizzle/`에 마이그레이션 SQL이 생성되었는가?
   - `build`가 통과하는가?
3. `phases/0-foundation/index.json`의 step 3을 업데이트한다:
   - 성공 → `"completed"` + `"summary"`(테이블·생성 파일 요약)
   - 3회 실패 → `"error"` + `"error_message"`
   - 사용자 개입 필요 → `"blocked"` + `"blocked_reason"`

## 금지사항
- `user_id`가 없는 테이블을 만들지 마라. 이유: RLS의 전제이자 멀티유저 확장 기반(CLAUDE.md CRITICAL).
- `service_role` key를 사용하거나 노출하지 마라. 이유: 보안(CLAUDE.md CRITICAL).
- `.claude/settings.json`에 Stop 훅(lint/build/test)을 추가하지 마라. 이유: dev 서버의
  `.next`와 충돌해 빌드가 깨진다(앞서 확인된 문제).
- Plan/Act/Review 패널 UI를 만들지 마라. 이유: step4(panel-routes) 범위다.
- DB 쿼리/트리 조작 로직을 UI 컴포넌트에 넣지 마라. 이유: `core/` 분리(CLAUDE.md CRITICAL).
- 기존 테스트를 깨뜨리지 마라.
