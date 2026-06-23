# 데이터 구조 (DATA-STRUCTURE)

> Dear My Routines의 Postgres(Supabase) 테이블·컬럼 레퍼런스.
> 실제 운영 DB를 직접 조회해 검증함 (기준일: 2026-06-23).
> 스키마 정의 원본은 `src/db/schema.ts`이며, 이 문서는 사람이 읽기 위한 트리 뷰다.

## 공통 규칙

- **모든 테이블에 `user_id` (uuid, NOT NULL)** + **RLS(Row Level Security) ON**.
  소유자 검사 `(select auth.uid()) = user_id`로, 클라이언트가 직접 쿼리해도 남의 행에
  접근 불가하다 (CLAUDE.md CRITICAL, ADR-003). 정책은 테이블마다 select/insert/update/delete
  4종이 자동 부착된다 (`ownerPolicies`, `src/db/schema.ts`).
- 모든 테이블에 **PK**(uuid, `defaultRandom()`)와 **생성/수정 타임스탬프**(`timestamptz`)가 있다.
- 타임스탬프는 전부 **`with time zone`(timestamptz)**. 날짜 전용 컬럼은 **`date`**(YYYY-MM-DD).
- "파생값은 저장하지 않는다" 원칙 — 현재 상태·carryCount·예상vs실제 비교 등은
  쿼리 시 `src/core/time`에서 계산한다 (ADR-013/014/015).

### 범례

```
PK   기본키        FK→  외래키(참조 대상)        ?  nullable
└ NOT NULL 표기가 없으면 nullable, default가 있으면 = 로 표기
```

---

## 1. 현행 도메인 모델 (ADR-015 / 016)

두 단계 고정 모델: **Project → Task**, 그리고 각 Task의 날짜별 **계획(plan)** 과 **실제(action)** 를
별도 리스트로 둔다. 한 행이 계획+실제를 동시에 갖지 않는다(강제된 "2h→9h" 비교를 없앰).

```
projects  (상위 그룹 — Task가 색을 상속)
└─ PK  project_id     : uuid
   ├─     user_id      : uuid   NOT NULL          — 소유자(RLS)
   ├─     title        : text   NOT NULL          — 프로젝트 이름
   ├─     project_color: text   ?                 — hex 색. 없으면 id 기반 결정색(lib/projectColor)
   ├─     created_on   : timestamptz NOT NULL = now()
   └─     updated_on   : timestamptz NOT NULL = now()

tasks  (정체성 + 통계 단위)
└─ PK  task_id        : uuid
   ├─     user_id      : uuid   NOT NULL          — 소유자(RLS)
   ├─ FK→ project_id   : uuid   ?  → projects.project_id (onDelete: set null)
   │                                  null = "No project"(미배정), 프로젝트 삭제 시 미배정으로
   ├─     title        : text   NOT NULL
   ├─     notes        : text   ?
   ├─     category     : text   ?                 — PRD 카테고리 통계용
   ├─     created_on   : timestamptz NOT NULL = now()
   └─     updated_on   : timestamptz NOT NULL = now()

plan_blocks  (Task의 날짜별 *의도* — 1:N from tasks)
└─ PK  plan_block_id  : uuid
   ├─     user_id      : uuid   NOT NULL          — 소유자(RLS)
   ├─ FK→ task_id      : uuid   NOT NULL  → tasks.task_id (onDelete: cascade)
   ├─     date         : date   NOT NULL          — 속한 grid day(07:00 경계, core/time/day)
   ├─     start_at     : timestamptz NOT NULL     — 계획은 항상 박스라 양끝 필수
   ├─     end_at       : timestamptz NOT NULL
   ├─     status       : plan_block_status NOT NULL = 'planned'   — planned | missed
   │                                  missed = 이월 흔적(리뷰 증거로 남김)
   ├─     created_on   : timestamptz NOT NULL = now()
   └─     updated_on   : timestamptz NOT NULL = now()

action_blocks  (Task의 날짜별 *실제 실행* — 1:N from tasks)
└─ PK  action_block_id: uuid
   ├─     user_id      : uuid   NOT NULL          — 소유자(RLS)
   ├─ FK→ task_id      : uuid   NOT NULL  → tasks.task_id (onDelete: cascade)
   ├─     date         : date   NOT NULL          — 속한 grid day
   ├─     start_at     : timestamptz NOT NULL
   ├─     end_at       : timestamptz ?            — 진행 중(타이머)이면 아직 끝 없음 → null
   ├─     created_on   : timestamptz NOT NULL = now()
   └─     updated_on   : timestamptz NOT NULL = now()
```

관계 요약:

```
projects ─1:N─ tasks ─1:N─ plan_blocks   (계획)
                     └1:N─ action_blocks (실제)
```

---

## 2. 리뷰 · AI · 통계

```
daily_reviews  (하루 회고 일기 + AI 분석)
└─ PK  id            : uuid
   ├─     user_id     : uuid   NOT NULL           — 소유자(RLS)
   ├─     date        : date   NOT NULL           — 회고 대상 날(grid day)
   ├─     journal_text: text   NOT NULL           — 사용자가 직접 쓴 일기/리플렉션
   ├─     ai_analysis : jsonb  ?                  — AI 분석 결과(미구현, 현재 null)
   └─     created_at  : timestamptz NOT NULL = now()
   ※ (user_id, date) unique 인덱스 `daily_reviews_user_date_uq`로 "하루 1개" 보장
     (마이그레이션 0008). PUT route가 이 제약을 conflict target으로 upsert한다.

category_stats  (2층 집계 메모리 — ADR-006, 집계 파이프라인 미구현)
└─ PK  id            : uuid
   ├─     user_id     : uuid   NOT NULL           — 소유자(RLS)
   ├─     category    : text   NOT NULL           — 카테고리명
   ├─     avg_estimate: real   ?                  — 평균 예상(분)
   ├─     avg_actual  : real   ?                  — 평균 실제(분)
   ├─     ratio       : real   ?                  — 실제/예상 비율
   ├─     sample_count: integer NOT NULL = 0      — 표본 수
   ├─     trend       : jsonb  ?                  — 시간 추세
   └─     updated_at  : timestamptz NOT NULL = now()
```

---

## 3. Enum 타입

```
node_type         : area | project | task | subtask      (레거시 nodes 트리용)
block_status      : planned | done | missed              (레거시 task_blocks용, ADR-014)
plan_block_status : planned | missed                     (현행 plan_blocks용, ADR-015)
```

`plan_blocks.status`의 `missed`는 이월 신호다: 못 끝낸 계획은 `missed`로 남고(리뷰 증거),
다음 grid day에 같은 task의 새 `planned` 블록이 시각·길이를 유지한 채 태어난다.

---

## 4. 레거시 테이블 (현행 모델로 대체됨, 읽기/마이그레이션 잔존)

carry-over v2 전환(ADR-015/016) 전 모델의 잔재다. 현행 UI/로직은 사용하지 않으나
테이블은 DB에 남아 있다. 신규 기능은 **이들을 참조하지 마라**.

```
nodes  (유연한 Area>Project>Task>Subtask 트리 — ADR-009, projects/tasks로 대체)
└─ PK id, user_id, parent_id(self FK, cascade), type(node_type), title, notes,
       links(text[]), estimate_minutes, category, color, is_big3, sort_order,
       created_at, updated_at

task_blocks  (Task의 날짜별 plan+actual 통합 행 — ADR-014, plan_blocks/action_blocks로 분리됨)
└─ PK id, user_id, node_id(FK→nodes, cascade), grid_day(date),
       planned_start?, planned_end?, actual_start?, actual_end?,
       status(block_status)='planned', sort_order, created_at, updated_at

time_logs  (실측 span — nodes 기반)
└─ PK id, user_id, node_id(FK→nodes, cascade), start_at, end_at?
```

---

## 5. 백업 테이블 (마이그레이션 스냅샷, 무시)

마이그레이션 0005/0006 직전 스냅샷이다. 도메인 모델이 아니며 코드가 참조하지 않는다.

```
plan_blocks_backup_pre0006
action_blocks_backup_pre0006
task_blocks_backup_pre0005
```
