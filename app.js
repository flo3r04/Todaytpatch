const gameData = window.todaypatchGameData?.aion2 || {};
const newsItems = Array.isArray(gameData.newsItems) ? gameData.newsItems : [];
const latestItem = (sourceKey) => newsItems.find((item) => item.sourceKey === sourceKey);
const taskItems = [
  { id: "read-latest-notice", title: "최신 공지 확인하기", item: latestItem("notice") },
  { id: "read-latest-update", title: "최신 업데이트 확인하기", item: latestItem("update") },
  { id: "read-latest-cm-story", title: "최신 CM 이야기 확인하기", item: latestItem("cm-story") },
];

const categories = ["전체", "공지", "업데이트", "CM 이야기"];
const game = { id: "aion2", name: "아이온2", aliases: "aion2 아이온2", icon: "./assets/aion2-logo.png", route: "#/aion2" };
const gameCatalog = [
  game,
  { id: "dokkaebi-world", name: "도깨비의 세계", icon: "./assets/dokkaebi-world.png", route: "#/game/dokkaebi-world" },
  { id: "temppal", name: "템빨", icon: "./assets/temppal.png", route: "#/game/temppal", upcoming: true },
];
const state = { filter: "전체", query: "", gameQuery: "", gameSearchFocused: false, notificationsOpen: false, discoveryView: "other", tutorialStep: 0, tutorialShownInSession: false };
const app = document.querySelector("#app");

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The page remains usable when browser storage is disabled.
  }
}

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = safeTheme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = safeTheme === "dark" ? "#0d1420" : "#f7f8fb";
}

applyTheme(readStorage("todaypatch.theme", "light"));

const savedTasks = () => readStorage("todaypatch.tasks", {});
const savedNews = () => readStorage("todaypatch.bookmarks", []);
const userPosts = () => {
  const posts = readStorage("todaypatch.userPosts", []);
  return Array.isArray(posts) ? posts.filter((post) => post && typeof post.id === "string" && typeof post.title === "string" && typeof post.body === "string") : [];
};
const readNews = () => {
  const ids = readStorage("todaypatch.readNews", []);
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
};
const followedGameIds = () => readStorage("todaypatch.followedGames", []);
const recentGameSearches = () => {
  const searches = readStorage("todaypatch.recentGameSearches", []);
  return Array.isArray(searches) ? searches.filter((query) => typeof query === "string") : [];
};
const isSaved = (id) => savedNews().includes(id);
const isRead = (id) => readNews().includes(id);
const isGameFollowed = (id) => followedGameIds().includes(id);
const storedNotifications = () => {
  const notifications = readStorage("todaypatch.notifications", []);
  return Array.isArray(notifications) ? notifications.filter((item) => item && typeof item.id === "string" && typeof item.title === "string") : [];
};

function knownNewsByGame() {
  const known = readStorage("todaypatch.knownNewsByGame", {});
  return known && typeof known === "object" && !Array.isArray(known) ? known : {};
}

function rememberCurrentGameNews(gameId) {
  if (gameId !== game.id) return;
  const known = knownNewsByGame();
  known[gameId] = [...new Set([...(Array.isArray(known[gameId]) ? known[gameId] : []), ...newsItems.map((item) => item.id)])].slice(-1000);
  writeStorage("todaypatch.knownNewsByGame", known);
}

function notifyBrowserOfNewPosts(items) {
  if (!readStorage("todaypatch.browserNotifications", false) || !("Notification" in window) || Notification.permission !== "granted" || !items.length) return;
  const latest = items[0];
  try {
    const notification = new Notification("아이온2 새 소식", {
      body: items.length > 1 ? `${latest.title} 외 ${items.length - 1}건` : latest.title,
      icon: "./assets/aion2-logo.png",
      tag: "todaypatch-aion2-news",
    });
    notification.onclick = () => {
      window.focus();
      window.location.hash = `#/aion2/news/${encodeURIComponent(latest.id)}`;
      notification.close();
    };
  } catch {
    // In-app notifications remain available when desktop notifications are unavailable.
  }
}

function syncFollowedNewsNotifications() {
  if (!followedGameIds().includes(game.id)) return;
  const known = knownNewsByGame();
  const currentIds = newsItems.map((item) => item.id);
  if (!Array.isArray(known[game.id])) {
    known[game.id] = [...new Set(currentIds)].slice(-1000);
    writeStorage("todaypatch.knownNewsByGame", known);
    return;
  }
  const knownIds = new Set(known[game.id]);
  const newPosts = newsItems.filter((item) => !knownIds.has(item.id));
  known[game.id] = [...new Set([...known[game.id], ...currentIds])].slice(-1000);
  writeStorage("todaypatch.knownNewsByGame", known);
  if (!newPosts.length) return;

  const notifications = storedNotifications();
  const existingIds = new Set(notifications.map((item) => item.id));
  const added = newPosts.filter((item) => !existingIds.has(item.id)).map((item) => ({
    id: item.id,
    gameId: game.id,
    title: item.title,
    category: item.category,
    date: item.date,
    url: item.url,
    createdAt: new Date().toISOString(),
    read: false,
  }));
  if (!added.length) return;
  writeStorage("todaypatch.notifications", [...added, ...notifications].slice(0, 100));
  notifyBrowserOfNewPosts(added);
}

function markNewsAsRead(id) {
  if (!id || isRead(id)) return;
  writeStorage("todaypatch.readNews", [...readNews(), id]);
}

function rememberGameSearch(query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return;
  const searches = recentGameSearches().filter((item) => item.toLocaleLowerCase("ko-KR") !== normalizedQuery.toLocaleLowerCase("ko-KR"));
  writeStorage("todaypatch.recentGameSearches", [normalizedQuery, ...searches].slice(0, 5));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatDisplayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}. ${part("month")}. ${part("day")}.`;
}

function currentRoute() {
  return window.location.hash || "#/";
}

function routeParts(route = currentRoute()) {
  return route.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function routeKind(route = currentRoute()) {
  const parts = routeParts(route);
  if (!parts.length) return "home";
  if (parts[0] === "dashboard") return "dashboard";
  if (parts[0] === "game" && gameCatalog.some((item) => item.id === parts[1])) return "game-hub";
  if (parts[0] === "aion2") {
    if (parts[1] === "news" && parts[2]) return "detail";
    if (["news", "notices", "updates", "cm-stories", "tasks", "bookmarks"].includes(parts[1])) return parts[1];
    return "game-home";
  }
  return "home";
}

function detailId() {
  const parts = routeParts();
  return parts[0] === "aion2" ? parts[2] : undefined;
}

function renderNotificationControl() {
  const notifications = storedNotifications();
  const unreadCount = notifications.filter((item) => !item.read).length;
  const browserSupported = "Notification" in window;
  const browserPermission = browserSupported ? Notification.permission : "unsupported";
  const browserEnabled = readStorage("todaypatch.browserNotifications", false);
  const browserSetting = !browserSupported
    ? `<span class="notification-setting-note">이 브라우저는 데스크톱 알림을 지원하지 않습니다.</span>`
    : browserPermission === "denied"
      ? `<span class="notification-setting-note">브라우저 설정에서 알림 권한을 허용해 주세요.</span>`
      : `<button class="notification-setting-button" type="button" data-action="toggle-browser-notifications">브라우저 알림 ${browserEnabled ? "끄기" : "켜기"}</button>`;
  const list = notifications.length
    ? `<div class="notification-list">${notifications.slice(0, 30).map((item) => {
      const exists = newsItems.some((news) => news.id === item.id);
      const href = exists ? `#/aion2/news/${encodeURIComponent(item.id)}` : item.url;
      const target = exists ? "" : 'target="_blank" rel="noopener noreferrer"';
      return `<a class="notification-item ${item.read ? "read" : "unread"}" href="${escapeHTML(href)}" ${target} data-action="open-notification" data-id="${escapeHTML(item.id)}"><span class="notification-dot" aria-hidden="true"></span><span class="notification-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.gameId === game.id ? game.name : item.gameId)} · ${escapeHTML(item.category || "새 소식")} · ${escapeHTML(item.date || "")}</small></span></a>`;
    }).join("")}</div>`
    : `<div class="notification-empty"><strong>새 알림이 없습니다.</strong><p>팔로우한 게임의 새 글은 크롤링 후 페이지를 방문하면 여기에 표시됩니다.</p></div>`;

  return `<div class="notification-wrap">
    <button id="notification-toggle" class="notification-toggle" type="button" data-action="toggle-notifications" aria-label="알림${unreadCount ? `, 읽지 않은 알림 ${unreadCount}개` : ""}" aria-expanded="${state.notificationsOpen}" title="알림">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 9h17C20.5 16 18 16 18 9Zm-8.2 12h4.4"/></svg>
      <span class="notification-count" ${unreadCount ? "" : "hidden"}>${unreadCount > 99 ? "99+" : unreadCount}</span>
    </button>
    <section class="notification-popover" aria-label="알림 목록" ${state.notificationsOpen ? "" : "hidden"}>
      <div class="notification-heading"><h2>알림</h2><button type="button" data-action="mark-all-notifications-read" ${unreadCount ? "" : "disabled"}>모두 읽음</button></div>
      <div class="notification-settings"><span>새 소식을 브라우저에서도 알림</span>${browserSetting}</div>
      ${list}
    </section>
  </div>`;
}

function renderHeader() {
  const kind = routeKind();
  const inGame = !["home", "dashboard", "game-hub"].includes(kind);
  const selectedGame = kind === "game-hub" ? gameCatalog.find((item) => item.id === routeParts()[1]) : null;
  const isDark = document.documentElement.dataset.theme === "dark";
  const themeLabel = isDark ? "라이트 모드" : "다크 모드";
  const themeIcon = isDark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.7 8.7 0 1 0 20.4 15.2Z"/></svg>';
  const links = [
    ["개요", "#/aion2", "game-home"],
    ["전체 소식", "#/aion2/news", "news"],
    ["공지", "#/aion2/notices", "notices"],
    ["업데이트", "#/aion2/updates", "updates"],
    ["CM 이야기", "#/aion2/cm-stories", "cm-stories"],
    ["할 일", "#/aion2/tasks", "tasks"],
    ["북마크", "#/aion2/bookmarks", "bookmarks"],
  ];
  const detailItem = kind === "detail" ? newsItems.find((item) => item.id === detailId()) : null;
  const activeDetailRoute = { notice: "notices", update: "updates", "cm-story": "cm-stories" }[detailItem?.sourceKey];

  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/" aria-label="오늘의 패치 게임 검색">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span>오늘의 패치</span>
        </a>
        ${inGame ? `<a class="header-game" href="#/aion2"><span class="header-divider" aria-hidden="true"></span>아이온2</a>
          <button class="mobile-menu-button" data-action="mobile-menu" aria-label="게임 메뉴 열기" aria-expanded="false">☰</button>
          <nav class="main-nav" id="main-nav" aria-label="아이온2 메뉴">
            ${links.map(([label, href, route]) => `<a class="nav-link ${kind === route || (kind === "detail" && route === activeDetailRoute) ? "active" : ""}" href="${href}" ${kind === route || (kind === "detail" && route === activeDetailRoute) ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
          </nav>` : `<span class="header-caption">${escapeHTML(selectedGame?.name || "게임별 소식을 한곳에서")}</span>`}
        <div class="header-controls ${inGame ? "in-game" : ""}">
          <button class="theme-toggle" type="button" data-action="toggle-theme" aria-label="${themeLabel}로 전환" title="${themeLabel}로 전환">${themeIcon}<span>${themeLabel}</span></button>
          ${renderNotificationControl()}
          <a class="dashboard-link ${kind === "dashboard" ? "active" : ""}" href="#/dashboard" ${kind === "dashboard" ? 'aria-current="page"' : ""} aria-label="대시보드"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5"/></svg><span>대시보드</span></a>
        </div>
      </div>
    </header>`;
}

function renderHome() {
  return `
    <main class="home-page">
      <section class="home-search" aria-labelledby="home-title">
        <h1 id="home-title">어떤 게임을 찾으세요?</h1>
        <p>패치노트, 공지, 업데이트, 공략 글을 한 곳에서 확인해 보세요.</p>
        <label class="search-field game-search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input id="game-search" type="search" value="${escapeHTML(state.gameQuery)}" placeholder="게임 이름 검색" autocomplete="off" aria-label="게임 이름 검색" />
        </label>
        <div class="game-results" id="game-results" aria-live="polite"></div>
      </section>
      ${renderFollowedGames()}
      <section class="home-guide" aria-labelledby="home-guide-title">
        <div class="home-guide-heading">
          <div><span class="home-guide-eyebrow">QUICK GUIDE</span><h2 id="home-guide-title">이용 방법</h2></div>
          <button class="secondary-button" type="button" data-action="open-tutorial">튜토리얼 보기</button>
        </div>
      </section>
    </main>`;
}

function renderFollowedGames() {
  const followedGames = gameCatalog.filter((item) => isGameFollowed(item.id));
  const otherGames = gameCatalog.filter((item) => !item.upcoming && !isGameFollowed(item.id));
  const upcomingGames = gameCatalog.filter((item) => item.upcoming && !isGameFollowed(item.id));
  const activeDiscovery = state.discoveryView === "upcoming"
    ? { title: "곧 출시하는 게임", items: upcomingGames, empty: "현재 출시 예정 게임이 없습니다." }
    : { title: "다른 게임", items: otherGames, empty: "팔로우할 게임이 없습니다." };
  return `
    <section class="home-following" aria-labelledby="home-following-title">
      <div class="home-following-heading"><div><span class="home-guide-eyebrow">YOUR GAMES</span><h2 id="home-following-title">팔로우한 게임</h2></div></div>
      <div class="home-following-layout">
        <section class="home-game-panel followed-panel" aria-label="내가 팔로우한 게임">
          <div class="home-game-panel-heading"><h3>내 게임</h3><span>${followedGames.length}개</span></div>
          <div class="discovery-tabs followed-tabs" aria-label="팔로우 게임 종류"><span class="discovery-tab active" aria-current="true">팔로우 중</span></div>
          <div class="game-list-box followed-list-box" aria-label="팔로우한 게임 목록">
            ${followedGames.length ? `<div class="followed-game-grid">${followedGames.map((item) => renderGameTile(item, "remove")).join("")}</div>` : `<div class="game-list-empty"><span class="following-empty-icon" aria-hidden="true">＋</span><p><strong>아직 팔로우한 게임이 없어요.</strong><br />오른쪽 게임 목록에서 추가해 보세요.</p></div>`}
          </div>
        </section>
        <section class="home-game-panel discover-panel" aria-label="팔로우할 게임과 출시 예정 게임">
          <div class="home-game-panel-heading"><h3>게임 둘러보기</h3></div>
          <div class="discovery-tabs" role="tablist" aria-label="둘러볼 게임 종류">
            <button type="button" role="tab" aria-selected="${state.discoveryView === "other"}" class="discovery-tab ${state.discoveryView === "other" ? "active" : ""}" data-action="select-discovery-view" data-view="other">다른 게임</button>
            <button type="button" role="tab" aria-selected="${state.discoveryView === "upcoming"}" class="discovery-tab ${state.discoveryView === "upcoming" ? "active" : ""}" data-action="select-discovery-view" data-view="upcoming">곧 출시하는 게임</button>
          </div>
          <div class="discovery-content" role="tabpanel" aria-live="polite" aria-label="${activeDiscovery.title}">
            <div class="game-list-box discovery-list-box">${renderGameDiscoveryList(activeDiscovery.items, activeDiscovery.empty)}</div>
          </div>
        </section>
      </div>
    </section>`;
}

function closeFollowContextMenu() {
  app.querySelector(".follow-context-menu")?.remove();
}

function renderGameTile(item, menuMode) {
  const status = item.upcoming ? '<small class="discovery-game-status">출시 예정</small>' : "";
  const actionHint = menuMode === "add" ? "우클릭 또는 길게 눌러 팔로우" : "우클릭 또는 길게 눌러 팔로우 해제";
  return `<a class="followed-game-tile ${menuMode === "add" ? "discovery-game-tile" : ""}" href="${escapeHTML(item.route)}" data-game-menu="${menuMode}" data-game-id="${escapeHTML(item.id)}" title="${escapeHTML(item.name)} 열기 · ${actionHint}"><span class="followed-game-icon"><img src="${escapeHTML(item.icon)}" alt="" /></span><span class="followed-game-name">${escapeHTML(item.name)}</span>${status}</a>`;
}

function renderGameDiscoveryList(items, emptyMessage) {
  return items.length ? `<div class="game-discovery-list">${items.map((item) => renderGameTile(item, "add")).join("")}</div>` : `<p class="game-discovery-empty">${escapeHTML(emptyMessage)}</p>`;
}

function openGameContextMenu(gameId, mode, x, y, tileBounds) {
  const targetGame = gameCatalog.find((item) => item.id === gameId);
  const followed = isGameFollowed(gameId);
  if (!targetGame || (mode === "remove" && !followed) || (mode === "add" && followed)) return;
  closeFollowContextMenu();
  const menu = document.createElement("div");
  menu.className = "follow-context-menu";
  menu.setAttribute("role", "menu");
  const action = mode === "add" ? "follow-game" : "toggle-follow";
  const label = mode === "add" ? "팔로우" : "팔로우 해제";
  menu.innerHTML = `<strong>${escapeHTML(targetGame.name)}</strong><button type="button" role="menuitem" data-action="${action}" data-game-id="${escapeHTML(targetGame.id)}">${label}</button>`;
  app.append(menu);
  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(Math.max(8, x), window.innerWidth - menuRect.width - 8);
  const top = Math.min(Math.max(8, y), window.innerHeight - menuRect.height - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  if (tileBounds && (x < 8 || y < 8)) {
    menu.style.left = `${Math.min(tileBounds.left, window.innerWidth - menuRect.width - 8)}px`;
    menu.style.top = `${Math.min(tileBounds.bottom + 5, window.innerHeight - menuRect.height - 8)}px`;
  }
  menu.querySelector("[role='menuitem']")?.focus();
}

function renderGameIntro(title, description, crumb = title) {
  const crawledAt = gameData.crawledAt;
  const crawledDate = crawledAt ? formatDisplayDate(crawledAt) : "크롤링 데이터 없음";
  return `
    <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><a href="#/aion2">아이온2</a>${crumb === "아이온2" ? "" : `<span aria-hidden="true">›</span><span>${escapeHTML(crumb)}</span>`}</div>
    <div class="page-heading"><div><span class="page-eyebrow">AION2 GAME HUB</span><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${crumb === "아이온2" ? `<span class="data-state"><i></i>최근 수집 · ${escapeHTML(crawledDate)}</span>` : ""}</div>`;
}

function renderDemoNote() {
  return `<div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>공식 공지, 업데이트, CM 이야기 게시판에서 수집한 내용입니다. 각 게시물에서 원문 본문을 확인할 수 있습니다.</p></div>`;
}

function renderQuickLink(label, description, href, icon) {
  return `<a class="quick-link" href="${href}"><span class="quick-icon" aria-hidden="true">${icon}</span><span class="quick-copy"><strong>${label}</strong><small>${description}</small></span><span class="quick-arrow" aria-hidden="true">→</span></a>`;
}

function renderGameHome() {
  const preview = newsItems.slice(0, 3);
  return `
    <main class="page-width game-page">
      ${renderGameIntro("아이온2", "공식 공지, 업데이트, CM 이야기에서 최신 소식을 확인하세요.", "아이온2")}
      ${renderDemoNote()}
      <section class="quick-links" aria-label="아이온2 게시판 바로가기">
        ${renderQuickLink("전체 소식", "세 게시판의 최신 글", "#/aion2/news", "⌕")}
        ${renderQuickLink("공지", "공식 안내와 공지", "#/aion2/notices", "i")}
        ${renderQuickLink("업데이트", "패치 노트와 변경점", "#/aion2/updates", "↻")}
        ${renderQuickLink("CM 이야기", "운영 소식과 주간 뉴스", "#/aion2/cm-stories", "✳")}
        ${renderQuickLink("오늘 할 일", "최신 게시물 체크리스트", "#/aion2/tasks", "✓")}
      </section>
      <section class="content-section preview-section">
        <div class="section-heading"><div><h2>최근 정보</h2><p>공식 게시판에서 수집한 최신 글과 본문 링크</p></div><a class="section-link" href="#/aion2/news">전체 소식 <span aria-hidden="true">→</span></a></div>
        ${preview.length ? `<div class="news-list">${preview.map(renderNewsCard).join("")}</div>` : `<div class="empty-state"><strong>수집된 게시물이 없습니다.</strong><p>npm run crawl을 실행해 공식 게시판을 수집해 주세요.</p></div>`}
      </section>
    </main>`;
}

function renderCatalogGamePage() {
  const item = gameCatalog.find((entry) => entry.id === routeParts()[1]);
  if (!item) return `<main class="page-width not-found"><h1>게임을 찾을 수 없어요.</h1><a class="primary-button" href="#/">게임 찾기로 돌아가기</a></main>`;
  const followed = isGameFollowed(item.id);
  return `
    <main class="page-width game-page game-hub-page">
      <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><span>${escapeHTML(item.name)}</span></div>
      <div class="page-heading"><div><span class="page-eyebrow">${item.upcoming ? "UPCOMING GAME" : "GAME HUB"}</span><h1>${escapeHTML(item.name)}</h1><p>${item.upcoming ? "출시를 기다리는 게임입니다. 팔로우하면 관심 게임 목록에서 모아볼 수 있어요." : "게임 소식을 모아볼 수 있도록 팔로우할 수 있습니다."}</p></div></div>
      <section class="game-hub-card"><img src="${escapeHTML(item.icon)}" alt="" /><div><strong>${escapeHTML(item.name)}</strong><p>${item.upcoming ? "출시 예정" : "게임 소식 연동 준비 중"}</p></div><button class="game-follow-button ${followed ? "following" : ""}" type="button" data-action="${followed ? "toggle-follow" : "follow-game"}" data-game-id="${escapeHTML(item.id)}" aria-pressed="${followed}">${followed ? "팔로우 해제" : "팔로우"}</button></section>
      <div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>현재 공지·업데이트 크롤링은 아이온2에 연결되어 있습니다. 다른 게임의 소식 데이터는 준비 중입니다.</p></div>
    </main>`;
}

function renderFilterBar(kind) {
  const pageCategories = kind === "news" ? categories : ["전체"];
  return `
    <div class="feed-tools">
      <label class="search-field news-search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input id="news-search" type="search" value="${escapeHTML(state.query)}" placeholder="제목, 요약, 키워드 검색" autocomplete="off" aria-label="아이온2 정보 검색" />
        <kbd>검색</kbd>
      </label>
      <div class="filter-row" aria-label="정보 유형 필터">
        ${pageCategories.map((category) => `<button class="filter-chip ${state.filter === category ? "selected" : ""}" data-action="filter" data-filter="${category}" aria-pressed="${state.filter === category}">${category}</button>`).join("")}
        <button class="clear-filter" data-action="clear-filter">초기화</button>
      </div>
    </div>`;
}

function categoryClass(category) {
  return category === "공지" ? "notice" : category === "CM 이야기" ? "cm" : "update";
}

function renderNewsCard(item) {
  const bookmarked = isSaved(item.id);
  const read = isRead(item.id);
  return `
    <article class="news-card ${read ? "is-read" : ""}">
      <a class="news-main" href="#/aion2/news/${encodeURIComponent(item.id)}" aria-label="${escapeHTML(item.title)} 상세 보기">
        <div class="news-topline"><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><span class="news-source">${escapeHTML(item.source)} · ${escapeHTML(item.date)}</span>${read ? '<span class="read-badge">읽음</span>' : ""}</div>
        <h3>${escapeHTML(item.title)}</h3>
      </a>
      <a class="news-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(item.title)} 공식 본문 열기">본문 원문 <span aria-hidden="true">↗</span></a>
      <button class="bookmark-button ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg>
      </button>
    </article>`;
}

function renderBookmarksPage() {
  const bookmarks = newsItems.filter((item) => isSaved(item.id));
  return `
    <main class="page-width game-page listing-page bookmarks-page">
      ${renderGameIntro("저장한 북마크", "관심 있는 공지와 업데이트를 모아보세요.", "북마크")}
      <section class="content-section feed-section">
        <div class="section-heading list-heading"><div><h2>북마크한 게시물</h2><p>저장한 글 <span>${bookmarks.length}건</span></p></div></div>
        ${bookmarks.length ? `<div class="news-list">${bookmarks.map(renderNewsCard).join("")}</div>` : `<div class="empty-state bookmark-empty"><span aria-hidden="true">★</span><strong>저장한 게시물이 없어요.</strong><p>게시물 카드의 북마크 아이콘을 눌러 여기에 모아보세요.</p><a class="secondary-button" href="#/aion2/news">전체 소식 보기</a></div>`}
      </section>
    </main>`;
}

function renderDashboardFollowedGame(item) {
  const status = item.id === game.id ? `최근 패치 · ${gameData.lastPatchDate || "아직 수집 전"}` : item.upcoming ? "출시 예정" : "소식 연동 준비 중";
  return `<article class="dashboard-game-item"><a class="dashboard-game-link" href="${escapeHTML(item.route)}"><span class="game-result-mark" aria-hidden="true"><img src="${escapeHTML(item.icon)}" alt="" /></span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(status)}</small></span></a><button class="game-follow-button following" type="button" data-action="toggle-follow" data-game-id="${escapeHTML(item.id)}" aria-label="${escapeHTML(item.name)} 팔로우 해제" aria-pressed="true">팔로우 해제</button></article>`;
}

function renderUserPost(post) {
  const createdAt = post.createdAt ? formatDisplayDate(post.createdAt) : "날짜 정보 없음";
  return `<article class="user-post-card"><details><summary><span class="user-post-title">${escapeHTML(post.title)}</span><span class="user-post-date">${escapeHTML(createdAt)}</span></summary><p>${escapeHTML(post.body)}</p></details><button class="post-delete-button" type="button" data-action="delete-user-post" data-id="${escapeHTML(post.id)}">삭제</button></article>`;
}

function renderDashboardPage() {
  const followed = gameCatalog.filter((item) => isGameFollowed(item.id));
  const bookmarks = newsItems.filter((item) => isSaved(item.id));
  const posts = userPosts();
  return `
    <main class="page-width game-page dashboard-page">
      <div class="page-heading dashboard-heading"><div><span class="page-eyebrow">MY TODAYPATCH</span><h1>내 대시보드</h1><p>팔로우한 게임과 저장한 소식, 내가 작성한 글을 관리하세요.</p></div></div>
      <div class="dashboard-stats" aria-label="내 활동 요약">
        <div class="dashboard-stat"><span>팔로우 게임</span><strong>${followed.length}</strong></div>
        <div class="dashboard-stat"><span>저장한 북마크</span><strong>${bookmarks.length}</strong></div>
        <div class="dashboard-stat"><span>내 작성 글</span><strong>${posts.length}</strong></div>
      </div>
      <div class="dashboard-columns">
        <section class="dashboard-section" aria-labelledby="dashboard-games-title">
          <div class="dashboard-section-heading"><div><span class="page-eyebrow">MY GAMES</span><h2 id="dashboard-games-title">팔로우한 게임</h2></div><span class="dashboard-count">${followed.length}개</span></div>
          ${followed.length ? `<div class="dashboard-games-list">${followed.map(renderDashboardFollowedGame).join("")}</div>` : `<div class="dashboard-empty"><p>팔로우 중인 게임이 없습니다.</p><a href="#/">게임 찾아보기 <span aria-hidden="true">→</span></a></div>`}
        </section>
        <section class="dashboard-section" aria-labelledby="dashboard-bookmarks-title">
          <div class="dashboard-section-heading"><div><span class="page-eyebrow">SAVED NEWS</span><h2 id="dashboard-bookmarks-title">북마크 관리</h2></div><a class="dashboard-more" href="#/aion2/bookmarks">전체 보기 <span aria-hidden="true">→</span></a></div>
          ${bookmarks.length ? `<div class="news-list dashboard-news-list">${bookmarks.slice(0, 4).map(renderNewsCard).join("")}</div>` : `<div class="dashboard-empty"><p>저장한 게시물이 없습니다.</p><a href="#/aion2/news">전체 소식 보기 <span aria-hidden="true">→</span></a></div>`}
        </section>
      </div>
      <section class="dashboard-section dashboard-posts" aria-labelledby="dashboard-posts-title">
        <div class="dashboard-section-heading"><div><span class="page-eyebrow">MY POSTS</span><h2 id="dashboard-posts-title">내가 작성한 글</h2><p>이 브라우저에 저장되어 나에게만 보이는 글입니다.</p></div><button class="primary-button" type="button" data-action="toggle-post-form" aria-expanded="false">글 작성하기</button></div>
        <form id="user-post-form" class="post-composer" hidden>
          <label for="user-post-title">제목</label><input id="user-post-title" name="title" type="text" maxlength="100" placeholder="글 제목을 입력하세요" required />
          <label for="user-post-body">내용</label><textarea id="user-post-body" name="body" rows="5" maxlength="5000" placeholder="나중에 다시 볼 내용을 적어두세요" required></textarea>
          <div class="post-composer-actions"><span>작성한 글은 이 기기의 브라우저에만 저장됩니다.</span><button class="primary-button" type="submit">저장</button></div>
        </form>
        ${posts.length ? `<div class="user-post-list">${posts.map(renderUserPost).join("")}</div>` : `<div class="dashboard-empty post-empty"><p>아직 작성한 글이 없습니다.</p><span>글 작성하기를 눌러 메모나 공략을 저장해 보세요.</span></div>`}
      </section>
    </main>`;
}

function renderFeedPage(kind) {
  const page = {
    news: ["아이온2 전체 소식", "공지, 업데이트, CM 이야기 게시물을 날짜순으로 확인하세요."],
    notices: ["아이온2 공식 공지", "공식 안내와 서비스 공지를 원문 링크와 함께 확인하세요."],
    updates: ["아이온2 업데이트", "최신 패치 노트와 업데이트 본문을 확인하세요."],
    "cm-stories": ["아이온2 CM 이야기", "주간 업데이트 뉴스와 운영 소식을 확인하세요."],
  }[kind];
  return `
    <main class="page-width game-page listing-page">
      ${renderGameIntro(page[0], page[1], page[0])}
      ${renderDemoNote()}
      <section class="content-section feed-section">
        ${renderFilterBar(kind)}
        <div class="section-heading list-heading"><div><h2>${page[0]}</h2><p>검색 결과 <span id="news-count"></span></p></div></div>
        <div class="news-list" id="news-list"></div>
        <div class="empty-state" id="empty-state" hidden><span aria-hidden="true">⌕</span><strong>게시물이 없어요.</strong><p>다른 단어를 입력하거나 다음 크롤링 후 다시 확인해 주세요.</p></div>
      </section>
    </main>`;
}

function renderTask(task, checked) {
  const linkedItem = task.item;
  return `
    <div class="task-row ${checked ? "completed" : ""}">
      <button class="task-check" data-action="toggle-task" data-id="${task.id}" aria-label="${checked ? "완료 취소" : "완료 표시"}" aria-pressed="${Boolean(checked)}">${checked ? "✓" : ""}</button>
      <div class="task-copy"><strong>${escapeHTML(task.title)}</strong>${linkedItem ? `<a href="#/aion2/news/${encodeURIComponent(linkedItem.id)}">${escapeHTML(linkedItem.title)}</a>` : `<span>크롤링 후 최신 게시물이 표시됩니다.</span>`}</div>
      <span class="task-due">${escapeHTML(linkedItem?.date || "수집 대기")}</span>
    </div>`;
}

function renderTasksPage() {
  const checked = savedTasks();
  const count = taskItems.filter((task) => checked[task.id]).length;
  return `
    <main class="page-width game-page listing-page tasks-page">
      ${renderGameIntro("패치 후 할 일", "최신 공지, 업데이트, CM 이야기를 확인 완료로 표시하세요.", "할 일")}
      <div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>각 게시판에서 수집한 최신 게시물을 열고 확인 완료를 표시하세요.</p></div>
      <section class="task-panel">
        <div class="task-panel-heading"><div><span class="page-eyebrow">LATEST POSTS</span><h2>수집 게시물 체크리스트</h2></div><span class="task-progress">${count} / ${taskItems.length} 완료</span></div>
        <p class="section-description">완료 상태는 이 브라우저에 저장됩니다. 크롤링 후 최신 게시물 링크가 자동으로 바뀝니다.</p>
        <div class="task-list">${taskItems.map((task) => renderTask(task, checked[task.id])).join("")}</div>
        <div class="task-legend"><span><i class="legend-official"></i>공식 게시판에서 수집</span></div>
      </section>
    </main>`;
}

function renderDetail(id) {
  const item = newsItems.find((news) => news.id === id);
  if (!item) return `<main class="page-width not-found"><h1>정보를 찾을 수 없어요.</h1><a class="primary-button" href="#/aion2/updates">아이온2 정보로 돌아가기</a></main>`;
  const bookmarked = isSaved(item.id);
  const summary = item.summary || item.excerpt || "요약 정보를 준비하지 못했습니다. 공식 원문을 확인해 주세요.";
  const analysis = item.analysis || "분석 정보가 없습니다. 아래 공식 원문에서 자세한 내용을 확인해 주세요.";
  const keyPoints = Array.isArray(item.keyPoints) ? item.keyPoints : [];
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const detailedSections = sections.length
    ? `<div class="analysis-sections"><h3>원문 파트별 핵심 내용</h3>${sections.map((section) => {
      const details = Array.isArray(section.importantDetails) ? section.importantDetails : [];
      return `<section class="analysis-section"><h4>${escapeHTML(section.heading)}</h4><p>${escapeHTML(section.summary)}</p>${details.length ? `<ul>${details.map((detail) => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>` : ""}</section>`;
    }).join("")}</div>`
    : keyPoints.length ? `<ul class="key-point-list">${keyPoints.map((point) => `<li>${escapeHTML(point)}</li>`).join("")}</ul>` : "";
  const sourceRoute = { notice: "notices", update: "updates", "cm-story": "cm-stories" }[item.sourceKey] || "news";
  return `
    <main class="page-width game-page detail-page">
      ${renderGameIntro("게시물 상세", "AI가 핵심 내용을 정리하고 분석한 결과를 확인하세요.", "게시물 상세")}
      <div class="detail-layout">
        <article class="detail-main">
          <div class="detail-title-row"><div><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><h1>${escapeHTML(item.title)}</h1></div><button class="bookmark-button detail-bookmark ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg></button></div>
          <section class="article-panel summary-panel"><div class="panel-heading"><h2>전체 내용 요약</h2><span class="summary-badge">전체 흐름</span></div><p class="summary-copy">${escapeHTML(summary)}</p></section>
          <section class="article-panel analysis-panel"><div class="panel-heading"><h2>AI 분석</h2><span class="example-label">이용자 관점</span></div><p>${escapeHTML(analysis)}</p>${detailedSections}<a class="article-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">공식 본문 링크 열기 <span aria-hidden="true">↗</span></a></section>
          <section class="article-panel"><div class="panel-heading"><h2>수집 정보</h2><span class="example-label">공식 게시판</span></div><dl class="info-list"><div><dt>게시판</dt><dd>${escapeHTML(item.source)}</dd></div><div><dt>게시일</dt><dd>${escapeHTML(item.date)}</dd></div><div><dt>수정일</dt><dd>${item.updatedAt ? escapeHTML(formatDisplayDate(item.updatedAt)) : "수정 기록 없음"}</dd></div></dl></section>
          <section class="article-panel action-panel"><div><strong>정보가 정확하지 않나요?</strong><p>날짜, 수치, 직업 정보나 출처 문제를 알려주세요.</p></div><button class="secondary-button" data-action="report">정보 신고</button></section>
          <a class="back-link" href="#/aion2/${sourceRoute}">← ${escapeHTML(item.category)} 목록</a>
        </article>
        <aside class="detail-side"><section class="source-panel"><span class="page-eyebrow">OFFICIAL SOURCE</span><h2>공식 게시물</h2><p>${escapeHTML(item.source)}에서 수집한 내용을 요약했습니다. 정확한 조건과 상세 내용은 원문에서 확인해 주세요.</p><div class="source-status-list"><div><span>게시일</span><strong>${escapeHTML(item.date)}</strong></div><div><span>표시 내용</span><strong>요약 · 분석</strong></div></div><a class="secondary-button full-width" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">공식 본문 열기 <span aria-hidden="true">↗</span></a></section></aside>
      </div>
    </main>`;
}

function renderModal() {
  return `<dialog class="app-dialog" id="app-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><dialog class="app-dialog tutorial-dialog" id="tutorial-dialog" aria-labelledby="tutorial-title"></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

const tutorialSteps = [
  { title: "게임을 찾아 팔로우하세요", body: "검색창에서 게임을 찾거나 오른쪽 게임 둘러보기에서 아이콘을 선택하세요. 아이콘을 누르면 게임 페이지로 이동하고, 둘러보기 목록은 우클릭하거나 길게 눌러 팔로우할 수 있어요.", tip: "내 게임 아이콘을 우클릭하거나 길게 누르면 팔로우를 해제할 수 있습니다." },
  { title: "새 소식을 확인하세요", body: "아이온2 페이지의 공지, 업데이트, CM 이야기에서 최신 글을 확인할 수 있어요. 게시글을 열면 AI 요약과 항목별 분석, 공식 원문 링크가 표시됩니다.", tip: "읽은 글은 목록에서 읽음 표시로 구분됩니다." },
  { title: "북마크와 게임을 관리하세요", body: "게시글은 북마크로 저장하고, 대시보드에서 팔로우한 게임과 저장한 글을 관리하세요. 팔로우한 게임에 새 글이 올라오면 알림 메뉴에서 확인할 수 있어요.", tip: "이용 방법은 메인 화면의 ‘튜토리얼 보기’에서 다시 열 수 있습니다." },
];

function renderTutorialStep() {
  const dialog = app.querySelector("#tutorial-dialog");
  if (!dialog) return;
  const index = Math.max(0, Math.min(state.tutorialStep, tutorialSteps.length - 1));
  const step = tutorialSteps[index];
  const checked = readStorage("todaypatch.skipTutorial", false);
  dialog.innerHTML = `
    <div class="tutorial-topline"><span class="page-eyebrow">이용 가이드 · ${index + 1} / ${tutorialSteps.length}</span><button class="dialog-close" type="button" data-action="tutorial-close" aria-label="튜토리얼 닫기">×</button></div>
    <div class="tutorial-progress" aria-hidden="true"><span style="width:${((index + 1) / tutorialSteps.length) * 100}%"></span></div>
    <span class="tutorial-step-number">STEP ${String(index + 1).padStart(2, "0")}</span>
    <h2 id="tutorial-title" tabindex="-1">${escapeHTML(step.title)}</h2>
    <p id="tutorial-copy">${escapeHTML(step.body)}</p>
    <div class="tutorial-tip"><span aria-hidden="true">i</span><p>${escapeHTML(step.tip)}</p></div>
    <div class="tutorial-actions">
      <label class="tutorial-skip"><input type="checkbox" data-action="skip-tutorial" ${checked ? "checked" : ""} /><span>앞으로 자동으로 띄우지 않기</span></label>
      <div class="tutorial-buttons">${index ? '<button class="secondary-button" type="button" data-action="tutorial-previous">이전</button>' : ""}<button class="primary-button" type="button" data-action="tutorial-next">${index === tutorialSteps.length - 1 ? "완료" : "다음"}</button></div>
    </div>`;
}

function openTutorial() {
  const dialog = app.querySelector("#tutorial-dialog");
  if (!dialog) return;
  state.tutorialStep = 0;
  state.tutorialShownInSession = true;
  renderTutorialStep();
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("#tutorial-title")?.focus();
}

function maybeOpenTutorial() {
  if (state.tutorialShownInSession || readStorage("todaypatch.skipTutorial", false)) return;
  state.tutorialShownInSession = true;
  state.tutorialStep = 0;
  renderTutorialStep();
  const dialog = app.querySelector("#tutorial-dialog");
  dialog?.showModal();
  dialog?.querySelector("#tutorial-title")?.focus();
}

function renderFooter() {
  return `<footer class="site-footer"><div class="footer-inner page-width"><a class="footer-brand" href="#/">오늘의 패치</a><span>필요한 게임 정보를 한곳에서.</span></div></footer>`;
}

function visibleNews() {
  let items = [...newsItems];
  const kind = routeKind();
  if (kind === "notices") items = items.filter((item) => item.sourceKey === "notice");
  if (kind === "updates") items = items.filter((item) => item.sourceKey === "update");
  if (kind === "cm-stories") items = items.filter((item) => item.sourceKey === "cm-story");
  if (state.filter !== "전체") items = items.filter((item) => item.category === state.filter);
  const query = state.query.trim().toLocaleLowerCase("ko-KR");
  if (query) items = items.filter((item) => `${item.title} ${item.excerpt} ${item.summary || ""} ${item.analysis || ""} ${(item.keyPoints || []).join(" ")} ${item.category} ${item.meta}`.toLocaleLowerCase("ko-KR").includes(query));
  return items;
}

function drawNewsList() {
  const list = app.querySelector("#news-list");
  if (!list) return;
  const items = visibleNews();
  list.innerHTML = items.map(renderNewsCard).join("");
  const count = app.querySelector("#news-count");
  if (count) count.textContent = `${items.length}건`;
  const empty = app.querySelector("#empty-state");
  if (empty) empty.hidden = items.length > 0;
}

function drawGameResults() {
  const results = app.querySelector("#game-results");
  if (!results) return;
  const query = state.gameQuery.trim().toLocaleLowerCase("ko-KR");
  if (!query) {
    const searches = state.gameSearchFocused ? recentGameSearches() : [];
    results.innerHTML = searches.length ? `
      <section class="recent-searches" aria-label="최근 검색 내역">
        <div class="recent-searches-heading"><strong>최근 검색</strong><button type="button" data-action="clear-search-history">전체 삭제</button></div>
        <div class="recent-search-list">${searches.map((term) => `<button type="button" class="recent-search-item" data-action="repeat-search" data-query="${escapeHTML(term)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg><span>${escapeHTML(term)}</span></button>`).join("")}</div>
      </section>` : "";
    return;
  }
  const matches = game.aliases.toLocaleLowerCase("ko-KR").includes(query);
  const latestPatchDate = gameData.lastPatchDate || "아직 수집 전";
  const followed = isGameFollowed(game.id);
  results.innerHTML = matches ? `
    <div class="game-result">
      <a class="game-result-open" href="#/aion2" data-action="record-game-search" aria-label="아이온2 정보 열기"><span class="game-result-mark" aria-hidden="true"><img src="./assets/aion2-logo.png" alt="" /></span><span class="game-result-copy"><strong>아이온2</strong><small>최근 패치 · ${escapeHTML(latestPatchDate)}</small></span></a>
      <button class="game-follow-button ${followed ? "following" : ""}" type="button" data-action="toggle-follow" data-game-id="${game.id}" aria-label="${followed ? "아이온2 팔로우 해제" : "아이온2 팔로우"}" aria-pressed="${followed}">${followed ? "팔로우 해제" : "팔로우"}</button>
    </div>` : `<div class="no-games"><strong>검색 결과가 없습니다.</strong><span>게임 이름을 다시 확인해 주세요.</span></div>`;
}

function render() {
  syncFollowedNewsNotifications();
  const kind = routeKind();
  if (kind === "detail") markNewsAsRead(detailId());
  let page;
  if (kind === "game-home") page = renderGameHome();
  else if (kind === "game-hub") page = renderCatalogGamePage();
  else if (["news", "notices", "updates", "cm-stories"].includes(kind)) page = renderFeedPage(kind);
  else if (kind === "tasks") page = renderTasksPage();
  else if (kind === "bookmarks") page = renderBookmarksPage();
  else if (kind === "dashboard") page = renderDashboardPage();
  else if (kind === "detail") page = renderDetail(detailId());
  else page = renderHome();
  app.innerHTML = `${renderHeader()}${page}${renderFooter()}${renderModal()}`;
  drawNewsList();
  drawGameResults();
  maybeOpenTutorial();
}

function openDialog(kind) {
  const dialog = app.querySelector("#app-dialog");
  const content = app.querySelector("#dialog-content");
  if (!dialog || !content) return;
  if (kind === "login") {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">TODAYPATCH ACCOUNT</span><h2 id="dialog-title">로그인</h2><p>북마크와 할 일은 현재 이 브라우저에 저장됩니다. 계정 로그인과 기기 간 동기화는 아직 연결되지 않았습니다.</p><button class="primary-button dialog-primary" data-action="close-dialog">확인</button>`;
  } else {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">REPORT INFORMATION</span><h2 id="dialog-title">정보 신고</h2><p>잘못된 날짜·수치·직업 정보나 오래된 공략을 알려주세요.</p><form id="report-form"><label for="report-reason">신고 내용</label><select id="report-reason" name="reason"><option>날짜 또는 기간이 달라요</option><option>직업·스킬 정보가 달라요</option><option>패치 버전이 오래됐어요</option><option>출처 링크가 열리지 않아요</option><option>기타</option></select><label for="report-detail">자세한 내용</label><textarea id="report-detail" name="detail" rows="3" placeholder="확인한 내용을 적어주세요."></textarea><button class="primary-button dialog-primary" type="submit">신고 내용 확인</button></form><span class="dialog-note">프로토타입에서는 신고가 저장되지 않습니다.</span>`;
  }
  dialog.showModal();
}

let toastTimer;
function showToast(message) {
  const toast = app.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

app.addEventListener("click", (event) => {
  if (!event.target.closest(".follow-context-menu")) closeFollowContextMenu();
  const notificationWrap = event.target.closest(".notification-wrap");
  if (!notificationWrap && state.notificationsOpen) {
    state.notificationsOpen = false;
    const popover = app.querySelector(".notification-popover");
    if (popover) popover.hidden = true;
    app.querySelector("#notification-toggle")?.setAttribute("aria-expanded", "false");
  }
  const button = event.target.closest("[data-action]");
  if (!button) {
    if (event.target.id === "app-dialog") event.target.close();
    return;
  }
  const { action, id } = button.dataset;
  if (action === "toggle-notifications") {
    state.notificationsOpen = !state.notificationsOpen;
    app.querySelector(".notification-popover").hidden = !state.notificationsOpen;
    button.setAttribute("aria-expanded", String(state.notificationsOpen));
  }
  if (action === "open-notification") {
    event.preventDefault();
    writeStorage("todaypatch.notifications", storedNotifications().map((item) => item.id === id ? { ...item, read: true } : item));
    const href = button.getAttribute("href");
    state.notificationsOpen = false;
    if (button.getAttribute("target") === "_blank") {
      window.open(href, "_blank", "noopener,noreferrer");
      render();
    } else if (href?.startsWith("#/")) {
      const route = href.slice(1);
      if (window.location.hash === route) render();
      else window.location.hash = route;
    }
  }
  if (action === "mark-all-notifications-read") {
    writeStorage("todaypatch.notifications", storedNotifications().map((item) => ({ ...item, read: true })));
    render();
  }
  if (action === "toggle-browser-notifications") {
    const browserEnabled = readStorage("todaypatch.browserNotifications", false);
    if (browserEnabled) {
      writeStorage("todaypatch.browserNotifications", false);
      render();
      showToast("브라우저 알림을 껐어요.");
    } else if (!("Notification" in window)) {
      showToast("이 브라우저에서는 데스크톱 알림을 사용할 수 없어요.");
    } else if (Notification.permission === "denied") {
      showToast("브라우저 설정에서 알림 권한을 허용해 주세요.");
    } else {
      const enableNotifications = (permission) => {
        const enabled = permission === "granted";
        writeStorage("todaypatch.browserNotifications", enabled);
        render();
        showToast(enabled ? "새 소식 브라우저 알림을 켰어요." : "브라우저 알림 권한이 허용되지 않았어요.");
      };
      if (Notification.permission === "granted") enableNotifications("granted");
      else Notification.requestPermission().then(enableNotifications).catch(() => showToast("브라우저 알림 권한을 설정하지 못했어요."));
    }
  }
  if (action === "filter") {
    state.filter = button.dataset.filter;
    app.querySelectorAll(".filter-chip").forEach((chip) => {
      const selected = chip.dataset.filter === state.filter;
      chip.classList.toggle("selected", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
    drawNewsList();
  }
  if (action === "clear-filter") {
    state.filter = "전체";
    state.query = "";
    render();
  }
  if (action === "record-game-search") rememberGameSearch(state.gameQuery);
  if (action === "clear-search-history") {
    writeStorage("todaypatch.recentGameSearches", []);
    drawGameResults();
  }
  if (action === "repeat-search") {
    state.gameQuery = button.dataset.query || "";
    state.gameSearchFocused = true;
    rememberGameSearch(state.gameQuery);
    const input = app.querySelector("#game-search");
    if (input) {
      input.value = state.gameQuery;
      input.focus();
    }
    drawGameResults();
  }
  if (action === "bookmark") {
    const bookmarks = savedNews();
    const wasSaved = bookmarks.includes(id);
    writeStorage("todaypatch.bookmarks", wasSaved ? bookmarks.filter((item) => item !== id) : [...bookmarks, id]);
    render();
    showToast(wasSaved ? "북마크를 해제했어요." : "소식을 저장했어요.");
  }
  if (action === "toggle-follow") {
    const gameId = button.dataset.gameId;
    if (routeKind() === "home" && state.gameQuery.trim()) rememberGameSearch(state.gameQuery);
    const followed = followedGameIds();
    const wasFollowed = followed.includes(gameId);
    writeStorage("todaypatch.followedGames", wasFollowed ? followed.filter((item) => item !== gameId) : [...followed, gameId]);
    if (!wasFollowed) rememberCurrentGameNews(gameId);
    render();
    const followedGame = gameCatalog.find((item) => item.id === gameId);
    showToast(wasFollowed ? `${followedGame?.name || "게임"} 팔로우를 해제했어요.` : `${followedGame?.name || "게임"} 팔로우를 시작했어요.`);
  }
  if (action === "follow-game") {
    const gameId = button.dataset.gameId;
    const followed = followedGameIds();
    if (followed.includes(gameId)) return;
    writeStorage("todaypatch.followedGames", [...followed, gameId]);
    rememberCurrentGameNews(gameId);
    render();
    const followedGame = gameCatalog.find((item) => item.id === gameId);
    showToast(`${followedGame?.name || "게임"} 팔로우를 시작했어요.`);
  }
  if (action === "select-discovery-view") {
    state.discoveryView = button.dataset.view === "upcoming" ? "upcoming" : "other";
    render();
  }
  if (action === "open-tutorial") openTutorial();
  if (action === "tutorial-previous") {
    state.tutorialStep = Math.max(0, state.tutorialStep - 1);
    renderTutorialStep();
    app.querySelector("#tutorial-title")?.focus();
  }
  if (action === "tutorial-next") {
    if (state.tutorialStep >= tutorialSteps.length - 1) app.querySelector("#tutorial-dialog")?.close();
    else {
      state.tutorialStep += 1;
      renderTutorialStep();
      app.querySelector("#tutorial-title")?.focus();
    }
  }
  if (action === "tutorial-close") app.querySelector("#tutorial-dialog")?.close();
  if (action === "toggle-post-form") {
    const form = app.querySelector("#user-post-form");
    const opening = form.hidden;
    form.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) form.querySelector("input")?.focus();
  }
  if (action === "delete-user-post") {
    writeStorage("todaypatch.userPosts", userPosts().filter((post) => post.id !== id));
    render();
    showToast("작성한 글을 삭제했어요.");
  }
  if (action === "toggle-task") {
    const checked = savedTasks();
    checked[id] = !checked[id];
    writeStorage("todaypatch.tasks", checked);
    render();
  }
  if (action === "mobile-menu") {
    const nav = app.querySelector("#main-nav");
    const open = nav.classList.toggle("mobile-open");
    button.setAttribute("aria-expanded", String(open));
  }
  if (action === "toggle-theme") {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    writeStorage("todaypatch.theme", nextTheme);
    applyTheme(nextTheme);
    render();
  }
  if (action === "login") openDialog("login");
  if (action === "report") openDialog("report");
  if (action === "close-dialog") app.querySelector("#app-dialog").close();
});

app.addEventListener("input", (event) => {
  if (event.target.id === "news-search") {
    state.query = event.target.value;
    drawNewsList();
  }
  if (event.target.id === "game-search") {
    state.gameQuery = event.target.value;
    drawGameResults();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.matches('[data-action="skip-tutorial"]')) writeStorage("todaypatch.skipTutorial", event.target.checked);
});

app.addEventListener("focusin", (event) => {
  if (event.target.id !== "game-search") return;
  state.gameSearchFocused = true;
  drawGameResults();
});

app.addEventListener("focusout", (event) => {
  if (event.target.id !== "game-search") return;
  if (event.relatedTarget && app.querySelector("#game-results")?.contains(event.relatedTarget)) return;
  state.gameSearchFocused = false;
  window.setTimeout(drawGameResults, 0);
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFollowContextMenu();
    return;
  }
  if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && event.target.closest("[data-game-menu]")) {
    event.preventDefault();
    const tile = event.target.closest("[data-game-menu]");
    const bounds = tile.getBoundingClientRect();
    openGameContextMenu(tile.dataset.gameId, tile.dataset.gameMenu, 0, 0, bounds);
    return;
  }
  if (event.target.id !== "game-search" || event.key !== "Enter") return;
  rememberGameSearch(state.gameQuery);
  if (game.aliases.toLocaleLowerCase("ko-KR").includes(state.gameQuery.trim().toLocaleLowerCase("ko-KR"))) window.location.hash = "#/aion2";
});

app.addEventListener("contextmenu", (event) => {
  const tile = event.target.closest("[data-game-menu]");
  if (!tile) return;
  event.preventDefault();
  const bounds = tile.getBoundingClientRect();
  openGameContextMenu(tile.dataset.gameId, tile.dataset.gameMenu, event.clientX, event.clientY, bounds);
});

window.addEventListener("resize", closeFollowContextMenu);

app.addEventListener("submit", (event) => {
  if (event.target.id === "user-post-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    if (!title || !body) return;
    const id = globalThis.crypto?.randomUUID?.() || `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeStorage("todaypatch.userPosts", [{ id, title, body, createdAt: new Date().toISOString() }, ...userPosts()]);
    render();
    showToast("작성한 글을 저장했어요.");
    return;
  }
  if (event.target.id === "report-form") {
    event.preventDefault();
    app.querySelector("#app-dialog").close();
    showToast("신고 내용을 확인했어요. 저장 기능은 서비스 연동 후 제공됩니다.");
  }
});

window.addEventListener("hashchange", () => {
  state.filter = "전체";
  state.query = "";
  state.gameSearchFocused = false;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
