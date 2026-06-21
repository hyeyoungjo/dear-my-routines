# Step 2: drag-resize

## 읽어야 할 파일
- `/CLAUDE.md` (CRITICAL: 부드러운 UX, 낙관적 업데이트, Client Component)
- `/docs/ADR.md` (ADR-007 부드러운 UX, ADR-010 dnd-kit)
- step1 산출물: `src/components/calendar/`, `/src/hooks/nodes.ts`, `/src/core/tree/`
- `/src/db/schema.ts` (시간 필드)

## 목표
캘린더 블록을 **dnd-kit으로 드래그 이동 + 외곽 드래그 리사이즈**해서 시간을 조정한다.
구글 캘린더 느낌(시간 단위 스냅, 부드러운 미리보기). 모든 변경은 낙관적 업데이트.

## 작업
### 1. dnd-kit 설치
- `npm install @dnd-kit/core` (필요하면 `@dnd-kit/modifiers`도).

### 2. 블록 드래그 이동
- 블록을 위/아래로 드래그하면 `plannedStart`/`plannedEnd`가 같은 duration으로 시간 이동.
- **시간 단위 스냅**(15분 또는 30분 격자).
- 낙관적 업데이트(`useUpdateNode`): 드래그 중 화면 즉시 반영, 실패 시 rollback.

### 3. 외곽(엣지) 리사이즈
- 블록 **아래 엣지** 드래그 → `plannedEnd` 조정(duration 변경). (위 엣지 → `plannedStart`도 가능.)
- 같은 스냅 + 낙관적 업데이트.
- 최소 길이(예: 15분) 제약, 음수/역전 방지.

### 4. 구글 캘린더 느낌
- 드래그 중 부드러운 미리보기, 스냅 격자에 붙기, 커서 변화(이동/리사이즈).

## Acceptance Criteria
```
npm install
npm run lint
npm run build
npm run test
```
빌드가 통과하고, 블록 드래그 이동 + 외곽 리사이즈가 시간을 바꿔야 한다.

## 검증 절차
1. AC 커맨드를 순서대로 실행한다.
2. 체크리스트:
   - dnd-kit으로 블록 드래그 이동 시 시간(planned)이 바뀌는가?
   - 외곽 드래그로 duration이 리사이즈되는가?
   - 시간 단위 스냅 + 낙관적(즉시 반영 + rollback)인가?
   - 최소 길이/역전 방지가 되는가?
   - build가 통과하는가?
3. `phases/2-calendar/index.json`의 step 2를 업데이트한다 (completed+summary / error / blocked).

## 금지사항
- 서버 응답을 기다리며 UI를 멈추지 마라(낙관적). 이유: 부드러운 UX(CLAUDE.md CRITICAL).
- 트리/시간 로직을 컴포넌트에 새로 구현하지 마라 — `core/tree`·hooks 재사용.
- Action(실제) 컬럼은 만들지 마라. 이유: step3 범위다.
- UI 한글 금지. `.claude/settings.json` Stop 훅 추가 금지. 기존 테스트 깨뜨리지 마라.
