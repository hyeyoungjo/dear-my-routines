# Step 3: settings-ui

헤더에 **기어(설정) 아이콘**을 두고, 클릭하면 **AI 모델 드롭다운**이 열려 모델을 고를 수 있게 한다.
선택은 step 2의 `user_settings` API로 저장한다(낙관적 업데이트). 이 step은 hooks + 컴포넌트
레이어다.

## 읽어야 할 파일

먼저 아래를 읽고 패턴을 파악하라:

- `/docs/ARCHITECTURE.md` — `components/`, `hooks/`, 낙관적 업데이트(TanStack Query) 패턴
- `/docs/ADR.md` — ADR-007(낙관적 업데이트), ADR-020(모델 드롭다운 + user_settings)
- `/src/hooks/dailyReviews.ts` — **그대로 따라야 할 hook 패턴**(useQuery + 낙관적 mutation:
  `onMutate`로 캐시 즉시 갱신 → `onError` rollback → `onSettled` invalidate)
- `/src/app/api/user-settings/route.ts` — (step 2 산출) 이 hook이 호출할 GET/PUT
- `/src/services/ai/models.ts` — (step 0 산출) `AI_MODELS`, `DEFAULT_MODEL_ID`, `resolveModelId`
- `/src/components/ThemeMenu.tsx` — **그대로 따라야 할 헤더 드롭다운/팝오버 패턴**(기어 아이콘 버튼 +
  바깥 클릭 닫기 오버레이 + 메뉴 패널). 같은 시각 언어로 만든다.
- `/src/app/page.tsx` — 헤더에 `<ThemeMenu />`가 있는 위치(여기 옆에 설정 메뉴를 둔다)

`dailyReviews` hook이 낙관적 upsert를 어떻게 하는지, `ThemeMenu`가 팝오버를 어떻게 여닫는지
이해한 뒤 같은 스타일로 작성하라.

## 작업

### 1. `src/hooks/userSettings.ts` — 설정 조회·갱신 hook

```ts
import type { UserSettings } from "@/db/schema";

export const userSettingsKey: readonly unknown[]; // 예: ["user-settings"]

// GET /api/user-settings → UserSettings | null. data가 null이면 "아직 설정 없음".
export function useUserSettings(): UseQueryResult<UserSettings | null>;

// PUT /api/user-settings { aiModel }. 낙관적: 캐시의 aiModel을 즉시 바꾸고 실패 시 rollback.
export function useUpdateUserSettings(): UseMutationResult<UserSettings, ..., { aiModel: string | null }>;
```

- 낙관적 패턴은 `dailyReviews.ts`와 동일하게: `onMutate`에서 이전 캐시 스냅샷 → `userSettingsKey`
  캐시를 새 `aiModel`로 즉시 교체(행이 없으면 플레이스홀더 객체 생성) → `onError`에서 rollback →
  `onSettled`에서 invalidate. 이유: 모델을 바꾸면 드롭다운이 서버를 기다리지 않고 즉시 반영된다(ADR-007).

### 2. `src/components/SettingsMenu.tsx` — 기어 아이콘 + 모델 드롭다운

`'use client'`. `ThemeMenu`와 같은 구조(기어 버튼 → 클릭 시 팝오버, 바깥 클릭으로 닫기).

- 기어 아이콘 버튼(`aria-label="Settings"`). 인라인 SVG로 그려도 되고, 이미 쓰는 아이콘 방식이
  있으면 그걸 따른다(ThemeMenu가 쓰는 방식 확인).
- 팝오버 안에 "AI model" 섹션: `AI_MODELS`를 순회해 각 모델을 선택 가능한 항목(라디오/리스트)으로
  렌더. 각 항목 라벨은 `model.label`(예: "Gemini 2.5 Flash").
- **현재 선택**: `useUserSettings()`의 `aiModel`을 `resolveModelId`로 정규화한 값과 일치하는 항목에
  체크/하이라이트. (설정이 없거나 null이면 `DEFAULT_MODEL_ID`가 선택된 것으로 보인다.)
- **선택 시**: `useUpdateUserSettings().mutate({ aiModel: model.id })`. 낙관적이라 즉시 반영된다.

### 3. `src/app/page.tsx` 헤더에 통합

헤더의 `<ThemeMenu />` 옆(같은 `flex items-center gap-2` 컨테이너 안)에 `<SettingsMenu />`를
추가하라. Plan/Act/Review 캘린더 동작은 일절 건드리지 마라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

- 세 커맨드가 에러 없이 통과해야 한다(기존 테스트 95개 유지).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - hook이 `src/hooks/`, 컴포넌트가 `src/components/`에 있는가? (ARCHITECTURE.md)
   - 모델 변경이 낙관적인가(서버 응답을 기다리며 UI를 멈추지 않는가)? (ADR-007, CLAUDE.md CRITICAL)
   - 드롭다운 목록을 하드코딩하지 않고 `AI_MODELS` 상수에서 렌더하는가? (단일 출처, ADR-005)
   - `SettingsMenu`가 `'use client'`인가? (인터랙션 컴포넌트)
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(파일·통합 위치 포함)"`
   - 실패(수정 3회 후) → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`

## 금지사항

- 모델 변경을 비낙관적(서버 응답 후에야 UI 갱신)으로 만들지 마라. 이유: 부드러운 UX가 최상위
  제약이다(ADR-007, CLAUDE.md CRITICAL).
- 드롭다운에 모델을 손으로 나열하지 마라(`AI_MODELS`에서 렌더). 이유: 클라·서버가 같은 목록을 써야
  검증이 어긋나지 않는다(ADR-005, step 0의 단일 출처).
- `GEMINI_API_KEY`나 어떤 비밀키도 이 컴포넌트/hook에서 다루지 마라. 이유: 클라 노출 금지(CLAUDE.md).
- 실제 AI 분석 호출(`/api/daily-reviews/analyze`)을 여기서 하지 마라. 이유: 그건 step 5(ReviewColumn)
  담당이다. 이 step은 모델 *선택*만 한다.
- Plan/Act/Review 캘린더 로직을 변경하지 마라. 이유: 이 step은 헤더 설정 UI만 추가한다.
- 기존 테스트를 깨뜨리지 마라.
