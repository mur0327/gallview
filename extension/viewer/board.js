const CONFIG = {
  // 확장 프로그램은 프록시 없이 직접 요청 가능
  proxyUrl: "",
  dcinside: {
    baseUrl: "https://gall.dcinside.com",
    imageBaseUrl: "https://images.dcinside.com/viewimage.php",
    selectors: {
      article: {
        dcbest: ".ub-content.us-post.thum .gall_tit.ub-word a:not(.reply_numbox)",
        gallery: '.ub-content.us-post[data-type="icon_pic"] .gall_tit.ub-word a:not(.reply_numbox)',
        recommend: '.ub-content.us-post[data-type="icon_recomimg"] .gall_tit.ub-word a:not(.reply_numbox)',
      },
      media: [
        {
          selector:
            "div.view_content_wrap .writing_view_box #zzbang_div img:not(.written_dccon), div.view_content_wrap .writing_view_box .write_div img:not(.written_dccon):not(.og-img)",
          attr: "src",
        },
        {
          selector: "div.view_content_wrap .writing_view_box .write_div video:not(.written_dccon)",
          attr: "data-src",
        },
      ],
    },
  },
  arcalive: {
    baseUrl: "https://arca.live",
    selectors: {
      article: "a.vrow:has(span.ion-ios-photos-outline)",
      articleBest: "a.vrow:has(span.ion-android-star)",
      media: [
        {
          selector: ".article-body .fr-view.article-content img[src*='namu.la']:not(.arca-emoticon)",
          attr: "src",
        },
      ],
    },
  },
  app: {
    defaultArticleCount: 20,
    maxArticleCount: 500,
    maxPages: 100,
    concurrentRequests: 5,
  },
};

/**
 * ImageBoard 클래스
 * 확장 프로그램 Viewer 전용으로 간소화됨.
 * 팝업에서 전달된 파라미터로 자동 실행됩니다.
 */
class ImageBoard {
  constructor() {
    this.totalImages = 0;
    this.loadedImages = 0;
    this.msnry = null;
    this.dynamicStyleSheet = null;
    this.dcbestParam = 1;
    this.category = "";
    this.currentSite = "dcinside";
    this.recommendOnly = false;
  }

  /**
   * 초기화 - Masonry 및 이벤트 리스너 설정 후 자동 실행
   */
  init() {
    const board = document.getElementById("board");
    const columnSelector = document.getElementById("column-selector");

    // 동적 스타일시트
    this.dynamicStyleSheet = document.createElement("style");
    document.head.appendChild(this.dynamicStyleSheet);

    // Masonry 초기화 - percentPosition으로 반응형 레이아웃 (공식 권장)
    // gutter는 CSS margin으로 처리
    this.msnry = new Masonry(board, {
      itemSelector: ".masonry-item",
      columnWidth: ".grid-sizer",
      percentPosition: true,
      transitionDuration: 0,
    });

    // 이벤트 리스너
    columnSelector.addEventListener("change", () => this.updateLayout());
    window.addEventListener("resize", () => this.updateLayout());
    document.getElementById("clear-btn").addEventListener("click", () => this.clearBoard());

    // 스크롤 시 헤더 자동 숨김
    this.setupHeaderAutoHide();

    // 초기 레이아웃 설정
    this.updateLayout();

    // URL 파라미터로 자동 실행
    this.checkUrlParams();
  }

  /**
   * 스크롤 시 헤더 자동 숨김/표시
   */
  setupHeaderAutoHide() {
    const header = document.getElementById("title");
    let lastScrollY = 0;
    let ticking = false;

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // 스크롤 다운 시 숨김 (일정 스크롤 이상일 때만)
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            header.classList.add("hidden");
          }
          // 스크롤 업 시 표시
          else if (currentScrollY < lastScrollY) {
            header.classList.remove("hidden");
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /**
   * URL 파라미터를 파싱하여 UI 업데이트 및 자동 로드
   * sessionStorage를 사용하여 새로고침 시 중복 fetch 방지
   */
  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    if (!urlParams.has("site") || !urlParams.has("id")) {
      this.showToast("잘못된 접근입니다. 팝업에서 실행해주세요.");
      return;
    }

    const site = urlParams.get("site");
    const id = urlParams.get("id");
    const count = urlParams.get("count") || CONFIG.app.defaultArticleCount;
    const page = urlParams.get("page") || 1;
    const head = urlParams.get("head") || "";
    const dcbest = urlParams.get("dcbest");

    // 상태 설정
    this.currentSite = site;
    this.category = head;
    if (dcbest) {
      this.dcbestParam = parseInt(dcbest, 10);
    }

    // 개념글만 필터
    if (urlParams.get("recommend") === "true" || urlParams.get("best") === "true") {
      this.recommendOnly = true;
    }

    // UI 업데이트
    const badge = document.getElementById("site-badge");
    badge.textContent = site === "dcinside" ? "디시인사이드" : "아카라이브";
    badge.classList.add(site === "dcinside" ? "dc" : "arca");

    document.getElementById("board-id").value = id;
    document.getElementById("article-count").value = count;
    document.getElementById("start-page").value = page;

    // 타이틀 업데이트
    document.title = `${id} - Gallview`;

    // 새로고침 시 중복 로드 방지
    const sessionKey = `gallview_loaded_${window.location.search}`;
    if (sessionStorage.getItem(sessionKey)) {
      this.showToast("이미 로드된 세션입니다. 새로 불러오려면 팝업에서 다시 실행하세요.");
      return;
    }

    // 로드 시작 표시
    sessionStorage.setItem(sessionKey, "true");

    // 갤러리 로드
    this.loadGallery(id, parseInt(count, 10), parseInt(page, 10));
  }

  /**
   * 토스트 알림 표시
   */
  showToast(message, duration = 2500) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast warning";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 레이아웃 업데이트 (열 개수 변경 시)
   * CSS 퍼센트 기반으로 반응형 레이아웃 적용
   */
  updateLayout() {
    if (!this.msnry) return;

    const board = document.getElementById("board");
    const columnSelector = document.getElementById("column-selector");
    const numColumns = parseInt(columnSelector.value, 10);

    // 순수 퍼센트 기반 너비 (padding이 wrapper에 있으므로 정확히 계산됨)
    const widthPercent = (100 / numColumns).toFixed(4);

    // CSS로 grid-sizer, masonry-item에 동일한 퍼센트 너비 설정
    this.dynamicStyleSheet.textContent = `
      .grid-sizer,
      .masonry-item {
        width: ${widthPercent}%;
      }
    `;

    // CSS 변경이 적용된 후 레이아웃 재계산
    requestAnimationFrame(() => {
      imagesLoaded(board, () => {
        this.msnry.layout();
      });
    });
  }

  /**
   * 로딩 상태 업데이트
   */
  updateLoadingStatus() {
    const statusEl = document.getElementById("loading-status");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");

    if (this.totalImages > 0) {
      statusEl.style.display = "block";
      statusEl.textContent = `총 ${this.totalImages}개 중 ${this.loadedImages}개 로드 완료`;

      progressContainer.style.display = "block";
      const percentage = (this.loadedImages / this.totalImages) * 100;
      progressBar.style.width = `${percentage}%`;

      if (this.loadedImages === this.totalImages) {
        statusEl.textContent = "로딩 완료 ✅";
        setTimeout(() => {
          statusEl.style.display = "none";
          progressContainer.style.display = "none";
          progressBar.style.width = "0%";
        }, 3000);
      }
    } else {
      statusEl.style.display = "none";
      progressContainer.style.display = "none";
      progressBar.style.width = "0%";
    }
  }

  /**
   * 갤러리 로드 메인 함수
   */
  async loadGallery(id, articleCount = CONFIG.app.defaultArticleCount, startPage = 1) {
    // 로그 출력
    console.log("%c========== 크롤링 시작 ==========", "color: #4CAF50; font-weight: bold;");
    console.log("%c📋 설정 정보", "color: #2196F3; font-weight: bold;");
    console.log(`  사이트: ${this.currentSite}`);
    console.log(`  ID: ${id}`);
    console.log(`  게시글 수: ${articleCount}`);
    console.log(`  시작 페이지: ${startPage}`);
    console.log(`  말머리: ${this.category === "" ? "전체" : this.category}`);
    if (id === "dcbest") {
      console.log(`  DCBest 카테고리: ${this.dcbestParam}`);
    }
    console.log("");

    this.clearBoard();

    try {
      const imgBoardList = await this.fetchImageBoardData(id, articleCount, startPage);
      await this.renderImageBoard(imgBoardList);
    } catch (error) {
      console.error(error.message);
      this.showToast(error.message);
    }
  }

  /**
   * 목록 URL 생성
   */
  buildListUrl(id, page = 1) {
    if (this.currentSite === "dcinside") {
      if (id === "dcbest") {
        return `${CONFIG.dcinside.baseUrl}/board/lists/?id=dcbest&page=${page}&_dcbest=${this.dcbestParam}`;
      }
      let url = `${CONFIG.dcinside.baseUrl}/mgallery/board/lists/?id=${id}&page=${page}`;
      if (this.category !== "") {
        url += `&sort_type=N&search_head=${this.category}`;
      }
      if (this.recommendOnly) {
        url += `&exception_mode=recommend`;
      }
      return url;
    }

    if (this.currentSite === "arcalive") {
      let url = `${CONFIG.arcalive.baseUrl}/b/${id}`;
      const params = [];
      if (this.category !== "") {
        params.push(`category=${encodeURIComponent(this.category)}`);
      }
      if (this.recommendOnly) {
        params.push(`mode=best`);
      }
      params.push(`p=${page}`);
      url += `?${params.join("&")}`;
      return url;
    }

    return "";
  }

  /**
   * HTML 가져오기
   */
  async getHTML(url, convertLazyImages = false) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          this.showToast("올바른 갤러리/채널 ID를 입력하세요");
          return null;
        }
        throw new Error(`HTTP 오류! 상태: ${res.status}`);
      }
      const text = await res.text();
      const parser = new DOMParser();
      const html = parser.parseFromString(text, "text/html");

      if (convertLazyImages) {
        const lazyImages = html.querySelectorAll("img.lazy");
        lazyImages.forEach((img) => {
          if (img.hasAttribute("data-original")) {
            img.setAttribute("src", img.getAttribute("data-original"));
            img.removeAttribute("data-original");
            img.classList.remove("lazy");
          }
        });
      }

      return html;
    } catch (error) {
      if (error.name === "AbortError" || error.message.includes("Failed to fetch")) {
        console.log("요청이 중단되었습니다.");
        return null;
      }
      throw new Error(`HTML을 가져오는 데 실패했습니다 (${url}): ${error.message}`);
    }
  }

  /**
   * 게시글 셀렉터 반환
   */
  getArticleSelector(id) {
    if (this.currentSite === "dcinside") {
      if (id === "dcbest") {
        return CONFIG.dcinside.selectors.article.dcbest;
      }
      return this.recommendOnly
        ? CONFIG.dcinside.selectors.article.recommend
        : CONFIG.dcinside.selectors.article.gallery;
    }
    if (this.currentSite === "arcalive") {
      return this.recommendOnly ? CONFIG.arcalive.selectors.articleBest : CONFIG.arcalive.selectors.article;
    }
    return "";
  }

  /**
   * HTML에서 게시글 추출
   */
  extractArticlesFromHTML(html, selector) {
    const articles = html.querySelectorAll(selector);
    const articleList = [];

    if (this.currentSite === "dcinside") {
      articles.forEach((article) => {
        const title = article.innerText.trim();
        const href = article.getAttribute("href");
        articleList.push({ title, url: CONFIG.dcinside.baseUrl + href });
      });
    }

    if (this.currentSite === "arcalive") {
      articles.forEach((a) => {
        const title = a.querySelector("span.title")?.textContent.trim() || "";
        const href = a.getAttribute("href");
        articleList.push({ title, url: CONFIG.arcalive.baseUrl + href });
      });
    }

    return articleList;
  }

  /**
   * 게시글 목록 수집
   */
  async getArticleList(id, targetCount, startPage = 1) {
    const selector = this.getArticleSelector(id);
    const allArticles = [];
    let currentPage = startPage;
    let emptyPageCount = 0;
    let isFirstPage = true;

    while (allArticles.length < targetCount && currentPage < startPage + CONFIG.app.maxPages) {
      const targetUrl = this.buildListUrl(id, currentPage);
      console.log(`페이지 ${currentPage} 조회 중...`);

      const html = await this.getHTML(targetUrl, false);

      if (!html) {
        if (isFirstPage) return [];
        break;
      }

      isFirstPage = false;
      const pageArticles = this.extractArticlesFromHTML(html, selector);

      if (pageArticles.length === 0) {
        emptyPageCount++;
        if (emptyPageCount >= 3) {
          console.log("더 이상 게시글이 없습니다.");
          break;
        }
      } else {
        emptyPageCount = 0;
        const remaining = targetCount - allArticles.length;
        allArticles.push(...pageArticles.slice(0, remaining));
        console.log(`페이지 ${currentPage}: ${pageArticles.length}개 발견, 총 ${allArticles.length}/${targetCount}개`);
      }

      currentPage++;
    }

    if (allArticles.length === 0) {
      throw new Error("이미지가 있는 게시글을 찾을 수 없습니다.");
    }

    console.log("가져온 게시글 목록:", allArticles);
    return allArticles;
  }

  /**
   * 배열 청크 분할
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 미디어 URL 수집
   */
  async getMediaList(articleList) {
    const results = [];
    const chunks = this.chunkArray(articleList, CONFIG.app.concurrentRequests);

    console.log("%c📷 게시글별 이미지 수집", "color: #9C27B0; font-weight: bold;");

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (article) => {
          const html = await this.getHTML(article.url, this.currentSite === "dcinside");

          if (!html) {
            return { ...article, mediaList: [] };
          }

          const mediaList = [];

          if (this.currentSite === "dcinside") {
            CONFIG.dcinside.selectors.media.forEach(({ selector, attr }) => {
              const elements = html.querySelectorAll(selector);
              elements.forEach((element) => {
                const src = element.getAttribute(attr);
                if (src) {
                  const srcObj = new URL(src);
                  const srcId = srcObj.searchParams.get("id");
                  const srcNo = srcObj.searchParams.get("no");
                  const fullUrl = `${CONFIG.dcinside.imageBaseUrl}?id=${srcId}&no=${srcNo}`;
                  mediaList.push({ url: fullUrl });
                }
              });
            });
          }

          if (this.currentSite === "arcalive") {
            CONFIG.arcalive.selectors.media.forEach(({ selector, attr }) => {
              html.querySelectorAll(selector).forEach((element) => {
                const src = element.getAttribute(attr);
                if (src && src.includes("namu.la")) {
                  mediaList.push({ url: `https:${src}` });
                }
              });
            });
          }

          return { ...article, mediaList };
        })
      );

      chunkResults.forEach((result) => {
        console.log(`📄 ${result.title} (${result.mediaList.length}개)`, result.url);
      });

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 이미지 데이터 수집 메인
   */
  async fetchImageBoardData(galleryId, articleCount, startPage) {
    const articleList = await this.getArticleList(galleryId, articleCount, startPage);
    const imgBoardList = await this.getMediaList(articleList);

    const totalMedia = imgBoardList.reduce((sum, article) => sum + article.mediaList.length, 0);
    console.log("");
    console.log("%c========== 크롤링 완료 ==========", "color: #4CAF50; font-weight: bold;");
    console.log("%c📊 결과 요약", "color: #FF9800; font-weight: bold;");
    console.log(`  수집된 게시글: ${imgBoardList.length}개`);
    console.log(`  총 이미지: ${totalMedia}개`);
    console.log("");

    return imgBoardList;
  }

  /**
   * 이미지 Blob 다운로드
   */
  async fetchImageBlob(imageUrl) {
    const res = await fetch(imageUrl);
    return res.blob();
  }

  /**
   * 이미지 카드 생성
   */
  async createImageCard(article, image) {
    const blob = await this.fetchImageBlob(image.url);
    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const anchor = document.createElement("a");
      anchor.href = article.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "masonry-item";

      const container = document.createElement("div");
      container.className = "image-container";

      const imgElement = document.createElement("img");
      imgElement.alt = article.title;

      const overlay = document.createElement("div");
      overlay.className = "image-overlay";
      overlay.textContent = article.title;

      imgElement.onload = () => {
        container.appendChild(imgElement);
        container.appendChild(overlay);
        anchor.appendChild(container);
        URL.revokeObjectURL(imgElement.src);
        resolve(anchor);
      };

      imgElement.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`이미지 로드 실패: ${image.url}`));
      };

      imgElement.src = objectUrl;
    });
  }

  /**
   * 이미지 렌더링
   */
  async renderImageBoard(imgBoardList) {
    const board = document.getElementById("board");
    this.totalImages = imgBoardList.reduce((sum, article) => sum + article.mediaList.length, 0);
    this.loadedImages = 0;
    this.updateLoadingStatus();

    if (this.totalImages === 0) {
      this.showToast("이미지가 없습니다.");
      return;
    }

    const allImages = [];
    imgBoardList.forEach((article) => {
      article.mediaList.forEach((image) => {
        allImages.push({ article, image });
      });
    });

    const batches = this.chunkArray(allImages, CONFIG.app.concurrentRequests);

    for (const batch of batches) {
      const batchPromises = batch.map(({ article, image }) =>
        this.createImageCard(article, image)
          .then((card) => {
            this.loadedImages++;
            this.updateLoadingStatus();
            return card;
          })
          .catch((error) => {
            console.error(error);
            this.loadedImages++;
            this.updateLoadingStatus();
            return null;
          })
      );

      const batchCards = await Promise.all(batchPromises);
      const validCards = batchCards.filter((card) => card !== null);

      validCards.forEach((card) => {
        board.appendChild(card);
      });

      this.msnry.appended(validCards);
      this.msnry.layout();
    }
  }

  /**
   * 보드 초기화
   */
  clearBoard() {
    if (this.msnry) {
      this.msnry.remove(this.msnry.getItemElements());
      this.msnry.layout();
    }
    this.totalImages = 0;
    this.loadedImages = 0;
    this.updateLoadingStatus();
  }
}

// 메인 실행
document.addEventListener("DOMContentLoaded", () => {
  const imageBoard = new ImageBoard();
  imageBoard.init();

  window.addEventListener("load", () => {
    imageBoard.updateLayout();
  });
});
