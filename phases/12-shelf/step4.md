# Step 4: calendar-filter

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026**, ADR-013/025(rows가 진실, 화면은 조립/해석), ADR-015(plan·action 분리)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/calendar/CalendarGrid.tsx` — 두 컬럼(PLAN/ACT) 그리드, plan/action/ghost 블록을 조립하는 곳
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/calendar/CalendarBlock.tsx` — 블록 셰이프(`isMissed`, `carryCount`, `isGhost`)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts` — `useTasks`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/shelf.ts` — `shelvedTaskIds`(step 1)

이전 step에서 sweep이 shelved task를 이월 대상에서 제외한다. 이제 **화면**에서도 shelved task의 블록이 안 보이게 한다.

## 작업

`CalendarGrid`(및 블록을 조립하는 동일 모듈)에서 **shelved task에 속한 plan/action/ghost 블록을 렌더링에서 제외**한다.

1. `useTasks()`로 task 목록을 얻고 `shelvedTaskIds(tasks)`로 Set을 만든다(이미 그리드가 tasks를 쓰고
   있으면 재사용).
2. plan 블록, action 블록, ghost(미실행 plan 투영) 블록을 만드는 파이프라인 각각에서 `taskId`가
   shelved Set에 들어 있으면 **걸러낸다**. 세 종류 모두 빠뜨리지 마라(ghost는 plan에서 파생되므로
   plan을 거르면 자동으로 빠질 수 있으나, 별도 경로라면 명시적으로 거른다).
3. **삭제가 아니라 필터다.** plan_blocks/action_blocks row는 그대로 둔다(ADR-018, ADR-026: 완전 복원
   가능해야 함). 데이터는 손대지 말고 렌더 단계에서만 숨긴다.
4. 다른 컬럼(Review 등)이나 통계가 shelved task를 어떻게 다루는지는 이 step 범위 밖이다 — 캘린더 두
   컬럼의 블록 렌더만 다룬다.

구현 디테일(어느 map/필터 지점에 끼울지)은 코드를 읽고 에이전트 재량으로 정하되, **세 블록 종류 전부**
shelved task를 제외한다는 규칙은 반드시 지킨다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. plan·action·ghost 세 경로 모두에서 shelved taskId가 제외되는지 코드로 확인한다.
3. plan_blocks/action_blocks를 삭제하거나 변형하는 코드가 없는지 확인한다(필터만).
4. 아키텍처 체크리스트: Server/Client 컴포넌트 경계 유지(`'use client'`) / 데이터 불변 / ADR 이탈 없음.
5. `phases/12-shelf/index.json`의 step 4를 업데이트한다(성공 → `completed` + summary, 실패 → `error`).

## 금지사항

- plan/action row를 삭제하거나 status를 바꾸지 마라. 이유: shelf는 되돌릴 수 있어야 함(ADR-026), missed는 데이터(ADR-018).
- 세 블록 종류 중 하나라도 빠뜨리지 마라(특히 ghost). 이유: 내려놓은 task가 act 컬럼에 유령으로 남으면 "숨김"이 깨진다.
- 캘린더 렌더 밖(통계/AI 입력 등)을 이 step에서 건드리지 마라. 이유: 범위 분리.
- 기존 테스트를 깨뜨리지 마라.
