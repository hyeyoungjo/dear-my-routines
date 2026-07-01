# Step 0: docs-adr

## 읽어야 할 파일

- `/docs/ADR.md` (마지막 항목 ADR-027 다음에 이어서 쓴다. ADR-026 Shelf도 읽어라 — 이 설계가 그 패턴을 미러한다)
- `/docs/DATA-STRUCTURE.md` (projects 테이블 구조)

이 step은 **문서만** 작성한다. 코드는 건드리지 않는다.

## 배경

프로젝트는 지금 "존재 vs 하드삭제"뿐이고, 삭제하면 그 프로젝트의 task가 `projectId=null`(미배정)로 풀려
그룹핑이 깨진다. 사용자가 원한 것은 **두 개의 독립된(orthogonal) 프로젝트 상태**다:

- **active/inactive (활성/비활성)** — 프로젝트의 라이프사이클. 비활성 = **Shelf로 이동**(이미 shelved task가
  사는 곳). task에는 **영향 없음**(task는 자기 상태대로 캘린더에 남는다).
- **visibility (표시/숨김)** — 캘린더 포커스 필터. 숨김 = 그 프로젝트의 **task 블록을 캘린더에서 뺀다**
  (task까지 영향을 주는 건 이 상태다). legend 칩은 남는다.

둘은 직교한다: 활성인데 잠깐 숨김(집중), 비활성인데 참고로 표시 — 다 가능해야 한다.

## 작업

`/docs/ADR.md` 맨 끝(ADR-027 다음)에 `ADR-028`을 추가하라. 기존 ADR 형식(한글, `### ADR-NNN: 제목
(2026-07-02)` 헤더, **맥락 / 결정 / 이유 / 트레이드오프 / 비고**)을 따른다.

담을 내용:

- **맥락**: 위 배경 — 프로젝트가 존재/삭제뿐, 중간 상태(치워두기·포커스 숨김)가 없음.
- **결정**:
  - `projects`에 **nullable timestamptz 2개** 추가 (shelf `tasks.shelvedAt`(ADR-026) 패턴 미러):
    - `deactivatedAt` — null=활성. 값=비활성 → **Shelf 컬럼에 표시**, top legend·task 프로젝트 지정
      픽커에서 제외. task 무영향(projectId·색·통계 그대로).
    - `hiddenAt` — null=표시. 값=숨김 → 그 프로젝트에 속한 task의 plan/action/ghost 블록을 **캘린더 렌더에서
      필터**. legend 칩엔 남고 eye-slash 상태로 표시.
  - "상태는 derive"가 이 프로젝트 원칙(ADR-016)이지만, **"내가 비활성/숨김으로 뒀다"는 의도라 derive 불가** →
    shelf와 같은 저장 예외(ADR-026과 동일 논리).
  - 프로젝트 칩 아이콘 **3개**: activate(활성/비활성) · eye(표시/숨김) · trash(삭제, 기존 하드삭제 유지).
  - **binary만** 둔다(completed/paused 세분화 안 함) — 이 앱에선 동작 차이가 없어 차원만 는다(YAGNI, ADR-001).
- **이유**: 기존 shelf 인프라·derive 로직을 재사용하고 데이터 모델을 최소로 건드린다. visibility는 본래
  "화면 해석"(ADR-025)이지만, 멀티 디바이스 일관성을 위해 **DB에 저장**한다(localStorage 아님).
- **트레이드오프**: "상태 derive" 순수성에 저장 플래그 2개 예외가 는다. visibility를 DB에 둬서 뷰 상태가
  데이터에 섞인다(대신 기기 간 일관).
- **비고**: 손대는 곳 — `db/schema.ts`(+마이그레이션), 신규 `core/project.ts`, `ProjectLegend.tsx`,
  `CalendarGrid.tsx`/`CalendarBlock.tsx`, `ShelfColumn.tsx`, i18n. **localStorage → DB 이전(rail/undo/guide-seen)은
  본 ADR 범위 밖 — 별도 phase 15**. phase `14-project-states`(step 0~5).

## 금지사항

- 코드 파일을 수정하지 마라. 이유: 이 step은 설계 기록만 담당한다.
- localStorage 이전(rail/undo/guide-seen)을 여기서 다루지 마라. 이유: 성격이 다른 별도 작업(phase 15)이다.
- 기존 ADR 항목(001~027)을 바꾸지 마라. 이유: ADR은 append-only다.

## Acceptance Criteria

```bash
grep -q "ADR-028" docs/ADR.md
```

```bash
npm run build
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트: ADR 형식 준수? 두 상태(deactivatedAt/hiddenAt)와 "task 영향은 visibility만"이 명확?
   binary 결정·shelf 미러 근거 포함?
3. `phases/14-project-states/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ADR-028 — projects.deactivatedAt(→shelf)·hiddenAt(캘린더 필터) 두 상태, shelf 패턴 미러, DB 저장. localStorage 이전은 phase15로 분리"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
