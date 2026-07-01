# Step 5: shelf-projects

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-028** — 비활성 프로젝트는 Shelf로 이동)
- `src/components/calendar/ShelfColumn.tsx` (지금 shelved **task** 목록을 렌더. 여기에 비활성 **프로젝트**
  섹션을 추가한다. 기존 unshelve/삭제 UX 패턴을 그대로 참고)
- `src/core/project.ts` (step 2: `deactivatedProjects`)
- `src/hooks/projects.ts` (`useProjects`, `useUpdateProject`, `useRemoveProject`)
- `src/i18n/messages/en.json`·`ko.json` (shelf/projects 라벨 네임스페이스)

## 작업

### `ShelfColumn.tsx` — 비활성 프로젝트 섹션 추가

기존 shelved task 목록은 그대로 두고, **비활성 프로젝트**를 함께 보여준다:

- `deactivatedProjects(useProjects())`(core)로 목록을 만든다. 비어 있으면 섹션을 그리지 않는다(또는 조용히 숨김).
- 각 항목: 프로젝트 색·이름 표시 + 액션 2개:
  - **재활성(reactivate)**: `useUpdateProject().mutate({ projectId, patch: { deactivatedAt: null } })` → legend로
    복귀. 라벨 `t("reactivate")` 계열(shelf의 unshelve와 같은 결의 아이콘, 예: `faCircleArrowUp`/기존 unshelve 아이콘).
  - **삭제**: `useRemoveProject().mutate(projectId)` (`faTrashCan`).
- 시각적으로 shelved task 항목과 구분되게 소제목/구분선을 둔다(task와 project는 다른 종류).

전부 **낙관적**(기존 shelf 동작과 동일). 재활성 시 그 프로젝트의 task들은 원래 자리에 그대로 있다(task 무영향,
ADR-028).

### i18n

`reactivate` 등 필요한 라벨을 en·ko 양쪽 추가한다.
- en: "Reactivate" / ko: "다시 활성화"

## 금지사항

- 비활성/삭제 판정을 인라인하지 마라. 이유: `deactivatedProjects`(core) 사용.
- 재활성/삭제가 그 프로젝트의 **task를 건드리게 하지 마라**. 이유: active 상태는 task 무영향(ADR-028) — 오직
  projectId 그룹핑만 유지/해제된다(삭제 시 기존대로 set null).
- 서버 응답 await로 UI를 멈추지 마라. 이유: ADR-007.
- i18n 한쪽만 채우지 마라.
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
2. 체크리스트: ShelfColumn이 비활성 프로젝트를 렌더? 재활성(`deactivatedAt:null`)·삭제 낙관적 동작? task 무영향?
   task 섹션과 시각 구분? i18n en·ko?
3. `phases/14-project-states/index.json`의 step 5 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ShelfColumn에 비활성 프로젝트 섹션 + 재활성(deactivatedAt=null)·삭제, task 무영향, i18n"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
