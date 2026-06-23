# Step 1: prompt-core

데일리 AI 분석의 **순수 로직 레이어**를 만든다. 오늘 하루의 plan/action/review 데이터를 받아
① 예상 vs. 실제 **숫자를 계산**하고 ② 그것으로 LLM **프롬프트 문자열을 조립**하며 ③ AI 출력의
**zod 스키마**를 정의한다. `src/core/ai/`에 두며, React·DB·네트워크에 의존하지 않는 순수 함수다
(CLAUDE.md CRITICAL: 비즈니스 로직·AI 프롬프트 구성은 core의 순수 함수로).

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `core/`는 React·DB·네트워크 import 금지(순수 함수만), `core/time` 구조
- `/docs/ADR.md` — ADR-006(3층 메모리), ADR-020(데일리 AI 분석 — **특히 "숫자는 core 계산, 말은
  AI" 원칙**과 결과 JSON 구조)
- `/src/core/time/plan.ts` — `PlanBlock` 타입, `plansForDay`, `carryCountOf`, `planSpan`,
  `originalDateOf`, `revisedDateOf` (꼼꼼히 읽어라)
- `/src/core/time/action.ts` — `ActionBlock` 타입, `actionsForDay`, `actualMinutesOf`, `actualDateOf`
- `/src/core/time/calendar.ts` — `durationMinutes(start, end)`, `Span`
- `/src/db/schema.ts` — `Task`, `Project` 타입(`tasks`/`projects` 테이블의 컬럼)
- `/src/services/ai/models.ts` — (step 0 산출) 이 step과 무관하지만 참고

이전 step(0)에서 만들어진 `src/services/ai/`를 읽고, 결과 스키마가 거기 `generateStructured`의
`schema` 인자로 들어간다는 점을 이해한 뒤 작업하라.

## 작업

### 1. `src/core/time/plan.ts`에 예상 시간 헬퍼 추가

`action.ts`에는 실제 시간을 합산하는 `actualMinutesOf(taskActions)`가 있는데, plan 쪽에는 대칭
함수가 없다. 다음을 추가하라(`actualMinutesOf`와 대칭, `durationMinutes`로 각 plan span 길이 합산):

```ts
/** Total planned minutes for a task — the sum of its plan spans (the estimate side). */
export function plannedMinutesOf(taskPlans: PlanBlock[]): number;
```

- 이유: 예상(plan 길이) vs 실제(action 길이)가 이 앱의 핵심 비교(PRD "예상 vs. 실제")인데, 예상
  쪽 합산기가 없다. **이 숫자는 AI가 아니라 우리가 계산한다(ADR-020).**

### 2. `src/core/ai/schema.ts` — AI 출력 스키마(zod)

```ts
import { z } from "zod";

// 가벼운 구조화(ADR-020). 숫자 비교는 여기 없다 — 그건 우리가 계산해 프롬프트에 사실로 넣는다.
// AI는 이 텍스트 필드만 생성한다.
export const dailyAnalysisSchema = z.object({
  summary: z.string(),              // 오늘 하루 한 줄 총평
  observations: z.array(z.string()),// 관찰(과소예측 패턴·이월·카테고리 쏠림 등)
  encouragement: z.string(),        // 자기효능감 격려 한마디
});

export type DailyAnalysis = z.infer<typeof dailyAnalysisSchema>;
```

- `generatedAt`(생성 시각)은 **스키마에 넣지 마라** — 그건 AI가 생성하는 값이 아니라 서버(step 4)가
  저장 시 붙이는 메타데이터다.

### 3. `prompts/` 디렉토리에 프롬프트 마크다운 파일 생성

프롬프트 텍스트를 코드에서 분리해 **사용자가 코드를 건드리지 않고 직접 편집**할 수 있게 한다.
프로젝트 루트에 `prompts/` 폴더를 만들고 두 파일을 둔다. 서버(step 4의 route)가 이 파일들을
`fs`로 읽어 `buildDailyPrompt`에 넘긴다 — core 자체는 파일을 읽지 않으므로 순수성이 유지된다.

**`prompts/daily-analysis-system.md`** — 시스템 프롬프트(AI의 역할·규칙·언어 지시). 변수 없음:
```
You are a personal time management coach reviewing one day's work.

Rules:
- Reply in the same language as the user's journal. If the journal is empty, reply in English.
- Base your analysis only on the data provided — do not invent or assume anything not shown.
- Numbers (planned/actual minutes, carry counts) are pre-calculated and given to you as facts.
  Do not recalculate them.

Focus areas (in order of importance):
1. Time under-estimation patterns (planned vs actual gaps).
2. Tasks carried over repeatedly (carryCount ≥ 2) as a signal of subproject-scale scope.
3. Self-efficacy — what went well, what the person can feel good about.
```

**`prompts/daily-analysis-user.md`** — 유저 프롬프트 템플릿. `{{PLACEHOLDER}}` 치환자 사용:
```
Date: {{DATE}}

## Tasks
{{TASK_ROWS}}

Total planned: {{TOTAL_PLANNED_MINUTES}} min
Total actual:  {{TOTAL_ACTUAL_MINUTES}} min

## Journal
{{JOURNAL_TEXT}}
```

치환자 목록:
- `{{DATE}}` — YYYY-MM-DD
- `{{TASK_ROWS}}` — task별 한 줄씩 (예: `- Write ADR draft | planned 60 min | actual 95 min | carried 1×`)
- `{{TOTAL_PLANNED_MINUTES}}` — 하루 예상 총합(숫자)
- `{{TOTAL_ACTUAL_MINUTES}}` — 하루 실제 총합(숫자)
- `{{JOURNAL_TEXT}}` — 사용자 일기 원문(비어 있으면 `(no journal written)`)

> 이 마크다운 파일 내용은 초안이다. 사용자가 직접 편집해 표현을 다듬을 수 있다.
> **치환자 이름(`{{...}}`)을 바꾸면 4번의 치환 코드도 함께 바꿔야 하니 이름은 그대로 유지하라.**

### 4. `src/core/ai/buildPrompt.ts` — 숫자 요약 + 프롬프트 조립

오늘 하루 데이터를 받아 (a) task별 예상/실제 숫자를 계산하고 (b) **외부에서 받은 템플릿** 문자열에
치환자를 채워 프롬프트를 완성한다. **순수 함수** — 파일시스템·네트워크·`new Date()`에 접근하지
않는다. 필요한 것은 모두 인자로 받는다.

```ts
import type { PlanBlock } from "@/core/time/plan";
import type { ActionBlock } from "@/core/time/action";
import type { Task, Project } from "@/db/schema";

/** 분석 1건의 입력. 모두 "오늘"(특정 grid day)로 이미 필터된 데이터를 받는다. */
export type DailyAnalysisInput = {
  date: string;            // YYYY-MM-DD (분석 대상 grid day)
  tasks: Task[];           // 그날 plan 또는 action이 있는 task들
  projects: Project[];     // task의 project 이름 매핑용
  plans: PlanBlock[];      // 그날 plan_blocks (wire 형태)
  actions: ActionBlock[];  // 그날 action_blocks (wire 형태)
  journalText: string;     // 사용자 일기(비어 있을 수 있음)
};

/** 외부(route)가 파일시스템에서 읽어 건네는 프롬프트 템플릿 쌍. */
export type PromptTemplates = {
  system: string;  // prompts/daily-analysis-system.md 원문
  user: string;    // prompts/daily-analysis-user.md 원문({{PLACEHOLDER}} 포함)
};

/** task 한 줄 요약(우리가 계산한 사실). 프롬프트와 (원하면) UI가 함께 쓸 수 있는 중간 표현. */
export type TaskFactRow = {
  title: string;
  category: string | null;
  projectTitle: string | null;
  plannedMinutes: number;  // plannedMinutesOf
  actualMinutes: number;   // actualMinutesOf
  carryCount: number;      // carryCountOf
};

/** 입력에서 task별 사실 줄 + 하루 합계를 계산(예상 총합·실제 총합). 순수. */
export function summarizeDay(input: DailyAnalysisInput): {
  rows: TaskFactRow[];
  totalPlannedMinutes: number;
  totalActualMinutes: number;
};

/**
 * 분석 호출용 system/user 프롬프트 쌍.
 * templates의 {{PLACEHOLDER}}를 실제 값으로 치환해 완성된 문자열을 반환한다.
 */
export function buildDailyPrompt(
  input: DailyAnalysisInput,
  templates: PromptTemplates,
): {
  system: string;
  prompt: string;
};
```

구현 요구(핵심 규칙만 — 나머지는 재량):

- **숫자는 전부 core에서 계산해 프롬프트에 사실로 박는다.** task별 `plannedMinutes`/`actualMinutes`/
  `carryCount`와 하루 총 예상/실제 분을 텍스트로 명시하라. AI에게 "직접 계산하라"고 시키지 마라.
  이유: LLM은 산수를 틀리는데, 과소예측 교정이 이 앱의 핵심이라 숫자 오류는 치명적이다(ADR-020).
- `buildDailyPrompt`는 `templates.system`을 그대로 `system`으로 반환하고, `templates.user`의
  `{{DATE}}`, `{{TASK_ROWS}}`, `{{TOTAL_PLANNED_MINUTES}}`, `{{TOTAL_ACTUAL_MINUTES}}`,
  `{{JOURNAL_TEXT}}`를 각각 계산된 값으로 치환해 `prompt`로 반환한다.
- **파일 읽기를 core에서 하지 마라** — 파일 내용은 route(step 4)가 읽어 인자로 넘긴다(순수성 유지).
- task별 예상/실제 합산은 1번에서 만든 `plannedMinutesOf`와 `action.ts`의 `actualMinutesOf`를
  task별로 필터해서 쓴다. project 이름은 `task.projectId`로 `projects`에서 찾는다(없으면 null).

### 5. 단위 테스트

`src/core/ai/buildPrompt.test.ts`(및 원하면 `plan.test.ts`에 `plannedMinutesOf` 케이스)를 작성하라:

- `plannedMinutesOf`: 여러 plan span 길이가 올바르게 합산되는가(빈 배열 = 0).
- `summarizeDay`: 예상/실제 총합과 task별 행이 입력과 일치하는가, carryCount가 missed 수와 맞는가.
- `buildDailyPrompt`: 더미 `templates`(인라인 문자열)를 넘겼을 때, 반환된 `prompt`에 `{{DATE}}`가
  실제 날짜로, `{{TOTAL_PLANNED_MINUTES}}`가 계산된 숫자로, `{{JOURNAL_TEXT}}`가 일기 텍스트로
  치환됐는가. (파일 읽기 없이 인라인 템플릿으로 테스트하는 것이 포인트.)

## Acceptance Criteria

```bash
npm run build
npm test
```

- 두 커맨드가 통과해야 한다. 이 step은 순수 로직이라 **새 테스트가 필수다**(위 3종).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 파일이 `src/core/ai/`에 있고, React·DB 클라이언트·`fetch`/네트워크를 import하지 않는가?
     (ARCHITECTURE.md "core는 순수 함수만") — `Task`/`Project` **타입** import는 허용(타입은 런타임
     의존이 아님).
   - 함수 안에서 `new Date()`를 직접 부르지 않고, 시간이 필요하면 인자로 받는가?(결정적 테스트)
   - 숫자 계산이 core에 있고 AI에게 위임하지 않는가?(ADR-020)
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(생성 파일·추가 함수 포함)"`
   - 실패(수정 3회 후) → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`

## 금지사항

- core 파일에서 `@/db`, `@/services`, `@/hooks`, React, `fetch`를 import하지 마라(타입 전용 import
  제외). 이유: core는 UI·DB·네트워크 비의존이어야 모바일 재사용·단위 테스트가 가능하다(ARCHITECTURE).
- AI에게 숫자(예상/실제 분, 비율)를 계산시키는 프롬프트를 쓰지 마라. 이유: LLM 산수 오류가 과소예측
  교정을 망친다 — 숫자는 core가 계산한다(ADR-020).
- 함수 내부에서 `new Date()`/현재시각을 직접 읽지 마라. 이유: 순수성·테스트 결정성. 필요하면 인자로.
- 실제 AI 호출을 하지 마라(`generateObject` 등). 이유: 호출은 services(step 0)·route(step 4) 담당.
- `buildDailyPrompt` 안에서 `fs`, `path`, `readFileSync` 등으로 파일을 읽지 마라. 이유: core는
  순수 함수여야 하고(파일시스템 비의존), 파일 읽기는 route(step 4) 담당이다.
- `prompts/` 마크다운 파일 안의 `{{PLACEHOLDER}}` 이름을 바꾸지 마라. 이유: route(step 4)의 치환
  코드가 이 이름을 그대로 참조한다.
- 기존 테스트를 깨뜨리지 마라.
