# 만세력 공유 랜딩 + App Links (설치 유도)

이 폴더는 **공유 링크 설치 퍼널**의 웹 파트 정본이다.
앱은 공유 시 `ohhyo://` 커스텀 스킴 대신 `https://hwoh87.github.io/...` 링크를 내보낸다.

```
공유된 https 링크 탭
   ├─ 앱 있음(App Link 검증됨) → 앱이 가로채 해당 화면으로 바로 진입
   ├─ 앱 있음(미검증)         → 이 페이지가 ohhyo:// 스킴으로 앱을 엶
   └─ 앱 없음                 → 이 페이지 → 플레이스토어(referrer 포함) → 설치 → 첫 실행에 복원
```

## 파일

| 경로 | 역할 |
|---|---|
| `m/index.html` | 매거진 랜딩. `https://hwoh87.github.io/m/?id=<id>` |
| `s/index.html` | 공유 결과 뷰어(sid 스냅샷 + 구형 scene 바운스). `https://hwoh87.github.io/s/?sid=<sid>` |
| `s/{fusion,compat,group,pair}/index.html` | **종류별 OG 셸** — 크롤러엔 종류별 미리보기, 사람은 즉시 `/s/?sid=` 로 리다이렉트. `DeepLink.buildSharedResultUrl(sid, kind)` 가 내보냄 |
| `og-*.png` | 브랜디드 OG 카드(1200×630). share=공용·fusion·compat·group·magazine. 원본 템플릿은 세션 스크래치 `og-card.html`(headless Chrome 렌더) |
| `index.html` | 루트 → 스토어 리다이렉트 |
| `.well-known/assetlinks.json` | **App Links 검증 파일** (SHA-256 채워야 동작) |
| `.nojekyll` | **필수.** GitHub Pages(Jekyll)가 `.well-known` 같은 점(.) 디렉터리를 무시하는 걸 막는다 |

## 배포 (GitHub Pages user-site)

1. `hwoh87.github.io` 이름의 **public repo** 생성 (user-site → 루트 `https://hwoh87.github.io/` 서빙).
2. 이 폴더의 내용물을 그 repo **루트**에 복사 후 push (`.nojekyll`, `.well-known/` 포함).
   ```sh
   # 예시 (repo를 ~/hwoh87.github.io 로 클론한 경우)
   cp -R landing/. ~/hwoh87.github.io/
   cd ~/hwoh87.github.io && git add -A && git commit -m "share landing + assetlinks" && git push
   ```
3. repo Settings → Pages → Source: `main` 브랜치 `/ (root)` 로 활성화.
4. 확인:
   - `https://hwoh87.github.io/.well-known/assetlinks.json` → JSON 200 (application/json)
   - `https://hwoh87.github.io/m/?id=1` → 랜딩 200

> ⚠️ `manseryeok-privacy`(프로젝트 사이트, `/manseryeok-privacy/` 경로)와 **공존한다**.
> user-site는 루트, 프로젝트 사이트는 하위 경로라 충돌 없음. 앱은 `/m/`·`/s/` 경로만 가로챈다.

## assetlinks.json SHA-256 채우기 (App Links 검증)

Play 배포는 **Play 앱 서명**을 쓰므로, 구글이 실제 서명에 쓰는 인증서의 SHA-256을 넣어야 한다.
업로드 키가 아니다.

- **운영(필수):** Play Console → 출시 → 설정 → **앱 무결성** → 앱 서명 →
  **"앱 서명 키 인증서"의 SHA-256** 복사 → `assetlinks.json` 첫 fingerprint 에 붙여넣기.
- **로컬 테스트(선택):** 디버그 빌드로 App Link를 검증하려면 디버그 키스토어 SHA-256도 배열에 추가.
  ```sh
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
    -storepass android -keypass android | grep SHA256
  ```

콜론 없는/있는 형식 모두 허용되지만 보통 `AB:CD:...` 대문자 콜론 표기로 넣는다.

## 검증

```sh
# App Link 직접 실행(설치된 기기)
adb shell am start -a android.intent.action.VIEW -d "https://hwoh87.github.io/m/?id=1"
adb shell am start -a android.intent.action.VIEW -d "https://hwoh87.github.io/s/?scene=one-to-one"

# 시스템 검증 상태(Android 12+)
adb shell pm get-app-links com.samramanshang.manseryeok
# → hwoh87.github.io: verified 떠야 함 (none/legacy면 assetlinks/서명 확인)

# 디퍼드(설치 referrer) — 내부테스트 트랙 설치로만 정확히 검증됨.
#   m/index.html 이 스토어 URL에 &referrer=m_<id> 를 싣고,
#   InstallReferrerHandler 가 첫 실행에 읽어 routeFromReferrer 로 복원.
```

Google **Digital Asset Links 검사기**:
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://hwoh87.github.io&relation=delegate_permission/common.handle_all_urls`

## OG 이미지 (선택, 미리보기 품질↑)

`m/index.html`·`s/index.html`·`index.html` 이 참조하는 `og-magazine.png` / `og-share.png` 를
repo 루트에 추가하면 카톡/인스타 공유 시 썸네일이 뜬다 (권장 1200×630). 없으면 텍스트만 노출.

## v2: 글별 리치 미리보기

지금은 모든 매거진 링크가 **공통 미리보기**(OG 정적)다. 글마다 제목·썸네일을 다르게 하려면
OG 크롤러가 JS를 실행하지 않으므로 **글별 정적 HTML**이 필요하다:
Supabase의 발행 매거진 목록을 읽어 `m/<id>/index.html` 을 생성하는 빌드 스크립트를 추가하면 된다
(앱의 `parseMagazineId` 는 이미 경로형 `/m/<id>` 도 인식하도록 돼 있음).
