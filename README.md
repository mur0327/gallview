# Gallview

dcinside 갤러리의 이미지를 Masonry 레이아웃으로 보여주는 이미지 뷰어입니다.

![preview](https://img.shields.io/badge/demo-live-brightgreen)

## ✨ 기능

- 🖼️ DCInside 갤러리 이미지 수집 및 표시
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
└── README.md
```

## ⚙️ 설정

`board.js`의 `CONFIG` 객체에서 설정 변경 가능:

```javascript
const CONFIG = {
  proxyUrl: 'https://cors-anywhere.uiram.com/',
  app: {
    maxArticlesToFetch: 20,  // 가져올 게시글 수
    concurrentRequests: 5,   // 동시 요청 수
  },
};
```

## 📝 라이선스

MIT License
