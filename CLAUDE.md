# 프로젝트: Dear My Routines

> 개인용 시간관리 웹앱. 매일 *예상 vs. 실제*를 측정해 시간 과소예측을 교정하고,
> subproject격으로 부푼 task를 감지하며, 데일리 AI 리뷰로 성장을 체감한다.
> 상세 기획·결정·구조는 `docs/PRD.md`, `docs/ADR.md`, `docs/ARCHITECTURE.md` 참조.

## 기술 스택
- Next.js 15 (App Router) + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- dnd-kit + Framer Motion (블록 드래그/리사이즈/애니메이션)
- TanStack Query (서버 상태 + 낙관적 업데이트)
- Supabase (Postgres + Auth 매직링크 + RLS)
- Drizzle ORM
- Vercel AI SDK (모델 비종속: OpenAI/Gemini)
- Railway (호스팅), Vitest (테스트)

## 아키텍처 규칙
- CRITICAL: **부드러운 UX가 최상위 제약**. 데이터 변경 인터랙션(드래그·리사이즈·인라인
  편집)은 TanStack Query 낙관적 업데이트로 화면을 즉시 갱신하고 실패 시 rollback한다.
  서버 응답을 기다리며 UI를 멈추지 마라.
- CRITICAL: **모든 AI 호출은 Vercel AI SDK를 통해서만** 한다. provider SDK(`openai` 등)를
  직접 호출하지 마라. 이유: 모델 비종속(ADR-005)을 깨뜨린다.
- CRITICAL: **모든 DB 테이블에 `user_id`를 두고 RLS를 켠다**. 클라이언트가 직접 쿼리해도
  남의 행에 접근 불가해야 한다.
- CRITICAL: **비밀키(AI/Supabase service key)를 클라이언트에 노출하지 마라**. 서버
  (Route Handler / Server Component / env)에서만 사용한다.
- CRITICAL: **비즈니스 로직을 UI에서 분리**한다 — 시간 계산·트리 조작·통계 집계·AI
  프롬프트 구성은 `src/core/`의 순수 함수로. 이유: 나중에 모바일에서 재사용(ADR-001 비고).
- 컴포넌트는 `components/`, 타입은 `types/`, 외부 서비스 래퍼는 `services/`, 순수 로직은
  `core/`, 잡유틸은 `lib/`에 둔다 (구조는 ARCHITECTURE.md).
- Server Components 기본, 인터랙션이 필요한 곳만 Client Component(`'use client'`).

## 개발 프로세스
- CRITICAL: 코드와 커맨드는 **OS 비종속**(Windows·macOS·Linux 공통) — 파일·콘솔 입출력은
  인코딩을 UTF-8로 명시, 경로는 path 유틸 사용(분리자 하드코딩 금지), 셸 커맨드는 `&&`
  체이닝 금지(한 줄에 하나씩), Python 런처는 Windows `python` / macOS·Linux `python3`.
- CRITICAL: 핵심 로직(시간 계산·트리 조작·통계 집계)은 **테스트를 먼저 또는 함께** 작성한다(TDD 지향).
- 코드·코드 코멘트·식별자·커밋 메시지, **그리고 UI 텍스트(화면에 보이는 문구)는 영어**.
  프로젝트 문서(`docs/`)는 **한글**. (글로벌 규칙 + 이 프로젝트의 UI 영어 관습)
- 커밋은 conventional commits 형식 (feat:, fix:, docs:, refactor:, chore:).
- CRITICAL: **되돌리기 어려운 설계 결정은 구현 전에 상의한다** — 데이터 삭제 동작·스키마 변경·
  데이터 모델 선택(hide vs delete 등)·마이그레이션이 필요한 변경은 (1) 원인/트레이드오프 설명 →
  (2) 옵션+추천 제시 → (3) 유저 선택 → (4) 구현 순서로. 유저가 "이게 낫지 않아?"처럼 방향을
  제시해도 그건 논의 시작이지 구현 승인이 아니다. 순수 UI 미세조정·명백한 오타 수정은 바로 해도 된다.
- **DB 마이그레이션 주의(이 프로젝트 고유)**: 이 DB는 과거 `drizzle-kit push`로 관리돼
  `drizzle.__drizzle_migrations` 추적이 저널(`drizzle/meta/_journal.json`)보다 뒤처져 있다.
  그래서 (a) `drizzle-kit generate`가 그동안 push로만 반영된 누적 드리프트를 새 마이그레이션 한
  파일에 몽땅 묶고, (b) `drizzle-kit migrate`는 이미 DB에 있는 옛 마이그레이션을 재적용하려다
  "already exists"로 조용히 실패(EXIT 1)한다. → 새 마이그레이션 SQL은 **이번 변경분만 남기도록
  트리밍**하고, 필요하면 추적 테이블에 "마지막 적용 지점"을 나타내는 행을 seed해(created_at =
  직전 저널 항목의 `when`) `migrate`가 신규분만 적용하게 한다.

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # Vitest
