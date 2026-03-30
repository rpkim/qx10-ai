# Google SSO + Google Drive 백업 설계 (Qx10 레포 기준)

비로그인 사용자는 **지금과 동일하게** `localStorage`만 사용한다. 로그인한 사용자만 설정에서 **Drive 백업을 연결**할 수 있다.

---

## 1. 원칙

| 항목 | 정책 |
|------|------|
| 기본 데이터 경로 | 브라우저 `localStorage` (변경 없음) |
| Google 로그인 | 선택. 계정 식별·크로스 기기·선택적 클라우드 동기화 |
| Drive | **별도 스코프·별도 “연결” 동의**. 로그인만 한 사용자는 Drive 접근 없음 |
| 단일 진실 소스 | 기본은 여전히 로컬; Drive는 **백업/복원·선택적 풀 동기화** 용도로 정의하는 것을 권장 |

---

## 2. OAuth 스코프 분리

### 2.1 “Google로 로그인”만 (최소)

- `openid`, `email`, `profile` (또는 OIDC 표준 세트)
- 용도: 사용자 ID, 세션, (선택) 서버에 사용자 레코드 생성

### 2.2 “Google Drive 백업 연결” (추가 동의)

권장 중 하나:

- **`https://www.googleapis.com/auth/drive.appdata`**  
  - 앱 전용 숨김 영역(`appDataFolder`). 사용자 Drive UI에 폴더가 안 보임. 백업·설정 파일에 적합.
- 또는 **`https://www.googleapis.com/auth/drive.file`**  
  - 사용자가 Picker로 고른 파일·앱이 만든 파일만 접근. “내 문서에 Qx10 폴더 보이게” UX에 유리.

**권장:** 백업 UX가 “사용자에게 보이지 않아도 됨”이면 **`drive.appdata`**. “내 Drive에서 찾고 싶다”면 **`drive.file` + 앱 폴더 생성** 조합을 검토.

검수: Drive 스코프는 Google Cloud **OAuth 검증** 대상이 될 수 있음(민감 스코프).

---

## 3. Drive 상의 파일 레이아웃

앱이 쓰는 **논리 경로** (실제는 `appDataFolder` 내 `parents` 또는 폴더 ID 한 개 아래):

```text
Qx10/
  manifest.json                 # 인덱스·버전·각 워크스페이스 메타
  workspaces/
    <slug-or-encoded-keyword>.json   # 스냅샷 1파일 = 워크스페이스 1개
  extras/
    dashboard-grid-<keyword-hash>.json # (선택) 키워드별 대시보드 그리드
    question-templates.json            # (선택) 전역 템플릿
```

### 3.1 `manifest.json` (예시 스키마)

```json
{
  "format": "qx10-drive-backup",
  "version": 1,
  "updatedAt": "2026-03-29T12:00:00.000Z",
  "clientSchema": {
    "workspaceSnapshotVersion": 1,
    "storagePrefix": "qx10.workspace.v1"
  },
  "workspaces": [
    {
      "keyword": "Large Language Models",
      "goal": "learn",
      "driveFileId": "…",
      "driveFileName": "workspaces/large-language-models.json",
      "contentHash": "sha256:…",
      "localUpdatedAt": "2026-03-29T11:55:00.000Z",
      "driveUpdatedAt": "2026-03-29T11:50:00.000Z"
    }
  ]
}
```

- `contentHash`: 충돌 감지·불필요한 업로드 스킵.
- `driveFileId`: Drive v3 `files` API로 덮어쓰기 시 사용.

### 3.2 워크스페이스 본문 파일

- **내용**은 지금 툴바 “JSON 저장”과 동일하게 **`serializeWorkspaceSnapshot(state)` 결과** (즉 `WorkspaceSnapshotFile` + `version: 1`).
- 파일명: `keyword`를 파일시스템 안전하게 slugify + 충돌 시 해시 접미사.

---

## 4. 레포와의 매핑 (무엇을 언제 올릴지)

### 4.1 반드시 포함 (핵심)

| 소스 | 코드 기준 | Drive에 넣는 시점 |
|------|-----------|-------------------|
| 워크스페이스 그래프 | `lib/workspace-snapshot.ts` — `serializeWorkspaceSnapshot` / `WORKSPACE_SNAPSHOT_VERSION` | **저장 시** 또는 **수동 “백업”** 또는 **주기(예: 5분 디바운스)** |
| 로컬 키 | `storageKey(keyword)` → `qx10.workspace.v1:${encodeURIComponent(keyword)}` | 업로드 단위는 “키워드당 1 JSON 파일”이면 충분 |

### 4.2 권장 포함 (복원 시 UX)

| 소스 | localStorage 키 | 비고 |
|------|-----------------|------|
| 최근 주제 목록 | `qx10.workspace.index.v1` (`lib/workspace-index.ts`) | `manifest` 또는 단일 `index.json` |
| 대시보드 그리드 | `qx10.dashboard.grid.v1:${encodeURIComponent(keyword)}` | 키워드별 `extras/` 파일 또는 manifest에 인라인 메타만 |

### 4.3 선택 포함

| 소스 | 키 | 비고 |
|------|-----|------|
| 질문 템플릿 | `lib/question-templates.ts`의 `STORAGE_KEY` | 여러 기기에서 템플릿 공유 시 유용 |
| 루트 시드 캐시 | `qx10.root.seed.v1:…` | 데모/성능용이라 백업 우선순위 낮음 |
| 데스크톱 뷰 모드 | `qx10.desktop.viewMode` | 기기별 설정이면 백업 제외 가능 |

### 4.4 제외 권장

- 테마·로케일: 기기 설정으로 두거나 별도 “설정 동기화” 플래그로만.

---

## 5. 동기화 플로우 (권장)

### 5.1 최초 “Drive 백업 연결”

1. 사용자가 설정에서 **Drive 연결** 클릭.
2. OAuth **Drive 스코프**만 추가(또는 처음부터 incremental auth).
3. 서버 또는 클라이언트가 `appDataFolder`에 `Qx10/manifest.json` 없으면 생성.
4. 선택: **로컬 → Drive 풀 업로드** (현재 `qx10.workspace.index.v1`에 있는 키워드 전부 순회 + 각 `storageKey` 로드).

### 5.2 이후: 업로드(백업)

트리거 후보:

- **수동:** “지금 백업” 버튼.
- **자동:** `saveWorkspaceToLocalStorage` 성공 직후 **디바운스 30~120초**로 해당 키워드만 Drive에 `files.update`.
- **주기:** 백그라운드 탭에서 `setInterval` 대신 **Page Visibility + 주기** 조합.

업로드 절차(한 워크스페이스):

1. `state` → `serializeWorkspaceSnapshot(state)` → UTF-8 JSON.
2. `sha256` (또는 짧은 hash) 계산; `manifest`의 `contentHash`와 같으면 스킵.
3. Drive: 기존 `fileId` 있으면 `PATCH` media, 없으면 `multipart` create with `parents: [appDataFolderId]`.
4. `manifest.json` 갱신 (원자적이게 하려면 Drive **두 파일 순서** 또는 manifest만 버전 필드 증가).

### 5.3 복원 / 새 기기

1. Drive에서 `manifest.json` 읽기.
2. 사용자가 복원할 키워드 선택(또는 전체).
3. 각 JSON → `parseWorkspaceSnapshotString` → 성공 시 `LOAD_SNAPSHOT` + `saveWorkspaceToLocalStorage`로 로컬에도 기록.
4. `registerWorkspaceVisit`로 인덱스 정합성 유지.

### 5.4 충돌

- 단순 정책: **`savedAt`(또는 `manifest.localUpdatedAt` vs `driveUpdatedAt`) 비교 후 최신 승** 또는 **항상 로컬 우선 / 항상 Drive 우선** 중 하나를 UI에 명시.
- 고급: 충돌 시 “복사본으로 열기” (새 키워드 또는 새 `ws` 세션).

---

## 6. 토큰 보관 (Next.js 권장 방향)

| 방식 | 장점 | 단점 |
|------|------|------|
| **서버 세션 + refresh token (암호화 저장)** | 갱신 안정적, 클라이언트에 refresh 없음 | 백엔드·DB 필요 |
| **클라이언트만 + PKCE + 짧은 수명 access token** | 서버 부담 감소 | 갱신·보안·오프라인 처리 복잡 |

**권장:** 프로덕션은 **서버에 Google refresh token 암호화 저장**(사용자 ID 기준), 클라이언트는 **세션 쿠키**만. Drive 호출은 **Route Handler / Server Action**에서 `googleapis`로 수행하거나, 짧은 TTL의 access token만 클라이언트에 내려주기.

---

## 7. Next.js 라우트 스케치 (구현 시)

- `GET/POST /api/auth/...` — Auth.js(NextAuth) 또는 자체 OAuth.
- `POST /api/integrations/google-drive/connect` — Drive 스코프 추가 코드 교환.
- `POST /api/integrations/google-drive/push` — body: `{ keyword }` 또는 전체; 서버가 스냅샷을 클라이언트에서 받거나, **클라이언트가 JSON을 보내고 서버가 Drive에 업로드** (서버가 로컬 state를 모르므로 보통 **클라이언트가 snapshot JSON 전송**이 단순).
- `GET /api/integrations/google-drive/manifest` — 목록 UI.
- `GET /api/integrations/google-drive/pull?keyword=…` — 다운로드 URL 또는 JSON 직접 반환.

(보안: 반드시 **세션의 userId**와 연결된 토큰만 사용.)

---

## 8. 구현 단계 (마일스톤)

1. **Auth만**: Google 로그인 + 세션, Drive 없음.
2. **Drive 연결**: 추가 스코프, `manifest` + 단일 워크스페이스 수동 업로드/다운로드.
3. **자동 백업**: 디바운스 업로드 + `manifest` 해시.
4. **풀 복원** + 인덱스/대시보드 그리드 등 extras.
5. **검수·모니터링** + rate limit / 용량 제한.

---

## 9. 관련 코드 파일 (레포)

- 스냅샷 직렬화/검증: `lib/workspace-snapshot.ts` (`WORKSPACE_SNAPSHOT_VERSION`, `serializeWorkspaceSnapshot`, `parseWorkspaceSnapshotString`)
- 로컬 저장: `saveWorkspaceToLocalStorage` / `loadWorkspaceFromLocalStorage` / `storageKey` → `qx10.workspace.v1:…`
- 최근 목록: `lib/workspace-index.ts` → `qx10.workspace.index.v1`
- 대시보드 레이아웃: `lib/dashboard-layout-storage.ts` → `qx10.dashboard.grid.v1:…`
-보내기 UX 참고: `downloadWorkspaceJson` (동일 포맷)

이 문서는 구현 시 스키마·플로우의 기준안이며, 제품 정책(충돌 처리, `appdata` vs `drive.file`)은 릴리스 전에 한 번 고정하는 것이 좋다.
