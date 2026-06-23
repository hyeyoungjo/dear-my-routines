# Step 0: review-schema-api

Review(데일리 회고 일기) 기능의 DB·서버 레이어를 만든다. 사용자가 하루에 대한 일기를
직접 작성·저장하는 기능이며, AI 분석은 이번 phase에서 다루지 않는다(추후 별도 작업).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 디렉토리 구조(`api/`, `db/`, `services/`)
- `/docs/ADR.md` — 특히 ADR-003(멀티유저+RLS), ADR-006(3층 메모리), ADR-013(날짜별 모델)
- `/docs/DATA-STRUCTURE.md` — `daily_reviews` 테이블 정의(컬럼·제약)
- `/src/db/schema.ts` — `dailyReviews` pgTable 정의와 `ownerPolicies` 헬퍼
- `/src/app/api/plan-blocks/route.ts` — **그대로 따라야 할 route 패턴**
  (auth.getUser() → userId 서버 주입 → parse 검증 → Drizzle)
- `/src/db/index.ts`, `/drizzle.config.ts` — DB 연결(Supabase 세션 풀러)과 마이그레이션 설정

기존 코드를 꼼꼼히 읽고, plan-blocks route가 어떻게 인증·검증·userId 주입을 하는지 이해한 뒤
같은 스타일로 작성하라.

## 작업

### 1. `daily_reviews`에 unique 제약 추가

`src/db/schema.ts`의 `dailyReviews` 테이블에 **`(user_id, date)` 복합 unique 인덱스**를 추가하라.
목적: "유저당 하루 일기 1개"를 DB가 보장 → upsert(`onConflictDoUpdate`)의 conflict target.

- Drizzle의 `uniqueIndex`를 테이블 정의의 두 번째 인자(현재 `ownerPolicies`를 반환하는 콜백)에서
  policies와 **함께** 반환하라. 콜백은 배열을 반환할 수 있다.
  예: `(t) => [uniqueIndex("daily_reviews_user_date_uq").on(t.userId, t.date), ...ownerPolicies("daily_reviews", t.userId)]`
- 인덱스 이름은 `daily_reviews_user_date_uq`로 한다.

### 2. 마이그레이션 생성·적용

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

- `generate`로 `drizzle/`에 마이그레이션 SQL이 생성된다. 내용이 `(user_id, date)` unique 인덱스
  추가만인지 확인하라(다른 테이블 변경이 끼어들면 안 된다).
- `migrate`로 실제 Supabase DB에 적용한다. DB 접속 정보는 `.env`(`DB_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`)에서 온다.
- 적용이 권한·접속 문제로 실패하면, 코드/마이그레이션 파일은 남기고 step status를 `blocked`로 두고
  `blocked_reason`에 사유를 적어라(예: "drizzle-kit migrate 접속 실패: <메시지>").

### 3. Route handler 생성 — `src/app/api/daily-reviews/route.ts`

plan-blocks route와 동일한 구조(인증 → 검증 → Drizzle, `NextResponse`)로 두 핸들러를 만든다.

```ts
// GET /api/daily-reviews?date=YYYY-MM-DD
//   → 해당 grid day의 review 1행 또는 null (200). 없으면 body는 null.
export async function GET(request: NextRequest): Promise<NextResponse>

// PUT /api/daily-reviews
//   body: { date: string (YYYY-MM-DD), journalText: string }
//   → 해당 (userId, date)에 upsert. 존재하면 journal_text 갱신, 없으면 insert. 갱신/생성된 행 반환.
export async function PUT(request: NextRequest): Promise<NextResponse>
```

구현 요구:

- **인증**: 두 핸들러 모두 `supabase.auth.getUser()`로 user를 얻고, 없으면 401.
- **userId 주입**: insert/upsert 시 `userId`는 반드시 `user.id`(세션)에서 넣는다.
  body에서 받은 user_id가 있어도 무시한다.
- **검증**: `date`는 `YYYY-MM-DD` 형식 문자열, `journalText`는 string. 형식 위반은 400 + `{ error }`.
- **upsert**: Drizzle `insert(...).values({ userId, date, journalText }).onConflictDoUpdate({
  target: [dailyReviews.userId, dailyReviews.date], set: { journalText } })`. conflict target은
  1번에서 만든 unique 인덱스와 일치해야 한다.
- **ai_analysis는 건드리지 않는다** — insert 시 미지정(기본 null), update 시 set에 넣지 않는다
  (기존 분석을 덮지 않기 위함).
- 반환: GET은 행 또는 `null`, PUT은 upsert된 행(JSON).

## Acceptance Criteria

```bash
npm run build
npm test
```

위 두 커맨드가 에러 없이 통과해야 한다. (이 step은 순수 서버 코드라 새 테스트는 선택사항이며,
기존 테스트가 깨지지 않는 것이 필수다.)

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - route가 `src/app/api/daily-reviews/`에 있는가? (ARCHITECTURE.md 구조)
   - plan-blocks route와 동일한 인증·userId 주입 패턴인가?
   - userId를 body에서 받지 않는가? (RLS, CLAUDE.md CRITICAL)
   - 마이그레이션 SQL이 `(user_id, date)` unique 추가만 담는가?
3. 결과에 따라 `phases/8-review-journal/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(생성/수정 파일 경로, 마이그레이션 번호 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - DB 접속·권한 등 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- userId를 request body에서 받지 마라. 이유: 클라이언트가 남의 행을 만들 수 있다(RLS 우회, ADR-003).
- `ai_analysis` 컬럼을 읽거나 쓰지 마라. 이유: AI 기능은 이 phase 범위 밖이며, 추후 이 칸을 채운다.
- 새 ORM·쿼리빌더를 도입하지 마라. 이유: Drizzle만 쓴다(ADR-010).
- provider AI SDK를 import하지 마라. 이유: 이 step엔 AI 호출이 전혀 없다.
- 기존 테스트를 깨뜨리지 마라.
