# Gallview

dcinside 갤러리의 이미지를 Masonry 레이아웃으로 보여주는 이미지 뷰어입니다.

## ✨ 기능

- 🖼️ dcinside 갤러리 이미지 수집 및 표시
- 📐 Masonry 레이아웃 (Pinterest 스타일)
- 🔢 1~8열 동적 컬럼 조절
- 📊 프로그레스 바 로딩 상태 표시
- 🏷️ 호버 시 게시글 제목 표시
- 📱 반응형 디자인

## 🚀 사용법

1. `board.html`을 브라우저에서 열기
2. dcinside 갤러리 URL 입력
   - 일반 갤러리: `https://gall.dcinside.com/board/lists/?id=갤러리ID`
   - 마이너 갤러리: `https://gall.dcinside.com/mgallery/board/lists/?id=갤러리ID`
   - 추가 쿼리 가능: `&list_num=50&page=2` 등
3. "불러오기" 클릭

## 🛠️ 기술 스택

- **HTML5** + **CSS3** + **Vanilla JavaScript**
- **Masonry Layout** - 이미지 레이아웃
- **imagesLoaded** - 이미지 로딩 감지
- **Pretendard** - 폰트

## 📁 파일 구조

```
Gallview/
├── board.html    # 메인 HTML
├── board.css     # 스타일시트
├── board.js      # 메인 로직
├── server.js     # CORS 프록시 서버
├── package.json  # Node.js 의존성
└── README.md
```

## 🔧 프록시 서버 설정

dcinside 이미지를 가져오려면 CORS 프록시 서버가 필요합니다.

### 로컬 실행

```bash
# 의존성 설치
npm install

# 프록시 서버 실행 (기본 포트: 8080)
npm start
```

## ⚙️ 설정

`board.js`의 `CONFIG` 객체에서 설정 변경 가능:

```javascript
const CONFIG = {
  proxyUrl: 'http://localhost:8080/', // 배포 시 실제 프록시 서버 URL로 변경
  app: {
    maxArticlesToFetch: 20,  // 가져올 게시글 수
    concurrentRequests: 5,   // 동시 요청 수
  },
};
```

## ⚠️ 주의사항

> **이 프로젝트는 개인 용도로 제작되었습니다.**

- 이미지를 **저장하지 않고 표시만** 합니다 (브라우저 캐시 제외)
- 과도한 요청은 서버에 부담을 줄 수 있으니 적절히 사용하세요
- 수집한 데이터를 상업적으로 재배포하지 마세요

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
