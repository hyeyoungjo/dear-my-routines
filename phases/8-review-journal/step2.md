# Step 2: review-column

Review 일기의 UI 레이어를 만든다. 캘린더에 4번째 열(Review)을 붙이고, 그날 전체에 대한
**일기 같은 자유 리플렉션**을 디바운스 자동저장으로 작성한다. 고아 패널 스텁을 정리한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-004(Plan·Act·Review), ADR-007(부드러운 UX)
- `/src/components/calendar/CalendarGrid.tsx` — **현재 레이아웃**. flex 컨테이너로
  `[Plan column(flex-1)] [shared time axis(w-14)] [Action column(flex-1)]`을 그리고,
  헤더(`Plan` / `Action`)를 본문과 정렬한다. 여기에 Review 열을 추가한다.
- `/src/components/date.tsx` — `useSelectedDate()`(선택된 날짜 훅).
- `/src/hooks/dailyReviews.ts` — Step 1의 `useDailyReview(date)` / `useUpsertDailyReview()`.
- `/src/core/time/day.ts` — `dayKey(Date) → "YYYY-MM-DD"`.
- `/src/components/panels/ReviewPanel.tsx`, `/src/components/panels/ActPanel.tsx` — 정리 대상(아래 참고).

CalendarGrid가 헤더와 본문 열을 어떻게 정렬하는지(헤더의 `flex-1` / `w-14` 구조) 정확히 읽고,
같은 정렬을 깨지 않게 Review 열을 추가하라.

## 작업

### 1. `src/components/calendar/ReviewColumn.tsx` (신규, `"use client"`)

그날 전체에 대한 일기 한 통을 쓰는 독립 열.

```ts
export function ReviewColumn(): JSX.Element
```

- 내부에서 `useSelectedDate()` → `dayKey(selectedDate)`로 `date` 문자열을 만들고,
  `useDailyReview(date)`로 기존 일기를 불러와 `<textarea>`의 초기값으로 채운다.
- `<textarea>`는 **로컬 state**로 입력을 받고, **디바운스 자동저장**한다:
  - 입력이 멈춘 뒤 약 **600ms** 후 `useUpsertDailyReview().mutate({ date, journalText })` 호출.
  - `onBlur`(포커스 아웃) 시, 그리고 **`date`가 바뀔 때**(다른 날로 이동) 보류 중인 저장을 즉시 flush 한다.
    이유: 디바운스 대기 중 날짜를 바꾸면 직전 날 글이 유실될 수 있다.
  - 디바운스 타이머는 cleanup으로 정리한다(언마운트·재입력 시 중복 저장 방지).
- 저장은 낙관적이라 화면을 멈추지 않는다(ADR-007). "저장 중" 때문에 textarea를 비활성화하지 마라.
- 이 열은 **시간 그리드를 공유하지 않는다** — 시간 라인(hour line)·시간축을 그리지 마라.
  Plan/Act 본문과 같은 세로 높이를 차지하되, 안은 자유 textarea 하나다.
- AI 관련 UI(분석 버튼·결과 영역)는 넣지 마라.

### 2. `CalendarGrid.tsx`에 Review 열 통합

- 본문 flex 컨테이너에서 Action 열 **오른쪽에** `<ReviewColumn />`을 추가한다.
- 헤더 영역에도 `Review` 제목 칸을 추가해 본문 열과 정렬을 맞춘다(기존 `Plan` / `Action` 헤더와 같은 스타일).
- Plan·시간축·Action 쪽 기존 동작(드래그/리사이즈/클릭 생성/ghost)을 **변경하지 마라**. Review는 독립 추가다.

### 3. 고아 스텁 정리

`page.tsx`는 `ActPanel`/`ReviewPanel`을 import하지 않는다(현재 화면에 안 붙음). 확인 후:

- `src/components/panels/ActPanel.tsx` 삭제. 이유: Act는 이미 CalendarGrid에 있다(중복 죽은 코드).
- `src/components/panels/ReviewPanel.tsx` 삭제. 이유: 본 step의 `ReviewColumn`이 대체한다.
- 삭제 전 `grep`으로 두 컴포넌트를 import하는 곳이 없는지 확인하라. import가 남아 있으면 먼저 제거한다.
- `src/components/panels/`가 비면 디렉토리를 남겨두지 말고 정리해도 좋다(필수 아님).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

build·lint·test가 에러 없이 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `ReviewColumn`이 `src/components/calendar/`에 있고 `"use client"`인가?
   - 자동저장이 낙관적 훅(Step 1)을 쓰고, textarea를 막지 않는가? (ADR-007)
   - Review 열이 시간축/시간 라인을 그리지 않는가? (그날 전체 일기)
   - `ActPanel`/`ReviewPanel` 삭제 후 깨진 import가 없는가?
   - AI UI가 들어가지 않았는가?
3. 결과에 따라 `phases/8-review-journal/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(신규/삭제 파일 경로 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- Review 열에 시간 그리드(시간 라인·시간축)를 그리지 마라. 이유: 일기는 시각이 아니라 하루 전체에 대한 것이다.
- 서버 응답을 기다리며 textarea를 disabled로 두거나 입력을 막지 마라. 이유: ADR-007 위반.
- AI 분석 버튼·결과 영역 등 AI UI를 넣지 마라. 이유: 이 phase 범위 밖(추후 작업).
- Plan/Action 열의 기존 드래그·리사이즈·생성 로직을 바꾸지 마라. 이유: Review는 독립 추가다.
- 디바운스 타이머 cleanup을 빠뜨리지 마라. 이유: 중복 저장·메모리 누수.
- 기존 테스트를 깨뜨리지 마라.
