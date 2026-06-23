# 출시 계획 (Launch Plan)

> Dear My Routines를 로컬에서 Railway 프로덕션으로 올리고, 단계적으로 공개하는 계획.
> 전략적 *결정*의 근거는 ADR-021·ADR-022 참조. 이 문서는 *타임라인·배포 절차·홍보*를 담는다.
> 작성일 2026-06-23.

## 1. 결정 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| Repo 공개 | **Private 유지** (클론 방어) | ADR-021 |
| 앱 주소 | **dearmyroutines.hyeyoungjo.com** (Railway 커스텀 도메인) | ADR-021 |
| 호스팅 | Railway(앱) + Supabase 클라우드(이미 사용 중) | ADR-002 |
| 수익화 | 지금은 안 함. ☕ Ko-fi 후원만. 구독은 데이터 쌓인 뒤 | ADR-022 |
| AI 키 | 공개 기본 = **BYO 키**, 테스터 = 매니지드(내 키), AI 없이도 동작 | ADR-022 |
| 메터링 | `ai_usage` 테이블로 BYO·매니지드 토큰 전부 기록 | ADR-022 |
| 후원 | Ko-fi (PayPal **Business** 또는 Stripe 연결) | ADR-022 |

## 2. 타임라인

| 단계 | 기간 | 날짜 | 목표 |
|---|---|---|---|
| **Dogfooding** | 1개월 | 2026-06-23 → 2026-07-23 | 제작자 1인 매일 사용. 큰 버그·구멍 잡기. AI 리뷰 가치 검증 |
| **비공개 베타** | 3개월 | 2026-07-23 → 2026-10-23 | allowlist 10~30명. 7일 재방문 검증. 메터링 데이터 수집 |
| **공개 출시** | — | 2026-10 말 목표 | BYO 기본으로 개방. disquiet/PH/HN 등으로 알림 |

> **승급 게이트**: 각 단계는 *재방문(7일차 복귀)* 이 확인돼야 다음으로 넘어간다. 숫자(가입자 수)가
> 아니라 retention이 신호다. Product Hunt·Hacker News 같은 "한 방" 채널은 공개 단계 전까지 아낀다.

## 3. 단계별 할 일

### 3-A. Dogfooding (지금) — *배포부터, 단순하게*
AI는 현재 stub(503)이고 사용자는 너 혼자라, BYO·메터링·kill switch는 **불필요**. 최소로 띄운다.

- [ ] **AI 배선**: `npm install ai @ai-sdk/google` 후 `services/ai/provider.ts`·`index.ts`,
      `app/api/daily-reviews/analyze/route.ts` stub을 실제 구현으로(ADR-020 설계대로). 내 `GEMINI_API_KEY` 사용.
- [ ] **Railway 배포** (§4 체크리스트).
- [ ] **커스텀 도메인 연결** (§4).
- [ ] 매일 직접 사용하며 데일리 AI 리뷰가 실제로 쓸 만한지 평가. 자신의 *예상 vs 실제* 데이터 축적.
- [ ] 발견한 버그·UX 거슬림 정리.

### 3-B. 비공개 베타 — *공개 전 안전장치 구축*
테스터(allowlist)가 내 키를 쓰므로, 여기서 메터링·상한을 붙인다.

- [ ] **`ai_usage` 테이블** + 마이그레이션(`drizzle/`). user_id+RLS, `key_source` 컬럼 포함(ADR-022).
- [ ] **AI 라우트에 사용량 로깅** 추가 — Vercel AI SDK `usage`(prompt/completion tokens)를 매 호출 기록.
- [ ] **토큰→비용 환산** 순수 함수를 `core/ai`에 + Gemini 단가 테이블.
- [ ] **비용 상한**: Google Cloud에서 Gemini 키에 예산/할당량 하드캡. 매니지드 per-user 예산 체크.
- [ ] **BYO 키 입력 필드**를 설정(⚙ `components/ThemeMenu.tsx` "AI Model" 섹션 근처)에 추가.
      암호화 저장(`user_settings`), 서버에서만 복호화. (테스터는 비워두면 매니지드 키로 폴백.)
- [ ] **키 소스 분기**: allowlist 테스터 → 매니지드 키, BYO 입력 있으면 그 키, 둘 다 없으면 AI 비활성.
- [ ] **Ko-fi ☕ 링크**를 푸터/설정에 추가.
- [ ] **베타 신청 퍼널**: hyeyoungjo.com에 간단한 신청 폼 → 이메일을 Supabase `allowed_emails`에 추가
      (`docs/ADMIN.md`의 INSERT 쿼리).
- [ ] 테스터 10~30명 모집(§5). 7일 재방문 + 피드백 + `ai_usage` "1인당 월 평균 비용" 실측.

### 3-C. 공개 출시 — *BYO 기본으로 개방*
- [ ] `allowed_emails` 게이트 해제(또는 가입 자동 승인). 기본 AI = BYO 키.
- [ ] (필요시) 글로벌 kill switch — 공개는 BYO라 비용 ≈ 0이라 없어도 될 가능성.
- [ ] hyeyoungjo.com 허브에 제품 카드 추가, "왜 우리는 시간을 과소예측하는가" 글 발행(§5).
- [ ] disquiet / Show HN / Product Hunt / 관련 subreddit에 알림.

## 4. 배포 체크리스트 (Railway)

현재 코드 상태(2026-06-23 확인): Supabase는 **이미 클라우드**, 하드코딩된 localhost **없음**,
콜백 URL은 동적(`request.origin`). Railway 설정 파일 불필요(`package.json` scripts를 읽음).

1. [ ] **Railway에서 GitHub repo 연결** (private repo 접근 권한 부여).
2. [ ] **환경 변수 등록**(Railway 대시보드 → Variables). `.env`는 커밋하지 말고 값만 복사:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DB_PASSWORD`
   - `GEMINI_API_KEY` (서버 전용)
   - `GEMINI_MODEL`
   - `NODE_ENV=production`
3. [ ] **빌드 확인**: scripts는 `build: next build --turbopack`, `start: next start`.
      ⚠️ turbopack 프로덕션 빌드가 Railway에서 깨끗이 도는지 *처음 한 번* 확인(문제 시 `--turbopack` 제거).
4. [ ] (권장) **Node 버전 고정**: `.nvmrc` 또는 `package.json` `engines`로 핀.
5. [ ] **커스텀 도메인 연결**: Railway → Settings → Domains에서 `dearmyroutines.hyeyoungjo.com` 추가
      → 안내된 CNAME 타겟을 `hyeyoungjo.com` DNS(서브도메인 레코드)로 등록 → SSL 자동 발급 대기.
6. [ ] **Supabase Auth URL 등록**: 대시보드 → Authentication → URL Configuration:
   - Site URL = `https://dearmyroutines.hyeyoungjo.com`
   - Redirect URLs에 `https://dearmyroutines.hyeyoungjo.com/auth/callback` 추가(로컬 URL도 개발용으로 유지).
7. [ ] **Google OAuth 확인**: Google Cloud OAuth 클라이언트의 승인된 리디렉션 URI가 Supabase 콜백
      (`https://<project-ref>.supabase.co/auth/v1/callback`)을 가리키는지 확인(도메인 바뀌어도 보통 불변).
      승인된 JavaScript 원본에 새 도메인이 필요한지 점검.
8. [ ] **배포 후 스모크 테스트**: 새 도메인 접속 → Google 로그인 → allowed_emails 게이트 동작 →
      블록 드래그/리사이즈(낙관적 업데이트) → AI "Analyze today" 동작.

## 5. 홍보 계획

데일리 습관 앱 = **재방문 우선**. 솔로·비영리 단계엔 *입소문 + 콘텐츠*가 정답(유료광고 X).

- **베타 모집(따뜻하게)**: 지인·동료·연구자 네트워크 + 내가 이미 속한 커뮤니티. 낯선 대중이 아니라
  *솔직한 피드백 줄 사람* 위주. allowlist 신청 폼이 희소성도 만든다.
- **콘텐츠(비밀 무기)**: 앱이 아니라 *통찰*을 글로. "왜 우리는 시간을 과소예측하는가"(planning
  fallacy) + 내가 모은 예상 vs 실제 데이터 → hyeyoungjo.com 블로그. 맞는 사람이 검색·공유로 유입되는
  durable한 채널. 제작자의 강점(글쓰기) 활용, 비용 0.
- **공개 채널**: 한국 = [disquiet.io](https://disquiet.io), [GeekNews](https://news.hada.io), 커리어리.
  글로벌 = Product Hunt, Hacker News(Show HN), Reddit(r/productivity, r/getdisciplined), Indie Hackers.
  ⚠️ PH·HN은 재방문 검증 *후*에(한 번뿐인 카드).
- **build in public(선택)**: 진행상황·데이터 인사이트를 X/Threads/LinkedIn에 공유.
- 모든 유입은 라이브 URL(`dearmyroutines.hyeyoungjo.com`)로 — repo는 private이라 클론 방어와 충돌 없음.

## 6. 후속/미해결

- 구독 유료 티어(매니지드 AI) 설계 — 베타 `ai_usage` 데이터로 가격 산정 후.
- 글로벌 kill switch 필요 여부 — 공개 단계에서 BYO 외 매니지드 노출이 있을 때만.
- BYO 키 암호화 방식(KMS vs 앱 레벨 대칭키) 구체화 — 베타 작업 시 결정.
- Ko-fi에 PayPal Business와 Stripe 중 무엇을 주 페이아웃으로 둘지(BofA 직입금이면 Stripe 유리).
