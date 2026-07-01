# Step 4: calendar-filter

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-028** — visibility만 task에 영향)
- `src/components/calendar/CalendarGrid.tsx` (`buildColumnBlocks(kind)` ~line 369 — plan/action/ghost 블록을
  만드는 곳. `useProjects`·`colorOf(projectId)` 이미 있음. 여기서 숨김 프로젝트 블록을 뺀다)
- `src/components/calendar/CalendarBlock.tsx` (색 스와치 위 프로젝트 지정 `<select>` ~line 227 — 옵션 목록을
  활성 프로젝트로 제한한다)
- `src/core/project.ts` (step 2: `hiddenProjectIds`, `isBlockProjectHidden`, `activeProjects`)
- `src/hooks/projects.ts` (`useProjects`)

## 작업

### 1. `CalendarGrid.tsx` — 숨김 프로젝트 블록 필터

`buildColumnBlocks`가 만드는 블록 중, **그 task의 projectId가 숨김 프로젝트**면 캘린더에서 제외한다.

- `useProjects`로 프로젝트를 가져와 `hiddenProjectIds(projects)`(core)로 숨김 id Set을 만든다.
- 블록의 taskId → task → projectId를 찾아(`useTasks` 이미 있음) `isBlockProjectHidden(projectId, hiddenSet)`이면
  그 블록(plan·action·ghost 전부)을 렌더 목록에서 뺀다.
- plan 칼럼·act 칼럼·ghost 모두 동일하게 적용한다(숨김은 그 프로젝트의 모든 흔적을 화면에서 없앰).

주의: 이건 **렌더 필터일 뿐** 데이터는 그대로다(ADR-025 "데이터는 사실, 화면은 해석"). plan/action 행을
삭제하거나 상태를 바꾸지 마라.

### 2. `CalendarBlock.tsx` — 지정 픽커에서 비활성 제외

task에 프로젝트를 지정하는 `<select>`의 옵션을 `activeProjects(projects)`(core)로 제한한다. 이유: 은퇴한
프로젝트에 새로 task를 붙이지 않기 위함(ADR-028). 단, **이미 그 프로젝트에 속한 task**라면 현재 값이 목록에
없어 빈칸처럼 보일 수 있으니, 현재 projectId가 비활성이면 그 항목은 예외적으로 표시되게 한다(선택 유지).

## 금지사항

- 숨김 처리로 plan/action **데이터를 삭제하거나 상태를 바꾸지 마라**. 이유: visibility는 순수 뷰 필터(ADR-025).
- 숨김 판정을 컴포넌트에 인라인하지 마라. 이유: `hiddenProjectIds`/`isBlockProjectHidden`(core) 사용.
- 낙관적 흐름을 깨지 마라(필터는 파생 렌더라 mutation과 무관).
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

## 검증 절차

1. build·lint·test 통과.
2. 체크리스트: 숨김 프로젝트의 plan/act/ghost 블록이 캘린더 렌더에서 빠지는가(데이터는 보존)? 지정 픽커가
   활성 프로젝트만(+현재 선택값) 보여주는가? 판정이 core 호출인가?
3. `phases/14-project-states/index.json`의 step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "CalendarGrid가 숨김 프로젝트 블록을 렌더 필터(데이터 보존), CalendarBlock 지정 픽커는 활성만"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
