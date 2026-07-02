# 운영(Admin) 가이드

> 접근 제어 설계 근거는 ADR-003(매직링크 + 화이트리스트), 로그인 방식은 ADR-011 참조.
> 테이블 정의는 `src/db/schema.ts`의 `allowedEmails`, 검사 로직은
> `src/services/supabase/middleware.ts` 참조.

## 접근 제어 개요 (allowed_emails 화이트리스트)

이 앱은 공개 URL이지만 **승인된 이메일만** 사용할 수 있다. 미들웨어가 모든 요청에서
로그인 사용자의 이메일이 `allowed_emails` 테이블에 있는지 확인하고, 없으면
`/unauthorized`로 보낸다.

- RLS상 **사용자는 자기 행을 추가/수정/삭제할 수 없다** (SELECT로 자기 이메일 존재
  여부만 확인 가능). 따라서 추가·삭제는 **관리자가 직접** 해야 한다.
- 테이블 컬럼: `email`(필수, unique), `note`(선택, 메모용), `id`·`created_on`은 자동.
  → 넣을 때 **`email`만** 있으면 된다.

추가/삭제는 **Supabase 대시보드 → SQL Editor**에서 아래 쿼리로 실행한다.

## 이메일 추가

```sql
insert into allowed_emails (email, note)
values
  ('me@gmail.com', 'owner'),
  ('friend@example.com', 'beta tester')
on conflict (email) do nothing;
```

- `on conflict (email) do nothing` — `email`에 unique 인덱스
  (`allowed_emails_email_uq`)가 걸려 있어, 이미 있는 주소를 다시 넣으면 에러가 난다.
  이 절을 붙이면 **이미 있으면 조용히 넘어간다**.
- `note`는 생략 가능: `insert into allowed_emails (email) values ('x@y.com');`

## 이메일 삭제 (접근 회수)

```sql
delete from allowed_emails
where email = 'friend@example.com';
```

> 삭제해도 이미 발급된 세션은 만료 전까지 살아 있을 수 있다. 즉시 차단이 필요하면
> Supabase 대시보드 → Authentication → Users에서 해당 사용자를 삭제하거나 세션을
> 무효화한다.

## 현재 목록 확인

```sql
select email, note, created_on
from allowed_emails
order by created_on desc;
```

## 주의: 이메일은 로그인 주소와 정확히 일치해야 한다

화이트리스트의 `email`은 로그인 사용자의 `auth.email()`과 **그대로 비교**된다. 둘이
어긋나면 로그인은 되지만 `/unauthorized`로 튕긴다. 흔한 원인:

- **로그인 수단별 실제 주소가 다름** — Google 로그인은 그 구글 계정의 gmail 주소,
  이메일/비밀번호 가입은 가입 시 입력한 주소.
- **대소문자·오타** — 저장된 값과 다르면 불일치로 처리된다. 소문자로 통일해 넣는 것을
  권장한다.

---

# 단체 공지 이메일 (announcement)

> 스크립트 `scripts/send-announcement.mjs`, 수신거부 설계는 ADR-029, 발신 인프라는
> Resend(도메인 `hyeyoungjo.com`, DKIM/SPF/DMARC 설정 완료).

전체 가입자에게 업데이트 공지를 보낸다. **수신자는 DB에서 자동 조회**하므로 이메일 주소를
repo에 넣지 않는다:

- 대상 = `auth.users` 중 **이메일 인증 완료(email_confirmed_at)** 한 전원.
- 각자 **자기 언어**(`user_settings.language`, 없으면 `en`)로 발송.
- **제외**: `email_unsubscribes`(수신거부자) + `ADMIN_EMAIL`(env, 본인) + 캠페인의 `exclude` 배열.
- 각 메일에 **서명된 원클릭 수신거부 링크 + List-Unsubscribe 헤더** 자동 포함. 수신자가 누르면
  `/api/unsubscribe`가 `email_unsubscribes`에 기록하고, 다음 발송부터 자동 제외된다.

## 사전 준비 (env)

`.env`에 다음이 있어야 한다: `NEXT_PUBLIC_SUPABASE_URL`, `DB_PASSWORD`, `RESEND_API_KEY`,
`UNSUBSCRIBE_SECRET`(운영 Railway와 **같은 값**), `ADMIN_EMAIL`(선택, 본인 주소 제외용).

> `UNSUBSCRIBE_SECRET`은 링크 서명·검증에 쓰이므로 **스크립트를 돌리는 곳과 배포 서버(Railway)의
> 값이 반드시 일치**해야 한다. 다르면 수신거부 링크가 무효 처리된다.

## 1) 캠페인 파일 작성

`campaigns/` 아래에 JSON 파일을 만든다(`campaigns/example.json` 복사해서 시작). 구조:

```
{
  "from":    "Dear My Routines <noreply@hyeyoungjo.com>",   // 선택(기본값 있음)
  "replyTo": "jhy.vfx@gmail.com",                            // 선택 — 답장 받을 주소
  "baseUrl": "https://dearmyroutines.hyeyoungjo.com",       // 선택
  "exclude": [],                                             // 선택 — 추가로 뺄 이메일
  "langs": {
    "en": { "subject": "...", "html": "...{{unsubscribe_url}}...", "text": "...{{unsubscribe_url}}..." },
    "ko": { "subject": "...", "html": "...", "text": "..." }
  }
}
```

- `langs.en`은 **필수**(다른 언어가 없을 때의 fallback). `ko` 등은 선택.
- `html`/`text`에 **`{{unsubscribe_url}}`** 를 한 번 넣으면 수신자별 서명 링크로 치환된다. 빼먹으면
  본문 안 링크는 없지만 헤더 수신거부(Gmail 버튼)는 여전히 동작한다.

## 2) 미리보기(dry-run) → 발송

macOS/Linux는 `node`, Windows도 `node`. 반드시 **dry-run으로 대상·인원 먼저 확인**한 뒤 보낸다.

```
node --env-file=.env scripts/send-announcement.mjs campaigns/example.json
```

- 대상 인원·언어 분포·제외 수를 출력하고 **아무것도 보내지 않는다**.

이상 없으면 `SEND=1`로 실제 발송:

```
SEND=1 node --env-file=.env scripts/send-announcement.mjs campaigns/example.json
```

- Resend `batch.send`로 100통씩 나눠 발송하고, 발송 수를 출력한다. **즉시 발송, 되돌릴 수 없다.**

## 참고

- 배달·열람 상태는 **Resend 대시보드**에서 확인.
- 인증 메일(매직링크·비번 재설정)은 이 스크립트와 무관 — Supabase Auth가 같은 Resend SMTP로 보낸다.
- 수신거부 현황: `select email, created_at from email_unsubscribes order by created_at desc;`
