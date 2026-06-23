# Step 2: settings-schema-api

사용자가 고른 AI 모델을 저장할 **`user_settings` 테이블**과 그 **서버 라우트**를 만든다. 모델 선택을
DB에 두면 폰·노트북 어디서든 같은 설정이 적용된다(ADR-002). 이 step은 DB·API 레이어만이며, UI는
다음 step에서 한다.

## 읽어야 할 파일

먼저 아래를 읽고 패턴을 파악하라:

- `/docs/ARCHITECTURE.md` — 디렉토리 구조(`api/`, `db/`)
- `/docs/ADR.md` — ADR-003(멀티유저+RLS), ADR-020(모델 선택을 user_settings에 저장)
- `/docs/DATA-STRUCTURE.md` — 공통 규칙(모든 테이블 user_id + RLS), `user_settings` 항목(이미 문서화됨)
- `/src/db/schema.ts` — `ownerPolicies` 헬퍼, `dailyReviews`의 `uniqueIndex` 사용 패턴
  (`(t) => [uniqueIndex(...).on(...), ...ownerPolicies(...)]`), `createdOn`/`updatedOn` 컨벤션
- `/src/app/api/daily-reviews/route.ts` — **그대로 따라야 할 route 패턴**
  (auth.getUser() → userId 서버 주입 → 검증 → Drizzle upsert `onConflictDoUpdate`)
- `/src/services/ai/models.ts` — (step 0 산출) `isAllowedModel`로 모델 화이트리스트 검증
- `/src/db/index.ts`, `/drizzle.config.ts` — DB 연결과 마이그레이션 설정

`daily-reviews` route가 어떻게 인증·검증·userId 주입·upsert를 하는지 이해한 뒤 같은 스타일로 작성하라.

## 작업

### 1. `src/db/schema.ts`에 `user_settings` 테이블 추가

유저당 1행(설정 묶음). 지금은 설정이 AI 모델 하나뿐이라 컬럼 하나로 시작한다(나중에 설정이 늘면
컬럼 추가). `(user_id)` unique = upsert conflict target.

```ts
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    // 선택한 AI 모델 id (services/ai/models.ts의 AI_MODELS[].id). null = env 기본값 사용.
    aiModel: text("ai_model"),
    createdOn: timestamp("created_on", { withTimezone: true }).notNull().defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_settings_user_uq").on(t.userId),
    ...ownerPolicies("user_settings", t.userId),
  ],
);

export type UserSettings = InferSelectModel<typeof userSettings>;
export type NewUserSettings = InferInsertModel<typeof userSettings>;
```

- `createdAt`/`updatedAt`이 아니라 `createdOn`/`updatedOn`을 쓴다(projects/tasks와 통일, ADR-016).

### 2. 마이그레이션 생성·적용

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

- `generate`로 `drizzle/`에 SQL이 생성된다(다음 번호는 `0009`). 내용이 `user_settings` 테이블 추가 +
  `(user_id)` unique 인덱스 + RLS 정책뿐인지 확인하라(다른 테이블 변경이 끼면 안 된다).
- `migrate`로 실제 Supabase DB에 적용한다. 접속 정보는 `.env`(`DB_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`)에서 온다.
- 적용이 권한·접속 문제로 실패하면 코드·마이그레이션 파일은 남기고 step status를 `blocked`로 두고
  `blocked_reason`에 사유를 적은 뒤 중단하라(예: "drizzle-kit migrate 접속 실패: <메시지>").

### 3. Route handler — `src/app/api/user-settings/route.ts`

`daily-reviews` route와 동일 구조(인증 → 검증 → Drizzle, `NextResponse`).

```ts
// GET /api/user-settings
//   → 현재 유저의 설정 1행 또는 null (200). 없으면 body는 null.
export async function GET(request: NextRequest): Promise<NextResponse>;

// PUT /api/user-settings
//   body: { aiModel: string | null }
//   → 현재 (userId)에 upsert. ai_model 갱신/생성된 행 반환.
export async function PUT(request: NextRequest): Promise<NextResponse>;
```

구현 요구:

- **인증**: 두 핸들러 모두 `supabase.auth.getUser()`로 user를 얻고, 없으면 401.
- **userId 주입**: upsert 시 `userId`는 반드시 `user.id`(세션)에서 넣는다. body의 user_id는 무시한다.
- **검증**: `aiModel`은 `string | null`. **string이면 `isAllowedModel(aiModel)`로 화이트리스트
  검증**하고, 허용 목록에 없으면 400 + `{ error }`. null은 허용(= 기본 모델로 되돌림).
  이유: 클라가 임의 모델 문자열을 저장해 이후 분석 호출을 깨뜨리지 못하게 한다(ADR-020).
- **upsert**: `insert(userSettings).values({ userId, aiModel }).onConflictDoUpdate({
  target: userSettings.userId, set: { aiModel, updatedOn: <now> } })`. conflict target은 1번의
  `(user_id)` unique 인덱스와 일치해야 한다.
- 반환: GET은 행 또는 `null`, PUT은 upsert된 행(JSON).

## Acceptance Criteria

```bash
npm run build
npm test
```

- 두 커맨드가 통과해야 한다(이 step은 순수 서버 코드라 새 테스트는 선택, 기존 테스트 유지가 필수).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - route가 `src/app/api/user-settings/`에 있는가? (ARCHITECTURE.md)
   - daily-reviews route와 동일한 인증·userId 주입·upsert 패턴인가?
   - userId를 body에서 받지 않는가? (RLS, CLAUDE.md CRITICAL)
   - `aiModel`을 `isAllowedModel`로 검증하는가? (ADR-020)
   - 마이그레이션 SQL이 `user_settings` 추가만 담는가?
3. 결과에 따라 `phases/9-ai-review/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(파일·마이그레이션 번호 포함)"`
   - 실패(수정 3회 후) → `"status": "error"`, `"error_message": "..."`
   - DB 접속·권한 등 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- userId를 request body에서 받지 마라. 이유: 클라이언트가 남의 행을 만들 수 있다(RLS 우회, ADR-003).
- `aiModel`을 검증 없이 저장하지 마라. 이유: 임의 문자열이 들어가면 이후 분석 호출이 깨진다 —
  `isAllowedModel`로 막는다(ADR-020).
- `GEMINI_API_KEY`를 이 route에서 읽거나 응답에 포함하지 마라. 이유: 키 노출 금지(CLAUDE.md).
- 새 ORM·쿼리빌더를 도입하지 마라. 이유: Drizzle만 쓴다(ADR-010).
- 기존 테스트를 깨뜨리지 마라.
