# Step 3: export-ui

기어 메뉴 안에 "Export data" 버튼을 추가하고, 클릭하면 날짜 범위 선택 후 CSV를 다운로드한다.

## 읽어야 할 파일

- `/src/components/ThemeMenu.tsx` — 기어 메뉴 구현. **이 파일에 Export 항목을 추가한다.**
- `/src/hooks/userSettings.ts` — `useUserSettings` 패턴 참고 (hooks 패턴)
- `/docs/ARCHITECTURE.md` — Client Component 기준
- `/src/app/api/export/route.ts` — step 2에서 만든 엔드포인트 시그니처 확인

## 작업

### 1. `src/hooks/useExport.ts` 생성

날짜 범위를 받아 `/api/export`를 호출하고 파일 다운로드를 트리거하는 hook.

```ts
export function useExport(): {
  download: (from: string, to: string) => Promise<void>;
  isPending: boolean;
  error: string | null;
};
```

구현 요점:
- `fetch("/api/export?from={from}&to={to}")` 호출
- 응답을 `blob()`으로 받아 `URL.createObjectURL` + `<a>` 태그로 다운로드 트리거
- 완료 후 object URL revoke
- `isPending`, `error` 상태 관리

### 2. `src/components/ExportModal.tsx` 생성

날짜 범위를 입력받는 모달 컴포넌트.

```tsx
type Props = {
  open: boolean;
  onClose: () => void;
};
export function ExportModal({ open, onClose }: Props): JSX.Element | null;
```

UI 요구사항:
- `open`이 false이면 null 반환
- `from` / `to` 날짜 입력 (`<input type="date">` 사용 — 라이브러리 추가 없이)
- 기본값: `from` = 30일 전, `to` = 오늘 (`dayKey()` 유틸 사용)
- "Export CSV" 버튼: `useExport().download(from, to)` 호출
- `isPending` 동안 버튼 disabled + "Exporting…" 텍스트
- 에러 시 에러 문구 표시
- 다운로드 성공 시 모달 닫기 (`onClose()`)
- 취소 버튼 또는 배경 클릭으로 닫기

### 3. `src/components/ThemeMenu.tsx` 수정

기어 메뉴 하단에 divider + "Export data" 항목 추가.

```tsx
// 메뉴 하단 (기존 항목들 아래)
<>
  <div className="my-1 border-t border-grid" />
  <button onClick={() => setExportOpen(true)} className="...">
    Export data
  </button>
  <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
</>
```

- `exportOpen` state는 `ThemeMenu` 안에 `useState(false)`로 관리

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 커맨드 통과 확인.
2. 체크리스트:
   - 기어 메뉴 하단에 "Export data" 버튼이 보이는가?
   - 클릭 시 날짜 범위 입력 모달이 열리는가?
   - 기본값이 30일 전 ~ 오늘으로 채워져 있는가?
   - "Export CSV" 클릭 시 CSV 파일 다운로드가 시작되는가?
   - `isPending` 동안 버튼이 disabled되는가?
   - 다운로드 완료 후 모달이 닫히는가?
3. `phases/11-data-export/index.json` step 3 업데이트.

## 금지사항

- 날짜 picker 라이브러리를 추가 설치하지 마라. 이유: `<input type="date">`로 충분하다.
- 다운로드 후 object URL을 revoke하지 않으면 메모리 누수가 생긴다. 반드시 revoke하라.
- 기존 테스트를 깨뜨리지 마라.
