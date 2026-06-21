# Step 0: project-setup

## 읽어야 할 파일
먼저 아래를 읽고 프로젝트 규칙·구조·기술 스택·결정 근거를 파악하라:
- `/CLAUDE.md` (프로젝트 규칙 — 특히 CRITICAL 항목)
- `/docs/ARCHITECTURE.md` (디렉토리 구조)
- `/docs/ADR.md` (ADR-007 부드러운 UX, ADR-010 기술 스택)
- `/.env.example`, `/.gitignore`

## 목표
이 프로젝트의 기반이 되는 **"돌아가는 빈 Next.js 앱"** 을 만든다. 인증·DB·실제 기능은
다음 step에서 한다. 이 step은 토대만 깐다.

## 작업

### 1. Next.js 15 (App Router) + TypeScript(strict) + Tailwind 초기화
- 현재 디렉토리(프로젝트 루트)에 Next.js 앱을 셋업한다. 설정: App Router, TypeScript,
  Tailwind CSS, ESLint, `src/` 디렉토리, import alias `@/*`, npm.
- **주의: 현재 디렉토리는 비어있지 않다** (`CLAUDE.md`, `docs/`, `scripts/`, `phases/`,
  `transcript/`, `.claude/`, `.env`, `.env.example`, `.gitignore`가 이미 있다).
  `create-next-app`은 비어있지 않은 디렉토리를 거부할 수 있다. 거부되면: 임시 디렉토리에
  생성한 뒤, 생성된 파일(`package.json`, `tsconfig.json`, `next.config.*`,
  `postcss.config.*`, `tailwind.config.*`, `eslint.config.*` 또는 `.eslintrc*`,
  `src/app/`, `public/`, `next-env.d.ts` 등)만 루트로 복사하라.
- **기존 파일을 덮어쓰지 마라** (아래 금지사항 참조). 특히 `.gitignore`는 이미 우리가
  작성한 것을 유지하고, Next가 만든 항목 중 빠진 게 있으면 *추가*만 하라.

### 2. 디렉토리 구조 생성 (ARCHITECTURE.md대로)
`src/` 아래에 다음 폴더를 만든다 (빈 폴더는 `.gitkeep` 파일로 git에 남긴다):
- `src/components/`, `src/core/time/`, `src/core/tree/`, `src/core/stats/`,
  `src/services/supabase/`, `src/services/ai/`, `src/db/`, `src/types/`, `src/lib/`
- `src/app/`은 create-next-app이 만든다.

### 3. TypeScript strict 확인
`tsconfig.json`에 `"strict": true`가 켜져 있어야 한다.

### 4. 테스트 도구 (Vitest) 설치 + 설정
- `vitest`를 devDependency로 설치한다.
- `package.json`의 `scripts`에 다음이 있어야 한다 (없으면 추가):
  - `"dev"`, `"build"`, `"lint"`는 create-next-app 기본값 유지/사용.
  - `"test": "vitest run --passWithNoTests"` (테스트 파일이 아직 없어도 통과하도록).
- `vitest.config.ts`를 만들어 `@/*` alias가 테스트에서도 동작하게 한다.

### 5. 안전훅 settings.json 생성
`.claude/settings.json`을 만든다 (기존 `.claude/settings.local.json`은 건드리지 마라):
```json
{
  "hooks": {
    "Stop": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1" }
      ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -qE 'rm\\s+-rf|git\\s+push\\s+--force|git\\s+reset\\s+--hard|DROP\\s+TABLE'; then echo 'BLOCKED: dangerous command' >&2; exit 1; fi" }
      ] }
    ]
  }
}
```

### 6. 플레이스홀더 페이지
`src/app/page.tsx`를 간단한 "Dear My Routines" 플레이스홀더로 둔다 (제목 한 줄 + 한 문장
설명 정도). Tailwind 클래스로 최소한의 스타일만. 실제 기능 UI는 만들지 마라.

## Acceptance Criteria
아래를 한 줄에 하나씩 실행한다 (모두 에러 없이 통과해야 한다):
```
npm install
npm run lint
npm run build
npm run test
```

## 검증 절차
1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 `src/` 디렉토리 구조가 존재하는가? (core/, services/, db/, types/, lib/, components/)
   - `tsconfig.json`의 `strict`가 true인가?
   - `.claude/settings.json` 안전훅이 존재하는가?
   - `.env`가 여전히 `.gitignore`로 보호되는가? (`git check-ignore .env`)
3. 결과에 따라 `phases/0-foundation/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성된 핵심 파일·구조 한 줄 요약"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "사유"` 후 중단

## 금지사항
- 다음 기존 파일/폴더를 덮어쓰거나 삭제하지 마라. 이유: 제품 정의·방법론 자산이다.
  `CLAUDE.md`, `docs/`, `scripts/`, `phases/`, `transcript/`, `.claude/commands/`,
  `.claude/settings.local.json`, `.env`, `.env.example`, 그리고 우리가 작성한 `.gitignore`.
- 인증·DB·트리·블록·AI 등 실제 기능을 만들지 마라. 이유: 다음 step들의 범위다.
- 비밀키를 코드나 커밋에 하드코딩하지 마라. 이유: 보안(CLAUDE.md CRITICAL).
- 기존 테스트를 깨뜨리지 마라.
