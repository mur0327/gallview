/**
 * Gallview Background Service Worker
 * 우클릭 컨텍스트 메뉴를 통해 현재 페이지의 이미지를 뷰어에서 표시합니다.
 */

// 확장 프로그램 설치/업데이트 시 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gallview-open",
    title: "Gallview로 열기",
    contexts: ["page"],
    documentUrlPatterns: [
      "https://gall.dcinside.com/mgallery/*",
      "https://gall.dcinside.com/board/*",
      "https://arca.live/b/*",
    ],
  });
});

/**
 * URL이 게시글 목록 페이지인지 확인
 * @returns {boolean} 목록 페이지면 true, 게시글 상세면 false
 */
function isListPage(url) {
  try {
    const parsed = new URL(url);

    // dcinside: no 파라미터가 있으면 게시글 상세
    if (parsed.hostname === "gall.dcinside.com") {
      if (parsed.searchParams.get("no")) return false;
      if (parsed.searchParams.get("id") === "dcbest") return false;
      return true;
    }

    // arcalive: /b/channelId/숫자 형식이면 게시글 상세
    if (parsed.hostname === "arca.live") {
      const articleMatch = parsed.pathname.match(/^\/b\/[^\/]+\/(\d+)/);
      if (articleMatch) return false;
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 탭 URL에 따라 컨텍스트 메뉴 표시/숨김
 */
function updateMenuVisibility(tabId, url) {
  const visible = isListPage(url);
  chrome.contextMenus.update("gallview-open", { visible });
}

// 탭 활성화 시 메뉴 업데이트
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      updateMenuVisibility(tab.id, tab.url);
    }
  } catch {
    // 탭 접근 불가 시 무시
  }
});

// 탭 URL 변경 시 메뉴 업데이트
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateMenuVisibility(tabId, changeInfo.url);
  }
});

// 컨텍스트 메뉴 클릭 핸들러
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "gallview-open") return;

  const url = new URL(tab.url);
  let site = null;
  let id = null;
  let page = 1;
  let head = "";
  let recommend = false;

  // dcinside 파싱
  if (url.hostname === "gall.dcinside.com") {
    site = "dcinside";
    id = url.searchParams.get("id");
    page = parseInt(url.searchParams.get("page"), 10) || 1;
    head = url.searchParams.get("search_head") || "";
    recommend = url.searchParams.get("exception_mode") === "recommend";
  }

  // arcalive 파싱
  if (url.hostname === "arca.live") {
    site = "arcalive";
    const pathMatch = url.pathname.match(/^\/b\/([^\/\?]+)/);
    id = pathMatch ? pathMatch[1] : null;
    page = parseInt(url.searchParams.get("p"), 10) || 1;
    head = url.searchParams.get("category") || "";
    recommend = url.searchParams.get("mode") === "best";
  }

  // 유효성 검사
  if (!site || !id) return;

  // 현재 페이지의 이미지 게시글 수 추출 (최대 20개)
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (site) => {
      const selectors = {
        // viewer/board.js CONFIG와 동일한 셀렉터 사용
        dcinside:
          '.ub-content.us-post[data-type="icon_pic"] .gall_tit.ub-word a:not(.reply_numbox), .ub-content.us-post[data-type="icon_recomimg"] .gall_tit.ub-word a:not(.reply_numbox)',
        arcalive: "a.vrow:has(span.ion-ios-photos-outline), a.vrow:has(span.ion-android-star)",
      };
      const articles = document.querySelectorAll(selectors[site]);
      return Math.min(articles.length, 20);
    },
    args: [site],
  });

  const count = result.result || 20;

  // 뷰어 URL 생성
  const viewerUrl = chrome.runtime.getURL("viewer/board.html");
  const params = new URLSearchParams({
    site,
    id,
    count: count.toString(),
    page: page.toString(),
  });

  if (head) {
    params.append("head", head);
  }

  if (recommend) {
    params.append(site === "dcinside" ? "recommend" : "best", "true");
  }

  // 새 탭으로 뷰어 열기
  chrome.tabs.create({ url: `${viewerUrl}?${params.toString()}` });
});
