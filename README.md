# Gallview

dcinside 갤러리와 arcalive 채널의 이미지를 Masonry 레이아웃으로 모아보는 이미지 뷰어입니다.
**웹 사이트(Web)** 방식과 **크롬 확장 프로그램(Extension)** 방식을 모두 지원합니다.

## ✨ 기능

- 🌐 **멀티 사이트 지원**: dcinside, arcalive 지원
- 📐 **Masonry 레이아웃**: Pinterest 스타일의 깔끔한 정렬
- 🎨 **1 Row 헤더 & 자동 숨김**: 스크롤 시 헤더가 숨겨져 넓은 화면 제공
- 🔢 **동적 열 조절**: 1~8열까지 자유롭게 레이아웃 변경 (반응형)
- � **말머리 필터링**:
  - Site: 갤러리/채널 ID 입력 후 말머리 목록 자동 로드 (모달)
  - Extension: 현재 페이지의 말머리를 자동 감지하여 필터링
- 🌟 **DCBest 카테고리**: 실시간 베스트, 실베 라이트, 나이트 등 카테고리별 조회

---

## 🚀 사용법

### 1. 웹 버전 (Web)

로컬 서버를 실행하여 브라우저에서 접속하는 방식입니다. (CORS 프록시 필요)

**설치 및 실행**

```bash
# 의존성 설치
npm install

# 프록시 서버 실행 (8080 포트)
npm start
```

1. 브라우저에서 `site/board.html` 열기
2. 사이트 선택 (디시인사이드 / 아카라이브)
3. 갤러리/채널 ID 입력
4. "불러오기" 클릭

---

### 2. 크롬 확장 프로그램 (Extension)

현재 탭에서 바로 실행하여 별도의 서버 없이 이미지를 수집합니다. (CORS 문제 없음)

**설치 방법**

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **"개발자 모드"** 활성화
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `Gallview/extension` 폴더 선택

**사용법**

1. dcinside 갤러리/게시글 또는 arcalive 채널 페이지 접속
2. 브라우저 우측 상단 **Gallview 아이콘** 클릭
3. (선택) 말머리 설정, 게시글 수 조절
4. **"불러오기"** 클릭 → 새 탭에서 이미지 뷰어 실행

---

## 🛠️ 기술 스택

- **Core**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Extension**: Manifest V3, Chrome Scripting API
- **Proxy**: Node.js (cors-anywhere)
- **Library**: Masonry Layout, imagesLoaded

---

## 📁 프로젝트 구조

```text
Gallview/
├── site/                     # 🌐 웹 버전 (Web)
│   ├── board.html            # 뷰어 HTML
│   ├── board.css             # 스타일시트
│   └── board.js              # 메인 로직 (Proxy 사용)
├── extension/                # 🧩 크롬 확장 프로그램 (Extension)
│   ├── manifest.json         # 확장 프로그램 설정
│   ├── popup/                # 팝업 UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js          # 스크립팅 API로 말머리 추출
│   └── viewer/               # 확장 프로그램용 뷰어 (site와 유사)
│       ├── board.html
│       ├── board.css
│       └── board.js          # 뷰어 로직 (직접 요청)
├── server.js                 # CORS 프록시 서버 (웹 버전용)
└── config.local.example.js   # 설정 템플릿
```

## 🔧 설정 (웹 버전용)

`config.local.example.js`를 복사하여 `config.local.js` 생성 후 프록시 URL 설정:

```javascript
const LOCAL_CONFIG = {
  proxyUrl: "http://localhost:8080/", // 또는 사용자 프록시 서버
};
```

## ⚠️ 주의사항

> **이 프로젝트는 개인 용도로 제작되었습니다.**

- 이미지를 **저장하지 않고 표시만** 합니다 (브라우저 캐시 제외)
- 과도한 요청은 대상 서버에 부담을 줄 수 있으니 적절히 사용하세요
- 수집한 데이터를 상업적으로 이용하거나 재배포하지 마세요

### 면책조항

이 프로젝트는 "있는 그대로(AS IS)" 제공됩니다. 사용으로 인해 발생하는 모든 책임은 **사용자 본인**에게 있습니다.

## 📝 라이선스

MIT License

### 사용된 오픈소스

| 라이브러리                                               | 라이선스 |
| -------------------------------------------------------- | -------- |
| [cors-anywhere](https://github.com/Rob--W/cors-anywhere) | MIT      |
| [Masonry](https://masonry.desandro.com/)                 | MIT      |
| [imagesLoaded](https://imagesloaded.desandro.com/)       | MIT      |
| [Pretendard](https://github.com/orioncactus/pretendard)  | SIL OFL  |
