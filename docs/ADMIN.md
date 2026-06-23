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
