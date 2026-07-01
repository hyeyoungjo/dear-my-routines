# Step 2: core-project

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` (순수 로직은 `src/core/` — React/DB/네트워크 금지)
- `/docs/ADR.md` (**ADR-028** — 두 상태의 의미)
- `src/core/time/shelf.ts` (선례: `isShelved`, `shelvedTaskIds` 같은 순수 술어 스타일을 그대로 따른다)
- `src/db/schema.ts` (step 1에서 추가된 `projects.deactivatedAt`/`hiddenAt`. 단, **core는 db 타입을 import하지
  말고** 아래처럼 최소 입력 타입을 자체 정의한다 — 기존 core가 wire 타입을 따로 두는 방식)

## 작업

새 파일 `src/core/project.ts`에 순수 함수를 만든다. 부작용·React·DB·fetch 금지 (CLAUDE.md CRITICAL). 상태는
**null 여부만** 본다(값의 타입은 무관하게 `== null` 체크 — 서버 JSON은 ISO string, 메모리는 Date일 수 있음).

최소 입력 타입 + 함수 시그니처:

```ts
/** Just the state fields this module reads (avoids importing the db row type). */
export type ProjectState = {
  projectId: string;
  deactivatedAt: string | Date | null;
  hiddenAt: string | Date | null;
};

/** Active = not deactivated. (null deactivatedAt) */
export function isProjectActive(p: Pick<ProjectState, "deactivatedAt">): boolean;

/** Hidden from the calendar = hiddenAt set. */
export function isProjectHidden(p: Pick<ProjectState, "hiddenAt">): boolean;

/** Only the active projects (for the legend + assign picker). */
export function activeProjects<T extends Pick<ProjectState, "deactivatedAt">>(projects: T[]): T[];

/** Only the deactivated ones (for the Shelf column). */
export function deactivatedProjects<T extends Pick<ProjectState, "deactivatedAt">>(projects: T[]): T[];

/** The set of projectIds whose tasks should be hidden from the calendar. */
export function hiddenProjectIds(projects: ProjectState[]): Set<string>;

/**
 * Whether a block belongs to a hidden project. `taskProjectId` may be null
 * (unassigned task) → always visible. Used by the calendar block filter.
 */
export function isBlockProjectHidden(
  taskProjectId: string | null,
  hidden: ReadonlySet<string>,
): boolean;
```

## 테스트 — `src/core/project.test.ts`

`src/core/time/shelf.test.ts` 스타일로 각 함수의 핵심 케이스를 **먼저** 작성하고 통과시켜라:
- `isProjectActive`/`isProjectHidden`: null ↔ 값 있음 양쪽.
- `activeProjects`/`deactivatedProjects`: 섞인 리스트에서 올바르게 분리.
- `hiddenProjectIds`: 숨김 프로젝트 id만 Set에 담김.
- `isBlockProjectHidden`: 숨김 프로젝트의 taskProjectId → true, 다른/`null` → false.

## 금지사항

- `src/core/`에 React/DB/fetch를 넣지 마라. 이유: core는 순수 함수여야 테스트·재사용 가능(CLAUDE.md CRITICAL).
- `db/schema.ts`의 `Project` 타입을 import하지 마라. 이유: 기존 core(plan/action)처럼 최소 wire 타입을 자체
  정의해 db 결합을 피한다.
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm test
```

```bash
npm run build
```

## 검증 절차

1. `npm test`·`npm run build` 통과.
2. 체크리스트: `src/core/project.ts`가 순수 함수인가? shelf 술어 스타일과 일관? 테스트가 모든 함수를 덮는가?
3. `phases/14-project-states/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "core/project.ts 순수 술어(isProjectActive/Hidden, activeProjects/deactivatedProjects, hiddenProjectIds, isBlockProjectHidden) + project.test.ts"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
