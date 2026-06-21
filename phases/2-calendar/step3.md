# Step 3: plan-vs-actual

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: UI 영어, 부드러운 UX, core/hooks 분리)
- `/docs/PRD.md` (예상 vs. 실제 나란히, 프로젝트별 통계, 빅3), `/docs/ADR.md` (ADR-004, ADR-006)
- step0~2 산출물: 시간 필드, 캘린더 그리드, 드래그/리사이즈, `/src/hooks/nodes.ts`, `/src/core/tree/`

## 목표
공유 시간축을 가운데 두고 **Plan(예상) | 시간축 | Action(실제)** 두 컬럼을 완성한다.
같은 task의 **예상 vs 실제를 나란히** 비교하고, 프로젝트 태그(색) + ★빅3를 붙인다.

## 작업
### 1. 두 컬럼 레이아웃
- 공유 시간축(07:00~02:00)을 가운데, 왼쪽 **Plan**(`plannedStart/End` 블록),
  오른쪽 **Action**(`actualStart/End` 블록). 같은 시각이 같은 높이에 오도록 정렬.

### 2. Action(실제) 블록
- 실제 시간 기록: `actualStart`/`actualEnd`. 빈 칸 클릭으로 생성하거나, Plan 블록에서 파생
  (예: "시작/종료" 또는 드래그)로 actual 블록을 만들고 step2의 드래그/리사이즈로 조정.
  (자동 타이머는 선택 — 없으면 수동 생성/조정으로 충분.)

### 3. 예상 vs 실제 비교
- 같은 task의 planned vs actual을 시각적으로 드러낸다 (나란히 + 차이 강조, 예: 실제가 길면 ⚠).

### 4. 태그
- 프로젝트별 색(트리의 부모 project 기준) + ★빅3 표시.

### 5. 디자인 마무리
- Act/Review 패널 톤까지 미니멀 모던으로 통일.

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고, Plan·Action 두 컬럼이 공유 시간축에 정렬되며 예상/실제 블록 + 태그가 보여야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - Plan | 시간축 | Action 두 컬럼이 공유 시간축에 정렬되는가?
   - actual 블록을 생성·조정할 수 있는가?
   - 같은 task의 예상 vs 실제가 시각적으로 비교되는가?
   - 프로젝트 색 + ★빅3가 보이는가? UI 텍스트 영어인가?
   - build가 통과하는가?
3. `phases/2-calendar/index.json`의 step 3을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- AI 분석/데일리 리뷰는 만들지 마라. 이유: phase 3 범위다.
- 트리/시간 로직을 컴포넌트에 새로 구현하지 마라 — `core/tree`·hooks 재사용.
- UI 텍스트에 한글을 쓰지 마라. `.claude/settings.json` Stop 훅 추가 금지. 기존 테스트/인증 깨뜨리지 마라.
