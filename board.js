const CONFIG = {
  // config.local.js가 있으면 해당 값 사용, 없으면 기본값
  proxyUrl: typeof LOCAL_CONFIG !== "undefined" ? LOCAL_CONFIG.proxyUrl : "http://localhost:8080/",
  dcinside: {
    baseUrl: "https://gall.dcinside.com",
    imageBaseUrl: "https://images.dcinside.com/viewimage.php",
    selectors: {
      article: {
        dcbest: ".ub-content.us-post.thum .gall_tit.ub-word a:not(.reply_numbox)",
        gallery: '.ub-content.us-post[data-type="icon_pic"] .gall_tit.ub-word a:not(.reply_numbox)',
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
  app: {
    defaultArticleCount: 20,
    maxArticleCount: 500,
    maxPages: 100, // 무한 루프 방지
    concurrentRequests: 5,
  },
};

/**
 * ImageBoard 클래스
 * 전역 변수 대신 클래스로 상태를 캡슐화하여 유지보수성을 높이고,
 * 여러 인스턴스 생성이 가능하도록 합니다.
 */
class ImageBoard {
  constructor() {
    this.totalImages = 0;
    this.loadedImages = 0;
    this.msnry = null;
    this.dynamicStyleSheet = null;
    this.dcbestParam = 1; // 기본값: 실시간 베스트
  }

  /**
   * Masonry, 이벤트 리스너 등 필수 컴포넌트를 초기화합니다.
   * DOMContentLoaded 이후에 호출해야 DOM 요소에 접근할 수 있습니다.
   */
  init() {
    const board = document.getElementById("board");
    const columnSelector = document.getElementById("column-selector");

    // 동적 스타일시트를 생성하고 head에 추가합니다.
    this.dynamicStyleSheet = document.createElement("style");
    document.head.appendChild(this.dynamicStyleSheet);

    // Masonry 초기화
    this.msnry = new Masonry(board, {
      itemSelector: ".masonry-item",
      percentPosition: false,
      transitionDuration: 0,
    });

    // 이벤트 리스너 설정
    columnSelector.addEventListener("change", () => this.updateLayout());
    window.addEventListener("resize", () => this.updateLayout());

    document.getElementById("load-btn").addEventListener("click", () => this.handleLoadClick());
    document.getElementById("clear-btn").addEventListener("click", () => this.clearBoard());

    // 입력 필드 유효성 검사
    this.setupInputValidation();

    // DCBest 모달 설정
    this.setupDcbestModal();
  }

  /**
   * DCBest 카테고리 선택 모달을 설정합니다.
   */
  setupDcbestModal() {
    const modal = document.getElementById("dcbest-modal");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const overlay = modal.querySelector(".modal-overlay");

    // 확인 버튼
    confirmBtn.addEventListener("click", () => {
      const checkboxes = modal.querySelectorAll('input[name="dcbest-cat"]:checked');
      if (checkboxes.length === 0) {
        this.showToast("최소 1개 이상 선택하세요");
        return;
      }
      // 체크된 값 합산
      this.dcbestParam = Array.from(checkboxes).reduce((sum, cb) => sum + parseInt(cb.value, 10), 0);
      modal.classList.remove("show");
      this.loadDcbest();
    });

    // 취소 버튼
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("show");
      this.setLoadButtonState("idle");
    });

    // 오버레이 클릭으로 닫기
    overlay.addEventListener("click", () => {
      modal.classList.remove("show");
      this.setLoadButtonState("idle");
    });
  }

  /**
   * 게시글 수와 시작 페이지 입력 필드에 유효성 검사를 설정합니다.
   * blur(포커스 해제) 또는 Enter 키 입력 시 범위를 검사하고 보정합니다.
   */
  setupInputValidation() {
    const articleCountInput = document.getElementById("article-count");
    const startPageInput = document.getElementById("start-page");

    const validateInput = (input, min, max) => {
      let value = parseInt(input.value, 10);
      if (isNaN(value) || value < min) {
        value = min;
        this.showToast(`최소값 ${min}으로 설정되었습니다`);
      } else if (value > max) {
        value = max;
        this.showToast(`최대값 ${max}으로 설정되었습니다`);
      }
      input.value = value;
    };

    // 게시글 수: 1 ~ 500
    const validateArticleCount = () => validateInput(articleCountInput, 1, CONFIG.app.maxArticleCount);
    articleCountInput.addEventListener("blur", validateArticleCount);
    articleCountInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") validateArticleCount();
    });

    // 시작 페이지: 1 이상
    const validateStartPage = () => validateInput(startPageInput, 1, 9999);
    startPageInput.addEventListener("blur", validateStartPage);
    startPageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") validateStartPage();
    });
  }

  /**
   * 토스트 알림을 표시합니다.
   * @param {string} message - 표시할 메시지
   * @param {number} duration - 표시 시간 (ms)
   */
  showToast(message, duration = 2500) {
    // 기존 토스트 제거
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast warning";
    toast.textContent = message;
    document.body.appendChild(toast);

    // 애니메이션을 위한 약간의 지연
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 컬럼 개수나 창 크기 변경 시 이미지 컨테이너 너비를 재계산합니다.
   * 동적 스타일시트를 사용하여 모든 요소에 일괄 적용하므로
   * 개별 element.style 수정보다 효율적입니다.
   */
  updateLayout() {
    if (!this.msnry) return;

    const board = document.getElementById("board");
    const style = getComputedStyle(board);
    const contentWidth = board.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    const columnSelector = document.getElementById("column-selector");
    const numColumns = parseInt(columnSelector.value, 10);
    const gutter = 5;

    const totalGutterSpace = (numColumns - 1) * gutter;
    const columnWidth = Math.floor((contentWidth - totalGutterSpace) / numColumns);

    // 수정: innerHTML 대신 textContent 사용
    this.dynamicStyleSheet.textContent = `.image-container { width: ${columnWidth}px; }`;

    this.msnry.options.columnWidth = columnWidth;
    this.msnry.options.gutter = gutter;
    this.msnry.layout();
  }

  /**
   * 사용자에게 로딩 진행 상황을 시각적으로 피드백합니다.
   * 프로그레스 바와 텍스트 상태를 동기화하여 UX를 향상시킵니다.
   */
  updateLoadingStatus() {
    const statusEl = document.getElementById("loading-status");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");

    if (this.totalImages > 0) {
      // 로딩 상태 텍스트
      statusEl.style.display = "block";
      statusEl.textContent = `총 ${this.totalImages}개 중 ${this.loadedImages}개 로드 완료`;

      // 프로그레스 바 업데이트
      progressContainer.style.display = "block";
      const percentage = (this.loadedImages / this.totalImages) * 100;
      progressBar.style.width = `${percentage}%`;

      if (this.loadedImages === this.totalImages) {
        // 로딩 완료 토스트
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
   * 불러오기 버튼의 진입점입니다.
   * 중복 클릭 방지, 기존 이미지 정리, 에러 핸들링을 담당합니다.
   */
  async handleLoadClick() {
    const galleryId = document.getElementById("gallery-id").value.trim().toLowerCase();
    if (!galleryId) {
      this.showToast("갤러리 ID를 입력하세요");
      return;
    }

    // dcbest면 모달 표시
    if (galleryId === "dcbest") {
      document.getElementById("dcbest-modal").classList.add("show");
      return;
    }

    await this.loadGallery(galleryId);
  }

  /**
   * DCBest 모달에서 확인 후 호출됩니다.
   */
  async loadDcbest() {
    await this.loadGallery("dcbest");
  }

  /**
   * 갤러리 데이터를 로드하는 공통 로직입니다.
   */
  async loadGallery(galleryId) {
    const articleCount = Math.min(
      Math.max(1, parseInt(document.getElementById("article-count").value, 10) || CONFIG.app.defaultArticleCount),
      CONFIG.app.maxArticleCount
    );
    const startPage = Math.max(1, parseInt(document.getElementById("start-page").value, 10) || 1);

    this.setLoadButtonState("loading");
    this.clearBoard();

    try {
      const imgBoardList = await this.fetchImageBoardData(galleryId, articleCount, startPage);
      await this.renderImageBoard(imgBoardList);
    } catch (error) {
      this.setLoadButtonState("error", error.message);
    }
  }

  /**
   * 갤러리 ID와 페이지 번호로 목록 URL을 생성합니다.
   * @param {string} galleryId - 갤러리 ID
   * @param {number} page - 페이지 번호 (기본값: 1)
   * @returns {string} 갤러리 URL
   */
  buildGalleryUrl(galleryId, page = 1) {
    if (galleryId === "dcbest") {
      return `${CONFIG.dcinside.baseUrl}/board/lists/?id=dcbest&page=${page}&_dcbest=${this.dcbestParam}`;
    } else {
      return `${CONFIG.dcinside.baseUrl}/mgallery/board/lists/?id=${galleryId}&page=${page}`;
    }
  }

  /**
   * CORS 프록시를 통해 외부 HTML을 가져옵니다.
   * 브라우저의 동일 출처 정책(Same-Origin Policy)으로 인해
   * DCInside 서버에 직접 요청할 수 없어 프록시가 필요합니다.
   * @param {string} proxyUrl - CORS 프록시 URL
   * @param {string} url - 가져올 페이지 URL
   * @param {boolean} convertLazyImages - lazy 이미지를 일반 이미지로 변환할지 여부
   * @returns {Promise<Document>} 파싱된 HTML Document
   */
  async getHTML(proxyUrl, url, convertLazyImages = false) {
    try {
      const res = await fetch(proxyUrl + url);
      if (!res.ok) {
        if (res.status === 404) {
          this.showToast("올바른 갤러리 ID를 입력하세요");
          return null;
        }
        throw new Error(`HTTP 오류! 상태: ${res.status}`);
      }
      const text = await res.text();
      const parser = new DOMParser();
      const html = parser.parseFromString(text, "text/html");

      /**
       * lazy 클래스 이미지들은 미리보기 이미지이고 data-src에 원본 주소가 없음
       * data-original에 원본 주소가 있으므로 data-src로 변경하여 로드
       */
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
      // 페이지 새로고침 등으로 요청이 중단된 경우 무시
      if (error.name === "AbortError" || error.message.includes("Failed to fetch")) {
        console.log("요청이 중단되었습니다.");
        return null;
      }
      throw new Error(`HTML을 가져오는 데 실패했습니다 (${url}): ${error.message}`);
    }
  }

  /**
   * 갤러리 ID에 맞는 게시글 셀렉터를 반환합니다.
   * dcbest는 별도 셀렉터, 그 외는 같은 셀렉터 사용.
   * @param {string} galleryId - 갤러리 ID
   * @returns {string} CSS 셀렉터
   */
  getArticleSelector(galleryId) {
    if (galleryId === "dcbest") {
      return CONFIG.dcinside.selectors.article.dcbest;
    } else {
      return CONFIG.dcinside.selectors.article.gallery;
    }
  }

  /**
   * HTML 문서에서 이미지가 있는 게시글 목록을 추출합니다.
   * @param {Document} html - 파싱된 HTML
   * @param {string} selector - 게시글 셀렉터
   * @returns {Array} 게시글 배열 [{title, url}]
   */
  extractArticlesFromHTML(html, selector) {
    const articles = html.querySelectorAll(selector);
    const articleList = [];
    articles.forEach((article) => {
      const title = article.innerText.trim();
      const href = article.getAttribute("href");
      articleList.push({ title, url: CONFIG.dcinside.baseUrl + href });
    });
    return articleList;
  }

  /**
   * 원하는 개수의 이미지 게시글을 수집할 때까지 페이지를 순회합니다.
   * @param {string} galleryId - 갤러리 ID
   * @param {number} targetCount - 수집할 게시글 수
   * @param {number} startPage - 시작 페이지
   * @returns {Promise<Array>} 게시글 목록
   */
  async getArticleList(galleryId, targetCount, startPage = 1) {
    const selector = this.getArticleSelector(galleryId);
    const allArticles = [];
    let currentPage = startPage;
    let emptyPageCount = 0;
    let isFirstPage = true;

    while (allArticles.length < targetCount && currentPage < startPage + CONFIG.app.maxPages) {
      const targetUrl = this.buildGalleryUrl(galleryId, currentPage);
      console.log(`페이지 ${currentPage} 조회 중...`);

      const html = await this.getHTML(CONFIG.proxyUrl, targetUrl, false);

      // 요청 중단 또는 404 - 첫 페이지면 조용히 종료 (토스트 이미 표시됨)
      if (!html) {
        if (isFirstPage) return [];
        break;
      }

      isFirstPage = false;
      const pageArticles = this.extractArticlesFromHTML(html, selector);

      if (pageArticles.length === 0) {
        emptyPageCount++;
        // 연속 3페이지 빈 페이지면 종료 (마지막 도달)
        if (emptyPageCount >= 3) {
          console.log("더 이상 게시글이 없습니다.");
          break;
        }
      } else {
        emptyPageCount = 0;
        // 필요한 만큼만 추가
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
   * 배열을 청크로 분할하여 동시 요청 수를 제한합니다.
   * 서버에 과부하를 주지 않고 안정적으로 데이터를 가져오기 위함입니다.
   * @param {Array} array - 분할할 배열
   * @param {number} chunkSize - 청크 크기
   * @returns {Array<Array>} 청크 배열
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 각 게시글 페이지를 방문하여 이미지/동영상 URL을 수집합니다.
   * 5개씩 배치 처리하여 서버 부하를 줄이고 순차적 진행을 보장합니다.
   * @param {string} proxyUrl - CORS 프록시 URL
   * @param {Array} articleList - 게시글 정보 배열
   * @returns {Promise<Array>} 미디어 목록이 포함된 게시글 배열
   */
  async getMediaList(proxyUrl, articleList) {
    const results = [];
    const chunks = this.chunkArray(articleList, CONFIG.app.concurrentRequests);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (article) => {
          console.log(`게시글 처리 중: ${article.title}`);
          const html = await this.getHTML(proxyUrl, article.url, true);

          // 요청 중단 시 빈 mediaList 반환
          if (!html) return { ...article, mediaList: [] };

          const mediaList = [];
          CONFIG.dcinside.selectors.media.forEach(({ selector, attr }) => {
            const elements = html.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`${elements.length}개의 미디어 요소를 찾았습니다 (노드):`, elements);
            }
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
          return { ...article, mediaList };
        })
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 게시글 목록 가져오기 → 미디어 URL 추출을 순차적으로 수행합니다.
   * @param {string} galleryId - 갤러리 ID
   * @param {number} articleCount - 수집할 게시글 수
   * @param {number} startPage - 시작 페이지
   */
  async fetchImageBoardData(galleryId, articleCount, startPage) {
    const articleList = await this.getArticleList(galleryId, articleCount, startPage);
    const imgBoardList = await this.getMediaList(CONFIG.proxyUrl, articleList);
    console.log("최종 이미지 보드 데이터:", imgBoardList);
    return imgBoardList;
  }

  /**
   * 이미지를 Blob으로 다운로드합니다.
   * Blob URL을 사용하면 외부 이미지도 crossorigin 제한 없이 표시할 수 있고,
   * 이미지가 완전히 로드된 후에만 DOM에 추가할 수 있습니다.
   */
  async fetchImageBlob(imageUrl) {
    const res = await fetch(CONFIG.proxyUrl + imageUrl);
    return res.blob();
  }

  /**
   * 이미지 카드 DOM 요소를 생성합니다.
   * 이미지가 완전히 로드된 후에만 resolve하여 레이아웃 깜빡임을 방지합니다.
   * Blob URL은 사용 후 메모리 누수 방지를 위해 해제합니다.
   * @param {Object} article - 게시글 정보 {title, url}
   * @param {Object} image - 이미지 정보 {url}
   * @returns {Promise<HTMLElement>} 이미지 카드 anchor 요소
   */
  async createImageCard(article, image) {
    const blob = await this.fetchImageBlob(image.url);
    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      // 수정: anchor에 masonry-item 클래스 추가
      const anchor = document.createElement("a");
      anchor.href = article.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "masonry-item";

      const container = document.createElement("div");
      container.className = "image-container";

      const imgElement = document.createElement("img");
      imgElement.alt = article.title;

      // 제목 오버레이
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
   * 수집된 이미지 데이터를 화면에 렌더링합니다.
   * 5개씩 배치 처리하여 점진적으로 화면에 표시하므로
   * 사용자가 전체 로딩을 기다리지 않고 먼저 로드된 이미지를 볼 수 있습니다.
   * @param {Array} imgBoardList - 이미지 데이터가 포함된 게시글 배열
   */
  async renderImageBoard(imgBoardList) {
    const board = document.getElementById("board");
    this.totalImages = imgBoardList.reduce((sum, article) => sum + article.mediaList.length, 0);
    this.loadedImages = 0;
    this.updateLoadingStatus();

    if (this.totalImages === 0) {
      this.setLoadButtonState("idle");
      return;
    }

    // 모든 이미지 작업을 플랫 리스트로 변환
    const allImages = [];
    imgBoardList.forEach((article) => {
      article.mediaList.forEach((image) => {
        allImages.push({ article, image });
      });
    });

    // 배치로 분할하여 순차 처리
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

      // 배치별로 DOM에 추가하여 점진적 렌더링
      validCards.forEach((card) => {
        board.appendChild(card);
      });

      this.msnry.appended(validCards);
      this.msnry.layout();
    }

    this.setLoadButtonState("idle");
  }

  /**
   * 새 이미지를 불러오기 전에 기존 이미지를 정리합니다.
   * Masonry에서 요소를 제거하고 상태를 초기화합니다.
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

  /**
   * 버튼 상태를 관리하여 중복 클릭을 방지하고 사용자에게 피드백을 제공합니다.
   * 에러 발생 시 alert로 메시지를 표시하고 idle 상태로 복원합니다.
   * @param {'loading'|'error'|'idle'} state - 버튼 상태
   * @param {string} message - 에러 메시지 (error 상태일 때)
   */
  setLoadButtonState(state, message = "") {
    const loadBtn = document.getElementById("load-btn");
    switch (state) {
      case "loading":
        loadBtn.textContent = "로딩 중...";
        loadBtn.disabled = true;
        break;
      case "error":
        alert(message);
        console.error(message);
        this.setLoadButtonState("idle");
        break;
      case "idle":
      default:
        loadBtn.textContent = "불러오기";
        loadBtn.disabled = false;
        break;
    }
  }
}

// 메인 실행 블록
document.addEventListener("DOMContentLoaded", () => {
  const imageBoard = new ImageBoard();
  imageBoard.init();

  // 페이지의 모든 리소스(CSS 포함)가 로드된 후 초기 레이아웃을 설정합니다.
  window.addEventListener("load", () => {
    imageBoard.updateLayout();
  });
});
