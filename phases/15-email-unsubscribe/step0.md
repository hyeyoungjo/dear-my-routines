# Step 0: docs-adr

## 읽어야 할 파일

- `/docs/ADR.md` (마지막 항목 ADR-028 다음에 이어서 쓴다)
- `/docs/DATA-STRUCTURE.md` (테이블 규칙 — user_id + RLS 공통 규칙, 그리고 그 예외를 여기 기록)

이 step은 **문서만** 작성한다. 코드는 건드리지 않는다.

## 배경

공지/업데이트 이메일(Resend 발신, `noreply@hyeyoungjo.com`) 수신자가 **원클릭으로 수신거부**하면 그 사실을
DB에 자동 기록하고, 이후 발송에서 제외해야 한다. 지금은 "답장으로 수신거부"라 수동이다. Gmail/Yahoo의
`List-Unsubscribe` 관행과도 맞춰야 한다.

## 작업

`/docs/ADR.md` 맨 끝(ADR-028 다음)에 `ADR-029`를 기존 형식(한글, **맥락/결정/이유/트레이드오프/비고**)으로 추가하라.

담을 내용:

- **맥락**: 위 배경.
- **결정**:
  - **`email_unsubscribes(email PK, created_at)` 테이블** 신설 — **이메일 기준**(user_id 아님)이라 유저/비유저
    무관하게 범용. 클릭한 사람이 로그인 상태가 아닐 수 있어 user 기반으로 못 묶는다.
  - **RLS 공통 규칙(모든 테이블 user_id + owner 정책)의 예외**: 이 테이블은 user_id가 없다. **RLS는 켜되
    정책을 두지 않아** 클라이언트 접근을 전부 차단하고, **서버(Drizzle `db`, 서버 라우트)만** 읽고 쓴다.
  - **서명 토큰(HMAC)**: 수신거부 URL은 `?e=<email>&t=<HMAC-SHA256(email, UNSUBSCRIBE_SECRET)>`. 엔드포인트가
    토큰을 재계산·상수시간 비교해 검증 → **아무나 남을 수신거부 못 함**. DB에 토큰을 저장하지 않는다.
  - **엔드포인트 `/api/unsubscribe`**: `GET`(사용자 클릭 → 검증 → upsert → 확인 HTML) + `POST`(RFC 8058
    one-click, `List-Unsubscribe-Post`) 둘 다 지원.
  - **이메일**: 푸터에 unsubscribe 링크 + `List-Unsubscribe` / `List-Unsubscribe-Post` 헤더. 발송 시
    `email_unsubscribes`를 조회해 제외.
  - 새 env: **`UNSUBSCRIBE_SECRET`** (서버 전용). 운영 env(Railway)에 설정 필요.
- **이유**: 원클릭 수신거부는 이메일 관행/규정에 부합하고, HMAC이라 상태 저장 없이 위조 방지. 이메일 기준
  테이블이라 비유저에게도 확장된다.
- **트레이드오프**: user_id + RLS-owner 공통 규칙에 "RLS만 켜고 정책 없음" 예외가 하나 생긴다.
- **비고**: 손대는 곳 — `db/schema.ts`(+마이그레이션), 신규 `lib/unsubscribe.ts`, `app/api/unsubscribe/route.ts`,
  `.env.example`. 발송 스크립트(리포지토리 밖 one-off)는 이 phase 범위 밖. **엔드포인트는 배포되어 있어야 링크가
  동작**한다(발송 전 배포 + `UNSUBSCRIBE_SECRET` 설정 + 마이그레이션 적용 필요). phase `15-email-unsubscribe`(step 0~3).

## 금지사항

- 코드 파일을 수정하지 마라. 이유: 설계 기록만 담당.
- 기존 ADR(001~028)을 바꾸지 마라. 이유: append-only.

## Acceptance Criteria

```bash
grep -q "ADR-029" docs/ADR.md
```

```bash
npm run build
```

## 검증 절차

1. 위 AC 실행.
2. 체크리스트: RLS 예외(정책 없음)·HMAC 토큰·GET/POST·List-Unsubscribe·UNSUBSCRIBE_SECRET이 명확한가?
3. `phases/15-email-unsubscribe/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ADR-029 — email_unsubscribes(email PK) 테이블, RLS 켜고 정책없음(서버만), HMAC 서명링크, /api/unsubscribe GET+POST, List-Unsubscribe, UNSUBSCRIBE_SECRET"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
