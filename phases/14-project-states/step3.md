# Step 3: legend-icons

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-028** — 세 상태의 의미)
- `src/components/calendar/ProjectLegend.tsx` (프로젝트 칩. 지금 색점(ColorPicker)+이름input+삭제(🗑). 여기에
  아이콘 2개 추가하고, 활성 프로젝트만 렌더한다)
- `src/core/project.ts` (step 2: `activeProjects`, `isProjectHidden`)
- `src/hooks/projects.ts` (`useUpdateProject` — 낙관적 patch. 새 훅 필요 없음)
- `src/components/CalendarBlock.tsx`의 shelve 버튼(`faBoxArchive`)·삭제 버튼 스타일 (아이콘 톤/hover 참고)
- `src/i18n/messages/en.json`·`ko.json` (`"projects"` 네임스페이스 ~line 81 — 여기에 라벨 추가)

## 작업

### `ProjectLegend.tsx`

1. **활성만 표시**: `activeProjects(projects)`(core)로 걸러 렌더한다. 비활성 프로젝트는 legend에서 사라지고
   Shelf에 나타난다(step 5). 정렬(생성순)은 유지.

2. **칩에 아이콘 2개 추가** (기존 색점·이름·🗑 옆에). 전부 `useUpdateProject().mutate`로 **낙관적**:
   - **deactivate** = `faBoxArchive` (task shelve와 같은 아이콘 — "선반으로 내려둠"과 동일 은유).
     클릭 → `patch: { deactivatedAt: new Date() }`. aria/title = `t("deactivate")`.
   - **visibility 토글** = `isProjectHidden(p)` 이면 `faEyeSlash`, 아니면 `faEye`.
     클릭 → `patch: { hiddenAt: p.hiddenAt ? null : new Date() }`. aria/title = 숨김상태에 따라 `t("show")`/`t("hide")`.
     숨김일 때 칩을 살짝 흐리게(opacity) 표시해 상태가 보이게 한다.
   - **삭제** = `faTrashCan` (기존 유지, `removeProject`).
   버튼들은 기존 삭제 버튼처럼 `e.stopPropagation()` + hover 노출 패턴을 따른다.

3. **i18n**: `projects` 네임스페이스에 `deactivate`/`hide`/`show`를 en·ko **양쪽** 추가.
   - en: "Deactivate" / "Hide on calendar" / "Show on calendar"
   - ko: "비활성" / "캘린더에서 숨기기" / "캘린더에 표시"

`new Date()`를 patch에 넣으면 낙관적 캐시에는 Date로, 서버로는 ISO string으로 나가고 step 1의 PATCH route가
받아 저장한다. `updateProject`의 낙관적 updater(기존)가 그대로 `{ ...p, ...patch }` 병합하므로 훅 수정 불필요.

## 금지사항

- 시각 계산이나 상태 판정 로직을 컴포넌트에 인라인하지 마라. 이유: `activeProjects`/`isProjectHidden`(core)를
  호출한다.
- 비활성 프로젝트를 legend에 남기지 마라. 이유: 비활성은 Shelf로 이동하는 설계(ADR-028).
- 서버 응답을 await하며 UI를 멈추지 마라. 이유: ADR-007 낙관적 업데이트.
- i18n 키를 한쪽 언어만 채우지 마라.
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
2. 체크리스트: legend가 `activeProjects`만 렌더? deactivate=`faBoxArchive`, visibility=`faEye`/`faEyeSlash`
   토글, 삭제=`faTrashCan`? 세 동작 다 낙관적 `useUpdateProject`/`removeProject`? i18n en·ko 채움?
3. `phases/14-project-states/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ProjectLegend: 활성만 표시 + deactivate(archive)·visibility(eye) 아이콘, 낙관적 patch, i18n en/ko"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
