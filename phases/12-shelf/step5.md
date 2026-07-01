# Step 5: shelf-trigger

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-026**, ADR-016(task = 정체성, 생애주기), ADR-007(낙관적)
- `/CLAUDE.md` — UI 텍스트는 **영어**(화면 문구), 코드/식별자 영어
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/calendar/TaskDetailModal.tsx` — bar 편집 모달(Originally / Done / Carried). shelf 버튼을 여기에 둔다
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/hooks/tasks.ts` — `useUpdateTask`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/core/time/shelf.ts` — `isShelved`
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/i18n/messages/en.json` 와 `ko.json` — 특히 `taskDetail` 네임스페이스
- `/Users/hyeyoungjo/Projects/dear-my-routines/src/components/DateBar.tsx` — `useTranslations("...")` 사용 패턴 참고

## 작업

task를 shelf에 **올리는 트리거**를 `TaskDetailModal`에 추가한다. 이 모달은 이미 task 생애주기(시작일/완료일)를 편집하므로 자연스러운 위치다.

1. **i18n 키 추가** — `en.json`·`ko.json`의 `taskDetail` 네임스페이스에 키를 추가한다(두 파일 키 구조 동일하게):
   - `shelf`: EN `"Shelf"`, KO `"선반에 두기"`
   - `unshelve`: EN `"Bring back"`, KO `"다시 꺼내기"` (이 키는 step 6에서도 쓰므로 지금 함께 추가)
   - `shelvedNote`: EN `"Shelved — paused from daily carry-over"`, KO `"선반에 둠 — 매일 자동 이월에서 잠시 빠짐"`
   - JSON은 UTF-8로 저장하고, 기존 키 순서/들여쓰기 스타일을 따른다.

2. **모달에 Shelf 버튼/토글 추가** — `useTranslations("taskDetail")`와 `useUpdateTask`를 사용:
   - 활성 task(`!isShelved(task)`)면 **"Shelf"** 버튼을 보여주고, 클릭 시
     `updateTask.mutate({ taskId, patch: { shelvedAt: new Date() } })` (낙관적). 누르면 캘린더에서 즉시
     사라지는 게 자연스러우면 모달을 닫아도 좋다(UX 재량).
   - 이미 shelved면 **"Bring back"** 버튼 + `shelvedNote` 안내를 보여준다. "Bring back"의 동작(꺼내기:
     shelvedAt 해제 + 오늘 plan 생성)은 step 6에서 공용 핸들러로 구현하므로, 여기서는 같은 핸들러를
     호출하도록 연결하거나 step 6이 채울 자리를 남겨둔다(둘 중 깔끔한 쪽). 최소한 모달에서 shelf 상태가
     보이고 올리기가 동작해야 한다.
   - 버튼 스타일은 모달의 기존 버튼(Originally/Done) 톤과 맞춘다. 파괴적 액션처럼 보이지 않게 — shelf는
     "잠깐 내려놓기"이지 삭제가 아니다.

3. UI에 보이는 모든 문구는 i18n 키를 통해서만 출력한다(하드코딩 금지).

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `en.json`·`ko.json`이 동일한 키 집합을 갖는지(누락 없음), UTF-8로 저장됐는지 확인한다.
3. 모달이 활성/내려놓음 상태에 따라 다른 버튼을 보여주고, 올리기가 `useUpdateTask`로 낙관적 처리되는지 확인한다.
4. 아키텍처 체크리스트: Client 컴포넌트(`'use client'`) / UI 텍스트 영어+i18n / 비밀키 노출 없음.
5. `phases/12-shelf/index.json`의 step 5를 업데이트한다(성공 → `completed` + summary, 실패 → `error`).

## 금지사항

- UI 문구를 하드코딩하지 마라. 이유: i18n(en/ko) 일관성, CLAUDE.md UI 영어 규칙은 키 기반으로 충족.
- shelf를 삭제처럼 보이는 빨간 파괴 버튼으로 만들지 마라. 이유: shelf는 복원 가능한 "내려놓기".
- `en.json`/`ko.json` 한쪽만 수정하지 마라. 이유: 키 불일치 시 런타임 누락.
- 기존 테스트를 깨뜨리지 마라.
