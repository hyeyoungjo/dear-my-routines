# Step 1: review-hooks

Review 일기의 클라이언트 상태 레이어를 만든다. 조회 + **낙관적 upsert** TanStack Query 훅.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-007(부드러운 UX = 낙관적 업데이트)
- `/src/hooks/planBlocks.ts` — **그대로 따라야 할 낙관적 mutation 패턴**
  (`useOptimisticPlanMutation`: onMutate 캐시 즉시 갱신 → onError 롤백 → onSettled invalidate)
- `/src/app/api/daily-reviews/route.ts` — Step 0에서 만든 GET/PUT route (이 훅이 호출할 엔드포인트)
- `/src/db/schema.ts` — `DailyReview` 타입(`InferSelectModel`)
- `/src/core/time/day.ts` — `dayKey`(Date → YYYY-MM-DD grid-day 변환). 호출부에서 쓸 키 변환.

이전 step에서 만든 route의 요청/응답 형태를 정확히 읽고 맞춰라.

## 작업

`src/hooks/dailyReviews.ts`를 만든다. `"use client"` 파일.

```ts
// 특정 grid day의 review를 조회. 없으면 data === null.
export function useDailyReview(date: string): UseQueryResult<DailyReview | null>

// 일기 본문 upsert (낙관적). date+journalText를 PUT.
export function useUpsertDailyReview(): UseMutationResult<DailyReview, Error, UpsertReviewInput, ...>

export type UpsertReviewInput = { date: string; journalText: string };
```

구현 요구:

- **쿼리 키는 날짜별로 분리**한다: `["daily-review", date]`. 이유: 날짜마다 일기가 1개씩이고,
  다른 날 캐시를 건드리지 않기 위함. 키 헬퍼 `dailyReviewKey(date)`를 export 해도 좋다.
- `useDailyReview(date)`: `fetch('/api/daily-reviews?date=' + date)` 결과를 그대로 캐시에 둔다
  (서버가 행 또는 null 반환).
- `useUpsertDailyReview()`: planBlocks의 `useOptimisticPlanMutation`과 **같은 생명주기**로 작성:
  - `onMutate`: `cancelQueries(["daily-review", date])` → 이전 값 스냅샷 →
    `setQueryData(["daily-review", date], ...)`로 **즉시** 새 journalText 반영(기존 행이 있으면 병합,
    없으면 낙관적 행 생성). 화면이 응답을 기다리지 않게 한다(ADR-007).
  - `onError`: 스냅샷으로 롤백.
  - `onSettled`: `invalidateQueries(["daily-review", date])`로 서버와 재동기화.
- mutationFn은 Step 0의 `PUT /api/daily-reviews`를 호출하고 upsert된 행을 반환한다.

낙관적 행 생성 시 placeholder id가 필요하면 `crypto.randomUUID()`를 쓴다(planBlocks의
`optimisticPlan`과 동일한 발상). `ai_analysis`는 낙관적 객체에서도 건드리지 않는다(null 유지).

## Acceptance Criteria

```bash
npm run build
npm test
```

타입 체크(build)가 통과하고 기존 테스트가 깨지지 않아야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 훅이 `src/hooks/dailyReviews.ts`에 있는가?
   - planBlocks와 동일한 onMutate/onError/onSettled 낙관적 패턴인가? (ADR-007)
   - 쿼리 키가 날짜별로 분리(`["daily-review", date]`)되는가?
3. 결과에 따라 `phases/8-review-journal/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(export한 훅 이름·쿼리키 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 비낙관적(서버 응답 후 갱신) 방식으로 쓰지 마라. 이유: 입력 중 버벅임 = 핵심 UX 위반(ADR-007).
- 전체 review 목록을 한 키에 담지 마라. 이유: 일기는 날짜당 1개라 날짜별 키가 맞고, 불필요한
  무효화·리렌더를 부른다.
- UI 컴포넌트(textarea, 디바운스)를 여기서 만들지 마라. 이유: 그건 Step 2 UI 레이어다.
- AI 관련 코드를 넣지 마라. 이유: 범위 밖.
- 기존 테스트를 깨뜨리지 마라.
