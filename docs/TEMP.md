# TEMP — 다음 세션 이어서 (배포 작업)

> 임시 핸드오프 노트. 배포 작업 끝나면 이 파일은 지운다.
> 정식 결정·계획은 `docs/ADR.md`(ADR-021·022)와 `docs/LAUNCH-PLAN.md`에 있다. 여기는 "어디까지 했고
> 다음에 뭘 하나" 요약만. 작성일 2026-06-23.

## 지금까지 (이번 세션)
로컬 → Railway 프로덕션 배포 + 수익화/공개 전략을 **결정만** 끝냈다. 코드 변경은 아직 0.

**핵심 결정** (자세히는 ADR-021·022):
- Repo는 **private 유지** (클론 방어).
- 앱 주소 = **`dearmyroutines.hyeyoungjo.com`** (Railway 커스텀 도메인, CNAME).
- 수익화 지금 안 함. **Ko-fi ☕ 후원만** (PayPal **Business**로 연결). 구독은 데이터 쌓인 뒤.
- AI: 공개 기본 **BYO 키**, 테스터(allowlist)는 **매니지드(내 키)**, AI 없이도 동작. `ai_usage` 메터링.
- 타임라인: **Dogfooding 1개월**(~2026-07-23) → **비공개 베타 3개월**(~2026-10-23) → 공개.

**확인된 현재 코드 상태**:
- Supabase는 **이미 클라우드**(`.env`의 `*.supabase.co`). 이전 작업 불필요.
- AI는 **미배선**(stub 503), **Gemini 전용**, 서버 키 `GEMINI_API_KEY` 하나. BYO·메터링·rate limit 없음.
- 로그인 = **Google OAuth** + 이메일/비번. 콜백 URL 동적(하드코딩 localhost 없음) → 배포 친화적.
- `allowed_emails` 게이팅 완성(DB 테이블 + 미들웨어). 설정 UI(⚙ `components/ThemeMenu.tsx`) 존재.

## 다음에 할 일 (Dogfooding 단계 — 추천 순서 A)
**(A) Railway 배포부터.** AI는 stub인 채로 먼저 띄워서 로그인까지 도는 걸 확인 → 그 위에 AI 배선.

`docs/LAUNCH-PLAN.md` §4 배포 체크리스트대로:
1. Railway에 GitHub repo 연결(private 권한).
2. env 변수 등록: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DB_PASSWORD`,
   `GEMINI_API_KEY`, `GEMINI_MODEL`, `NODE_ENV=production`.
3. 빌드 확인(⚠️ `next build --turbopack`가 Railway에서 도는지 첫 회 점검).
4. (권장) Node 버전 핀(`.nvmrc`/`engines`).
5. 커스텀 도메인 `dearmyroutines.hyeyoungjo.com` 추가 → DNS CNAME 등록.
6. Supabase Auth: Site URL + Redirect URL에 새 도메인 등록.
7. Google OAuth 리디렉션/원본 점검.
8. 스모크 테스트(로그인 → allowed_emails 게이트 → 드래그 → AI 버튼).

그 다음 **AI 배선**: `npm install ai @ai-sdk/google` → `services/ai/*`·analyze route stub을 ADR-020 설계대로 구현.

## 다음 세션에 준비해두면 좋은 것
- Railway에 이 repo 이미 연결돼 있나? (계정은 있다고 함)
- `hyeyoungjo.com` DNS 관리 콘솔 접근(CNAME 추가용).
- Google Cloud Console OAuth 클라이언트 접근.
- Ko-fi 가입 + PayPal Business 연결(진행 중이었음).
