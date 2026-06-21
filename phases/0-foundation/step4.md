# Step 4: panel-routes

## 읽어야 할 파일
- `/CLAUDE.md` (UI 텍스트 영어, Server/Client Components, `core/` 분리, 부드러운 UX)
- `/docs/PRD.md` (Plan · Act · Review 3패널, "하루를 한눈에")
- `/docs/ARCHITECTURE.md` (디렉토리 구조)
- `/docs/ADR.md` (ADR-004 Plan·Act·Review)
- step0~3 산출물: `src/app/`(page, login, auth/callback), `src/middleware.ts`,
  `src/db/schema.ts`, `src/services/supabase/`, `src/components/`

## 목표
"하루를 한눈에"의 **뼈대** — Plan · Act · Review 3패널 레이아웃을 **빈 상태로** 만든다.
실제 블록/트리/타이머/AI는 다음 phase. 이 step은 라우트 + 레이아웃 + 빈 패널만.

## 작업

### 1. 메인 화면을 3패널로
- 로그인 후 보이는 메인 화면(`src/app/page.tsx`)을 **Plan | Act | Review 3패널 가로 배치**로
  만든다. 로그인 보호는 `src/middleware.ts`가 이미 처리한다(비인증 → /login).
- 각 패널: 제목(Plan / Act / Review) + 짧은 placeholder("Coming soon" 등). **모든 UI 텍스트
  영어**(CLAUDE.md).
- 반응형: 넓은 화면은 3컬럼 나란히, 좁은 화면은 세로 스택 (Tailwind: 예 `grid md:grid-cols-3`).

### 2. 패널 컴포넌트 (`src/components/panels/`)
- `PlanPanel`, `ActPanel`, `ReviewPanel`을 빈 컴포넌트로 만든다 (제목 + placeholder).
  지금은 props 없음. 나중 phase에서 내용이 채워진다.

### 3. 헤더 / 로그아웃
- 화면 상단에 가벼운 헤더(앱 이름 + 로그아웃 버튼). 기존 `signOut` 서버 액션을 재사용한다.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
```
메인 화면에 Plan / Act / Review 3패널이 렌더되어야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - 메인에 Plan/Act/Review 3패널이 렌더되는가?
   - 반응형(넓으면 3컬럼, 좁으면 스택)인가?
   - 로그인 보호가 유지되는가? (미들웨어)
   - UI 텍스트가 전부 영어인가?
   - `build`가 통과하는가?
3. `phases/0-foundation/index.json`의 step 4를 업데이트한다:
   - 성공 → `"completed"` + `"summary"`
   - 3회 실패 → `"error"` + `"error_message"`
   - 사용자 개입 필요 → `"blocked"` + `"blocked_reason"`

## 금지사항
- 실제 기능(블록 드래그, 트리 조작, 타이머, 시간 계산, AI 호출)을 만들지 마라. 다음 phase
  범위다. **빈 뼈대만** 만든다.
- UI 텍스트에 한글을 쓰지 마라. 이유: 이 프로젝트 UI는 영어(CLAUDE.md).
- `service_role` key를 노출하지 마라. 이유: 보안(CLAUDE.md CRITICAL).
- `.claude/settings.json`에 Stop 훅(lint/build/test)을 추가하지 마라. 이유: dev 서버의
  `.next`와 충돌해 빌드가 깨진다(앞서 확인된 문제).
- 인증/미들웨어를 깨뜨리지 마라. 기존 테스트를 깨뜨리지 마라.
