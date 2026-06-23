# Step 4: analyze-route

데일리 AI 분석을 실제로 수행하는 **서버 라우트**를 만든다. 한 날짜를 받아 그날의
plan/action/review를 모아 프롬프트를 만들고(core), 사용자가 고른 모델로 AI를 호출해(services),
결과를 `daily_reviews.ai_analysis`에 저장한다. 이 step이 step 0·1·2를 하나로 엮는다.

## 읽어야 할 파일

먼저 아래를 읽고 모든 조각이 어떻게 맞물리는지 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 흐름의 `[Review] → 3층 메모리 조립 → AI SDK → 저장`
- `/docs/ADR.md` — ADR-005/012(AI 호출), ADR-006(3층 메모리 — 이번엔 1층 raw "오늘"만),
  ADR-020(스코프=오늘 중심, 결과 구조, 숫자는 core 계산, 모델은 user_settings에서 읽음,
  **프롬프트는 `prompts/` 마크다운 파일에서 읽어 core에 넘김**)
- `/src/services/ai/index.ts`, `provider.ts`, `models.ts` — (step 0) `generateStructured`,
  `resolveModelId`
- `/src/core/ai/buildPrompt.ts`, `schema.ts` — (step 1) `buildDailyPrompt(input, templates)`,
  `PromptTemplates`, `dailyAnalysisSchema`, `DailyAnalysisInput`
- `/prompts/daily-analysis-system.md`, `/prompts/daily-analysis-user.md` — (step 1 생성) 이 route가
  읽어 `templates`로 넘기는 프롬프트 파일. 경로: 프로젝트 루트 기준.
- `/src/core/time/plan.ts`, `/src/core/time/action.ts` — `PlanBlock`/`ActionBlock` **wire 타입**
  (timestamps가 ISO 문자열) — DB 행을 이 형태로 매핑해야 한다
- `/src/db/schema.ts` — `tasks`, `projects`, `planBlocks`, `actionBlocks`, `dailyReviews`,
  `userSettings`(step 2)
- `/src/app/api/daily-reviews/route.ts` — 인증·userId·`onConflictDoUpdate` 패턴
- `/src/core/time/day.ts` — grid day 경계(필요 시 참고)

## 작업

### Route handler — `src/app/api/daily-reviews/analyze/route.ts`

```ts
// POST /api/daily-reviews/analyze
//   body: { date: string }   // YYYY-MM-DD (분석할 grid day)
//   → 분석 후 갱신된 daily_reviews 행(ai_analysis 채워짐)을 반환.
export async function POST(request: NextRequest): Promise<NextResponse>;
```

흐름과 구현 요구:

1. **인증**: `supabase.auth.getUser()` → 없으면 401. 이하 모든 쿼리는 `user.id`로 스코프한다.
2. **검증**: `date`는 `YYYY-MM-DD` 형식. 위반 시 400 + `{ error }`.
3. **데이터 조회(Drizzle)**: 그 `date`의 `plan_blocks`·`action_blocks`(둘 다 `date` 컬럼이 grid day),
   해당 task들(`tasks`)과 그 `projects`, 그리고 그 날의 `daily_reviews` 1행(있으면)을 가져온다.
   - DB 행을 core가 받는 **wire 타입**으로 매핑하라: `timestamptz` → `.toISOString()` 문자열
     (`PlanBlock.startAt/endAt`, `ActionBlock.startAt`, `endAt`은 null 가능). `date`는 그대로 문자열.
   - `journalText`는 그 날 review가 있으면 그 텍스트, 없으면 빈 문자열 `""`.
4. **모델 결정**: `user_settings`에서 이 유저의 `aiModel`을 읽어 `resolveModelId(aiModel)`로 정규화한다
   (행이 없거나 null이면 `DEFAULT_MODEL_ID`). **모델 id를 클라이언트 body에서 받지 마라** — 서버가
   DB에서 읽는다(ADR-020).
5. **프롬프트 템플릿 로드 + 조립(core)**:
   - `fs.readFileSync`로 `prompts/daily-analysis-system.md`와 `prompts/daily-analysis-user.md`를
     UTF-8로 읽는다. 경로는 `process.cwd()`를 기준으로 잡아라(Next.js 서버는 프로젝트 루트에서 실행됨).
     파일이 없으면 500 + `{ error: "Prompt templates not found" }`.
   - `buildDailyPrompt(input, { system: systemTemplate, user: userTemplate })`로 system/prompt를 만든다.
     `input`은 위에서 모은 `DailyAnalysisInput`(date·tasks·projects·plans·actions·journalText).
6. **AI 호출(services)**: `generateStructured({ modelId, schema: dailyAnalysisSchema, system, prompt })`.
   **반드시 이 래퍼를 통해서만 호출하라**(CLAUDE.md CRITICAL) — provider SDK 직접 호출 금지.
7. **저장(upsert)**: 결과에 생성 시각을 붙여 `ai_analysis`에 저장한다:
   `aiAnalysis = { ...analysis, generatedAt: new Date().toISOString() }`.
   - `daily_reviews`에 `(userId, date)`로 upsert. **기존 행의 `journal_text`를 절대 덮지 마라** —
     `onConflictDoUpdate`의 `set`에는 `aiAnalysis`(와 필요한 타임스탬프)만 넣는다. 행이 없으면 insert
     하되 `journalText`는 `""`(NOT NULL 충족). 이유: 분석은 일기를 변경하지 않는다.
   - conflict target은 `daily_reviews_user_date_uq`(`userId`,`date`)다.
8. **반환**: 갱신된 `daily_reviews` 행(JSON, `ai_analysis` 포함).

에러 처리:

- AI 호출이 실패하면(키 누락·rate limit·네트워크 등) 502 또는 500 + `{ error }`로 응답하고,
  `daily_reviews`는 변경하지 마라. 이유: 부분 저장으로 일기/분석이 깨지면 안 된다.

## Acceptance Criteria

```bash
npm run build
npm test
```

- 두 커맨드가 통과해야 한다. 실제 AI 호출은 키가 필요하므로 자동 테스트하지 않는다(빌드 + 기존
  테스트 유지가 필수). 라우트 로직 중 순수하게 분리 가능한 매핑이 있으면 테스트를 더해도 좋다(선택).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - route가 `src/app/api/daily-reviews/analyze/`에 있는가? (ARCHITECTURE.md)
   - AI 호출이 `services/ai`의 `generateStructured`만 거치는가(provider SDK 직접 호출 없음)?
     (CLAUDE.md CRITICAL, ADR-005)
   - 숫자 계산을 AI가 아니라 core(`buildDailyPrompt`/`summarizeDay`)가 하는가? (ADR-020)
   - 모델 id를 클라 body가 아니라 `user_settings`에서 읽는가? (ADR-020)
   - upsert가 `journal_text`를 덮지 않고 `ai_analysis`만 갱신하는가?
   - 모든 쿼리가 `user.id`로 스코프되고 userId를 body에서 받지 않는가? (RLS, ADR-003)
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(파일 경로 포함)"`
   - 실패(수정 3회 후) → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요(예: 빌드는 되나 실제 호출에 키 필요) → 코드는 완성하되, 키가 없어 *런타임
     검증*만 막히는 경우는 `completed`로 두고 summary에 "런타임 검증은 키 필요" 명시. DB 접속 등으로
     빌드/적용 자체가 막히면 `blocked`.

## 금지사항

- provider SDK(`@google/generative-ai` 등)나 `@ai-sdk/google`을 이 라우트에서 직접 import하지 마라.
  이유: AI 호출은 `services/ai` 래퍼로만(모델 비종속, CLAUDE.md CRITICAL, ADR-005).
- 모델 id를 request body에서 받지 마라. 이유: 서버가 user_settings에서 읽는다 — 신뢰 경계를 클라에
  두지 않는다(ADR-020).
- AI에게 예상/실제 분이나 비율을 계산시키지 마라. 이유: 숫자는 core가 계산해 프롬프트에 사실로
  넣는다(ADR-020).
- upsert `set`에 `journalText`를 넣지 마라. 이유: 사용자의 일기를 분석이 덮어쓰면 안 된다.
- 누적 통계(category_stats)·과거 검색을 끌어오지 마라. 이유: 이번 스코프는 "오늘"뿐이다(ADR-020,
  집계/검색은 후속 phase).
- 프롬프트 문자열을 route 안에 하드코딩하지 마라. 이유: 프롬프트는 `prompts/` 마크다운 파일에서
  읽어야 사용자가 코드 없이 편집할 수 있다(ADR-020).
- `prompts/` 파일 읽기를 `src/core/`에서 하지 마라. 이유: core는 파일시스템 비의존이어야 한다 —
  파일 읽기는 이 route(서버)만 담당한다.
- 기존 테스트를 깨뜨리지 마라.
