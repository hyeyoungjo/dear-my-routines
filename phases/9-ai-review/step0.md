# Step 0: ai-provider

데일리 AI 분석의 **인프라 레이어**를 만든다. Vercel AI SDK를 설치하고, `src/services/ai/`에
모델 비종속(ADR-005/012) 래퍼를 둔다. 이 step은 AI 호출의 *토대*만 만든다 — 실제 프롬프트 구성
(core)·라우트(api)·UI는 다음 step에서 한다.

## 읽어야 할 파일

먼저 아래를 읽고 아키텍처·설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 디렉토리 구조(특히 `services/ai/` = "Vercel AI SDK 래퍼, 모델 비종속")
- `/docs/ADR.md` — ADR-005(AI 모델 비종속 추상화), ADR-012(기본 provider=Gemini, OpenAI 제거),
  ADR-020(데일리 AI 분석 — 본 phase의 설계 결정)
- `/CLAUDE.md` — CRITICAL "모든 AI 호출은 Vercel AI SDK를 통해서만", "비밀키를 클라이언트에 노출 금지"
- `/.env.example` — 이미 `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`가 정의돼 있다
- `/src/services/supabase/server.ts` — 기존 `services/` 래퍼의 코드 스타일 참고

## 작업

### 1. 의존성 설치

```bash
npm install ai @ai-sdk/google zod
```

- `ai` = Vercel AI SDK(코어, `generateObject`).
- `@ai-sdk/google` = Gemini provider 어댑터.
- `zod` = `generateObject`의 출력 스키마 정의용(미설치 상태라 함께 설치).

### 2. `src/services/ai/models.ts` — 허용 모델 목록(상수)

드롭다운(클라)과 서버 검증이 **공유**할 단일 출처. 모델 비종속(ADR-005)을 위해 항목을
`{ id, label, provider }` 구조로 둔다 — 나중에 OpenAI 등을 추가하려면 이 배열에 항목만 늘리면 된다.

```ts
export type AiProvider = "google";

export type AiModelOption = {
  id: string;       // 모델 식별자 (예: "gemini-2.5-flash") — DB·API·SDK가 쓰는 값
  label: string;    // 사람이 읽는 이름 (예: "Gemini 2.5 Flash") — 드롭다운 표시용
  provider: AiProvider;
};

export const AI_MODELS: AiModelOption[];   // 아래 두 개로 시작
//   { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" }
//   { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   provider: "google" }

export const DEFAULT_MODEL_ID: string;     // env GEMINI_MODEL ?? "gemini-2.5-flash"

export function isAllowedModel(id: string | null | undefined): boolean;
//   AI_MODELS에 있는 id면 true. 임의 문자열 차단용.

export function resolveModelId(id: string | null | undefined): string;
//   id가 허용 목록이면 그대로, 아니면 DEFAULT_MODEL_ID. 항상 안전한 모델 id를 반환.
```

- `DEFAULT_MODEL_ID`는 `process.env.GEMINI_MODEL`을 우선 쓰되, 비었으면 `"gemini-2.5-flash"`로
  폴백한다. (이 파일은 클라에서도 import되므로 `GEMINI_MODEL`이 클라 번들에서 undefined일 수 있다 —
  그래서 폴백 상수가 반드시 있어야 한다. **`GEMINI_API_KEY`는 이 파일에서 절대 읽지 마라.**)

### 3. `src/services/ai/provider.ts` — 모델 인스턴스 생성(서버 전용)

```ts
import type { LanguageModel } from "ai";

// 주어진 모델 id로 Vercel AI SDK LanguageModel을 만든다. id는 resolveModelId로
// 정규화된 안전한 값이라고 가정한다. 현재 provider는 google뿐.
export function getModel(modelId: string): LanguageModel;
```

- `@ai-sdk/google`의 `createGoogleGenerativeAI`로 provider를 만들고 `GEMINI_API_KEY`를 주입한 뒤
  `provider(modelId)`를 반환한다. **`GEMINI_API_KEY`는 이 파일(서버)에서만 읽는다.**

### 4. `src/services/ai/index.ts` — 구조화 출력 호출 래퍼(서버 전용)

실제 AI 호출은 **반드시 이 함수를 통해서만** 한다(CLAUDE.md CRITICAL). 라우트(step 4)가 이걸 부른다.

```ts
import type { z } from "zod";

export async function generateStructured<T>(args: {
  modelId: string;          // resolveModelId로 정규화된 값
  schema: z.ZodType<T>;     // 출력 스키마(core/ai에서 정의, step 1)
  system: string;           // 시스템 프롬프트
  prompt: string;           // 유저 프롬프트(오늘 데이터 + 일기)
}): Promise<T>;
```

- 내부에서 `getModel(args.modelId)` + AI SDK `generateObject({ model, schema, system, prompt })`를
  호출하고 `result.object`(검증된 `T`)를 반환한다.
- 이 파일과 `provider.ts`는 서버 전용이다. `'use client'`를 붙이지 마라.

## Acceptance Criteria

```bash
npm run build
npm test
```

- 두 커맨드가 에러 없이 통과해야 한다. 이 step은 외부 키가 필요한 실제 호출은 하지 않으므로
  새 테스트는 선택사항이며, 기존 테스트(95개)가 깨지지 않는 것이 필수다.
- `models.ts`의 순수 함수(`isAllowedModel`, `resolveModelId`)에 한해 가벼운 단위 테스트를 더해도 좋다
  (권장이지만 필수는 아님).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 파일이 `src/services/ai/`에 있는가? (ARCHITECTURE.md 구조)
   - `GEMINI_API_KEY`가 `provider.ts`/`index.ts`(서버)에서만 읽히고, `models.ts`(클라 공유)에서는
     읽히지 않는가? (CLAUDE.md 비밀키 보호)
   - provider 분기 구조가 `AiProvider`로 확장 가능한가? (ADR-005)
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(생성 파일 경로, 설치 패키지 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(예: 패키지 설치가 네트워크/권한으로 막힘) → `"status": "blocked"`,
     `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- provider SDK(`@google/generative-ai` 등)를 직접 import하지 마라. 이유: Vercel AI SDK
  추상화를 통해서만 호출해야 모델 비종속이 유지된다(CLAUDE.md CRITICAL, ADR-005).
- `GEMINI_API_KEY`를 `models.ts`에서 읽거나, `'use client'` 파일에서 import 가능한 경로에 두지 마라.
  이유: 비밀키가 클라이언트 번들에 들어가면 노출된다(CLAUDE.md CRITICAL).
- 프롬프트 문자열 구성이나 결과 스키마(zod)를 이 step에서 정의하지 마라. 이유: 그건 순수 로직이라
  `src/core/ai/`(step 1) 담당이다. 여기서는 `z.ZodType<T>`를 인자로 받기만 한다.
- 라우트나 UI를 만들지 마라. 이유: 이 step은 인프라 레이어만이다.
- 기존 테스트를 깨뜨리지 마라.
