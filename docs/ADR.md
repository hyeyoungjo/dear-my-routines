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
