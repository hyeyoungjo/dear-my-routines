# Step 1: calendar-grid

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: UI 텍스트 영어, 부드러운 UX, Client Component, 로직 `core/`/hooks 분리)
- `/docs/PRD.md` (캘린더, "하루를 한눈에", 7am~2am), `/docs/ADR.md` (ADR-004, ADR-007, ADR-009)
- `/src/db/schema.ts` (step0의 시간 필드), `/src/hooks/nodes.ts`, `/src/core/tree/`
- `/src/components/panels/PlanPanel.tsx` (현재 트리 — 캘린더로 진화)
- `/src/app/globals.css` (디자인 토큰), `/src/app/layout.tsx` (Geist 폰트), `/src/app/page.tsx`

## 목표
구글 캘린더 스타일 **시간 그리드(07:00~익일 02:00)** 위에 task 블록을 시간 위치로 배치하고,
빈 칸 클릭으로 블록을 생성한다. 동시에 **미니멀 모던 디자인**으로 전면 정비한다(올드함 탈피).

## 작업
### 1. 미니멀 디자인 토큰 (`src/app/globals.css`)
구글 캘린더처럼 깨끗·여백 중심으로:
- 배경은 **거의 흰색**(오프화이트), 패널 흰색, **보더는 아주 연하게**, accent는 보라 포인트로만
  (전체 연보라 배경 X — 그게 올드해 보였음).
- `body`의 `font-family`를 `var(--font-geist)`로 (layout이 이미 변수 주입). 시스템 폰트 fallback.
- 3테마(lavender/slate/dark) 토큰 유지하되 위 방향으로 재조정.

### 2. 시간 그리드 (`src/components/calendar/`)
- 세로 시간축 **07:00 → 02:00(다음날)**, 1시간(또는 30분) 슬롯 + 시간 라벨.
- 시간이 배치된 task(`plannedStart`/`plannedEnd` 있는 노드)를 **절대 위치 블록**으로 렌더
  (top = 시작 시각, height = duration). 블록에 제목 + ★빅3.

### 3. 빈 칸 클릭 → 블록 생성
- 빈 시간 슬롯 클릭 시 새 task 생성: `plannedStart` = 클릭한 시각, `plannedEnd` = +1h 기본.
  제목 인라인 입력. `useAddNode`(시간 필드 포함)로 — 낙관적 업데이트.

### 4. 화면 연결
- `src/app/page.tsx`의 메인을 이 캘린더(Plan/예상 컬럼)로 전환한다. Action(실제) 컬럼과
  드래그는 다음 step이므로, 지금은 **예상 블록 표시 + 클릭 생성**까지.

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고, 캘린더 그리드(07:00~02:00)가 렌더되며 빈 칸 클릭으로 블록이 생성돼야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - 07:00~02:00 시간 그리드가 렌더되는가?
   - task 블록이 시간 위치/높이로 배치되는가?
   - 빈 칸 클릭으로 블록이 생성(낙관적)되는가?
   - 디자인이 미니멀·모던(폰트 적용, 옅은 보더, 흰 배경)인가? UI 텍스트 영어인가?
   - build가 통과하는가?
3. `phases/2-calendar/index.json`의 step 1을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 드래그/리사이즈는 만들지 마라. 이유: step2 범위다. 지금은 클릭 생성 + 표시.
- Action(실제) 컬럼은 만들지 마라. 이유: step3 범위다.
- 트리 조작·시간 계산 로직을 컴포넌트에 새로 구현하지 마라 — `core/tree`·hooks 재사용. 이유: 단일 출처.
- UI 텍스트에 한글을 쓰지 마라. `.claude/settings.json`에 Stop 훅 추가 금지. 기존 테스트 깨뜨리지 마라.
