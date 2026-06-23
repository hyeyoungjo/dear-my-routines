# Step 5: review-ai-ui

Review 열에 **"Analyze today" 버튼**과 **분석 결과 표시**를 붙인다. 사용자가 일기를 쓴 뒤 버튼을
누르면 step 4 라우트를 호출하고, 돌아온 분석(summary·observations·encouragement)을 보여준다.
이 step이 데일리 AI 분석을 사용자 손에 닿게 하는 마지막 조각이다.

## 읽어야 할 파일

먼저 아래를 읽고 패턴을 파악하라:

- `/docs/ARCHITECTURE.md` — `components/`·`hooks/`, 데이터 흐름의 `[Review] → AI → 화면 표시`
- `/docs/ADR.md` — ADR-019(Review = 자동저장 일기, AI는 별도 버튼), ADR-020(버튼 트리거, 결과 구조)
- `/src/components/calendar/ReviewColumn.tsx` — **수정 대상**. 현재 textarea 자동저장만 있다
  (28줄 주석 "AI analysis ... out of scope this phase"). 이 step에서 그 자리를 채운다.
- `/src/hooks/dailyReviews.ts` — `useDailyReview(date)`(이미 `data.aiAnalysis` 접근 가능),
  `dailyReviewKey(date)`, 그리고 mutation 패턴(여기에 analyze mutation을 추가하거나 새 파일에 둔다)
- `/src/core/ai/schema.ts` — (step 1) `DailyAnalysis` 타입(summary·observations·encouragement)
- `/src/app/api/daily-reviews/analyze/route.ts` — (step 4) `POST { date }` → 갱신된 review 행
- `/src/components/date.tsx` — `useSelectedDate`(이미 ReviewColumn이 씀)

ReviewColumn의 자동저장(디바운스·flush·낙관적) 흐름을 깨지 않고 *추가*만 한다는 점을 이해하라.

## 작업

### 1. analyze mutation hook

`src/hooks/dailyReviews.ts`에 추가(또는 같은 폴더 새 파일):

```ts
// POST /api/daily-reviews/analyze { date } → 갱신된 DailyReview(ai_analysis 채워짐).
// 성공 시 ["daily-review", date] 캐시를 응답 행으로 교체(또는 invalidate)해 결과가 바로 보이게 한다.
export function useAnalyzeDay(): UseMutationResult<DailyReview, ..., { date: string }>;
```

- 이건 **낙관적이 아니다**(생성 결과를 미리 알 수 없다). 대신 `isPending`으로 로딩을 표시하고,
  성공 시 캐시를 갱신한다. `onSettled`에서 `dailyReviewKey(date)`를 invalidate해도 된다.

### 2. `ReviewColumn.tsx`에 버튼 + 결과 표시

기존 textarea는 그대로 두고, 그 아래(또는 위)에 AI 영역을 추가한다. 28줄의 "out of scope" 주석은
갱신하라.

- **"Analyze today" 버튼**: 클릭 시 `useAnalyzeDay().mutate({ date })`. `isPending` 동안 비활성화 +
  로딩 표시("Analyzing…"). 버튼 라벨 등 UI 텍스트는 **영어**(프로젝트 관습).
- **결과 표시**: `useDailyReview(date)`의 `data?.aiAnalysis`를 읽어, 있으면 구조화해 표시한다:
  - `summary` — 강조된 한 줄
  - `observations` — 불릿 리스트
  - `encouragement` — 격려 문단
  - 생성 시각(`generatedAt`)이 있으면 작게 표시(선택).
  - `aiAnalysis`는 `unknown`(jsonb)이라 타입 단언/가드가 필요하다. step 1의 `DailyAnalysis` 형태로
    좁혀서 읽되, 형태가 안 맞으면(과거 데이터 등) 조용히 미표시하라(렌더 크래시 금지).
- **빈 상태**: 분석이 아직 없으면 결과 영역 대신 버튼만 보인다. 분석이 있으면 다시 눌러 재생성 가능.
- 날짜를 바꾸면 그 날짜의 분석이 보여야 한다(`useDailyReview(date)`가 이미 날짜별 캐시라 자연히 따라옴).

### 3. UX 제약

- 버튼을 누른 분석 호출은 시간이 걸린다(수 초). textarea의 자동저장·입력은 그 동안에도 **멈추면 안
  된다**(ADR-007). 분석 로딩은 AI 영역에만 가두고 textarea를 비활성화하지 마라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

- 세 커맨드가 통과해야 한다(기존 테스트 95개 유지).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 버튼·결과가 `ReviewColumn`에, mutation이 `src/hooks/`에 있는가? (ARCHITECTURE.md)
   - 분석 로딩이 textarea 자동저장을 막지 않는가? (ADR-007, CLAUDE.md CRITICAL)
   - `aiAnalysis`(jsonb/unknown)를 안전하게 가드하고, 형태 불일치 시 크래시 없이 미표시하는가?
   - UI 텍스트가 영어인가? (프로젝트 관습)
   - AI 호출을 컴포넌트에서 직접 하지 않고 `/api/daily-reviews/analyze`(서버)를 거치는가? (키 보호)
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(파일·hook 포함)"`
   - 실패(수정 3회 후) → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`

## 금지사항

- AI를 클라이언트에서 직접 호출하지 마라(`generateObject`·provider SDK·`GEMINI_API_KEY`). 이유:
  키는 서버에만 있어야 한다 — 반드시 `/api/daily-reviews/analyze`를 거친다(CLAUDE.md CRITICAL).
- 분석 로딩 동안 textarea를 비활성화하거나 일기 자동저장을 멈추지 마라. 이유: 부드러운 UX가 최상위
  제약이다(ADR-007).
- `aiAnalysis`를 타입 가드 없이 `DailyAnalysis`로 단정해 렌더하지 마라. 이유: jsonb는 `unknown`이고
  형태가 안 맞으면 런타임 크래시가 난다 — 가드 후 미표시로 처리한다.
- ReviewColumn의 기존 자동저장(디바운스·flush·낙관적 upsert) 로직을 바꾸지 마라. 이유: 이 step은
  AI 영역만 *추가*한다(ADR-019 일기 흐름 보존).
- UI 텍스트를 한국어로 쓰지 마라(분석 *내용*은 모델이 사용자 언어로 생성하지만, 버튼·라벨 등 UI는
  영어). 이유: 프로젝트 UI 영어 관습.
- 기존 테스트를 깨뜨리지 마라.
