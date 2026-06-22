# Step 0: blocks-schema

carry-v2의 토대 — **`task_blocks` 테이블을 신설**하고, 기존 노드의 시간 정보를 거기로 **이전**한다.
이번 step은 *추가만* 한다: `nodes`의 시간 필드는 **그대로 둔다**(점진 전환 — 제거는 step 5). 그래야
중간 step마다 기존 캘린더가 안 깨지고 빌드가 유지된다(ADR-014).

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-014**(task 정체성과 날짜별 배치 분리, `task_blocks` 1:N, 이월=missed+새 block, planned/revised/actual·carryCount는 파생), ADR-013(rows가 진실·그리드 하루 경계 07:00~익일 02:00), ADR-009, ADR-003/010(모든 테이블 user_id + RLS).
- `/docs/ARCHITECTURE.md` — 데이터 모델 절, `core/` 순수 규칙.
- `CLAUDE.md` — CRITICAL: 모든 테이블 `user_id`+RLS, 비밀키 서버 전용.
- `src/db/schema.ts` — `nodes` 정의, `ownerPolicies` 헬퍼(RLS 정책), 기존 enum(`nodeStatus`), jsonb/date/timestamp 컬럼 예, `InferSelectModel`/`InferInsertModel` 타입 export 패턴. **`nodes`의 시간 필드(`plannedStart/End`, `actualStart/End`, `plannedDate`, `status`, `actualMinutes`, `carryCount`)가 이전 대상이다.**
- `src/core/time/day.ts` — `gridDayOf`(타임스탬프 → 그리드 하루 `YYYY-MM-DD`), `dayKey`. **데이터 이전 시 grid_day 계산은 이 규칙과 일치해야 한다.**
- `drizzle.config.ts` 와 `src/db/` — 마이그레이션 방식 확인(스크립트 없으면 `npx drizzle-kit generate` / `push`).

## 작업

1. **`task_blocks` 테이블** (`src/db/schema.ts`):
   - 새 enum `blockStatus`: `planned` | `done` | `missed`.
   - 컬럼: `id`(uuid pk), `userId`(uuid notNull), `nodeId`(uuid → `nodes.id`, onDelete cascade, notNull), `gridDay`(date, notNull — 그 block이 속한 그리드 하루), `plannedStart`/`plannedEnd`(timestamptz, nullable), `actualStart`/`actualEnd`(timestamptz, nullable), `status`(blockStatus, notNull, default `planned`), `sortOrder`(integer, notNull, default 0), `createdAt`/`updatedAt`(timestamptz, defaultNow).
   - **RLS**: `ownerPolicies("task_blocks", t.userId)`를 그대로 붙인다(기존 테이블과 동일 패턴).
   - `InferSelectModel`/`InferInsertModel`로 `TaskBlock`/`NewTaskBlock` 타입 export.
2. **마이그레이션 생성·적용**: drizzle 방식대로 마이그레이션 파일 생성 후 DB 적용.
3. **데이터 이전**(중요 — 기존 task가 사라지면 안 된다): 기존 `nodes` 중 `plannedStart` 또는 `actualStart`가 있는 행마다 `task_blocks` 한 행을 만든다.
   - `node_id` = 그 노드, `grid_day` = `gridDayOf(plannedStart ?? actualStart)`(day.ts 규칙), `planned_start/end`·`actual_start/end` = 그대로 복사, `status` = `actualStart`가 있으면 `done` 아니면 `planned`.
   - 일회성 이전 스크립트(`scripts/` 아래, 예: `migrate-to-blocks.ts`)로 Drizzle을 써서 select→insert 하라(grid_day 계산에 `gridDayOf` 재사용). **멱등**하게: 이미 그 노드의 block이 있으면 건너뛴다(재실행해도 중복 생성 금지).

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
2. 마이그레이션 적용 후 `task_blocks` 행 수가 "시간 정보가 있던 기존 노드 수"와 일치하는지 확인한다(이전 누락 없음).
3. 아키텍처 체크리스트: `task_blocks`에 `user_id`+RLS 정책이 붙었는가? `grid_day`가 `gridDayOf` 규칙(07:00 경계)과 일치하는가? `nodes` 시간 필드를 **건드리지 않았는가**(제거는 step 5)?
4. 결과에 따라 `phases/7-carry-v2/index.json`의 step 0을 업데이트한다:
   - 성공 → `"completed"`, `"summary"`(테이블·enum·이전 스크립트·이전된 행 수).
   - 수정 3회 실패 → `"error"` + `error_message`.
   - **DB 적용/이전이 막히면** → `"blocked"` + `blocked_reason`(마이그레이션·스크립트 파일은 생성 완료, DB 적용만 사용자 필요) 후 중단.

## 금지사항

- `nodes`의 시간 필드(`plannedStart` 등)를 제거하지 마라. 이유: 점진 전환 — 아직 캘린더가 그 필드를 읽는다. 제거는 모두가 `task_blocks`로 옮겨간 step 5다.
- 캘린더·hooks·`core/time`의 기존 로직을 수정하지 마라. 이번 step은 스키마 추가 + 데이터 이전만.
- `task_blocks`에 RLS(`ownerPolicies`)를 빠뜨리지 마라. 이유: CLAUDE.md CRITICAL — 모든 테이블은 owner만 접근 가능해야 한다.
- 데이터 이전 스크립트를 비멱등하게 만들지 마라(재실행 시 block 중복 생성 금지).
- 기존 테스트를 깨뜨리지 마라.
