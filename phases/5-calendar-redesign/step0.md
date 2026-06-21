# Step 0: task-blocks

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 로직 `core/` 분리, 부드러운 UX, UI 영어)
- `/docs/ADR.md` (ADR-009 계층, ADR-004 캘린더, ADR-007 UX)
- `/src/components/calendar/CalendarGrid.tsx`, `/src/components/calendar/CalendarBlock.tsx`
- `/src/core/time/calendar.ts`(+test), `/src/core/tree/tree.ts` (`ancestorOfType`),
  `/src/lib/projectColor.ts`, `/src/hooks/nodes.ts`, `/src/db/schema.ts`

## 멘탈모델 (중요 — 지금 구현이 어긋나 있음)
계층은 **Project > Task > Subtask > Subsubtask**. **Project(와 Area)는 시간을 갖지 않는 묶음**이고,
**Task부터 시간 블록**이다. 지금은 Project까지 시간 블록으로 그려서 틀렸다.

## 목표
- 캘린더 시간축에 **Task를 최상위 시간 블록**으로, 그 안에 **Subtask>Subsubtask를 중첩 시간 블록**
  (frame-in-frame, 임의 깊이)으로 그린다.
- **Project/Area는 시간 블록으로 그리지 않는다.** 대신 Task에 **프로젝트 색 + 라벨**로 표시.
- 제목/버튼은 블록 안 상단 **오버레이**(레이아웃 공간 0)로 둬서 **시간축을 정확히** 유지한다
  (이전엔 제목 헤더가 시간 공간을 먹어 subtask가 겹쳤다).

## 작업
### 1. 캘린더는 Task부터 (`CalendarGrid` buildColumnTree)
- 시간 블록으로 그리는 최상위 = **type `task`**. `area`/`project`는 시간 필드가 있어도 캘린더에
  블록으로 그리지 않는다(렌더 대상에서 제외).
- task 아래 `subtask`/`subsubtask`는 중첩(기존 nested 로직 유지, 단 최상위가 task).
- task의 조상 `project`(`ancestorOfType(all, id, "project")`)로 **색(`projectColor`) + 라벨
  (project.title)** 을 그 task 블록에 붙인다.

### 2. 제목 오버레이 (`CalendarBlock`) — 시간축 정확
- 블록 = **순수 시간 높이**(top = 시작 px, height = duration px). 제목·★·＋·✕를 블록 안
  **상단 오버레이**(`absolute`, 세로 레이아웃 0)로 → 헤더가 시간 공간을 먹지 않는다.
- 짧은 블록: 제목 `truncate` + `title` 속성(hover 시 전체 제목).
- nested subtask: 시간 위치(top = 시작 px) + **좌측 들여쓰기**. 부모 제목 오버레이는 위(z)에 둬
  자식과 시각이 겹쳐도 제목이 읽히게.

### 3. `core/time` 정리
- 제목이 오버레이(공간 0)이므로 더는 `headerPx`만큼 자식을 밀 필요가 없다. `blockPixelHeight`/
  자식 offset을 **순수 시간 기반**(headerPx 제거/0)으로 단순화하고, 부모가 자식을 시간으로 감싸는
  `fitParentToChildren`은 유지. **테스트 갱신**.

### 4. 생성
- 빈 칸 클릭 = task 생성(현재대로). 블록의 ＋ = subtask(`childTypeOf`). **Project 배정 UI는 다음
  step** — 이 step은 기존 데이터에 project가 있으면 색/라벨을 보여주는 데까지.

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드·테스트 통과. area/project는 시간 블록으로 안 그려지고, task 최상위 + subtask 중첩이 시간축에
정확히 정렬되며(겹침은 실제 시간 겹칠 때만), 제목 오버레이로 헤더가 시간 공간을 먹지 않아야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - area/project가 시간 블록으로 안 그려지는가? task가 최상위인가?
   - subtask>subsubtask가 중첩 시간 블록으로, 헤더가 시간을 안 먹어 안 겹치는가?
   - 제목 오버레이 + 짧으면 hover? task에 project 색/라벨?
   - `core/time` 테스트가 새 공식으로 갱신되고 통과하는가? build 통과?
3. `phases/5-calendar-redesign/index.json`의 step 0을 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- area/project를 시간 블록으로 그리지 마라. 이유: 시간을 갖지 않는 묶음이다(멘탈모델).
- 시간/높이 로직을 컴포넌트에 흩지 마라 — `core/time` 순수 함수 + 테스트.
- UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지. 기존 인증/테스트 깨뜨리지 마라.
