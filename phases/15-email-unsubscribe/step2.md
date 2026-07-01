# Step 2: token-lib

## 읽어야 할 파일

- `/docs/ADR.md` (**ADR-029** — HMAC 서명 토큰)
- `/docs/ARCHITECTURE.md` (외부/유틸: `lib/`. 이건 node `crypto`+env secret을 쓰는 **서버 전용** 유틸)
- `src/lib/` 기존 유틸 스타일 (예: `projectColor.ts`)
- `.env.example` (여기에 `UNSUBSCRIBE_SECRET` 추가)

## 작업

### 1. `src/lib/unsubscribe.ts` — HMAC 토큰

node `crypto`로 서명 토큰을 만든다. **서버 전용**(클라이언트 번들에 들어가면 안 됨 — secret 사용).

```ts
import { createHmac, timingSafeEqual } from "crypto";

/** HMAC-SHA256(email, UNSUBSCRIBE_SECRET) as hex. Secret read at call time. */
export function unsubscribeToken(email: string): string;

/** Constant-time verify of a token for an email. */
export function verifyUnsubscribeToken(email: string, token: string): boolean;

/** Full unsubscribe URL: `${baseUrl}/api/unsubscribe?e=<enc>&t=<token>`. */
export function unsubscribeUrl(email: string, baseUrl: string): string;
```

규칙:
- **secret은 호출 시점에 `process.env.UNSUBSCRIBE_SECRET`로 읽어라**(모듈 로드 시 캐시하지 마라) — 테스트가
  env를 설정할 수 있어야 하고, secret 미설정 시 명확히 처리한다.
- 이메일은 **정규화**(trim + lowercase) 후 서명·검증한다(대소문자 불일치로 검증 실패 방지).
- `verifyUnsubscribeToken`은 `timingSafeEqual`로 상수시간 비교(길이 다르면 즉시 false).
- `unsubscribeUrl`은 email을 `encodeURIComponent`.

### 2. `.env.example` — 키 추가

`UNSUBSCRIBE_SECRET=` 항목과 짧은 주석을 추가한다(운영 env에도 설정해야 함을 명시).

### 3. 테스트 — `src/lib/unsubscribe.test.ts`

- 테스트 앞에서 `process.env.UNSUBSCRIBE_SECRET`를 고정값으로 설정.
- 토큰이 **결정적**(같은 이메일 → 같은 토큰).
- 올바른 토큰 → `verify` true; 변조 토큰/다른 이메일 → false.
- 대소문자·공백 차이가 있어도 정규화로 검증 통과(`" A@B.com "` ↔ `a@b.com`).

## 금지사항

- secret을 모듈 로드 시 상수로 캐시하지 마라. 이유: 테스트가 env를 주입 못 하고, 런타임 유연성도 잃는다.
- 이 파일을 클라이언트 컴포넌트에서 import하지 마라. 이유: secret이 번들에 노출된다(서버 전용).
- 토큰 비교에 `===`를 쓰지 마라. 이유: 타이밍 공격 — `timingSafeEqual`을 써라.
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm test
```

```bash
npm run build
```

## 검증 절차

1. test·build 통과.
2. 체크리스트: secret 호출시점 읽기? 이메일 정규화? 상수시간 비교? `.env.example`에 키 추가? 서버 전용?
3. `phases/15-email-unsubscribe/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/unsubscribe.ts HMAC 토큰(gen/verify/url, 정규화, 상수시간) + 테스트 + .env.example UNSUBSCRIBE_SECRET"`
   - 실패 → `"status": "error"`, `"error_message": "..."`
