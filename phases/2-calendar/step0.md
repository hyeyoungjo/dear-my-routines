# Step 0: time-schema

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 모든 테이블 user_id+RLS, 로직 `core/` 분리)
- `/docs/PRD.md` (예상 vs. 실제, 시간 블록), `/docs/ADR.md` (ADR-009 트리, ADR-004 Plan·Act)
- `/src/db/schema.ts` (현재 `nodes` + `estimateMinutes`)
- `/drizzle.config.ts` (세션 pooler 연결), `/src/core/tree/types.ts` (FlatNode)

## 사전 조건
- `.env`에 `DB_PASSWORD`가 있다 (마이그레이션 적용 가능, 세션 pooler).

## 목표
캘린더 뷰의 기반 — task 노드에 **시간 블록 필드**(예상/실제 시작·종료)를 추가한다.

## 작업
### 1. schema 확장 (`src/db/schema.ts`)
`nodes`에 다음을 추가한다 (모두 nullable, `timestamptz`):
- `plannedStart`, `plannedEnd` — 예상(Plan) 블록의 시간 범위
- `actualStart`, `actualEnd` — 실제(Action) 블록의 시간 범위
- 기존 `estimateMinutes`는 유지한다 (시간 미배치 task의 fallback).

### 2. 마이그레이션
- `npx drizzle-kit generate` 로 SQL 생성
- `npx drizzle-kit migrate` 로 Supabase에 적용 (DB_PASSWORD/pooler)
- RLS는 기존 정책 유지 (테이블 구조만 변경).

### 3. 타입
- `InferSelectModel`/`InferInsertModel` 자동 갱신. `core/tree/types.ts`의 FlatNode가 새 필드를
  포함하는지 확인하고, 빌드가 깨지면 보정한다.

## Acceptance Criteria
한 줄에 하나씩 (모두 통과):
```
npm install
npm run lint
npm run build
npm run test
npx drizzle-kit generate
```
새 마이그레이션 SQL이 생성되고, migrate가 성공해야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - `nodes`에 `plannedStart/End`, `actualStart/End`가 추가됐는가?
   - 마이그레이션이 생성·적용됐는가?
   - `user_id` + RLS가 그대로 유지되는가?
   - build/test가 통과하는가?
3. `phases/2-calendar/index.json`의 step 0을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 기존 컬럼/RLS/인증을 깨뜨리지 마라. 이유: 데이터 무결성·보안(CLAUDE.md CRITICAL).
- 캘린더 UI를 만들지 마라. 이유: step1 범위다.
- `.claude/settings.json`에 Stop 훅을 추가하지 마라. 이유: dev 서버와 충돌(확인된 문제).
- 기존 테스트를 깨뜨리지 마라.
