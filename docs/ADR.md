# Architecture Decision Records

> 장기 프로젝트이므로, 사소하지 않은 결정은 여기에 *왜* 그렇게 정했는지와 함께 기록한다.
> 나중에 "내가 왜 이렇게 했지?" 할 때의 답.

## 철학
**개인 도구가 우선** — 시장 출시가 아니라 제작자 본인의 매일 사용과 빠른 반복에 최적화한다.
나중에 멀티유저로 키울 문은 열어두되 지금 만들지는 않는다(YAGNI). 부드러운 사용자 경험을
최우선 제약으로 둔다.

---

### ADR-001: 개인용 앱, 수익화 보류 (2026-06-20)
**결정**: 구독형 출시 목표를 접고, 나만을 위한 개인 웹앱으로 만든다.
**이유**: 수익화를 노리면 멀티유저·결제·온보딩·약관 등 부수적 무게가 핵심 기능(과소예측
해결)을 늦춘다. 제작자가 곧 사용자라 피드백 루프가 즉각적이다.
**트레이드오프**: 당장의 수익 가능성을 포기. 단, 데이터 모델에 여지를 남겨 나중에 전환 가능.

### ADR-002: 클라우드 호스팅 (Supabase + Railway) (2026-06-20)
**결정**: Supabase(Auth·Postgres·Storage) + Railway(백엔드/AI 잡)에 배포한다.
**이유**: 폰·노트북 어디서든 접속해야 매일 기록하는 앱으로 의미가 있다. 둘 다 이미 구독 중.
**트레이드오프**: 로컬 전용보다 복잡하고 로그인이 필요. 대신 어디서든 접근 가능.

### ADR-003: 1인 매직링크 로그인, 스키마에 user_id 유지 (2026-06-20)
**결정**: Supabase 매직링크로 "나만" 로그인. DB 스키마에는 `user_id`를 1인 기본값으로 둔다.
**이유**: 공개 URL이라 최소 보호가 필요. 비밀번호 관리 없이 매직링크가 가장 간단·안전.
`user_id`를 처음부터 두면 나중에 멀티유저 전환 때 데이터 모델을 갈아엎지 않아도 된다.
**트레이드오프**: 멀티유저 로직은 지금 안 만든다(YAGNI). 스키마에 미사용 컬럼이 생김.

### ADR-004: Plan · Act · Review 3패널, 데일리 AI 리뷰 (2026-06-20)
**결정**: 메인 화면을 Plan·Act·Review 세 패널로. AI 분석은 주간이 아니라 **데일리**.
**이유**: 하루의 세 순간(계획/실행/회고)이 타임박싱 방법론에 깔끔히 대응. 매일 회고를
강제하면 "나를 더 잘 알게 되는" 과정이 매일 일어난다. 가운데 패널 이름은 "Real"이 아니라
**Act** — 단순 측정이 아니라 블록을 옮기고 늘리며 능동적으로 하루를 굴리는 곳이기 때문.
**트레이드오프**: 매일 AI 호출 → 비용·토큰. 3층 메모리(ADR-006)로 완화.

### ADR-005: AI 모델 비종속 추상화 (2026-06-20)
**결정**: OpenAI/Gemini 등을 얇은 추상화 레이어 뒤에서 교체 가능하게 만든다.
**이유**: 특정 AI 회사에 묶이지 않기 위함. `.env`에 이미 두 모델의 키/모델명 자리를 둠.
**트레이드오프**: 공통 인터페이스 설계 비용. 단, 모델 발전이 빠른 분야라 충분히 가치 있음.

### ADR-006: 3층 메모리 (원장 / 집계 / 검색) (2026-06-20)
**결정**: ① 원장(raw): 모든 task·시간·리뷰 원본을 DB에 영구 저장. ② 집계(stats):
카테고리별 예상/실제 비율 등 숫자 요약을 매일 갱신, AI에 항상 통째로 전달. ③ 검색
(retrieval): 오늘과 관련된 과거 기록 몇 개만 골라 전달. AI 프롬프트 = 오늘 데이터 +
누적 통계 요약 + 관련 과거 + 오늘 리뷰 글.
**이유**: 기록이 쌓여도 AI 입력 크기를 일정하게 유지하고 분석 품질을 보존하기 위함.
**트레이드오프**: 집계·검색 파이프라인 구현 복잡도. 단, 데일리 분석에는 필수.

### ADR-007: 부드러운 UX를 최상위 아키텍처 제약으로 (2026-06-20)
**결정**: 드래그/리사이즈/인라인 편집의 매끄러움을 프론트엔드 스택 선택의 1순위 기준으로 삼는다.
**이유**: 블록 기반 트리 인터랙션이 제품의 핵심 경험. 여기가 버벅이면 매일 안 쓰게 된다.
**트레이드오프**: 단순 폼 기반 UI보다 구현이 무겁다. 본 제품에선 타협 불가 영역으로 본다.

### ADR-008: harness-framework step 방법론으로 개발 (2026-06-20)
**결정**: 큰 작업을 자기완결적 step으로 쪼개 `scripts/execute.py`로 순차 실행하며 개발한다.
**이유**: 장기 프로젝트라 한 세션에 몰아넣으면 설계 의도가 표류한다. step마다 가드레일
(CLAUDE.md+docs) 주입과 step별 커밋으로 일관성을 유지.
**트레이드오프**: step 설계에 선행 비용. 단, 누적 개발에서 회수된다.

### ADR-009: 유연한 트리 데이터 모델 + 단순 자동 이월 (2026-06-20)
**결정**: Area › Project › Task › Subtask의 유연한 트리. 미완료 task는 다음 날 Plan에
자동 이월하고 Plan에서 자유 편집. 이월 횟수(carry count)는 백그라운드 메타데이터로만 기록.
**이유**: 사용자의 실제 종이 todolist가 들쭉날쭉한 깊이의 중첩 트리. subtask 증가 + 이월
횟수가 "이 task는 subproject격이다"의 데이터 증거가 된다. 이월 UX는 복잡하게 만들지 않기로 함.
**트레이드오프**: 고정 단계보다 트리 렌더링·쿼리가 복잡. 단, 사용자 사고방식과 일치.

### ADR-010: 기술 스택 확정 (2026-06-20)
**결정**:
- **프론트엔드**: Next.js 15 (App Router) + TypeScript(strict), Tailwind CSS + shadcn/ui,
  dnd-kit + Framer Motion(블록 드래그·리사이즈·애니메이션), TanStack Query(서버 상태 +
  낙관적 업데이트).
- **백엔드/데이터**: Next.js Route Handlers, Supabase(Postgres + Auth 매직링크 + RLS),
  Drizzle ORM.
- **AI**: Vercel AI SDK (모델 비종속 — OpenAI/Gemini를 한 인터페이스로).
- **배포/테스트**: Railway 호스팅, Vitest.
**이유**: 모든 선택의 1순위 기준은 ADR-007(부드러운 UX). dnd-kit + Framer Motion +
TanStack Query의 **낙관적 업데이트**(화면 먼저 갱신, 실패 시 rollback)가 "버벅임 0"을
만든다. Supabase **RLS**(행 수준 보안)로 모든 테이블에 user_id를 두고 남의 데이터 접근을
DB가 직접 차단(ADR-003 멀티유저 확장과도 맞물림). **Vercel AI SDK**가 ADR-005(모델
비종속)를 기성품으로 실현. **Railway**를 (Next.js 본진 Vercel 대신) 고른 이유: ① 이미
구독 중, ② 항상 켜진 서버라 데일리 AI 분석·집계 같은 백그라운드 잡(ADR-006)에 유리
(서버리스 타임아웃 회피).
**트레이드오프**: Next.js를 본진(Vercel) 아닌 Railway에 배포해 약간의 설정 필요. React
생태계 학습 곡선 — 단, harness step으로 한 조각씩 익히며 진행(ADR-008).

### ADR-011: Google OAuth를 기본 로그인으로 추가, 매직링크 병행 (2026-06-21)
**결정**: 기본 로그인을 **Google OAuth**로 하고, 매직링크(ADR-003)도 백업으로 함께 유지한다.
**이유**: 제작자가 gmail을 쓴다 — "Google로 로그인" 버튼 한 번이 매번 메일 링크를 클릭하는
것보다 편하다(자동 로그인 체감). 매직링크는 대체 수단으로 남긴다. 콜백(`/auth/callback`)·
미들웨어·Supabase 클라이언트는 매직링크와 그대로 공유하므로 추가 비용이 작다.
**트레이드오프**: Google Cloud Console에 OAuth 앱을 한 번 등록해야 한다. 로그인 화면에 두
경로(Google 버튼 + 이메일 폼)가 생겨 약간 복잡. **ADR-003을 대체하지 않고 보강**한다.

### ADR-012: AI 기본 provider는 Gemini, OpenAI 제거 (2026-06-22)
**결정**: 실제 AI 호출(데일리 리뷰·카테고리 분류 등)의 기본 provider를 **Gemini**로 한다
(Vercel AI SDK + `@ai-sdk/google`). `.env`/`.env.example`에서 OpenAI 키·모델을 제거한다.
**이유**: 한 provider로 단순화. 모델 비종속(ADR-005)은 유지하므로, 나중에 OpenAI 등을 다시
붙이려면 어댑터(provider)만 바꾸면 된다.
**트레이드오프**: 지금은 Gemini에 의존. 단 Vercel AI SDK 추상화 덕분에 교체 비용은 작다.
**비고**: ADR-005를 대체하지 않고 *기본값을 지정*해 구체화한다. Gemini 키는 `AIza...` 형식
(aistudio.google.com). 실제 AI 코드는 다음 AI phase(데일리 리뷰)에서 작성한다.

### ADR-013: 날짜별 데이터 모델 — 정규화 rows가 진실, 하루는 조립한 view (2026-06-21)
**결정**: "하루"의 절대적 진실(source of truth)은 **정규화된 `nodes` 등의 DB rows**로 둔다.
날짜 패널·AI가 다루는 "하루 = 하나의 JSON 문서(`{ date, plan, act, review }`)"는 그 rows
위에서 **조립하는 read model(view)** 일 뿐, 저장 형태(JSONB blob)가 아니다. 조립은 일단
**클라이언트에서** 한다 — `core/time/day.ts`의 순수함수(`nodesForDay` 등)가 선택 날짜에
속하는 rows를 골라내고, 기존 단일 `["nodes"]` 캐시 + 낙관적 업데이트(ADR-007)를 그대로 쓴다.
**이유**: 이 앱의 핵심 가치(카테고리별 예상/실제 통계·예측 보정·성장 추세, PRD 6)는 본질적으로
**여러 날을 가로지르는 집계**다. 하루를 JSONB blob 하나로 저장하면 그런 cross-day 쿼리·노드
단위 이월(ADR-009)·RLS가 전부 무거워진다 — Postgres 정규화의 강점을 버리게 된다. 반면
"하루=문서"라는 **멘탈 모델**은 UI·AI(ADR-006 "오늘 데이터 통째로")에 그대로 유용하므로,
저장이 아니라 *조립*으로 실현한다. 1인 앱이라 데이터가 적어 클라 조립으로 충분(YAGNI, ADR-001).
**그리드 하루 경계**: 캘린더가 07:00~익일 02:00을 한 화면으로 보므로(`calendar.ts`), 자정~06:59
타임스탬프는 전날에 귀속시킨다(`gridDayOf`). 블록이 그려지는 위치와 귀속 날짜가 항상 일치한다.
**트레이드오프**: 날짜 필터가 지금은 클라에서만 돌아 모든 rows를 받아온다. 기록이 많아지면
서버 날짜 필터(`GET /api/days/[date]`) + 캐시 분할로 옮긴다 — 조립을 순수함수로 빼뒀으므로
이전 비용이 작다.

### ADR-014: task 정체성과 날짜별 배치(task_blocks) 분리 — 다중 occurrence 이월 (2026-06-23)
**결정**: "task 정체성"과 "날짜별 시간 배치"를 **분리**한다. `nodes`는 task/project 트리와
**통계 단위**(title·category·estimate·트리)만 갖고 시간 필드를 버린다. 새 **`task_blocks`**
테이블이 한 task의 **날짜별 계획+실제 배치(occurrence)** 를 1:N으로 가진다
(`node_id`, `grid_day`, `planned_start/end`, `actual_start/end`, `status` planned|done|missed).
- **이월** = 못한 block을 `missed`로 두고 **다음 날 새 block 생성**(같은 `node_id`, 시각 유지).
- **planned**(첫 block 날) · **revised**(마지막 planned block 날) · **actual**(actual 있는 block 날)
  · **carryCount**(missed block 수)는 컬럼이 아니라 block들에서 **파생**한다.
- **비교 라벨**(예상→실제)은 한 block에 planned+actual이 **둘 다 있을 때만** 띄운다.
**이유**: 한 task가 여러 날에 걸쳐 계획·이월·실행되고, 각 날의 계획을 **독립적으로 보존·수정**해야
리뷰("그날 뭘 계획했고 못했나")와 과소예측 분석이 가능하다. task와 배치를 한 행에 합친 모델로는
이 1:N을 표현할 수 없다. 분리하면 각 occurrence가 행 단위로 독립 편집되고, 통계는 `node_id`로
묶여 무결성이 유지된다(ADR-013 "rows가 진실, 하루는 조립한 view"와 정합).
**트레이드오프**: 스키마 분리·마이그레이션·캘린더/hooks/core 재배선 비용이 크다. 점진 전환
(`task_blocks` 추가 → 캘린더 이관 → 레거시 컬럼 제거)으로 각 step의 빌드 무결성을 지킨다. 단,
이 앱의 핵심(리뷰·예상vs실제·성장)이 본질적으로 다중-날짜라 필수다. **ADR-009를 데이터 모델
수준에서 구체화·대체**한다(트리·자동 이월·carryCount 신호의 *의도*는 유지, *저장 형태*만 바꿈).

### ADR-015: Plan과 Action을 별도 리스트로 분리 — task_blocks 한 행 해체 (2026-06-22)
**맥락**: ADR-014의 `task_blocks`는 한 행에 계획(`planned_*`)과 실제(`actual_*`)를 **함께** 들었다.
이 "한 행 동거"가 세 문제의 공통 뿌리였다 — (a) 한 블록이 planned+actual을 둘 다 들어 강제
비교 라벨(`2h→9h`)이 자동 생성, (b) ✕가 맥락별로 이월/clear/삭제로 갈려 혼란, (c) undo가 그
혼란과 충돌(`docs/Task-Continuity_Problem.md` 5절).
**결정**: 데이터를 **세 리스트로 분리**한다. ADR-014의 "정체성=nodes / 배치=blocks" 분리는
유지하되, **배치를 다시 plan과 action 두 테이블로 쪼갠다**.
- **① Task = `nodes`** (정체성·통계 단위, task당 1행): `parent`·`type`·`title`·`category`·
  `notes/links/color/isBig3`. **`estimate_minutes`는 제거** — 예상은 고정 한 칸이 아니라 Plan
  줄마다(시작~끝 길이)에 흩어져 있다. 아직 캘린더에 안 올린 task는 예상값이 없다(예측=배치).
- **② Plan = `plan_blocks`** (`task_blocks`에서 `actual_*` 제거, 날짜별 N행): `node_id`·
  `grid_day`·`start`·`end`·`status`. **status는 `planned|missed` 둘뿐**(`done` 제거 — "했다"는
  Action 줄이 대신 말한다). 모든 Plan은 박스로 만들어 **항상 시각을 가진다.** `sort_order` 제거
  (시간순 배치라 불필요).
- **③ Action = `action_blocks`** (신규, 날짜별 N행): `node_id`·`grid_day`·`start`·`end`.
  **status 없음**(행이 존재함 = 실행함), **sort_order 없음**. 하루에 못 끝내 나눠 하면 N행.
- **파생값은 컬럼 아님, 읽을 때 계산**: 원래계획일(가장 이른 plan)·현재목표일(`planned` plan)·
  거쳐온 날(`missed` plan들)·carryCount(`missed` 수)·**실제 시간(action 길이들의 합)**·
  **예상vs실제**. 합계·평균은 저장하지 않는다.
- **✕ = 삭제**(그 행 DELETE, 박스가 실제로 사라짐). **이월은 별도의 명시적 동작**으로 분리.
- **비교(예상→실제)는 캘린더 블록 라벨이 아니라 통계/리뷰에서 `node_id` 단위로** 한다 → `2h→9h`
  라벨이 구조적으로 제거된다.
- **undo 제거**(`undo.tsx`·providers·깊이설정·`recordCommand`).
**이유**: plan과 action을 다른 리스트에 두면 (a) 한 블록이 둘을 동시에 들 수 없어 강제 비교가
원천 차단되고, (b) ✕가 "그 줄 삭제" 하나로 명확해지며, (c) 각 날의 계획/실행을 독립 줄로
보존·수정할 수 있다. 예상이 여러 개라는 사실(Plan 줄마다 길이 수정 가능)을 평균으로 뭉개 저장하지
않고 raw 줄로 보존하면, "원래 예측 vs 최종 예측" 같은 통계 규칙을 나중에 바꿔도 데이터 이전이
필요 없다(ADR-013 "rows가 진실, view는 조립"과 정합).
**트레이드오프**: 테이블 1개 추가(`action_blocks`) + `task_blocks` 슬림화 + 캘린더/hooks/core/API
재배선 + 기존 16개 task의 `actual_*` 데이터를 `action_blocks`로 이관하는 마이그레이션이 필요하다.
점진 전환(스키마/마이그레이션 → core/time 분리 → API/hooks → 캘린더 → 모달 → undo 제거 →
통계)으로 각 step 빌드 무결성을 지킨다. **ADR-014를 구체화·대체**한다(정체성/배치 분리·이월·
통계 묶음의 *의도*는 유지, plan+actual 한 행 합침만 해체).
**비고(다음 작업에서 결정)**: ① "시간 미정 계획"은 도입하지 않기로 함(모든 Plan은 시각 보유) —
그래서 `grid_day`는 `start`에서 파생 가능하나 날짜 필터 쿼리 편의로 컬럼을 **남긴다**. ② 통계의
"예상" 기준(첫 plan=원래 예측 vs 마지막 plan=최종 예측)은 통계 단계에서 확정한다. ③ 이월의
구체 UI(별도 버튼/제스처)는 동작 설계 단계에서 정한다.

### ADR-016: 유연한 트리(nodes) 폐기 → projects + tasks 2층 고정 (2026-06-22)
**맥락**: ADR-009의 유연한 자기참조 트리(`nodes`: Area>Project>Task>Subtask, 깊이 자유)는
개인용 1인 앱에 과했다. 실제로 쓰는 건 "프로젝트 안에 task" 2층뿐이고, area/subtask/임의 깊이는
렌더·쿼리·이름만 복잡하게 했다. 작업 연속성 작업(ADR-015) 내내 area/subtask는 한 번도 등장하지
않았다.
**결정**: `nodes` 트리를 폐기하고 **`projects` + `tasks` 2층 고정**으로 단순화한다. 이름도 정리한다.
- **`projects`**: `projectId`(PK)·`userId`·`title`·`projectColor`·`createdOn`·`updatedOn`.
- **`tasks`**: `taskId`(PK)·`userId`·`projectId`(**nullable** — 무프로젝트 task 허용)·`title`·
  `notes`·`category`·`createdOn`·`updatedOn`.
- **`plan_blocks`**: `planBlockId`(PK)·`userId`·`taskId`·`date`·`startAt`·`endAt`·
  `status`(planned|missed)·`createdOn`·`updatedOn`. (ADR-015의 plan_blocks를 rename: `id`→
  `planBlockId`, `nodeId`→`taskId`, `gridDay`→`date`.)
- **`action_blocks`**: `actionBlockId`(PK)·`userId`·`taskId`·`date`·`startAt`·`endAt`(**nullable**)·
  `status`(**in-progress|done**)·`createdOn`·`updatedOn`. action에 status를 도입해 "doing"
  (진행 중 = 시작했으나 끝 시각 없음)을 살린다. 그래서 `endAt`은 nullable.
- **status는 두 층위**(ADR-015 유지): plan/action 행의 `status`는 *그 칸*의 상태(저장). projects·
  tasks의 "current status"(planned/missed/in-progress/done)는 plan+action에서 **파생**(저장 안 함,
  `currentStatusOf`).
- **`createdAt`/`updatedAt` → `createdOn`/`updatedOn`** 전 테이블 통일.
- **estimate_minutes·isBig3·links·sortOrder는 task에서 제거**(최소 스펙). `category`는 PRD의
  카테고리별 통계 때문에 **task에 유지**. `title`은 UI(프로젝트 배정 메뉴)에 필요해 project에 **유지**.
**이유**: 개인용·소량 데이터(ADR-001 YAGNI)에서 2층 고정이 사고·렌더·쿼리를 단순화한다. 이름을
도메인 용어(project/task)로 명시화하면 `nodes`/`nodeId`의 모호함이 사라진다.
**트레이드오프**: ADR-009의 *유연한 깊이*와 PRD 7의 *"subtask 증가 → subproject 감지"* 신호를
**잃는다**(subtask가 없으므로). 대신 "이월 횟수(carryCount)"가 subproject 신호로 남는다. 기존 16개
`nodes`(트리)를 projects/tasks로 **재분류 이전**해야 한다 — area→drop 또는 project로, subtask→task로
승격 등 의미 매핑은 실데이터를 보고 마이그레이션 단계에서 정한다. **ADR-009를 대체**하고 ADR-015의
nodes 부분을 **구체화**한다(정체성/배치/통계 묶음의 의도는 유지).

### ADR-017: status 어휘 통일 + 캘린더 동작 확정 (2026-06-22)
**맥락**: ADR-016의 `action_block_status(in-progress|done)`은 캘린더 UX를 정하는 과정에서
어긋났다. "doing"을 저장 상태가 아니라 시각으로 파생하기로 하면서 그 칸이 무의미해졌고,
status 어휘가 list마다 제각각(`planned/missed` 중복, `in-progress`만 하이픈)이었다.
**결정 — status 어휘(전부 파생, 단 하나만 저장)**:
- **plan_blocks** (유일한 저장 status): `planned` | `missed`.
- **action kind** (파생): `kept`(그날 plan과 시각 **정확히 일치**) | `revised`(plan 있고 다름) |
  `added`(그날 plan 없음). `actionKindOf(action, plans)`로 계산.
- **task/project 롤업** (파생): `todo` | `doing` | `overdue` | `done`. `doing`은 **now가 action
  span 안**일 때(`isOngoing`). task=`currentStatusOf`, project=`projectStatusOf`(doing>overdue>
  all done>todo). → 어떤 단어도 두 층위를 가리키지 않는다.
- **action_blocks는 status 칸 없음** — 0006에서 넣은 칸/enum을 0007에서 제거. `end_at`만 nullable로
  남겨 미래 타이머("끝 미정")에 대비.
**결정 — 캘린더 동작(2열 PLAN|ACT)**:
- PLAN열=plan_blocks, ACT열=action_blocks. 옛 **비교 라벨(`2h→9h`) 제거**(두 열 분리).
- **ghost**(ACT열의 흐릿한 plan 투영) 유지: 클릭=그 **계획 시간대로 action 생성**, 이후 드래그/
  리사이즈로 자유 편집. "계획=실제 박제" 걱정은 *동기 있는 1인 유저*라 안 막는다(YAGNI, 단순함 우선).
- **✕ 의미**: PLAN ✕=그 plan 삭제, 실제 ACT ✕=그 action만 삭제(plan은 남아 다시 ghost),
  **ghost ✕=그 plan을 다음날로 수동 이월**(`carryOverPlan` — missed로 남기고 내일 새 planned,
  carryCount +1). 즉 ghost ✕는 "오늘 못함"을 손으로 내일 보내는 것(삭제 아님). 그냥 두면 자동
  sweep이 처리, 재계획(다른 날·시간)은 드래그. (당초 "수동 이월 버튼 없음"을 철회 — ACT열에서
  바로 미루는 흐름이 자연스러워 ghost ✕로 부활.)
- **carryCount 표시**: 0~1=숨김, 2~3=muted `·N`, 4+=amber(은근한 subproject 신호).
- **in-progress 하이라이트**: now가 걸친 ACT 블록 강조(시각으로 파생).
**이유**: 저장 상태를 최소화(plan만)하고 나머지를 파생하면 동기화 부담이 사라지고(ADR-013 정합),
어휘에서 단어 재사용이 없어져 모호함이 준다. ghost는 한 클릭 실행이라는 좋은 어포던스를 유지하되
비교 라벨만 떼어내 거슬림을 없앤다.
**트레이드오프**: 파생 비용(매 렌더 계산)은 1인 소량 데이터라 무시 가능. action kind가 *현재 plan
기준*이라, action 후 plan을 수정하면 kept→revised로 재분류된다(드물고 의미상 허용). **ADR-016을
구체화**한다(action status 저장만 철회).

### ADR-018: 각 날 plan 행 저장 유지 — "양끝만 저장(missed 파생)" 기각 (2026-06-23)
**맥락**: carry-over(ADR-015/017)가 매일 `missed`를 쌓는다. 그래서 "missed를 행으로 저장하지 말고
**막대 양끝**(originally·done)만 저장하고 가운데는 파생하자"를 검토했다. task를 *여러 날 걸친
막대*로 보는 유저 멘탈모델(왼끝=originally planned, 오른끝=done/today, 가운데=missed; 이미
`core/time/span.ts`·`TaskDetailModal.tsx`로 구현)에서 가운데 missed가 양끝 사이를 채우는
부산물처럼 보였기 때문. 동기는 데이터 단순화(유저가 원래 1구조를 원했으나 UX 위해 셋으로 나눔).
**기각 이유(결정적)**: 구글 캘린더 이벤트와 이 앱의 본질적 차이 — **매일 다시 계획되는 task는 그
날마다 시각이 다를 수 있다**(6/20 09:00, 6/21 14:00, 6/22 10:00…). 각 날의 시각이 *그 날이 가진
고유 정보*인 순간, 양끝(시작·끝)만으로 가운데를 복원할 수 없다 → missed는 "같은 시각의 빈 중복"이
아니라 **저장해야 할 데이터**다. 더해서, 유저가 미래 기능으로 원하는 **하루 여러 시간대**(점심·미팅
사이 분할)도 양끝 1행 압축이 봉쇄한다.
**결정**: **`plan_blocks`를 각 날 1행으로 저장하는 현행 구조를 유지**한다. `status(planned|missed)`,
sweep의 missed 누적, `span.ts`의 가운데 reconcile을 모두 그대로 둔다. "양끝만 저장"은 채택하지 않는다.
유일한 비용인 missed 행 누적은 1인 소량 데이터라 무시 가능하며(데이터 최적화 < UX·표현력 우선),
표현력(날마다 다른 시각)을 잃으면서까지 줄일 이유가 없다.
**트레이드오프**: 데이터가 "최적화"되진 않는다(carry로 같은 시각 missed가 양산되는 흔한 경우엔
중복). 그러나 그 단순화는 날마다 다른 시각·여러 시간대 표현력을 깨므로 받아들이지 않는다. 이 결정을
**기록으로 남기는 목적**: 미래에 "missed가 중복이니 줄이자"는 유혹이 다시 올 때, 각 날 저장이
표현력 때문에 옳다는 근거를 남긴다.
**관련 미래 기능(별도 ADR 예정, 본 ADR 범위 밖)**:
- **break type 블록**: 점심·휴식처럼 그 시간대에 모든 task를 건너뛰게 하는 블록. task가 아닌 *별도
  타입* → 데이터 모델 단순화 논의와 독립.
- **하루 여러 시간대**: 한 task를 같은 날 여러 블록으로 분할(현재 미구현). 각 날 plan 여러 행으로
  자연 확장 가능 — 본 ADR의 "각 날 저장" 결정이 이 확장을 막지 않는다.

### ADR-019: Review = 하루 일기 리플렉션, AI 분석은 분리해 후속 (2026-06-23)
**맥락**: ADR-004는 Review 패널을 "밤에 일기 작성 → 데일리 AI 분석"으로 뒀다. 구현 시점에 Review를
어떻게 구체화할지 정해야 했다. 사용자 의도가 명확했다 — **먼저 스스로 노트를 남기는 UI가 핵심**이고
AI 분석은 "nice-to-have"로 부차적이다. Review는 시각이 아니라 *하루 전체*에 대한 일기 같은
리플렉션이다.
**결정**:
- Review를 캘린더의 **네 번째 독립 열**로 둔다(`Plan │ 시간축 │ Act │ Review`). Plan/Act는 시간
  그리드를 공유하지만 **Review는 시간축을 공유하지 않는다** — 시간 라인 없이 하루 한 통 자유
  textarea(`ReviewColumn.tsx`).
- 저장은 **디바운스(600ms) 자동저장 + blur·날짜변경 flush**, TanStack Query **낙관적**(ADR-007).
  하루 1개를 `daily_reviews`의 `(user_id, date)` unique로 보장하고 PUT route가 upsert한다.
- **AI 분석은 이번 범위에서 분리**한다. `daily_reviews.ai_analysis`(jsonb, nullable)는 비워두고,
  나중에 plan+action+review를 소스로 AI가 채운다.
**이유**: ① Review가 "하루 전체"라 시각이 없으니 시간축 비공유가 사용자 멘탈모델과 일치. ② 자동저장은
일기 쓰는 흐름을 끊지 않는다(ADR-007). ③ AI 분리 — 2층 집계/3층 검색 파이프라인(ADR-006)이 아직
없고, 일기 데이터부터 쌓은 뒤 그 위에 AI를 얹는 것이 의존성 순서상 옳다. ④ 모델 비종속(ADR-005)·
Gemini 기본(ADR-012)은 후속 AI 작업에서 적용한다.
**트레이드오프**: ADR-004가 약속한 "데일리 AI 분석"이 이번에 구현되지 않고 연기된다. Review가 자유
텍스트 한 통이라 구조화(잘된 점/아쉬운 점/내일) 가이드는 없다 — 자유도를 우선했다. 추후 AI 입력으로
쓸 때 구조가 필요하면 재검토한다(본 결정을 깨지 않는 점진 확장).
**비고**: ADR-004를 *구체화*하며, ADR-006/012의 AI 부분은 본 ADR 이후 별도 작업으로 남긴다.

### ADR-020: 데일리 AI 분석 — 오늘 중심 입력, 버튼 트리거, 구조화 결과, 모델 선택 (2026-06-23)
**맥락**: ADR-019가 Review를 일기 UI로 먼저 구현하고 AI 분석은 연기했다(`daily_reviews.ai_analysis`를
비워둠). 이제 그 칸을 채운다. ADR-006의 3층 메모리(원장/집계/검색) 중 원장은 이미 있으나
집계(`category_stats` 갱신 파이프라인)·검색은 미구현이고, 데이터도 아직 적다(task 16개 수준).
**결정**:
- **스코프 = 오늘 하루**(3층 중 1층 raw만). 입력은 그 날의 `plan_blocks`+`action_blocks`+
  `daily_reviews`(일기)뿐. 누적 집계(예측 보정·성장 추세)와 과거 검색은 **데이터가 쌓인 뒤 후속
  phase**로 분리한다. ADR-019의 "plan+action+review를 소스로 채운다"와 정확히 일치, 의존성 순서상
  데일리 분석부터 동작시킨다.
- **트리거 = 명시적 버튼**("Analyze today"). Review는 자동저장이라 Submit이 없으므로(ADR-019), 분석은
  사용자가 하루 끝에 한 번 누른다. 데일리 1회 호출로 비용·토큰을 통제한다(ADR-004 트레이드오프 완화).
- **결과 = 가벼운 구조화 JSON**: `{ summary, observations[], encouragement, generatedAt }`. Vercel AI
  SDK `generateObject`로 zod 스키마(`core/ai/schema.ts`)를 강제해 안정적으로 받는다. `generatedAt`은
  AI가 아니라 서버가 저장 시 붙인다.
- **숫자는 core가 계산, 말은 AI가 생성**(결정적). 예상(plan 길이 합)·실제(action 길이 합)·carryCount
  같은 수치는 `core/time`/`core/ai`의 순수 함수가 계산해 프롬프트에 *사실*로 박고, UI에도 그 값을
  쓴다. AI는 그 사실을 보고 통찰·격려 *텍스트*만 만든다. 이유: LLM은 산수를 틀리는데 과소예측 교정이
  이 앱의 핵심이라 숫자 오류는 치명적이다.
- **모델 선택 = `user_settings`(DB)에 저장**. 헤더 기어 아이콘 드롭다운으로 고르고, DB에 두어 폰·
  노트북 어디서든 같은 모델이 적용된다(ADR-002). 분석 라우트는 모델 id를 **클라 body가 아니라 서버가
  DB에서 읽어** `resolveModelId`로 정규화한다(없으면 env `GEMINI_MODEL`). 신뢰 경계를 클라에 두지 않는다.
- **모델 비종속 유지**(ADR-005): 허용 모델은 `services/ai/models.ts`의 `AI_MODELS`
  (`{id,label,provider}`) 단일 출처에 둔다. 지금은 Gemini variants(`gemini-2.5-flash`/`-pro`)뿐이지만,
  OpenAI 등을 붙이려면 이 배열과 `provider.ts`의 분기만 늘리면 된다. 모든 AI 호출은 `services/ai`
  래퍼(`generateStructured`)로만 한다(CLAUDE.md CRITICAL).
- **레이어 분리**: 프롬프트 구성·숫자 계산·결과 스키마는 `core/ai`(순수), AI 호출은 `services/ai`,
  데이터 조립·저장은 `api`, 표시는 `components`. (CLAUDE.md "비즈니스 로직을 UI에서 분리".)
- **프롬프트 텍스트는 `prompts/` 마크다운 파일로 분리**. `prompts/daily-analysis-system.md`(시스템
  지시)와 `prompts/daily-analysis-user.md`(데이터 템플릿 + `{{PLACEHOLDER}}`)를 프로젝트 루트에 둔다.
  서버 route가 `fs`로 읽어 `buildDailyPrompt(input, templates)`에 넘기고, core는 치환만 한다. 이유:
  사용자가 코드를 건드리지 않고 프롬프트만 수정할 수 있어야 한다. core 순수성도 유지된다.
**이유**: 오늘 중심으로 좁히면 미구현 파이프라인(집계/검색)에 막히지 않고 가장 빨리 가치를 낸다.
구조화 결과 + core 숫자 계산은 과소예측 교정의 정확성을 지킨다. 모델을 DB에 두면 어디서든 일관된다.
**트레이드오프**: ADR-004/006이 그리는 누적 통계(성장 추세·예측 보정)는 이번에 포함되지 않는다 —
데이터가 쌓인 뒤 별도 phase. 모델 목록을 상수로 하드코딩하므로 새 모델이 나오면 코드를 수정해야
한다(1인 앱이라 허용). 일기를 안 쓴 날도 plan/action만으로 분석은 가능하나, 통찰 품질은 낮을 수 있다.
**비고**: ADR-004/006/019를 *구체화*한다(데일리 AI의 *의도*는 유지, 이번엔 오늘 중심으로 범위 확정).
집계·검색 파이프라인과 누적 통계는 본 ADR 이후 별도 작업으로 남긴다. phase `9-ai-review`로 구현.

### ADR-021: 커스텀 도메인 서브도메인 + repo 비공개 유지 (2026-06-23)
**맥락**: ADR-002에서 Railway 호스팅을 정했으나 주소는 Railway 기본 URL(`*.up.railway.app`)이었다.
제작자는 `hyeyoungjo.com` 도메인을 보유하고, 앞으로 만들 웹앱·플러그인들을 한 브랜드 허브 아래
모으려 한다(홈페이지는 별도 repo: `github.com/hyeyoungjo/homepage`).
**결정**:
- 앱 주소 = **`dearmyroutines.hyeyoungjo.com`**. Railway에 커스텀 도메인을 CNAME으로 연결한다.
  루트 `hyeyoungjo.com`은 홈페이지(허브)로 두고, 각 제품은 서브도메인으로 꽂는다("크리에이터가 브랜드").
- 서브도메인은 **하이픈 없는 `dearmyroutines`** (repo 폴더명 `dear-my-routines`와 무관, 안 맞춰도 됨).
- **repo는 비공개(private) 유지** — 오픈소스로 공개하지 않는다.
**이유**: 보유 도메인 하나로 앱을 무한 확장(비용 0)하고 브랜드를 일관되게 묶는다. 하이픈 없는
서브도메인이 구두 전달·입력 실수에 강하다. repo 비공개는 "링크만 보고 클론해 똑같이 만드는 것"을
코드 차원에서 원천 차단한다(소스를 안 주므로 클론 불가). 가치를 *호스팅된 서비스*에 두면 클론 방어가
공짜로 따라온다.
**트레이드오프**: 제품을 독립 브랜드(별도 도메인)로 키우는 길은 지금 포기(나중에 특정 앱만 분리 가능).
오픈소스 커뮤니티/기여도 포기. 배포 시 Supabase Site URL·redirect와 Google OAuth 설정에 새 도메인을
반영해야 한다.
**비고**: ADR-002를 구체화한다. 배포 절차·DNS·체크리스트는 `docs/LAUNCH-PLAN.md` 참조.

### ADR-022: 출시 전략 전환 — 단계적 공개 + BYO 키 기본 + AI 사용량 메터링 (2026-06-23)
**맥락**: ADR-001은 "수익화 보류, 순수 개인용"이었다. 이후 앱이 충분히 자라, 제작자는 (1) 다른 사람도
쓰게 공개하고 (2) Supabase·Railway 유지비를 언젠가 회수하되 (3) *지금 당장의 수익은 목표가 아니며*
(4) AI 비용 폭주로 통장이 터지는 것을 가장 경계한다. 현재 AI는 Gemini 전용(ADR-012), 서버 env 키
`GEMINI_API_KEY` 하나, BYO·메터링·rate limit 미구현이다.
**결정**:
- **단계적 출시**: dogfooding(제작자 1인, ~1개월) → 비공개 베타(`allowed_emails` allowlist, 10~30명,
  ~3개월) → 공개 출시. 데일리 습관 앱은 도달보다 *재방문*이 먼저라, 7일 재방문이 검증된 뒤에만 다음
  단계로 넘어간다.
- **AI 키 모델**:
  - 공개 단계 **기본 = BYO(Bring Your Own) 키** — 사용자가 설정(⚙)에서 본인 Gemini API 키를 입력한다.
    키는 암호화해 DB(`user_settings`, user_id+RLS)에 저장하고 **서버 라우트에서만 복호화·사용**한다
    (CLAUDE.md 비밀키 규칙). 변동비를 사용자에게 이전 → 제작자 AI 비용 ≈ 0, 비용 폭주 위험 제거.
  - **테스터(allowlist)는 매니지드 키**(제작자 `GEMINI_API_KEY`) 사용을 허용 — 일반인도 키 없이 AI를
    체험하는 표본을 확보한다.
  - **AI 없이도 완전 동작** — 키가 없으면 AI 리뷰만 비활성, 핵심(예상 vs 실제 시간추적)은 전원 사용.
- **사용량 메터링**: 새 테이블 `ai_usage`(user_id+RLS; `created_at`, `model`,
  `key_source`('managed'|'byo'), `prompt_tokens`, `completion_tokens`, `estimated_cost_usd`). 모든 AI
  호출이 서버 라우트(`services/ai`)를 지나므로 BYO·매니지드 양쪽 토큰을 기록한다. 토큰→비용 환산은
  `core/ai`의 순수 함수 + 단가 테이블. 용도: (a) 매니지드(내 돈) 실지출 추적, (b) BYO 사용 패턴 파악,
  (c) 향후 구독가를 *측정값*으로 산정.
- **비용 상한**: 매니지드 키엔 per-user 예산 + Google Cloud의 Gemini 키 예산 하드캡(백스톱)을 건다.
  베타는 allowlist로 사용자 수가 묶이고 하루 1회 버튼(ADR-020)이라 노출이 자연히 제한된다 → 거창한
  글로벌 kill switch는 공개 단계에서 필요할 때만 추가(공개는 BYO라 비용 ≈ 0이라 불필요할 수 있음).
- **후원**: Ko-fi 링크(☕)를 푸터·설정에 가볍게 단다(PayPal Business 또는 Stripe 연결).
- **구독은 보류**: "키 없이 매니지드 AI를 쓰는 편의"를 파는 유료 티어로 *나중에* — 메터링 데이터가
  충분히 쌓인 뒤 가격을 정한다.
**이유**: BYO 기본은 무료 공개를 *통장 위험 없이* 가능케 하고, 메터링은 미뤄둔 수익화의 연료(가격
근거)를 지금 모은다. 후원/구독을 코드보다 데이터로 결정한다.
**트레이드오프**: BYO 기본이면 핵심 셀링포인트인 데일리 AI 리뷰가 *비개발자에겐 진입 장벽*이 된다
(키 발급 필요) — 단 핵심 시간추적은 전원 사용 가능해 지금은 감수한다. ADR-001의 "순수 개인용"을
명시적으로 **전환**한다(데이터 모델에 남겨둔 멀티유저 여지를 이제 사용). BYO·메터링·암호화 저장은
*베타 시작 전* 구현이 필요하다(dogfood 단계엔 불필요).
**비고**: ADR-001을 evolve하고, ADR-012(Gemini 전용)·ADR-020(모델 DB 저장) 위에 BYO 키·메터링을
얹는다. 타임라인·배포 체크리스트·홍보 계획은 `docs/LAUNCH-PLAN.md`.

### ADR-023: 모바일 레이아웃 — 상단 폴더 탭 (Plan / Act / Reflect) (2026-06-23)
**맥락**: 데스크탑은 Plan·Act·Reflect 3열을 나란히 보여주지만, 모바일에서는 가로 공간이 부족해
세 열을 동시에 표시할 수 없다. 하단 탭바, 스와이프, 드로어, 상단 탭 등 여러 패턴 중 하나를 골라야 했다.
**결정**:
- **상단 폴더 탭** — Plan·Act·Reflect 탭이 섹션 패널 위에 파일 폴더처럼 달리고, 활성 탭은 패널과
  동일한 배경색(`bg-panel`) + `-mb-px`로 아래 테두리를 숨겨 폴더가 패널에 붙어있는 모양을 만든다.
- 탭 라벨: 영어 Plan/Act/Reflect, 한국어 계획하기/실천하기/돌아보기.
- 활성 탭 라벨에 페이즈별 색상(Plan=파랑, Act=초록, Reflect=보라)을 CSS 변수로 적용 (라이트/다크).
- 데스크탑(`sm:` 이상)은 기존 3열 레이아웃 유지 — 모바일 전용 변경.
- 프로젝트 목록은 모바일에서 `flex-nowrap` + `overflow-x-auto` 가로 스크롤로.
**이유**: 폴더 탭은 "지금 어느 섹션에 있는지"를 직관적으로 보여주고, 패널과 시각적으로 합쳐지는
모양이 섹션 소속감을 자연스럽게 전달한다. 하단 탭은 엄지 접근성은 좋으나 리뷰 텍스트 입력 시 키보드가
올라오면 탭을 가리는 문제가 있어 제외했다.
**트레이드오프**: 한 번에 하나의 섹션만 볼 수 있어 Plan↔Act 비교는 데스크탑에서만 가능.

### ADR-024: 그리드 시간 범위 사용자 설정 (grid_start_time / grid_end_time) (2026-06-23)
**맥락**: 캘린더 그리드의 표시 시작·종료 시각이 7AM·2AM으로 하드코딩돼 있었다. 사람마다 기상·취침
시간이 다르므로(야행성 등) 고정값은 모두에게 맞지 않는다.
**결정**:
- `user_settings` 테이블에 `grid_start_time`(integer), `grid_end_time`(integer) 컬럼 추가.
  null이면 기본값(start=7, end=24)으로 폴백.
- 값은 **시 단위 정수** — 24 이상은 다음 날(예: 26 = 새벽 2시). 이렇게 하면 자정을 넘는 그리드도
  단순 정수 뺄셈으로 처리된다.
- 설정 UI: 기어 메뉴에 "Grid hours" 섹션, From/To 드롭다운(0~23시 전 범위).
- `core/time/calendar.ts`의 `gridSlots`, `blockTopMinutes`, `snapToSlot`, `slotDate` 함수가
  모두 `startHour`/`endHour` 파라미터를 받도록 수정(기본값 = 기존 상수, 하위 호환).
**이유**: 표시 범위가 visualization의 문제이므로 데이터 구조를 건드리지 않고 UI 레이어에서 해결.
**트레이드오프**: 그리드 범위보다 넓은 시간의 블록은 화면에서 보이지 않는다(데이터는 온전히 보존됨).

### ADR-025: 데이터 날짜 ↔ 시각화 분리 — 자정 기준 귀속, 시간 윈도우 필터 (2026-06-23)
**맥락**: 기존 `gridDayOf()`는 새벽 7시 이전 타임스탬프를 "전날 그리드"로 귀속시켰다(하드코딩된
"논리적 하루" 경계). 이 설계는 두 가지 문제를 만들었다. ① 기상 시각이 7시가 아닌 사람은 귀속이
어긋나 블록이 엉뚱한 날에 저장된다. ② 그리드 시간이 사용자 설정으로 바뀌면 귀속 경계도 따라 바꿔야
해 데이터 레이어가 시각화 설정에 종속된다.
**결정**:
- **데이터 귀속은 달력 자정 기준** — `gridDayOf(ts)` = `dayKey(ts)` (새벽 7시 wrap 제거).
  새벽 1시 블록은 달력상 그 날짜에 귀속된다.
- **화면 표시는 시간 윈도우 필터** — `plansForDay(plans, day, gridStartHour, gridEndHour)`는
  `startAt >= day+gridStartHour AND startAt < day+gridEndHour`로 필터링한다. `gridEndHour > 24`이면
  다음 달력 날짜의 새벽까지 포함해 자정을 넘는 그리드(예: 22시~3시)도 자연스럽게 동작한다.
- `carry.ts clockOntoGridDay`도 새벽 wrap 제거 — 블록을 특정 날짜로 이동할 때 그 날의 달력 날짜에
  동일 시각으로 배치한다.
**이유**: "데이터는 사실(타임스탬프), 화면은 해석(윈도우)"라는 원칙. 사람마다 하루 경계가 다를 수 있어
고정 경계를 데이터 레이어에 두는 게 적절하지 않다. 윈도우 필터는 자정을 넘는 그리드도 커버해
night-owl 사용자에게도 올바르게 동작한다.
**트레이드오프**: 기존 새벽 0시~7시에 기록된 블록은 달력 다음 날짜 귀속으로 재해석된다(타임스탬프
자체는 변경 없음). 그리드 윈도우 설정을 0시 이전부터 시작하거나 24시 이후까지 늘리면 해당 블록이
원래 의도한 날의 그리드에 다시 보인다.
**비고**: `core/time/day.ts`·`plan.ts`·`action.ts`·`carry.ts` 수정, 테스트 106개 전부 통과.

### ADR-026: Shelf — 비긴급 task를 의도적으로 내려놓는 선반 (2026-06-30)
**맥락**: 데이 바운더리 sweep(`useCarryOverSweep`, ADR-009/015)은 못 끝낸 `planned` 블록을 매일
자동으로 오늘로 끌어온다. 급한 일에는 좋은 압박이지만, **안 급한 일까지 똑같이 매일 끌려와** `missed`
블록과 `carryCount`만 쌓이며 사용자에게 스트레스를 준다. "지금은 안 할래, 잠깐 내려놓되 잃어버리진
않게" 하는 *능동적* 보관 행위가 없었다. 이는 자동 누적되는 *수동적* delay와 근본적으로 다르다.
**결정**:
- **`tasks.shelvedAt`(nullable timestamp) 한 컬럼 추가.** `null`=활성, 값 있으면=내려놓음(시각도 기록).
  task의 현재 상태는 plan/action에서 derive하는 게 이 프로젝트 원칙(ADR-016)이지만, **"내가 일부러
  내려놨다"는 의도는 plan/action만으로 derive 불가** — shelf가 저장 컬럼을 두는 유일한 예외다.
- **올리기**: 그 task의 **plan 블록을 삭제**(planned·missed 모두 — 캘린더의 plan 발자국 제거)하고
  `shelvedAt=now`를 찍는다. **action 블록(실제 실행 기록 = "예상 vs 실제"의 핵심 데이터)은 보존**하고
  shelvedAt 필터가 캘린더에서만 가린다. sweep도 그 task를 건너뛴다. carry-count는 리셋되는데, 이는
  shelf의 목적("지연 더미를 의식적으로 리셋")과 맞는다.
- **보기**: 좌측 **Shelf 패널**(`ShelfColumn`) — 데스크탑은 nav 토글로 접는 좌측 레일, 모바일은
  오버레이 drawer. 이 앱에 task 목록 UI가 없으므로(블록으로만 task가 보임) 보관함을 새로 만든다.
- **꺼내기(un-shelf)**: `shelvedAt=null` + **오늘 날짜에 새 `planned` 블록 하나 생성**(`freshPlanToday`).
  plan이 남아있지 않으므로 항상 정확히 1개 — 중복이 생기지 않는다.
**이유**: shelf는 carry-over 컨베이어벨트에서 task를 빼내는 의도적 행위다. "rows가 진실, view는 조립"
(ADR-013) 원칙 위에서, shelf는 *의도*라는 새 차원이라 1개 컬럼으로 저장하되 나머지는 전부 기존 derive
로직(sweep skip + 렌더 필터)을 재사용한다. 데이터 모델을 최소로 건드리고 UX는 분리한다.
**트레이드오프**: 활성/내려놓음을 가르는 저장 플래그가 하나 생겨, "상태는 derive" 순수성에 작은 예외를
둔다. 그리고 shelve가 plan 블록을 **삭제**하므로 그 task의 `missed` 히스토리·carry-count가 사라진다
(ADR-018 "missed는 리뷰 데이터"와의 긴장) — 단 shelve는 의도적 리셋이라 이를 감수한다. action(실제
기록)은 절대 지우지 않아 "예상 vs 실제" 데이터는 보존된다.
**비고**: 최초 설계는 "plan을 숨김(필터, 삭제 아님)"이었으나, un-shelve 때 숨겨진 plan이 되살아나며 새
plan과 겹쳐 **블록이 중복 생성되는 버그**가 있었다. → **"plan 삭제 + action 보존"으로 개정**(유저 결정):
캘린더에 있거나 선반에 있거나 둘 중 하나, 되살아날 게 없어 중복이 원천 소멸. phase `12-shelf`(step0~6)로
구현했고, 손대는 곳 — `db/schema.ts`(컬럼+마이그레이션), `core/time/shelf.ts`+`plan.ts`,
`api/tasks/[id]`(PATCH `shelvedAt`), `hooks/useCarryOverSweep.ts`(skip)·`hooks/shelf.ts`(shelve/un-shelve),
`CalendarGrid.tsx`(필터)·`CalendarBlock.tsx`(shelf 버튼)·`TaskDetailModal.tsx`, 신규 `ShelfColumn.tsx`·
앱셸(`AppSidebar.tsx`/`HeaderMenu.tsx`) + i18n(en/ko).

### ADR-027: Continue Later — → 버튼을 목적지 선택으로 일반화, 이벤트 블록 기각 (2026-07-01)
**맥락**: "task를 하다가 중간에 쉬었다가 이어서 하기"를 원했다. 처음엔 휴식·미팅·출근·퇴근 같은
"끼워넣는 이벤트 블록"을 새 개념으로 만들자는 논의였으나, 다음 결론에 도달했다 — ① 미팅·출근 등은
성격상 그냥 **task로 만들면 된다**(이 앱은 모든 블록이 task다). 별도 이벤트 개념이 불필요. ② 휴식은
기록 대상이 아니라 **두 작업 조각 사이의 빈틈**일 뿐이다. ③ 진짜 필요한 건 하나 — **task를 하루 안에서
멈췄다가 이어서 하기**. 그런데 지금은 → 버튼이 항상 내일로 carry라, "이어하기"가 사실상 다음날로만
가능하다.
**결정**:
- **"이벤트/휴식 블록" 개념 기각.** 미팅·출근은 task로, 휴식은 두 조각 사이의 빈틈으로 남긴다.
  새 테이블·새 컬럼을 만들지 않는다.
- **→ 버튼 = 목적지 선택 팝오버**(`오늘 이따가` / `내일` / `특정 날짜`). 지금은 action에만 있는 → 를
  **plan·action 실블록 양쪽**에 단다. ghost의 carry도 이 팝오버로 흡수한다.
- **동작 매트릭스**:

  | 목적지 | ACTION 블록 | PLAN 블록 |
  |---|---|---|
  | 오늘 이따가 | 같은 task 새 **plan 블록**(위치=블록끝+1h, 60분). 원본 그대로(partial/missed 안 붙임) | 같은 task 새 **plan 블록**(블록끝+1h, 60분). 원본 `planned` 그대로 |
  | 내일 | action `partial` + 내일 plan(같은 시각) | `carryOverPlan(plan, 내일)`: 원본→`missed` + 내일 새 `planned` |
  | 특정 날짜 | action `partial` + 그날 plan(같은 시각) | `carryOverPlan(plan, 그날)`: 원본→`missed` + 그날 새 `planned` |

- **"오늘 이따가"의 기준점은 now가 아니라 "그 블록 자신의 끝 시각 + 1시간"** 이다. 이유: 이 액션이 plan
  칼럼에서도 호출되는데, plan 블록은 벽시계상 now와 무관하기 때문. 블록-상대라야 plan/act 양쪽에서
  일관된다. 그리드 끝을 넘으면 clamp한다.
- **"오늘 이따가"는 miss가 아니다** — 같은 날 이어하기는 "놓침"이 아니라 additive다. 그래서 원본에
  missed/partial 딱지를 붙이지 않고, 같은 task의 새 plan 조각을 하나 더 만든다. task는 하루에 blocks
  여러 개(1:N)이므로 구조 변경이 필요 없다.
- **아이콘 언어 정리**: 삭제 버튼을 `✕`(faXmark)에서 **쓰레기통**(faTrashCan)으로 교체한다. `✕`는
  "닫기" 전용(팝오버·모달)으로 남긴다. 결과적으로 블록의 아이콘 뜻이 갈린다 — **→ = 이어하기/미루기,
  🗑 = 삭제**.
**이유**: 새 개념·스키마를 만들지 않고 UX 문제(하루 안 pause/resume)를 기존 배관 위에서 푼다.
`carryOverPlan(plan, toDate)`가 이미 임의 날짜를 받으므로 "내일/특정 날짜"는 core 변경이 없다.
"데이터는 사실, 화면은 해석"(ADR-025)·"파생값 저장 안 함"(ADR-013/018) 원칙과 정합 — 남은 분량을
계산해 옮기지 않고 그냥 새 조각을 추가한다.
**트레이드오프**: "오늘 이따가"가 남은 분량을 자동 계산하지 않으므로(기본 60분 새 블록), 정확한 잔여
시간은 사용자가 리사이즈로 맞춘다. 이는 파생값을 저장/계산하지 않는 원칙을 지키기 위한 선택이다.
**비고**: 손대는 코드는 `core/time/plan.ts`(신규 `continueLaterSpan`)·`CalendarBlock.tsx`·
`CalendarGrid.tsx`·i18n(en/ko). phase `13-continue-later`(step 0~2). **스키마 변경 없음** →
`DATA-STRUCTURE.md`는 수정하지 않는다.

### ADR-028: 프로젝트 상태 — active/inactive(Shelf)와 visibility(캘린더 필터) 두 직교 축 (2026-07-02)
**맥락**: 프로젝트는 지금 "존재 vs 하드삭제"뿐이라 중간 상태가 없다. 삭제하면 그 프로젝트의 task가
`projectId=null`(미배정)로 풀려 그룹핑이 깨진다. 사용자가 원한 건 두 가지 다른 행위다 — ① 프로젝트를
당장 안 굴리지만 지우긴 아까워 **잠깐 치워두기**, ② 지금 집중하려고 다른 프로젝트를 캘린더에서 **잠깐
숨기기**. 이 둘은 성격이 달라 한 상태로 뭉뚱그릴 수 없다.
**결정**:
- `projects`에 **nullable timestamptz 2개**를 추가한다(shelf `tasks.shelvedAt`(ADR-026) 패턴 미러 —
  "언제 그렇게 뒀는가"의 시각도 함께 기록):
  - **`deactivatedAt`** (active/inactive, 라이프사이클 축): null=활성. 값 있으면=비활성 → 프로젝트가
    **Shelf 컬럼에 표시**되고(이미 shelved task가 사는 곳), top legend와 task의 프로젝트 지정 픽커에서
    제외된다. **task에는 무영향** — 그 프로젝트의 task는 `projectId`·색·통계를 그대로 유지하고 자기
    상태대로 캘린더에 남는다. 비활성은 *프로젝트 자체*를 치우는 것이지 task를 건드리지 않는다.
  - **`hiddenAt`** (visibility, 화면 포커스 축): null=표시. 값 있으면=숨김 → 그 프로젝트에 속한 task의
    **plan/action/ghost 블록을 캘린더 렌더에서 필터**한다. **task에 영향을 주는 건 이 축뿐**이다. 단
    legend 칩은 남아(eye-slash 상태로) 언제든 다시 켤 수 있다.
- **두 축은 직교(orthogonal)** 한다: 활성인데 잠깐 숨김(집중), 비활성인데 참고로 표시 — 네 조합이 모두
  유효하다. deactivatedAt은 *프로젝트를 어디에 두나*(캘린더 영역 vs Shelf), hiddenAt은 *그 task 블록을
  그리나 마나*를 정한다.
- **"상태는 derive"가 이 프로젝트 원칙**(ADR-016: task/project 현재 상태는 plan/action에서 파생, 저장
  안 함)이지만, **"내가 비활성/숨김으로 뒀다"는 사용자 의도라 plan/action만으로 derive 불가** → shelf와
  똑같이 저장 컬럼을 두는 예외다(ADR-026과 동일 논리 — 의도는 새 차원이므로 파생 불가).
- **프로젝트 칩 아이콘 3개**: activate(활성↔비활성 토글) · eye(표시↔숨김 토글) · trash(하드삭제, 기존
  동작 유지). 세 동작이 각각 위 세 축(deactivatedAt / hiddenAt / DELETE)에 1:1 대응한다.
- **binary만 둔다** — completed/paused/archived 같은 세분화는 하지 않는다. 이 앱에선 그 구분에 따른
  동작 차이가 없어 상태 차원만 늘 뿐이다(YAGNI, ADR-001). 필요해지면 나중에 확장한다.
**이유**: 기존 shelf 인프라(Shelf 컬럼·shelvedAt 필터 패턴)와 derive 로직을 재사용하고 데이터 모델을
**최소로**(컬럼 2개) 건드린다. visibility는 본래 "화면 해석"(ADR-025)이라 localStorage 같은 클라 뷰
상태에 둘 수도 있으나, **멀티 디바이스 일관성**(폰·노트북 어디서든 같은 숨김 상태, ADR-002)을 위해
**DB에 저장**한다.
**트레이드오프**: "상태는 derive" 순수성에 저장 플래그 2개(deactivatedAt/hiddenAt) 예외가 는다.
visibility를 DB에 둬서 순수 뷰 상태가 데이터 레이어에 섞인다(ADR-025의 "데이터는 사실, 화면은 해석"과
약한 긴장) — 대신 기기 간 일관성을 얻는다. 1인·소량 데이터라 감수한다.
**비고**: 손대는 곳 — `db/schema.ts`(+마이그레이션), 신규 `core/project.ts`(상태 판정 순수 함수),
`ProjectLegend.tsx`(칩 아이콘 3개), `CalendarGrid.tsx`/`CalendarBlock.tsx`(hidden 필터),
`ShelfColumn.tsx`(inactive 프로젝트 표시), i18n(en/ko). **localStorage → DB 이전(rail/undo/guide-seen)은
본 ADR 범위 밖 — 성격이 다른 별도 phase 15**. phase `14-project-states`(step 0~5)로 구현.
