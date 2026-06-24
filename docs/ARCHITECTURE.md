# 아키텍처

> 기술 스택 선택의 근거는 ADR-010, UX 제약은 ADR-007, 메모리 전략은 ADR-006,
> 데이터 모델 방향은 ADR-009 참조.

## 디렉토리 구조 (Next.js App Router)
```
src/
├── app/                # 페이지 + Route Handlers (서버 API)
│   ├── (panels)/       # Plan · Act · Review 화면
│   └── api/            # Route Handlers (서버 엔드포인트)
├── components/         # UI 컴포넌트 (block, tree, panel 등)
├── core/               # 순수 비즈니스 로직 (UI·DB 비의존 → 모바일 재사용)
│   ├── time/           #   시간 계산, 예상/실제 비교
│   ├── tree/           #   트리 조작 (Area>Project>Task>Subtask)
│   └── stats/          #   카테고리별 집계, 성장 추세
├── services/           # 외부 서비스 래퍼
│   ├── supabase/       #   DB/Auth 클라이언트
│   └── ai/             #   Vercel AI SDK 래퍼 (모델 비종속)
├── db/                 # Drizzle 스키마 + 마이그레이션
├── types/              # 공유 타입
└── lib/                # 잡유틸/헬퍼
```
**핵심 원칙**: `core/`는 React·DB·네트워크를 import하지 않는 순수 함수만. 이래야 단위
테스트가 쉽고, 나중에 모바일 앱이 같은 로직을 그대로 가져다 쓴다.

## 그리드 시간 모델 (ADR-024/025)
- **데이터 귀속**: 블록의 날짜는 `startAt` 타임스탬프의 달력 날짜(자정 기준). 특수한 "논리적 하루" 경계 없음.
- **화면 필터**: `plansForDay(plans, day, startHour, endHour)` — 시간 윈도우로 필터. `endHour > 24`이면 다음 달력 날짜 새벽까지 포함(자정 넘는 그리드 지원).
- **사용자 설정**: `user_settings.grid_start_time` / `grid_end_time` (정수, 시 단위; ≥24은 다음 날). null이면 기본값 7/24.

## 데이터 모델 (유연한 트리 — ADR-009)
임의 깊이의 중첩(frame inside frame)을 위해, **단일 `nodes` 테이블 + self-referencing
`parent_id`** 로 트리를 표현한다 (고정 4테이블보다 유연).

**`nodes`** — Area/Project/Task/Subtask를 한 테이블로:
- `id`, `user_id` (RLS 대상)
- `parent_id` (self-reference; null이면 최상위 = Area)
- `type`: `area` | `project` | `task` | `subtask`
- `title`, `notes`, `links`
- `estimate_minutes`, `actual_minutes`
- `status`: `pending` | `in_progress` | `done` | `carried` | `dropped`
- `category` (AI 자동 분류, nullable)
- `is_big3` (boolean), `planned_date`
- `carry_count` (백그라운드 메타데이터 — 이월 횟수)
- `sort_order` (형제 간 정렬 = 드래그 순서)
- `created_at`, `updated_at`

**`time_logs`** — 실제 측정(선택적으로 subtask 단위 타이머):
- `id`, `user_id`, `node_id`, `start_at`, `end_at`

**`daily_reviews`** — 데일리 회고 + AI 분석:
- `id`, `user_id`, `date`, `journal_text`, `ai_analysis`, `created_at`

**`category_stats`** — 3층 메모리 ②집계 (예측 보정·성장 추세의 소스):
- `id`, `user_id`, `category`, `avg_estimate`, `avg_actual`, `ratio`,
  `sample_count`, `trend`, `updated_at`

> 정확한 컬럼·제약은 각 step에서 Drizzle 스키마로 확정한다. 위는 방향.

## 패턴
- Server Components 기본, 인터랙션 필요한 곳만 Client Component(`'use client'`).
- 데이터 변경 = **낙관적 업데이트** (TanStack Query mutation의 `onMutate`로 캐시 즉시 갱신,
  `onError`로 rollback). 드래그·리사이즈가 손에 착 붙는 느낌의 정체.
- 비즈니스 로직은 `core/`의 순수 함수 — UI/DB 비의존, Vitest로 단위 테스트.

## 데이터 흐름
```
[Plan] 입력 → TanStack Query mutation (낙관적: 화면 즉시 갱신)
   → Route Handler → Drizzle → Supabase(Postgres, RLS 검증)
   → 성공: 확정 / 실패: rollback

[Act] 블록 드래그·리사이즈·추가 → 위와 동일 (낙관적 업데이트가 핵심 경험)
   → 타이머는 time_logs에 기록, actual_minutes 갱신

[Review] 일기 Submit → Route Handler
   → 3층 메모리 조립 → Vercel AI SDK(모델 비종속) → 분석
   → daily_reviews 저장 → 화면 표시
```

## 3층 메모리 (ADR-006 상세)
기록이 쌓여도 AI 입력 크기를 일정하게 유지하기 위한 전략:
1. **원장(raw)**: `nodes`·`time_logs`·`daily_reviews` — Postgres에 영구 저장. AI에 직접 안 줌.
2. **집계(stats)**: `category_stats` — 측정/일 단위로 갱신. 가벼우니 AI에 **항상 통째로**.
   예측 보정과 성장 추세(자기효능감)의 소스.
3. **검색(retrieval)**: 오늘 task와 유사한 과거 `nodes`/`reviews` 몇 개만. 키워드·카테고리
   매칭으로 시작하고, 필요해지면 임베딩 기반으로 확장.

→ **AI 프롬프트 = ②집계 전체 + ③검색 일부 + 오늘 데이터 + 오늘 일기.** 입력 크기 일정.

## 상태 관리
- **서버 상태**: TanStack Query (캐시 + 낙관적 업데이트).
- **클라이언트 UI 상태**(드래그 중, 패널 토글 등): 가벼우면 `useState`, 공유가 필요하면 Zustand.
- 비밀키는 서버(Route Handler / env)에만. 클라이언트 번들에 절대 포함 금지.
