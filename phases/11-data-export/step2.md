# Step 2: export-api

날짜 범위를 받아 CSV 파일을 반환하는 API 라우트를 만든다.

## 읽어야 할 파일

- `/src/app/api/tasks/route.ts` — 인증 패턴(`getAuthenticatedUser`) 및 DB 쿼리 패턴
- `/src/app/api/daily-reviews/route.ts` — DailyReview 조회 패턴
- `/src/db/schema.ts` — tasks, projects, planBlocks, actionBlocks, dailyReviews 테이블
- `/src/core/export/index.ts` — step 1에서 만든 `buildExportRows`, `ExportRow` (이 파일을 읽고 시그니처 파악 후 사용)
- `/docs/ARCHITECTURE.md` — Route Handler 패턴

## 작업

### `src/app/api/export/route.ts` 생성

**엔드포인트:** `GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD`

흐름:
1. 인증 확인 — 기존 `getAuthenticatedUser()` 패턴 사용. 미인증 → 401.
2. `from`, `to` 쿼리 파라미터 파싱 및 유효성 검사:
   - 둘 다 필수. 없으면 400 반환.
   - `YYYY-MM-DD` 형식 검사. 파싱 실패 시 400 반환.
   - `from` > `to`이면 400 반환.
   - 범위는 최대 365일. 초과 시 400 반환.
3. DB 쿼리 (모두 `user_id = user.id` 조건):
   - `tasks` + `projects` JOIN (LEFT JOIN, project 없는 task 포함)
   - `plan_blocks` WHERE `date >= from AND date <= to`
   - `action_blocks` WHERE `date >= from AND date <= to`
   - `daily_reviews` WHERE `date >= from AND date <= to`
   - `allTaskPlanBlocks`: 해당 유저의 전체 plan_blocks (날짜 제한 없음 — `times_carried_over` 계산용)
4. `buildExportRows(input)` 호출
5. `ExportRow[]` → CSV 문자열 변환:
   - 첫 행: 헤더 (`date,task_name,project_name,...`)
   - 이후 행: 각 ExportRow. 값에 쉼표/따옴표 포함 시 `"..."` 로 escape
   - null 값은 빈 문자열로
6. 응답:
   ```
   Content-Type: text/csv; charset=utf-8
   Content-Disposition: attachment; filename="dear-my-routines-{from}-{to}.csv"
   ```

**CSV 컬럼 순서 (ExportRow 필드 순서와 동일):**
```
date, task_name, project_name, task_category, completion_status,
planned_start_time, planned_end_time, planned_duration_min,
actual_start_time, actual_end_time, actual_duration_min,
duration_overrun_min, times_carried_over, daily_journal
```

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - `from` > `to` 시 400을 반환하는가?
   - 365일 초과 시 400을 반환하는가?
   - 응답 `Content-Type`이 `text/csv; charset=utf-8`인가?
   - `Content-Disposition`에 파일명이 포함되는가?
   - 쉼표/따옴표가 포함된 journal 텍스트가 올바르게 escape되는가?
   - 미인증 요청 시 401을 반환하는가?
3. `phases/11-data-export/index.json` step 2 업데이트.

## 금지사항

- `buildExportRows` 로직을 이 라우트 안에서 재구현하지 마라. 이유: core 함수를 import해서 써야 한다.
- CSV escape 없이 값을 그냥 join하지 마라. 이유: journal 텍스트에 쉼표가 있으면 CSV가 깨진다.
- 기존 테스트를 깨뜨리지 마라.
