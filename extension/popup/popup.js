document.addEventListener("DOMContentLoaded", async () => {
  const siteBadge = document.getElementById("site-badge");
  const boardIdInput = document.getElementById("board-id");
  const loadBtn = document.getElementById("load-btn");
  const statusMsg = document.getElementById("status-msg");

  // 현재 탭 쿼리
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    setStatus("탭 정보를 읽을 수 없습니다.");
    return;
  }

  const url = new URL(tab.url);
  let site = null;
  let id = null;

  // 사이트 및 ID 감지
  if (url.hostname === "gall.dcinside.com") {
    site = "dcinside";
    id = url.searchParams.get("id");
  } else if (url.hostname === "arca.live") {
    site = "arcalive";
    // /b/channelId 패턴 추출
    const match = url.pathname.match(/^\/b\/([^\/\?]+)/);
    id = match ? match[1] : null;
  }

  // 감지 결과 반영
  if (site && id) {
    siteBadge.textContent = site === "dcinside" ? "디시인사이드" : "아카라이브";
    boardIdInput.value = id;
    loadBtn.disabled = false;
    setStatus("갤러리가 감지되었습니다.");

    // DCBest 감지 시 UI 표시
    if (id === "dcbest") {
      document.getElementById("dcbest-options").style.display = "block";
    }
  } else {
    siteBadge.textContent = "지원하지 않는 페이지";
    boardIdInput.value = "";
    loadBtn.disabled = true;
    setStatus("갤러리/채널 페이지에서 실행해주세요.");
  }

  // 입력 필드 유효성 검사
  setupInputValidation();

  function setupInputValidation() {
    const articleCountInput = document.getElementById("article-count");
    const startPageInput = document.getElementById("start-page");

    // 제한 설정
    const LIMITS = {
      articleCount: { min: 1, max: 500, default: 20 },
      startPage: { min: 1, max: 9999, default: 1 },
    };

    const validateInput = (input, min, max, defaultValue) => {
      let value = parseInt(input.value, 10);
      if (isNaN(value)) {
        value = defaultValue;
        setStatus(`기본값 ${defaultValue}(으)로 설정되었습니다.`);
      } else if (value < min) {
        value = min;
        setStatus(`최솟값 ${min}으로 설정되었습니다.`);
      } else if (value > max) {
        value = max;
        setStatus(`최댓값 ${max}으로 설정되었습니다.`);
      } else {
        setStatus("갤러리가 감지되었습니다."); // 정상 범위일 때 메시지 초기화
      }
      input.value = value;
    };

    // 게시글 수 검사
    const validateArticleCount = () => {
      validateInput(articleCountInput, LIMITS.articleCount.min, LIMITS.articleCount.max, LIMITS.articleCount.default);
    };
    articleCountInput.addEventListener("blur", validateArticleCount);
    articleCountInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        validateArticleCount();
        articleCountInput.blur(); // 포커스 해제하여 시각적 피드백
      }
    });

    // 시작 페이지 검사
    const validateStartPage = () => {
      validateInput(startPageInput, LIMITS.startPage.min, LIMITS.startPage.max, LIMITS.startPage.default);
    };
    startPageInput.addEventListener("blur", validateStartPage);
    startPageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        validateStartPage();
        startPageInput.blur();
      }
    });
  }

  // 불러오기 버튼 클릭 핸들러
  loadBtn.addEventListener("click", () => {
    const articleCount = document.getElementById("article-count").value;
    const startPage = document.getElementById("start-page").value;
    const head = document.getElementById("head-select").value;

    // 뷰어 URL 생성
    const viewerUrl = chrome.runtime.getURL("viewer/board.html");
    const params = new URLSearchParams({
      site: site,
      id: id,
      count: articleCount,
      page: startPage,
    });

    if (head) {
      params.append("head", head);
    }

    // DCBest 카테고리 파라미터 추가
    if (id === "dcbest") {
      const dcbestValue = Array.from(document.querySelectorAll('input[name="dcbest-cat"]:checked')).reduce(
        (sum, cb) => sum + parseInt(cb.value, 10),
        0
      );

      if (dcbestValue === 0) {
        setStatus("최소 1개 이상 선택하세요");
        return;
      }
      params.append("dcbest", dcbestValue);
    }

    // 새 탭으로 열기
    chrome.tabs.create({ url: `${viewerUrl}?${params.toString()}` });
  });

  // 말머리 로드 실행
  if (site && id) {
    loadHeads(site, id);
  }

  async function loadHeads(site, id) {
    const headSelect = document.getElementById("head-select");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    try {
      // 현재 탭에서 스크립트 실행하여 말머리 추출
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractHeadsFromDOM,
        args: [site],
      });

      const heads = results[0].result || [];

      // Dropdown 채우기
      headSelect.innerHTML = '<option value="">전체</option>';
      if (heads.length === 0) {
        const option = document.createElement("option");
        option.text = "말머리 없음";
        option.disabled = true;
        headSelect.add(option);
      } else {
        heads.forEach((h) => {
          const option = document.createElement("option");
          option.value = h.id;
          option.textContent = h.name;
          headSelect.add(option);
        });
      }
      headSelect.disabled = false;
    } catch (error) {
      console.error(error);
      headSelect.innerHTML = '<option value="">로드 실패</option>';
    }
  }

  // DOM 컨텍스트에서 실행될 함수
  function extractHeadsFromDOM(site) {
    const heads = [];
    const HEAD_SELECTORS = {
      dcinside: {
        main: ".center_box .inner > ul li a",
        more: "#subject_morelist ul li a",
      },
      arcalive: ".board-category-wrapper .board-category span.item a",
    };

    // dcinside
    if (site === "dcinside") {
      const { main, more } = HEAD_SELECTORS.dcinside;
      const extractHeadId = (onclick) => {
        const match = onclick?.match(/listSearchHead\((\d+)\)/);
        return match ? match[1] : null;
      };

      const extractFrom = (selector) => {
        document.querySelectorAll(selector).forEach((a) => {
          const id = extractHeadId(a.getAttribute("onclick"));
          const name = a.textContent.trim();
          if (id !== null && name) heads.push({ id, name });
        });
      };

      extractFrom(main);
      // 더보기 메뉴가 있는 경우
      extractFrom(more);
    }

    // arcalive
    if (site === "arcalive") {
      document.querySelectorAll(HEAD_SELECTORS.arcalive).forEach((a) => {
        const href = a.getAttribute("href") || "";
        const name = a.textContent.trim();
        // "/b/channel?category=공지" -> "공지"
        const match = href.match(/[?&]category=([^&]+)/);
        const id = match ? decodeURIComponent(match[1]) : "";

        if (name && !heads.some((h) => h.id === id)) {
          heads.push({ id, name });
        }
      });
    }

    return heads;
  }

  function setStatus(msg) {
    statusMsg.textContent = msg;
  }
});
