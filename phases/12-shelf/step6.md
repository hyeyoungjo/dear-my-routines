# Step 6: shelf-tray

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026**(보기=접히는 사이드 트레이, 꺼내기=오늘 복귀), ADR-007(낙관적)
- `/CLAUDE.md` — UI 텍스트 영어+i18n, 낙관적 업데이트, Client 컴포넌트는 `'use client'`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/calendar/CalendarGrid.tsx` 와 이를 품는
  캘린더 페이지/레이아웃(예: `src/app/(app)/...` 또는 `src/app/page.tsx` — 직접 찾아라). 트레이를 여기에 붙인다
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/MiniCalendar.tsx`, `DateBar.tsx` — 사이드/팝오버 UI·i18n 패턴 참고
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts` — `useTasks`, `useUpdateTask`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/planBlocks.ts` — `useAddPlanBlock`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/shelf.ts` — `isShelved`, `freshPlanToday`(step 1)
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/day.ts` — `startOfDay`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/i18n/messages/en.json`·`ko.json` — `taskDetail.unshelve` 등(step 5에서 추가). 트레이 전용 키는 새 `shelf` 네임스페이스에 추가

이전 step들: shelf 올리기(step 5), sweep/캘린더 필터(step 3·4), `freshPlanToday`(step 1)가 준비됐다.

## 작업

내려놓은 task를 **보고 다시 꺼내는** 접히는 사이드 트레이 `ShelfTray`를 만든다. 이 앱엔 task 목록 UI가 없으므로 이게 유일한 보관함이다 — 없으면 내려놓은 task가 화면에서 사라져 영영 못 찾는다.

1. **신규 컴포넌트** `src/components/calendar/ShelfTray.tsx` (`'use client'`):
   - `useTasks()`에서 `isShelved`인 task만 추린다. **개수 배지**와 함께 평소 **접힘** 상태로, 캘린더 옆/모서리에
     붙는 작은 탭/핸들로 표시한다(펼침 상태는 `useState`로 로컬 관리). 개수 0이면 핸들을 아주 작게/조용히
     둔다(완전히 숨길지 작게 둘지는 UX 재량 — 단 0일 때 시끄럽지 않게).
   - 펼치면 내려둔 task 목록(제목, 가능하면 project 색/내려놓은 시각). 각 항목에 **"Bring back"** 버튼.
   - 스크롤·반응형 고려(목록이 길어질 수 있음). 모바일에서도 깨지지 않게(ADR-023 모바일 레이아웃 참고).

2. **꺼내기(un-shelve) 핸들러** — 두 동작을 한 번에(둘 다 낙관적):
   - `updateTask.mutate({ taskId, patch: { shelvedAt: null } })` — 활성으로 되돌림.
   - `addPlanBlock.mutate(freshPlanToday(taskId, taskPlansOfThis, startOfDay(new Date())))` — 오늘 날짜에
     새 `planned` 블록 하나 생성. `taskPlansOfThis`는 그 task의 기존 plan들(없으면 빈 배열 → 기본 슬롯).
   - 두 캐시(tasks, planBlocks)가 즉시 갱신되고 실패 시 각자 rollback되는지 확인(기존 훅의 낙관 경로 재사용).
   - 옛 `missed` plan은 부활시키지 마라(ADR-026). `freshPlanToday`만 사용.
   - 같은 "Bring back" 핸들러를 step 5의 모달 버튼에서도 재사용할 수 있게 export 하거나 공용 훅/함수로
     뽑아라(중복 구현 금지).

3. **캘린더 페이지에 연결** — `ShelfTray`를 캘린더 화면 레이아웃에 마운트한다. 기존 3열(Plan/Act/Reflect)
     레이아웃을 깨지 않는 위치(옆 가장자리/접힌 트레이)로.

4. **i18n** — `en.json`·`ko.json`에 `shelf` 네임스페이스 추가(두 파일 동일 키, UTF-8):
   - `title`: EN `"Shelf"`, KO `"선반"`
   - `empty`: EN `"Nothing shelved"`, KO `"내려둔 게 없어요"`
   - `bringBack`: EN `"Bring back"`, KO `"다시 꺼내기"` (또는 step 5의 `taskDetail.unshelve` 재사용)
   - `count`: 개수 표시가 필요하면 ICU plural 형태로.
   하드코딩 금지.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다(빌드·테스트·린트 통과).
2. un-shelve가 (a) shelvedAt=null, (b) 오늘 새 planned 블록 생성 — 둘 다 낙관적으로 일어나고 실패 시
   rollback되는지 코드로 확인한다. 옛 missed 부활이 없는지 확인한다.
3. `ShelfTray`가 평소 접힘 + 개수 배지이고, 캘린더 레이아웃을 깨지 않으며, 모바일에서도 동작하는지 확인한다.
4. `en.json`·`ko.json` 키 일치 + UTF-8 확인.
5. 아키텍처 체크리스트: Client 컴포넌트(`'use client'`) / 낙관적+rollback / UI 영어+i18n / 데이터 불변(필터로 숨김).
6. `phases/12-shelf/index.json`의 step 6을 업데이트한다(성공 → `completed` + summary, 실패 → `error`).

## 금지사항

- un-shelve에서 옛 `missed` plan을 부활/복원하지 마라. 이유: 깨끗한 재시작(ADR-026).
- "Bring back" 핸들러를 모달(step 5)과 트레이에 따로 중복 구현하지 마라. 이유: 공용화.
- task row나 plan/action 히스토리를 삭제하지 마라. 이유: shelf는 복원 가능, missed는 데이터.
- 개수 0일 때 시끄러운 빈 패널을 띄우지 마라. 이유: shelf는 조용한 보관함이어야 함.
- `en.json`/`ko.json` 한쪽만 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
