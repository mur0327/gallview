const CONFIG = {
  // config.local.js가 있으면 해당 값 사용, 없으면 기본값
  proxyUrl: typeof LOCAL_CONFIG !== "undefined" ? LOCAL_CONFIG.proxyUrl : "http://localhost:8080/",
  dcinside: {
    baseUrl: "https://gall.dcinside.com",
    imageBaseUrl: "https://images.dcinside.com/viewimage.php",
    selectors: {
      article: {
        dcbest: ".ub-content.us-post.thum .gall_tit.ub-word a:not(.reply_numbox)",
        // 기본: 이미지 게시글 + 개념글 모두 포함
        gallery:
          '.ub-content.us-post[data-type="icon_pic"] .gall_tit.ub-word a:not(.reply_numbox), .ub-content.us-post[data-type="icon_recomimg"] .gall_tit.ub-word a:not(.reply_numbox)',
        // 개념글만
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
      // 말머리 추출용 셀렉터
      head: {
        main: ".center_box .inner > ul li a",
        more: "#subject_morelist ul li a",
      },
    },
  },
  arcalive: {
    baseUrl: "https://arca.live",
    selectors: {
      // 기본: 이미지 게시글 + 베스트 게시글 모두 포함
      article: "a.vrow:has(span.ion-ios-photos-outline), a.vrow:has(span.ion-android-star)",
      // 베스트만
      articleBest: "a.vrow:has(span.ion-android-star)",
      media: [
        {
          selector: ".article-body .fr-view.article-content img[src*='namu.la']:not(.arca-emoticon)",
          attr: "src",
        },
      ],
      head: ".board-category-wrapper .board-category span.item a",
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
    this.category = ""; // 말머리/카테고리 필터 ID (빈 문자열 = 전체)
    this.categoryName = ""; // 말머리/카테고리 필터 이름
    this.currentSite = "dcinside"; // 디시인사이드만 지원
    this.recommendOnly = false; // 개념글만 필터
  }

  /**
   * 라디오 버튼 상태로 현재 선택된 사이트를 반환합니다.
   * @returns {"dcinside" | "arcalive"} 현재 사이트
   */
  getCurrentSite() {
    const selected = document.querySelector('input[name="site"]:checked');
    return selected?.value || "dcinside";
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

    // Masonry 초기화 - percentPosition으로 반응형 레이아웃 (공식 권장)
    // gutter는 CSS margin으로 처리
    this.msnry = new Masonry(board, {
      itemSelector: ".masonry-item",
      columnWidth: ".grid-sizer",
      percentPosition: true,
      transitionDuration: 0,
    });

    // 이벤트 리스너 설정
    columnSelector.addEventListener("change", () => this.updateLayout());
    window.addEventListener("resize", () => this.updateLayout());

    document.getElementById("load-btn").addEventListener("click", () => this.handleLoadClick());
    document.getElementById("clear-btn").addEventListener("click", () => this.clearBoard());

    // 스크롤 시 헤더 자동 숨김
    this.setupHeaderAutoHide();

    // 입력 필드 유효성 검사
    this.setupInputValidation();

    // dcbest 모달 설정
    this.setupDcbestModal();

    // 말머리 선택 모달 설정
    this.setupHeadModal();

    // 초기 레이아웃 설정
    this.updateLayout();
  }

  /**
   * 스크롤 시 헤더 자동 숨김/표시
   * 스크롤 다운 시 숨기고, 스크롤 업 시 표시
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
   * dcbest 카테고리 선택 모달을 설정합니다.
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
   * 말머리 선택 모달을 설정합니다.
   */
  setupHeadModal() {
    const modal = document.getElementById("head-modal");
    const confirmBtn = document.getElementById("head-modal-confirm");
    const cancelBtn = document.getElementById("head-modal-cancel");
    const overlay = modal.querySelector(".modal-overlay");

    // 확인 버튼 → 말머리 선택 후 갤러리 로드
    confirmBtn.addEventListener("click", () => {
      const selected = modal.querySelector('input[name="modal-search-head"]:checked');
      if (selected) {
        this.category = selected.value;
        this.categoryName = selected.nextElementSibling.textContent.trim();
      }
      modal.classList.remove("show");

      // 저장된 갤러리/채널 ID로 로드
      const id = document.getElementById("board-id").value.trim().toLowerCase();
      this.loadGallery(id);
    });

    // 취소 버튼
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("show");
    });

    // 오버레이 클릭으로 닫기
    overlay.addEventListener("click", () => {
      modal.classList.remove("show");
    });
  }

  /**
   * 말머리 선택 모달을 열고 갤러리/채널에서 말머리를 로드합니다.
   * @param {string} id - 갤러리/채널 ID
   */
  async openHeadModal(id) {
    const modal = document.getElementById("head-modal");
    const loading = document.getElementById("head-modal-loading");
    const options = document.getElementById("head-modal-options");

    // 현재 사이트 설정
    this.currentSite = this.getCurrentSite();

    // 모달 표시 (로딩 상태)
    modal.classList.add("show");
    loading.style.display = "block";
    options.style.display = "none";
    options.innerHTML = "";
    options.scrollTop = 0; // 스크롤 초기화

    try {
      // 갤러리/채널 첫 페이지에서 말머리 추출
      const targetUrl = this.buildListUrl(id, 1);
      const html = await this.getHTML(CONFIG.proxyUrl, targetUrl, false);

      if (!html) {
        modal.classList.remove("show");
        return;
      }

      const heads = this.extractHeadsFromHTML(html);
      this.populateHeadModal(heads);

      loading.style.display = "none";
      options.style.display = "block";
    } catch (error) {
      console.error("말머리 로드 실패:", error);
      this.showToast("말머리를 불러오는데 실패했습니다");
      modal.classList.remove("show");
    }
  }

  /**
   * 갤러리/채널 페이지에서 말머리 목록을 추출합니다.
   * @param {Document} html - 파싱된 갤러리/채널 페이지 HTML
   * @returns {Array} 말머리 배열 [{id, name}]
   */
  extractHeadsFromHTML(html) {
    const heads = [];

    // DCInside
    if (this.currentSite === "dcinside") {
      const { main, more } = CONFIG.dcinside.selectors.head;

      // onclick="listSearchHead(숫자)"에서 숫자 추출
      const extractHeadId = (onclick) => {
        const match = onclick?.match(/listSearchHead\((\d+)\)/);
        return match ? match[1] : null;
      };

      // 메인 말머리
      html.querySelectorAll(main).forEach((a) => {
        const id = extractHeadId(a.getAttribute("onclick"));
        const name = a.textContent.trim();
        if (id !== null && name) {
          heads.push({ id, name });
        }
      });

      // 더보기 말머리
      html.querySelectorAll(more).forEach((a) => {
        const id = extractHeadId(a.getAttribute("onclick"));
        const name = a.textContent.trim();
        if (id !== null && name) {
          heads.push({ id, name });
        }
      });
    }

    // Arca.live
    if (this.currentSite === "arcalive") {
      html.querySelectorAll(CONFIG.arcalive.selectors.head).forEach((a) => {
        const href = a.getAttribute("href") || "";
        const name = a.textContent.trim();

        // "/b/nikketgv?category=공지" → "공지"
        const match = href.match(/[?&]category=([^&]+)/);
        const id = match ? decodeURIComponent(match[1]) : "";

        if (name && !heads.some((h) => h.id === id)) {
          heads.push({ id, name });
        }
      });
    }

    return heads;
  }

  /**
   * 말머리 모달 옵션을 채웁니다.
   * @param {Array} heads - 말머리 배열 [{id, name}]
   */
  populateHeadModal(heads) {
    const options = document.getElementById("head-modal-options");

    // 말머리가 없으면 메시지 표시
    if (heads.length === 0) {
      options.innerHTML = '<div class="modal-loading">이 갤러리/채널에는 말머리가 없습니다</div>';
      return;
    }

    // 옵션 생성 함수
    const createOption = (id, name, checked = false) => {
      const label = document.createElement("label");
      label.className = "head-option";
      label.innerHTML = `
        <input type="radio" name="modal-search-head" value="${id}" ${checked ? "checked" : ""} />
        <span>${name}</span>
      `;
      return label;
    };

    // 단일 그룹에 모든 옵션 추가
    const group = document.createElement("div");
    group.className = "head-group";

    // "전체" 옵션 (디시인사이드만 - 아카라이브는 첫 번째 카테고리가 이미 전체)
    if (this.currentSite === "dcinside") {
      const isAllSelected = this.category === "";
      group.appendChild(createOption("", "전체", isAllSelected));
    }

    // 모든 말머리 추가
    heads.forEach((h) => {
      const isChecked =
        this.currentSite === "arcalive" && this.category === ""
          ? h === heads[0] // 아카라이브: 첫 번째 옵션이 기본 선택
          : this.category === h.id;
      group.appendChild(createOption(h.id, h.name, isChecked));
    });

    options.appendChild(group);
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
      progressContainer.classList.add("show");
      const percentage = (this.loadedImages / this.totalImages) * 100;
      progressBar.style.width = `${percentage}%`;

      if (this.loadedImages === this.totalImages) {
        // 로딩 완료 토스트
        statusEl.textContent = "로딩 완료 ✅";
        setTimeout(() => {
          statusEl.style.display = "none";
          progressContainer.classList.remove("show");
          progressBar.style.width = "0%";
        }, 3000);
      }
    } else {
      statusEl.style.display = "none";
      progressContainer.classList.remove("show");
      progressBar.style.width = "0%";
    }
  }

  /**
   * 불러오기 버튼의 진입점입니다.
   * 중복 클릭 방지, 기존 이미지 정리, 에러 핸들링을 담당합니다.
   */
  async handleLoadClick() {
    const id = document.getElementById("board-id").value.trim().toLowerCase();
    if (!id) {
      this.showToast("갤러리/채널 ID를 입력하세요");
      return;
    }

    // 현재 사이트 설정
    this.currentSite = this.getCurrentSite();

    // 개념글만 체크박스 상태 저장
    this.recommendOnly = document.getElementById("recommend-only").checked;

    // DCInside dcbest면 dcbest 모달 표시
    if (this.currentSite === "dcinside" && id === "dcbest") {
      document.getElementById("dcbest-modal").classList.add("show");
      return;
    }

    // 말머리 선택 모달 표시
    await this.openHeadModal(id);
  }

  /**
   * dcbest 모달에서 확인 후 호출됩니다.
   */
  async loadDcbest() {
    this.currentSite = "dcinside";
    await this.loadGallery("dcbest");
  }

  /**
   * 갤러리/채널 데이터를 로드하는 공통 로직입니다.
   */
  async loadGallery(id) {
    const articleCount = Math.min(
      Math.max(1, parseInt(document.getElementById("article-count").value, 10) || CONFIG.app.defaultArticleCount),
      CONFIG.app.maxArticleCount
    );
    const startPage = Math.max(1, parseInt(document.getElementById("start-page").value, 10) || 1);

    // 설정 정보 로그
    console.log("%c========== 크롤링 시작 ==========", "color: #4CAF50; font-weight: bold;");
    console.log("%c📋 설정 정보", "color: #2196F3; font-weight: bold;");
    console.log(`  사이트: ${this.currentSite}`);
    console.log(`  ID: ${id}`);
    console.log(`  게시글 수: ${articleCount}`);
    console.log(`  시작 페이지: ${startPage}`);
    console.log(`  말머리: ${this.category === "" ? "전체" : `${this.categoryName} (${this.category})`}`);
    console.log(`  개념글만: ${this.recommendOnly ? "예" : "아니오"}`);
    if (id === "dcbest") {
      console.log(`  dcbest 카테고리: ${this.dcbestParam}`);
    }
    console.log("");

    this.setLoadButtonState("loading");
    this.clearBoard();

    try {
      const imgBoardList = await this.fetchImageBoardData(id, articleCount, startPage);
      await this.renderImageBoard(imgBoardList);
    } catch (error) {
      this.setLoadButtonState("error", error.message);
    }
  }

  /**
   * 사이트별 게시글 목록 URL을 생성합니다.
   * @param {string} id - 갤러리/채널 ID
   * @param {number} page - 페이지 번호 (기본값: 1)
   * @returns {string} 목록 URL
   */
  buildListUrl(id, page = 1) {
    // dcinside
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

    // arcalive (파라미터 순서: category → mode → p)
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
   * 갤러리/채널 ID에 맞는 게시글 셀렉터를 반환합니다.
   * @param {string} id - 갤러리/채널 ID
   * @returns {string} CSS 셀렉터
   */
  getArticleSelector(id) {
    // DCInside
    if (this.currentSite === "dcinside") {
      if (id === "dcbest") {
        return CONFIG.dcinside.selectors.article.dcbest;
      }
      return this.recommendOnly
        ? CONFIG.dcinside.selectors.article.recommend
        : CONFIG.dcinside.selectors.article.gallery;
    }

    // Arca.live
    if (this.currentSite === "arcalive") {
      return this.recommendOnly ? CONFIG.arcalive.selectors.articleBest : CONFIG.arcalive.selectors.article;
    }

    return "";
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

    // DCInside
    if (this.currentSite === "dcinside") {
      articles.forEach((article) => {
        const title = article.innerText.trim();
        const href = article.getAttribute("href");
        articleList.push({ title, url: CONFIG.dcinside.baseUrl + href });
      });
    }

    // Arca.live: a.vrow 요소에서 href와 title 추출
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
   * 원하는 개수의 이미지 게시글을 수집할 때까지 페이지를 순회합니다.
   * @param {string} id - 갤러리/채널 ID
   * @param {number} targetCount - 수집할 게시글 수
   * @param {number} startPage - 시작 페이지
   * @returns {Promise<Array>} 게시글 목록
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

    console.log("%c📷 게시글별 이미지 수집", "color: #9C27B0; font-weight: bold;");

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (article) => {
          // dcinside는 lazy 이미지 변환 필요, arcalive는 불필요
          const html = await this.getHTML(proxyUrl, article.url, this.currentSite === "dcinside");

          // 요청 중단 시 빈 mediaList 반환
          if (!html) return { ...article, mediaList: [] };

          const mediaList = [];

          // dcinside
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

          // arcalive: img 태그의 src는 미리보기 이미지(webp) URL
          // a 태그의 href는 원본 이미지(png) URL
          // fetch시 a 태그가 없어서 img 태그 사용함
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

      // 청크 완료 후 순서대로 로그 출력
      chunkResults.forEach((result) => {
        console.log(`📄 ${result.title} (${result.mediaList.length}개)`, result.url);
      });

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

    // 총 이미지 개수 계산 및 로그
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
