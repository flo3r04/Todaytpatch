const gameData = window.todaypatchGameData?.aion2 || {};
const newsItems = Array.isArray(gameData.newsItems) ? gameData.newsItems : [];
const game = { id: "aion2", name: "아이온2", aliases: "aion2 아이온2", icon: "./assets/aion2-logo.png", route: "#/aion2" };
const categories = ["전체", "공지", "업데이트", "CM 아지트"];
const gameCatalog = [
  game,
  { id: "dokkaebi-world", name: "도깨비의 세계", aliases: "도깨비의 세계 도깨비 dokkaebi dokev", icon: "./assets/dokkaebi-world.png", route: "#/game/dokkaebi-world" },
  { id: "temppal", name: "템빨", aliases: "템빨 오버기어드 temppal", displayTitle: "템빨: 오버기어드", icon: "./assets/temppal.png", route: "#/game/temppal", upcoming: true, releaseDate: "2026-11-26T00:00:00+09:00" },
];
const dokkaebiNewsItems = [
  {
    id: "dokkaebi-overview", category: "공지", source: "도깨비의 세계 · 예시 정보", date: "예시 콘텐츠", meta: "세계관 · 게임 소개",
    title: "도깨비의 세계 공개 정보 모아보기", excerpt: "게임 소개와 세계관 등 공개 정보를 한곳에서 찾아볼 수 있도록 정리하는 페이지입니다.",
    summary: "도깨비의 세계에 관한 공개 정보와 안내를 모아보는 페이지 구성 예시입니다.", keyPoints: ["공개 정보 검색", "새 소식과 게임 안내 모아보기"],
  },
  {
    id: "dokkaebi-starter-guide", category: "공략", source: "도깨비의 세계 · 예시 공략", date: "예시 콘텐츠", meta: "입문 · 기본 정보",
    title: "도깨비의 세계 입문 가이드", excerpt: "처음 시작할 때 필요한 기본 정보와 자주 찾는 내용을 모으는 가이드 예시입니다.",
    summary: "입문자를 위한 기본 가이드 페이지 예시입니다.", keyPoints: ["입문 정보", "기본 조작과 콘텐츠", "자주 묻는 질문"],
  },
  {
    id: "dokkaebi-news-placeholder", category: "업데이트", source: "도깨비의 세계 · 예시 정보", date: "예시 콘텐츠", meta: "게임 소식",
    title: "도깨비의 세계 새 소식", excerpt: "공지와 업데이트가 연결되면 이 목록에서 제목과 내용을 검색할 수 있습니다.",
    summary: "도깨비의 세계 새 소식 목록 구성 예시입니다.", keyPoints: ["공식 데이터 연동 대기"],
  },
];
const isAionNewsItem = (item) => (item?.gameId || game.id) === game.id;
const isAionCmStory = (item) => isAionNewsItem(item)
  && (item.sourceKey === "cm-story" || item.category === "CM 이야기" || item.category === "CM 아지트");
const displayNewsCategory = (item) => isAionCmStory(item) ? "CM 아지트" : item.category;
const displayNewsSource = (item) => isAionCmStory(item)
  ? String(item.source || "아이온2 공식 CM 아지트").replace(/CM 이야기/g, "CM 아지트")
  : item.source;
const state = { filter: "전체", query: "", gameQuery: "", dokkaebiQuery: "", dokkaebiFilter: "전체", gameSearchFocused: false, notificationsOpen: false, tutorialStep: 0, tutorialShownInSession: false, calendarOffset: 0, chatOpen: false, chatMessages: [] };
const app = document.querySelector("#app");
let releaseCountdownTimer = null;

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
  if (themeColor) themeColor.content = safeTheme === "dark" ? "#0d1420" : "#f7f8f7";
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
  known[gameId] = [...new Set([...(Array.isArray(known[gameId]) ? known[gameId] : []), ...newsItems.filter(isAionNewsItem).map((item) => item.id)])].slice(-1000);
  writeStorage("todaypatch.knownNewsByGame", known);
}

function notifyBrowserOfNewPosts(items) {
  if (!readStorage("todaypatch.browserNotifications", false) || !("Notification" in window) || Notification.permission !== "granted" || !items.length) return;
  const latest = items[0];
  const isCalendarAlert = latest.category === "기간 알림";
  try {
    const notification = new Notification(isCalendarAlert ? "아이온2 일정 알림" : "아이온2 새 소식", {
      body: latest.body || (items.length > 1 ? `${latest.title} 외 ${items.length - 1}건` : latest.title),
      icon: "./assets/aion2-logo.png",
      tag: isCalendarAlert ? "todaypatch-aion2-calendar" : "todaypatch-aion2-news",
    });
    notification.onclick = () => {
      window.focus();
      window.location.hash = `#/aion2/news/${encodeURIComponent(latest.newsId || latest.id)}`;
      notification.close();
    };
  } catch {
    // In-app notifications remain available when desktop notifications are unavailable.
  }
}

function syncFollowedNewsNotifications() {
  if (!followedGameIds().includes(game.id)) return;
  const known = knownNewsByGame();
  const currentItems = newsItems.filter(isAionNewsItem);
  const currentIds = currentItems.map((item) => item.id);
  if (!Array.isArray(known[game.id])) {
    known[game.id] = [...new Set(currentIds)].slice(-1000);
    writeStorage("todaypatch.knownNewsByGame", known);
    return;
  }
  const knownIds = new Set(known[game.id]);
  const newPosts = currentItems.filter((item) => !knownIds.has(item.id));
  known[game.id] = [...new Set([...known[game.id], ...currentIds])].slice(-1000);
  writeStorage("todaypatch.knownNewsByGame", known);
  if (!newPosts.length) return;

  const notifications = storedNotifications();
  const existingIds = new Set(notifications.map((item) => item.id));
  const added = newPosts.filter((item) => !existingIds.has(item.id)).map((item) => ({
    id: item.id,
    gameId: game.id,
    title: item.title,
    category: displayNewsCategory(item),
    date: item.date,
    url: item.url,
    createdAt: new Date().toISOString(),
    read: false,
  }));
  if (!added.length) return;
  writeStorage("todaypatch.notifications", [...added, ...notifications].slice(0, 100));
  notifyBrowserOfNewPosts(added);
}

function calendarDaysUntil(value) {
  const key = eventDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  const today = localDateKey(new Date()).split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today[0], today[1] - 1, today[2])) / 86400000);
}

function syncCalendarNotifications() {
  if (!followedGameIds().includes(game.id)) return;
  const notifications = storedNotifications();
  const existingIds = new Set(notifications.map((item) => item.id));
  const added = [];
  for (const event of dashboardCalendarEvents()) {
    const target = event.deadlineAt || event.endAt;
    const daysUntil = calendarDaysUntil(target);
    if (daysUntil === null || daysUntil < 0 || daysUntil > 7) continue;
    const reminderKey = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : "week";
    const id = `calendar-${event.newsId}-${eventDateKey(target)}-${reminderKey}`;
    if (existingIds.has(id)) continue;
    const deadlineLabel = event.deadlineAt ? "마감" : "종료";
    const timeLabel = daysUntil === 0 ? `오늘 ${deadlineLabel}` : daysUntil === 1 ? `내일 ${deadlineLabel}` : `${daysUntil}일 후 ${deadlineLabel}`;
    const body = event.conditions.slice(0, 2).join(" · ") || event.reward || event.details || formatEventDate(target);
    added.push({
      id,
      newsId: event.newsId,
      gameId: event.gameId,
      title: `${event.title} · ${timeLabel}`,
      category: "기간 알림",
      date: formatEventDate(target),
      body,
      url: event.url,
      createdAt: new Date().toISOString(),
      read: false,
    });
    existingIds.add(id);
  }
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
  return route.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
}

function dokkaebiRouteCategory(route = currentRoute()) {
  return ({ notices: "공지", updates: "업데이트", guides: "공략" })[routeParts(route)[2]] || "전체";
}

function routeKind(route = currentRoute()) {
  const parts = routeParts(route);
  if (!parts.length) return "home";
  if (parts[0] === "dashboard") return "dashboard";
  if (parts[0] === "community") {
    if (parts[1] === "new") return "community-new";
    if (parts[1] === "post" && parts[2]) return "community-detail";
    if (parts[1] === "moderation") return "community-moderation";
    return "community";
  }
  if (parts[0] === "game" && gameCatalog.some((item) => item.id === parts[1])) {
    if (parts[1] === "dokkaebi-world") return parts[2] === "news" && parts[3] ? "dokkaebi-detail" : "dokkaebi-hub";
    return "game-hub";
  }
  if (parts[0] === "aion2") {
    if (parts[1] === "news" && parts[2]) return "detail";
    if (["news", "notices", "updates", "cm-stories", "tasks", "bookmarks"].includes(parts[1])) return parts[1];
    return "game-home";
  }
  return "home";
}

function detailId() {
  const parts = routeParts();
  if (parts[0] === "game" && parts[1] === "dokkaebi-world" && parts[2] === "news") return parts[3];
  return parts[0] === "aion2" ? parts[2] : undefined;
}

function renderNotificationControl() {
  const notifications = storedNotifications().filter((item) => !/CM 이야기|CM 아지트/u.test(item.category || "") || item.gameId === game.id);
  const communityNotificationCount = window.todaypatchCommunity?.unreadNotificationCount() || 0;
  const unreadCount = notifications.filter((item) => !item.read).length + communityNotificationCount;
  const browserSupported = "Notification" in window;
  const browserPermission = browserSupported ? Notification.permission : "unsupported";
  const browserEnabled = readStorage("todaypatch.browserNotifications", false);
  const browserSetting = !browserSupported
    ? `<span class="notification-setting-note">이 브라우저는 데스크톱 알림을 지원하지 않습니다.</span>`
    : browserPermission === "denied"
      ? `<span class="notification-setting-note">브라우저 설정에서 알림 권한을 허용해 주세요.</span>`
      : `<button class="notification-setting-button" type="button" data-action="toggle-browser-notifications">브라우저 알림 ${browserEnabled ? "끄기" : "켜기"}</button>`;
  const communityItems = window.todaypatchCommunity?.renderNotificationItems() || "";
  const list = notifications.length || communityItems
    ? `<div class="notification-list">${notifications.slice(0, 30).map((item) => {
      const newsId = item.newsId || item.id;
      const exists = newsItems.some((news) => news.id === newsId);
      const href = exists ? `#/aion2/news/${encodeURIComponent(newsId)}` : item.url;
      const target = exists ? "" : 'target="_blank" rel="noopener noreferrer"';
      const notificationCategory = String(item.category || "새 소식").replace(/CM 이야기/g, "CM 아지트");
      return `<a class="notification-item ${item.read ? "read" : "unread"}" href="${escapeHTML(href)}" ${target} data-action="open-notification" data-id="${escapeHTML(item.id)}"><span class="notification-dot" aria-hidden="true"></span><span class="notification-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.gameId === game.id ? game.name : item.gameId)} · ${escapeHTML(notificationCategory)} · ${escapeHTML(item.date || "")}</small>${item.body ? `<small>${escapeHTML(item.body)}</small>` : ""}</span></a>`;
    }).join("")}${communityItems}</div>`
    : `<div class="notification-empty"><strong>새 알림이 없습니다.</strong><p>팔로우한 게임의 새 소식과 커뮤니티 반응 알림이 여기에 표시됩니다.</p></div>`;

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
  const currentParts = routeParts();
  const isCommunityRoute = kind.startsWith("community");
  const communityGameId = new URLSearchParams(currentRoute().split("?")[1] || "").get("gameId");
  const communityGame = gameCatalog.find((item) => item.id === communityGameId) || game;
  const isDokkaebi = (currentParts[0] === "game" && currentParts[1] === "dokkaebi-world") || (isCommunityRoute && communityGameId === "dokkaebi-world");
  const communityOnly = isCommunityRoute && !["aion2", "dokkaebi-world"].includes(communityGameId || "aion2");
  const inGame = !["home", "dashboard", "game-hub"].includes(kind);
  const selectedGame = isDokkaebi || kind === "game-hub" ? (isCommunityRoute ? communityGame : gameCatalog.find((item) => item.id === currentParts[1])) : null;
  const isDark = document.documentElement.dataset.theme === "dark";
  const themeLabel = isDark ? "라이트 모드" : "다크 모드";
  const themeIcon = isDark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.7 8.7 0 1 0 20.4 15.2Z"/></svg>';
  const links = communityOnly ? [
    ["게임 찾기", "#/", "game-list"],
    ["커뮤니티", `#/community?gameId=${encodeURIComponent(communityGame.id)}`, "community"],
  ] : isDokkaebi ? [
    ["개요", "#/game/dokkaebi-world", "dokebi-home"],
    ["전체 소식", "#/game/dokkaebi-world/news", "dokebi-news"],
    ["공지", "#/game/dokkaebi-world/notices", "dokebi-notices"],
    ["업데이트", "#/game/dokkaebi-world/updates", "dokebi-updates"],
    ["공략", "#/game/dokkaebi-world/guides", "dokebi-guides"],
    ["커뮤니티", "#/community?gameId=dokkaebi-world", "community"],
  ] : [
    ["전체 소식", "#/aion2", "game-home"],
    ["공지", "#/aion2/notices", "notices"],
    ["업데이트", "#/aion2/updates", "updates"],
    ["CM 아지트", "#/aion2/cm-stories", "cm-stories"],
    ["할 일", "#/aion2/tasks", "tasks"],
    ["북마크", "#/aion2/bookmarks", "bookmarks"],
    ["커뮤니티", "#/community?gameId=aion2", "community"],
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
        ${inGame ? `<a class="header-game" href="${isDokkaebi ? escapeHTML(selectedGame.route) : isCommunityRoute ? escapeHTML(communityGame.route || "#/community") : "#/aion2"}"><span class="header-divider" aria-hidden="true"></span>${isDokkaebi ? `<img class="header-game-icon" src="${escapeHTML(selectedGame.icon)}" alt="" />` : ""}${escapeHTML(isDokkaebi ? selectedGame.name : isCommunityRoute ? communityGame.name : game.name)}</a>
          <button class="mobile-menu-button" data-action="mobile-menu" aria-label="게임 메뉴 열기" aria-expanded="false">☰</button>
          <nav class="main-nav" id="main-nav" aria-label="${escapeHTML(isCommunityRoute ? communityGame.name : selectedGame?.name || game.name)} 메뉴">
            ${links.map(([label, href, routeKey]) => {
              const segment = currentParts[2] || "";
              const dokkaebiActive = isDokkaebi && !isCommunityRoute && (routeKey === "dokebi-home" ? !segment : routeKey === "dokebi-news" ? segment === "news" || kind === "dokkaebi-detail" : routeKey === `dokebi-${segment}`);
              const active = routeKey === "community" ? isCommunityRoute : isDokkaebi ? dokkaebiActive : kind === routeKey || (routeKey === "game-home" && kind === "news") || (kind === "detail" && routeKey === activeDetailRoute);
              return `<a class="nav-link ${active ? "active" : ""}" href="${href}" ${active ? 'aria-current="page"' : ""}>${label}</a>`;
            }).join("")}
          </nav>` : selectedGame ? `<span class="header-caption">${escapeHTML(selectedGame.name)}</span>` : ""}
        <div class="header-controls ${inGame ? "in-game" : ""}">
          <button class="theme-toggle" type="button" data-action="toggle-theme" aria-label="${themeLabel}로 전환" title="${themeLabel}로 전환">${themeIcon}<span>${themeLabel}</span></button>
          ${renderNotificationControl()}
          ${window.todaypatchCommunity?.renderAccountControl() || ""}
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
      ${renderFollowedGameShortcuts()}
      <section class="home-content-grid" aria-label="팔로우한 게임 소식과 공략">
        ${renderPatchBriefPanel()}
        ${renderUpcomingReleases()}
        ${renderPopularGuides()}
        ${renderPopularPosts()}
        ${renderFollowedNewsPanel()}
        ${renderCommunityHomePanel()}
      </section>
    </main>`;
}

function renderCommunityHomePanel() {
  const followed = followedGameIds();
  const preview = window.todaypatchCommunity?.renderPreview(followed, 4) || "";
  return `<section class="home-content-panel home-community-panel" aria-labelledby="community-home-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">COMMUNITY</span><h2 id="community-home-heading">팔로우한 게임 커뮤니티</h2></div><a href="#/community?gameId=aion2">게시판 보기 →</a></div>${followed.length ? preview : `<div class="home-section-empty"><strong>게임을 팔로우해 보세요.</strong><p>팔로우한 게임의 새 커뮤니티 글을 여기에 모아 보여드립니다.</p><a href="#/community?gameId=aion2">아이온2 커뮤니티 둘러보기 →</a></div>`}</section>`;
}

function renderFollowedGameShortcuts() {
  const followedGames = gameCatalog.filter((item) => isGameFollowed(item.id));
  return `<section class="home-shortcuts" aria-label="팔로우한 게임 바로가기"><div class="home-game-shortcuts">${followedGames.length
    ? followedGames.map((item) => `<a class="home-game-shortcut" href="${escapeHTML(item.route)}" data-game-menu="remove" data-game-id="${escapeHTML(item.id)}" title="${escapeHTML(item.name)} 열기 · 우클릭 또는 길게 눌러 팔로우 해제"><span class="home-game-shortcut-icon"><img src="${escapeHTML(item.icon)}" alt="" /></span><span>${escapeHTML(item.name)}</span></a>`).join("")
    : `<p class="home-shortcut-empty">게임을 팔로우하면 아이콘이 여기에 표시됩니다.</p>`}</div></section>`;
}

function followedNewsItems() {
  const followed = new Set(followedGameIds());
  return newsItems.filter((item) => followed.has(item.gameId || game.id))
    .sort((left, right) => String(right.postedAt || "").localeCompare(String(left.postedAt || "")));
}

function renderFollowedNewsPanel() {
  const posts = followedNewsItems().slice(0, 6);
  const emptyMessage = followedGameIds().length
    ? "팔로우한 게임의 새 게시글을 크롤링하면 이곳에 모아 보여드릴게요."
    : "게임을 팔로우하면 해당 게임의 새 게시글을 여기서 확인할 수 있어요.";
  return `<section class="home-content-panel home-followed-news" aria-labelledby="followed-news-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">FOLLOWED GAMES</span><h2 id="followed-news-heading">팔로우한 게임 게시글</h2></div><span>${posts.length}건</span></div>${posts.length
    ? `<div class="home-post-list">${posts.map((item) => `<a class="home-post-row" href="#/aion2/news/${encodeURIComponent(item.id)}" data-action="record-article-view" data-id="${escapeHTML(item.id)}"><div class="home-post-meta"><span class="category-pill category-${categoryClass(displayNewsCategory(item))}">${escapeHTML(displayNewsCategory(item))}</span><span>${escapeHTML(item.date || "")}</span></div><strong>${escapeHTML(item.title)}</strong><span class="home-post-game">${escapeHTML(gameCatalog.find((entry) => entry.id === (item.gameId || game.id))?.name || game.name)} · 게시물 보기 →</span></a>`).join("")}</div>`
    : `<div class="home-section-empty"><strong>새 글이 아직 없어요.</strong><p>${escapeHTML(emptyMessage)}</p></div>`}</section>`;
}

function renderPatchBriefPanel() {
  const item = newsItems.find((entry) => isAionNewsItem(entry) && entry.sourceKey === "update")
    || newsItems.find(isAionNewsItem);
  if (!item) return `<section class="home-content-panel home-patch-brief-panel"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">TODAY'S PATCH</span><h2>오늘의 패치 브리핑</h2></div></div><div class="home-section-empty"><strong>새 패치 소식을 준비 중이에요.</strong><p>다음 크롤링 후 주요 업데이트를 이곳에서 확인할 수 있습니다.</p></div></section>`;
  const summary = item.summary || item.excerpt || "새 업데이트의 주요 내용을 확인해 보세요.";
  return `<section class="home-content-panel home-patch-brief-panel" aria-labelledby="patch-brief-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">TODAY'S PATCH</span><h2 id="patch-brief-heading">오늘의 패치 브리핑</h2></div><span>최신 업데이트</span></div><div class="patch-brief-copy"><div class="home-post-meta"><span class="category-pill category-${categoryClass(displayNewsCategory(item))}">${escapeHTML(displayNewsCategory(item))}</span><span>${escapeHTML(item.date || "")}</span></div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(summary)}</p><a href="#/aion2/news/${encodeURIComponent(item.id)}" data-action="record-article-view" data-id="${escapeHTML(item.id)}">패치 내용 확인 <span aria-hidden="true">→</span></a></div></section>`;
}

function releaseCountdownParts(releaseDate, now = Date.now()) {
  let seconds = Math.max(0, Math.floor((new Date(releaseDate).getTime() - now) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return { days, hours, minutes, seconds };
}

function releaseDateLabel(releaseDate) {
  const date = new Date(releaseDate);
  if (Number.isNaN(date.getTime())) return "일정 확인 중";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "month")?.value}.${parts.find((part) => part.type === "day")?.value}`;
}

function renderReleaseCountdown(item) {
  const parts = releaseCountdownParts(item.releaseDate);
  const units = [["days", "Days"], ["hours", "Hours"], ["minutes", "Min"], ["seconds", "Sec"]];
  return `<div class="release-countdown" data-release-countdown data-release-at="${escapeHTML(item.releaseDate)}" aria-live="off">${units.map(([key, label], index) => `${index ? '<span class="release-countdown-separator" aria-hidden="true">:</span>' : ""}<span class="release-countdown-unit"><strong data-countdown-part="${key}">${String(parts[key]).padStart(2, "0")}</strong><small>${label}</small></span>`).join("")}</div>`;
}

function renderUpcomingReleases() {
  const now = Date.now();
  const upcoming = gameCatalog.filter((item) => item.upcoming && item.releaseDate && new Date(item.releaseDate).getTime() > now)
    .sort((left, right) => new Date(left.releaseDate) - new Date(right.releaseDate));
  if (!upcoming.length) return "";
  const featured = upcoming[0];
  return `<section class="home-content-panel home-release-panel" aria-labelledby="release-panel-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">COMING SOON</span><h2 id="release-panel-heading">출시 카운트다운</h2></div><span>${upcoming.length}개</span></div><a class="release-featured" href="${escapeHTML(featured.route)}" aria-label="${escapeHTML(featured.displayTitle || featured.name)} 게임 정보 열기"><img src="${escapeHTML(featured.icon)}" alt="" /><span class="release-featured-copy"><span class="release-date-label"><strong>출시</strong><time>${escapeHTML(releaseDateLabel(featured.releaseDate))}</time></span><strong class="release-game-title">${escapeHTML(featured.displayTitle || featured.name)}</strong><span class="release-clock-label"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>출시까지 남은 시간</span>${renderReleaseCountdown(featured)}</span></a>${upcoming.length > 1 ? `<div class="release-upcoming-list">${upcoming.slice(1).map((item) => `<a href="${escapeHTML(item.route)}"><span class="release-list-tag">출시</span><strong>${escapeHTML(item.displayTitle || item.name)}</strong><time>${escapeHTML(releaseDateLabel(item.releaseDate))}</time></a>`).join("")}</div>` : ""}</section>`;
}

function popularGuideEntries() {
  const guideHeadingPattern = /공략|가이드|방법|경로|설정|세팅|스킬|직업|성장|육성/u;
  const storedCounts = readStorage("todaypatch.articleViews", {});
  const viewCounts = storedCounts && typeof storedCounts === "object" && !Array.isArray(storedCounts) ? storedCounts : {};
  const entries = [];
  for (const item of newsItems.filter(isAionNewsItem)) {
    const sections = Array.isArray(item.sections) ? item.sections : [];
    const usefulSections = sections.filter((section) => {
      if (!section || typeof section !== "object") return false;
      const details = Array.isArray(section.importantDetails) ? section.importantDetails : [];
      return guideHeadingPattern.test(`${section.heading || ""} ${section.summary || ""} ${details.join(" ")}`);
    });
    const guideSection = usefulSections.sort((left, right) => {
      const relevance = (section) => {
        const details = Array.isArray(section.importantDetails) ? section.importantDetails : [];
        return (`${section.heading || ""} ${section.summary || ""} ${details.join(" ")}`.match(/공략|가이드|방법|스킬|세팅|경로/gu) || []).length;
      };
      return relevance(right) - relevance(left);
    })[0];
    const isGuidePost = /공략|가이드/u.test(`${item.title || ""} ${item.category || ""}`);
    if (!guideSection && !isGuidePost) continue;
    const details = Array.isArray(guideSection?.importantDetails) ? guideSection.importantDetails : [];
    const keywords = `${guideSection?.heading || ""} ${guideSection?.summary || ""} ${details.join(" ")}`;
    const viewScore = Math.min(20, Number(viewCounts[item.id]) || 0) * 2;
    entries.push({
      item,
      title: guideSection?.heading || item.title,
      description: guideSection?.summary || details[0] || item.summary || item.excerpt || "",
      score: viewScore + Number(isSaved(item.id)) * 4 + Number(isRead(item.id)) + (keywords.match(/방법|공략|가이드|스킬|세팅|경로/gu) || []).length,
    });
  }
  return entries.sort((left, right) => right.score - left.score || String(right.item.postedAt || "").localeCompare(String(left.item.postedAt || ""))).slice(0, 5);
}

function renderPopularGuides() {
  const entries = popularGuideEntries();
  return `<section class="home-content-panel home-guides-panel" aria-labelledby="popular-guides-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">POPULAR GUIDES</span><h2 id="popular-guides-heading">인기 공략글</h2></div><span>열람·저장·내용 관련도</span></div>${entries.length
    ? `<div class="home-guide-list">${entries.map((entry) => `<a class="home-guide-row" href="#/aion2/news/${encodeURIComponent(entry.item.id)}" data-action="record-article-view" data-id="${escapeHTML(entry.item.id)}"><span class="home-guide-category">${escapeHTML(displayNewsCategory(entry.item))} · ${escapeHTML(entry.item.date || "")}</span><strong>${escapeHTML(entry.title)}</strong><p>${escapeHTML(entry.description)}</p><small>${escapeHTML(entry.item.title)}</small></a>`).join("")}</div>`
    : `<div class="home-section-empty"><strong>공략 정보를 준비 중이에요.</strong><p>크롤링된 게시물에서 방법·스킬·세팅 관련 정보가 수집되면 여기에 표시됩니다.</p></div>`}</section>`;
}

function popularPostEntries() {
  const storedCounts = readStorage("todaypatch.articleViews", {});
  const viewCounts = storedCounts && typeof storedCounts === "object" && !Array.isArray(storedCounts) ? storedCounts : {};
  return newsItems.filter(isAionNewsItem).map((item) => ({
    item,
    score: Math.min(50, Number(viewCounts[item.id]) || 0) * 2 + Number(isSaved(item.id)) * 4 + Number(isRead(item.id)),
  })).sort((left, right) => right.score - left.score || String(right.item.postedAt || "").localeCompare(String(left.item.postedAt || ""))).slice(0, 4);
}

function renderPopularPosts() {
  const entries = popularPostEntries();
  return `<section class="home-content-panel home-popular-posts-panel" aria-labelledby="popular-posts-heading"><div class="home-panel-heading"><div><span class="home-guide-eyebrow">POPULAR POSTS</span><h2 id="popular-posts-heading">인기 게시글</h2></div><span>열람 · 저장 · 최신순</span></div>${entries.length
    ? `<div class="home-guide-list">${entries.map(({ item }) => `<a class="home-guide-row home-popular-post-row" href="#/aion2/news/${encodeURIComponent(item.id)}" data-action="record-article-view" data-id="${escapeHTML(item.id)}"><span class="home-guide-category">${escapeHTML(displayNewsCategory(item))} · ${escapeHTML(item.date || "")}</span><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.summary || item.excerpt || "게시물 핵심 내용을 확인해 보세요.")}</p><small>${escapeHTML(displayNewsSource(item))}</small></a>`).join("")}</div>`
    : `<div class="home-section-empty"><strong>게시글을 준비 중이에요.</strong><p>새 글을 수집하면 인기 게시글에 표시됩니다.</p></div>`}</section>`;
}

function updateReleaseCountdowns() {
  app.querySelectorAll("[data-release-countdown]").forEach((element) => {
    const parts = releaseCountdownParts(element.dataset.releaseAt);
    for (const [key, value] of Object.entries(parts)) {
      const target = element.querySelector(`[data-countdown-part="${key}"]`);
      if (target) target.textContent = String(value).padStart(2, "0");
    }
  });
}

function startReleaseCountdowns() {
  if (releaseCountdownTimer) window.clearInterval(releaseCountdownTimer);
  releaseCountdownTimer = null;
  if (!app.querySelector("[data-release-countdown]")) return;
  updateReleaseCountdowns();
  releaseCountdownTimer = window.setInterval(updateReleaseCountdowns, 1000);
}

function closeFollowContextMenu() {
  app.querySelector(".follow-context-menu")?.remove();
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

function renderGameHome() {
  return renderFeedPage("news");
}

function renderCatalogGamePage() {
  const item = gameCatalog.find((entry) => entry.id === routeParts()[1]);
  if (!item) return `<main class="page-width not-found"><h1>게임을 찾을 수 없어요.</h1><a class="primary-button" href="#/">게임 찾기로 돌아가기</a></main>`;
  if (item.id === "dokkaebi-world") return renderDokkaebiPage();
  const followed = isGameFollowed(item.id);
  return `
    <main class="page-width game-page game-hub-page">
      <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><span>${escapeHTML(item.name)}</span></div>
      <div class="page-heading"><div><span class="page-eyebrow">${item.upcoming ? "UPCOMING GAME" : "GAME HUB"}</span><h1>${escapeHTML(item.name)}</h1><p>${item.upcoming ? "출시를 기다리는 게임입니다. 팔로우하면 관심 게임 목록에서 모아볼 수 있어요." : "게임 소식을 모아볼 수 있도록 팔로우할 수 있습니다."}</p></div></div>
      <section class="game-hub-card"><img src="${escapeHTML(item.icon)}" alt="" /><div><strong>${escapeHTML(item.name)}</strong><p>${item.upcoming ? "출시 예정" : "게임 소식 연동 준비 중"}</p></div><button class="game-follow-button ${followed ? "following" : ""}" type="button" data-action="${followed ? "toggle-follow" : "follow-game"}" data-game-id="${escapeHTML(item.id)}" aria-pressed="${followed}">${followed ? "팔로우 해제" : "팔로우"}</button></section>
      <div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>현재 공지·업데이트 크롤링은 아이온2에 연결되어 있습니다. 다른 게임의 소식 데이터는 준비 중입니다.</p></div>
    </main>`;
}

function renderDokkaebiPage() {
  const item = gameCatalog.find((entry) => entry.id === "dokkaebi-world");
  const followed = isGameFollowed(item.id);
  const category = state.dokkaebiFilter;
  const heading = category === "전체" ? "도깨비의 세계 소식" : `도깨비의 세계 ${category}`;
  return `
    <main class="page-width game-page listing-page dokkaebi-page">
      <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><span>${escapeHTML(item.name)}</span>${category === "전체" ? "" : `<span aria-hidden="true">›</span><span>${escapeHTML(category)}</span>`}</div>
      <div class="page-heading"><div><span class="page-eyebrow">DOKKAEBI WORLD GAME HUB</span><h1>${escapeHTML(heading)}</h1><p>도깨비의 세계 게임 정보와 소식을 검색하고 분류해 보세요.</p></div></div>
      <section class="game-hub-card"><img src="${escapeHTML(item.icon)}" alt="" /><div><strong>${escapeHTML(item.name)}</strong><p>게임 소식과 공략을 검색할 수 있습니다.</p></div><button class="game-follow-button ${followed ? "following" : ""}" type="button" data-action="${followed ? "toggle-follow" : "follow-game"}" data-game-id="${escapeHTML(item.id)}" aria-pressed="${followed}">${followed ? "팔로우 해제" : "팔로우"}</button></section>
      <div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>공식 데이터 연동 전입니다. 아래는 검색과 페이지 구성을 위한 예시 콘텐츠입니다.</p></div>
      <section class="content-section feed-section">
        <div class="feed-tools">
          <label class="search-field news-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg><input id="dokkaebi-search" type="search" value="${escapeHTML(state.dokkaebiQuery)}" placeholder="도깨비의 세계 정보 검색" autocomplete="off" aria-label="도깨비의 세계 정보 검색" /></label>
          <div class="filter-row" aria-label="도깨비의 세계 정보 유형 필터">${["전체", "공지", "업데이트", "공략"].map((label) => `<button class="filter-chip ${category === label ? "selected" : ""}" type="button" data-action="dokkaebi-filter" data-filter="${label}" aria-pressed="${category === label}">${label}</button>`).join("")}</div>
        </div>
        <div class="section-heading list-heading"><div><h2>${escapeHTML(heading)}</h2><p>검색 결과 <span id="dokkaebi-count"></span></p></div></div>
        <div class="news-list" id="dokkaebi-news-list"></div>
        <div class="empty-state" id="dokkaebi-empty-state" hidden><span aria-hidden="true">⌕</span><strong>검색 결과가 없어요.</strong><p>다른 단어를 입력하거나 정보 유형을 바꿔 보세요.</p></div>
      </section>
    </main>`;
}

function renderDokkaebiNewsCard(item) {
  return `<article class="news-card"><a class="news-main" href="#/game/dokkaebi-world/news/${encodeURIComponent(item.id)}" aria-label="${escapeHTML(item.title)} 상세 보기"><div class="news-topline"><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><span class="news-source">${escapeHTML(item.source)} · ${escapeHTML(item.date)}</span></div><h3>${escapeHTML(item.title)}</h3><p class="news-excerpt">${escapeHTML(item.excerpt)}</p><div class="news-meta">${escapeHTML(item.meta)}</div></a></article>`;
}

function renderDokkaebiDetail(id) {
  const item = dokkaebiNewsItems.find((entry) => entry.id === id);
  if (!item) return `<main class="page-width not-found"><h1>정보를 찾을 수 없어요.</h1><a class="primary-button" href="#/game/dokkaebi-world/news">도깨비의 세계 소식으로 돌아가기</a></main>`;
  return `<main class="page-width game-page detail-page"><div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><a href="#/game/dokkaebi-world">도깨비의 세계</a><span aria-hidden="true">›</span><span>${escapeHTML(item.category)}</span></div><div class="page-heading"><div><span class="page-eyebrow">DOKKAEBI WORLD</span><h1>${escapeHTML(item.title)}</h1><p>${escapeHTML(item.excerpt)}</p></div></div><div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>공식 데이터 연동 전 페이지 구성 예시입니다.</p></div><article class="article-panel"><div class="panel-heading"><h2>내용 요약</h2><span class="example-label">예시 콘텐츠</span></div><p class="summary-copy">${escapeHTML(item.summary)}</p>${item.keyPoints.length ? `<ul class="key-point-list">${item.keyPoints.map((point) => `<li>${escapeHTML(point)}</li>`).join("")}</ul>` : ""}<div class="info-list"><div><dt>정보 유형</dt><dd>${escapeHTML(item.category)}</dd></div><div><dt>출처 표시</dt><dd>${escapeHTML(item.source)}</dd></div></div><a class="back-link" href="#/game/dokkaebi-world/news">← 도깨비의 세계 정보 목록</a></article></main>`;
}

function renderFilterBar(kind) {
  const pageCategories = kind === "news" ? categories : ["전체"];
  return `
    <div class="feed-tools">
      <label class="search-field news-search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input id="news-search" type="search" value="${escapeHTML(state.query)}" placeholder="제목, 요약, 키워드 검색" autocomplete="off" aria-label="아이온2 정보 검색" />
      </label>
      <div class="filter-row" aria-label="정보 유형 필터">
        ${pageCategories.map((category) => `<button class="filter-chip ${state.filter === category ? "selected" : ""}" data-action="filter" data-filter="${category}" aria-pressed="${state.filter === category}">${category}</button>`).join("")}
      </div>
    </div>`;
}

function categoryClass(category) {
  return category === "공지" ? "notice" : category === "CM 아지트" || category === "CM 이야기" ? "cm" : category === "공략" || category === "가이드" ? "guide" : category === "이벤트" ? "event" : "update";
}

function renderNewsCard(item) {
  const bookmarked = isSaved(item.id);
  const read = isRead(item.id);
  return `
    <article class="news-card ${read ? "is-read" : ""}">
      <a class="news-main" href="#/aion2/news/${encodeURIComponent(item.id)}" data-action="record-article-view" data-id="${escapeHTML(item.id)}" aria-label="${escapeHTML(item.title)} 상세 보기">
        <div class="news-topline"><span class="category-pill category-${categoryClass(displayNewsCategory(item))}">${escapeHTML(displayNewsCategory(item))}</span><span class="news-source">${escapeHTML(displayNewsSource(item))} · ${escapeHTML(item.date)}</span>${read ? '<span class="read-badge">읽음</span>' : ""}</div>
        <h3>${escapeHTML(item.title)}</h3>
      </a>
      <a class="news-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(item.title)} 공식 본문 열기">본문 원문 <span aria-hidden="true">↗</span></a>
      <button class="bookmark-button ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg>
      </button>
    </article>`;
}

function renderBookmarksPage() {
  const bookmarks = newsItems.filter((item) => isAionNewsItem(item) && isSaved(item.id));
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

function normalizeCalendarDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!match) return "";
  const [, yearText, monthText, dayText, hour, minute] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  if (hour && (Number(hour) > 23 || Number(minute) > 59)) return "";
  return `${yearText}-${monthText}-${dayText}${hour ? `T${hour}:${minute}` : ""}`;
}

function parseExplicitDates(text, articleDate) {
  const base = String(articleDate || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  const baseYear = Number(base?.[1]) || new Date().getFullYear();
  const baseMonth = Number(base?.[2]) || 1;
  const datePattern = /(?:(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?|(?<!\d)(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?)(?:\s*\([^)]*\))?/g;
  const dates = [];
  for (const match of String(text || "").matchAll(datePattern)) {
    let year = Number(match[1]) || baseYear;
    const month = Number(match[2] || match[4]);
    const day = Number(match[3] || match[5]);
    if (!match[1] && month < baseMonth) year += 1;
    const tail = String(text).slice(match.index + match[0].length);
    const time = tail.match(/^\s*(?:(\d{1,2}):(\d{2})|(\d{1,2})시(?:\s*(\d{1,2})분)?)/);
    const dateValue = normalizeCalendarDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}${time ? `T${String(time[1] || time[3]).padStart(2, "0")}:${String(time[2] || time[4] || "00").padStart(2, "0")}` : ""}`);
    if (dateValue) dates.push({ value: dateValue, index: match.index, length: match[0].length });
  }
  return dates;
}

function stripExplicitDates(text) {
  const datePattern = /(?:(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?|(?<!\d)(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?)(?:\s*\([^)]*\))?/g;
  return String(text || "").replace(datePattern, " ").replace(/[~～]/g, " ").replace(/\s+/g, " ").replace(/^[,;:：\s]+|[,;:：\s]+$/g, "").trim();
}

function legacyCalendarEvents(item) {
  const sectionDetails = (Array.isArray(item.sections) ? item.sections : []).flatMap((section) => [
    ...(Array.isArray(section.importantDetails) ? section.importantDetails : []),
  ]);
  const lines = [...new Set([...(Array.isArray(item.keyPoints) ? item.keyPoints : []), ...sectionDetails].filter((line) => typeof line === "string" && line.trim()))];
  const dateTopics = /이벤트|시즌|쿠폰|보상|만료|종료|마감|기간|서버\s*이전|신청\s*시작|재적용|적용\s*일정/i;
  const events = [];
  lines.forEach((line, index) => {
    if (!dateTopics.test(line)) return;
    const dates = parseExplicitDates(line, item.date);
    if (!dates.length) return;
    const context = `${item.title || ""} ${line}`;
    const range = dates.length > 1 && /~|～|부터|기간/.test(line);
    const type = /시즌/i.test(context) ? "season"
      : /서버\s*이전|이전\s*신청/i.test(context) ? "server-transfer"
        : /쿠폰|보상|만료|수령/i.test(context) ? "reward-deadline"
          : /정책|적용\s*일정/i.test(line) ? "policy" : "event";
    const startAt = range || /신청\s*시작|시작\s*시점|오픈|적용\s*일정/i.test(line) ? dates[0].value : "";
    const endAt = range || /종료|마감|재적용|기한|까지/i.test(line) ? dates.at(-1).value : "";
    const deadlineAt = /만료|마감|기한|수령\s*기간/i.test(line) ? dates.at(-1).value : "";
    if (!startAt && !endAt && !deadlineAt) return;
    let title = "";
    if (/PC\s*방/i.test(context)) title = /출석/i.test(context) ? "PC방 출석 이벤트" : "PC방 접속 이벤트";
    else if (/재적용/i.test(line)) title = "거래소 정산 한도 재적용";
    else if (/서버\s*이전|이전\s*신청/i.test(context)) title = "무료 서버 이전 일정";
    else if (/쿠폰/i.test(context)) title = /만료/i.test(line) ? "쿠폰 보상 만료" : "감사 쿠폰 사용 기간";
    else if (/시즌/i.test(context)) title = "시즌 일정";
    else if (/운영정책/i.test(line)) title = "운영정책 변경 적용";
    else title = line.split(/[:：]/)[0].trim() || "공식 일정";

    const relatedPattern = type === "server-transfer" ? /서버\s*이전|이전\s*신청|재적용|정산\s*완료/i
      : type === "reward-deadline" ? /쿠폰|보상|만료|수령\s*캐릭터|계정당|이동\s*불가/i
        : type === "season" ? /시즌|시즌\s*미션/i
          : type === "policy" ? /운영정책|정책|적용/i : /이벤트|PC\s*방|접속|출석|응모/i;
    const details = [stripExplicitDates(line).replace(/^[^:：]{1,45}[:：]\s*/, "").trim(), ...lines.filter((relatedLine) => relatedLine !== line && relatedPattern.test(relatedLine)).slice(0, 2)]
      .filter((detail) => detail && detail.length > 2);
    const reward = lines.find((relatedLine) => relatedPattern.test(relatedLine) && /보상|지급|경품|쿠폰/.test(relatedLine)) || "";
    events.push({
      id: `${item.id}-derived-${index}`,
      gameId: item.gameId || game.id,
      gameName: gameCatalog.find((catalogItem) => catalogItem.id === (item.gameId || game.id))?.name || game.name,
      newsId: item.id,
      title,
      type,
      startAt,
      endAt,
      deadlineAt,
      conditions: [...new Set(details)].slice(0, 3),
      reward,
      details: line,
      url: item.url,
    });
  });
  return events.filter((event, index, all) => all.findIndex((candidate) => candidate.title === event.title
    && candidate.startAt === event.startAt && candidate.endAt === event.endAt && candidate.deadlineAt === event.deadlineAt) === index);
}

function normalizeArticleEvent(event, item, index) {
  const startAt = normalizeCalendarDate(event.startAt);
  const endAt = normalizeCalendarDate(event.endAt);
  const deadlineAt = normalizeCalendarDate(event.deadlineAt);
  if (!startAt && !endAt && !deadlineAt) return null;
  const type = ["event", "season", "server-transfer", "reward-deadline", "policy", "other"].includes(event.type) ? event.type : "other";
  return {
    id: `${item.id}-event-${index}`,
    gameId: item.gameId || game.id,
    gameName: gameCatalog.find((catalogItem) => catalogItem.id === (item.gameId || game.id))?.name || game.name,
    newsId: item.id,
    title: event.title || "공식 일정",
    type,
    startAt,
    endAt,
    deadlineAt,
    conditions: Array.isArray(event.conditions) ? event.conditions.filter((value) => typeof value === "string" && value.trim()).slice(0, 4) : [],
    reward: event.reward || "",
    details: event.details || "",
    url: item.url,
  };
}

function dashboardCalendarEvents() {
  const followedIds = new Set(followedGameIds());
  return newsItems.flatMap((item) => {
    const gameId = item.gameId || game.id;
    if (!followedIds.has(gameId)) return [];
    const explicit = Array.isArray(item.events) ? item.events.map((event, index) => normalizeArticleEvent(event, item, index)).filter(Boolean) : [];
    return explicit.length ? explicit : legacyCalendarEvents(item);
  }).sort((left, right) => {
    const leftDate = left.deadlineAt || left.endAt || left.startAt;
    const rightDate = right.deadlineAt || right.endAt || right.startAt;
    return leftDate.localeCompare(rightDate);
  });
}

function eventDateKey(value) {
  return normalizeCalendarDate(value).slice(0, 10);
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatEventDate(value) {
  const normalized = normalizeCalendarDate(value);
  if (!normalized) return "일정 날짜 미정";
  const [, year, month, day, hour, minute] = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  return `${year}. ${Number(month)}. ${Number(day)}.${hour ? ` ${hour}:${minute}` : ""}`;
}

function calendarOccurrenceLabel(event, kind) {
  if (kind === "start") {
    if (event.type === "server-transfer") return "서버 이전 신청 접수 시작";
    if (event.type === "season") return "시즌 시작";
    if (event.type === "reward-deadline") return "쿠폰·보상 사용 시작";
    if (event.type === "policy") return "정책 적용 시작";
    return event.type === "event" ? "이벤트 시작" : "일정 시작";
  }
  if (kind === "deadline") {
    if (event.type === "server-transfer") return "서버 이전 신청 마감";
    if (event.type === "season") return "시즌 보상 마감";
    return event.type === "reward-deadline" ? "보상 사용 마감" : "신청 마감";
  }
  if (event.type === "server-transfer") return "서버 이전 기간 종료";
  if (event.type === "season") return "시즌 종료";
  if (event.type === "reward-deadline") return "쿠폰·보상 기간 종료";
  return event.type === "event" ? "이벤트 종료" : "일정 종료";
}

function eventOccurrences(events) {
  return events.flatMap((event) => [
    event.startAt ? { date: eventDateKey(event.startAt), label: calendarOccurrenceLabel(event, "start"), event, kind: "start" } : null,
    event.endAt ? { date: eventDateKey(event.endAt), label: calendarOccurrenceLabel(event, "end"), event, kind: "end" } : null,
    event.deadlineAt ? { date: eventDateKey(event.deadlineAt), label: calendarOccurrenceLabel(event, "deadline"), event, kind: "deadline" } : null,
  ].filter(Boolean));
}

function renderCalendarEventLink(occurrence) {
  const accessibleLabel = `${occurrence.label} · ${occurrence.event.title}`;
  return `<a class="calendar-marker ${escapeHTML(occurrence.kind)}" href="#/aion2/news/${encodeURIComponent(occurrence.event.newsId)}" title="${escapeHTML(accessibleLabel)}" aria-label="${escapeHTML(accessibleLabel)}">${escapeHTML(occurrence.label)}</a>`;
}

function renderUpcomingCalendarEvent(event) {
  const targetDate = event.deadlineAt || event.endAt || event.startAt;
  const conditions = event.conditions.length
    ? `<ul>${event.conditions.map((condition) => `<li>${escapeHTML(condition)}</li>`).join("")}</ul>`
    : `<p>${escapeHTML(event.details || "공식 게시물에서 일정이 확인되었습니다.")}</p>`;
  return `<article class="calendar-upcoming-item"><div class="calendar-upcoming-date"><strong>${escapeHTML(formatEventDate(targetDate))}</strong><span>${escapeHTML({ event: "이벤트", season: "시즌", "server-transfer": "서버 이전", "reward-deadline": "보상 마감", policy: "정책 적용", other: "일정" }[event.type] || "일정")}</span></div><div class="calendar-upcoming-copy"><a href="#/aion2/news/${encodeURIComponent(event.newsId)}"><strong>${escapeHTML(event.title)}</strong></a>${conditions}${event.reward ? `<small>보상 · ${escapeHTML(event.reward)}</small>` : ""}</div></article>`;
}

function renderDashboardCalendar(events) {
  const today = new Date();
  const month = new Date(today.getFullYear(), today.getMonth() + state.calendarOffset, 1);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const startOffset = (month.getDay() + 6) % 7;
  const occurrences = eventOccurrences(events);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, 1 - startOffset + index);
    const key = localDateKey(date);
    const isCurrentMonth = date.getMonth() === monthIndex;
    const matching = occurrences.filter((occurrence) => occurrence.date === key);
    return `<div class="calendar-day ${isCurrentMonth ? "" : "outside-month"} ${key === localDateKey(today) ? "today" : ""}"><span class="calendar-day-number">${date.getDate()}</span><div class="calendar-day-events">${matching.slice(0, 2).map(renderCalendarEventLink).join("")}${matching.length > 2 ? `<small class="calendar-more-events">+${matching.length - 2}개</small>` : ""}</div></div>`;
  }).join("");
  const todayKey = localDateKey(today);
  const upcoming = events.map((event) => {
    const candidates = [event.deadlineAt, event.endAt, event.startAt].filter(Boolean).sort();
    const nextDate = candidates.find((value) => eventDateKey(value) >= todayKey);
    return nextDate ? { ...event, displayDate: nextDate } : null;
  }).filter(Boolean).sort((left, right) => left.displayDate.localeCompare(right.displayDate)).slice(0, 6);
  const monthLabel = `${year}년 ${monthIndex + 1}월`;
  return `
    <section class="dashboard-section dashboard-calendar" aria-labelledby="dashboard-calendar-title">
      <div class="dashboard-section-heading calendar-section-heading"><div><span class="page-eyebrow">EVENT CALENDAR</span><h2 id="dashboard-calendar-title">팔로우한 게임 일정</h2><p>크롤링한 공식 게시물에서 기간·종료일·보상 조건을 자동으로 모았습니다.</p></div></div>
      <div class="calendar-layout">
        <div class="calendar-month-view">
          <div class="calendar-month-heading"><button class="calendar-nav-button" type="button" data-action="calendar-previous" aria-label="이전 달">‹</button><strong>${monthLabel}</strong><button class="calendar-nav-button" type="button" data-action="calendar-next" aria-label="다음 달">›</button></div>
          <div class="calendar-weekdays" aria-hidden="true">${["월", "화", "수", "목", "금", "토", "일"].map((day) => `<span>${day}</span>`).join("")}</div>
          <div class="calendar-grid" aria-label="${monthLabel} 달력">${cells}</div>
          <div class="calendar-legend"><span><i class="start"></i>시작</span><span><i class="end"></i>종료·마감</span></div>
        </div>
        <aside class="calendar-upcoming"><h3>다가오는 일정</h3>${upcoming.length ? `<div class="calendar-upcoming-list">${upcoming.map(renderUpcomingCalendarEvent).join("")}</div>` : `<div class="calendar-empty"><strong>표시할 일정이 없습니다.</strong><p>팔로우한 게임의 새 공지를 크롤링하면 날짜가 명시된 이벤트와 시즌 일정이 여기에 추가됩니다.</p></div>`}</aside>
      </div>
    </section>`;
}

function renderUserPost(post) {
  const createdAt = post.createdAt ? formatDisplayDate(post.createdAt) : "날짜 정보 없음";
  return `<article class="user-post-card"><details><summary><span class="user-post-title">${escapeHTML(post.title)}</span><span class="user-post-date">${escapeHTML(createdAt)}</span></summary><p>${escapeHTML(post.body)}</p></details><button class="post-delete-button" type="button" data-action="delete-user-post" data-id="${escapeHTML(post.id)}">삭제</button></article>`;
}

function renderDashboardPage() {
  const followed = gameCatalog.filter((item) => isGameFollowed(item.id));
  const bookmarks = newsItems.filter((item) => isAionNewsItem(item) && isSaved(item.id));
  const posts = userPosts();
  const calendarEvents = dashboardCalendarEvents();
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
      <section class="dashboard-section dashboard-community" aria-labelledby="dashboard-community-title">
        <div class="dashboard-section-heading"><div><span class="page-eyebrow">FOLLOWED COMMUNITY</span><h2 id="dashboard-community-title">팔로우한 게임 새 게시글</h2><p>선택한 게임의 새 글을 한곳에서 확인하세요.</p></div><a class="dashboard-more" href="#/community?gameId=aion2">커뮤니티 열기 →</a></div>
        ${followed.length ? (window.todaypatchCommunity?.renderPreview(followed.map((item) => item.id), 5) || "") : `<div class="dashboard-empty"><p>게임을 팔로우하면 새 커뮤니티 글이 여기에 표시됩니다.</p><a href="#/">게임 찾아보기 →</a></div>`}
      </section>
      ${renderDashboardCalendar(calendarEvents)}
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
    news: ["아이온2 전체 소식", "공지, 업데이트, CM 아지트 게시물을 날짜순으로 확인하세요."],
    notices: ["아이온2 공식 공지", "공식 안내와 서비스 공지를 원문 링크와 함께 확인하세요."],
    updates: ["아이온2 업데이트", "최신 패치 노트와 업데이트 본문을 확인하세요."],
    "cm-stories": ["아이온2 CM 아지트", "아이온2 CM 아지트의 소식과 운영 안내를 확인하세요."],
  }[kind];
  return `
    <main class="page-width game-page listing-page">
      ${renderGameIntro(page[0], page[1], page[0])}
      <section class="content-section feed-section">
        ${renderFilterBar(kind)}
        <div class="section-heading list-heading"><div><h2>${page[0]}</h2><p>검색 결과 <span id="news-count"></span></p></div></div>
        <div class="news-list" id="news-list"></div>
        <div class="empty-state" id="empty-state" hidden><span aria-hidden="true">⌕</span><strong>게시물이 없어요.</strong><p>다른 단어를 입력하거나 다음 크롤링 후 다시 확인해 주세요.</p></div>
      </section>
    </main>`;
}

function taskEvidenceLines(item) {
  return [
    ...(Array.isArray(item.keyPoints) ? item.keyPoints : []),
    ...(Array.isArray(item.sections) ? item.sections.flatMap((section) => [
      ...(Array.isArray(section.importantDetails) ? section.importantDetails : []),
      section.summary,
    ]) : []),
    item.summary,
    item.analysis,
    item.excerpt,
    item.title,
  ].filter((line) => typeof line === "string" && line.trim());
}

const patchTaskRules = [
  { id: "coupon", match: /쿠폰\s*(코드|번호)?|쿠폰코드/u, evidence: /쿠폰|코드|사용 기간|만료/u, title: "쿠폰을 등록하고 보상 기한 확인하기", priority: 1, topics: /쿠폰|보상|사용|만료/u },
  { id: "server-transfer", match: /서버\s*이전|이전\s*신청/u, evidence: /서버\s*이전|이전\s*신청|정산/u, title: "서버 이전 일정과 정산 조건 확인하기", priority: 1, topics: /서버\s*이전|이전\s*신청|정산/u },
  { id: "event", match: /이벤트|PC\s*방|출석/u, evidence: /이벤트|PC\s*방|출석|참여 조건/u, title: "이벤트 참여 조건을 확인하고 보상 챙기기", priority: 2, topics: /이벤트|PC\s*방|출석|보상/u },
  { id: "season", match: /시즌|시즌\s*미션/u, evidence: /시즌|미션|종료|보상/u, title: "시즌 종료 전 미션과 보상 점검하기", priority: 2, topics: /시즌|미션|종료|보상/u },
  { id: "class", match: /직업|클래스|스킬|밸런스/u, evidence: /직업|클래스|스킬|밸런스|피해량/u, title: "직업 변경 내용을 확인하고 스킬 세팅 점검하기", priority: 3, topics: /직업|클래스|스킬|밸런스/u },
  { id: "policy", match: /계정당|각인|이동 불가|수령 캐릭터/u, evidence: /계정당|각인|이동 불가|수령 캐릭터/u, title: "보상 대상과 아이템 제한 조건 확인하기", priority: 3, topics: /계정당|각인|이동 불가|수령 캐릭터/u },
  { id: "update", match: /업데이트|패치|변경/u, evidence: /업데이트|패치|변경|추가|조정|개선/u, title: "업데이트 변경 사항을 확인하고 필요한 설정 점검하기", priority: 4, topics: /업데이트|패치|변경|추가|조정|개선/u, sourceKey: "update" },
];

function taskDueDate(item, rule, evidence) {
  const eventPattern = rule.id === "coupon" || rule.id === "policy" ? /쿠폰|보상|만료|수령|정책/u
    : rule.id === "server-transfer" ? /서버\s*이전|이전\s*신청|정산/u
      : rule.id === "season" ? /시즌|미션/u
        : rule.id === "event" ? /이벤트|PC\s*방|출석/u : rule.topics;
  const events = [
    ...(Array.isArray(item.events) ? item.events.map((event, index) => normalizeArticleEvent(event, item, index)).filter(Boolean) : []),
    ...legacyCalendarEvents(item),
  ];
  const matchingEvent = events.find((event) => eventPattern.test(`${event.title || ""} ${event.details || ""} ${(event.conditions || []).join(" ")}`)
    && (event.deadlineAt || event.endAt || event.startAt));
  if (matchingEvent?.deadlineAt) return { value: normalizeCalendarDate(matchingEvent.deadlineAt), label: "마감" };
  if (matchingEvent?.endAt) return { value: normalizeCalendarDate(matchingEvent.endAt), label: "종료" };
  if (matchingEvent?.startAt) return { value: normalizeCalendarDate(matchingEvent.startAt), label: "시작" };

  const datedLine = evidence.find((line) => rule.topics.test(line) && /기간|기한|마감|종료|만료|까지/u.test(line));
  const dates = parseExplicitDates(datedLine || "", item.date);
  return dates.length ? { value: dates.at(-1).value, label: /마감|종료|만료|까지/u.test(datedLine) ? "기한" : "일정" } : { value: "", label: "" };
}

function buildPatchTaskRecommendations() {
  const items = [...newsItems].filter(isAionNewsItem).sort((left, right) => String(right.postedAt || "").localeCompare(String(left.postedAt || "")));
  const candidates = [];
  for (const item of items) {
    const lines = taskEvidenceLines(item);
    const fullText = `${item.title || ""} ${item.summary || ""} ${item.analysis || ""} ${lines.join(" ")}`;
    for (const rule of patchTaskRules) {
      if (rule.sourceKey && item.sourceKey !== rule.sourceKey) continue;
      if (!rule.match.test(fullText)) continue;
      const evidence = lines.find((line) => rule.evidence.test(line)) || item.summary || item.title;
      const due = taskDueDate(item, rule, lines);
      const dueAt = due.value;
      if (dueAt && calendarDaysUntil(dueAt) < 0) continue;
      candidates.push({
        id: `recommend-${item.id}-${rule.id}`,
        title: rule.title,
        evidence,
        item,
        dueAt,
        dueLabel: due.label,
        priority: rule.priority,
        priorityLabel: dueAt ? "기한 확인" : rule.priority <= 2 ? "먼저 확인" : "패치 점검",
      });
    }
  }
  return candidates.sort((left, right) => {
    if (left.dueAt && right.dueAt && left.dueAt !== right.dueAt) return left.dueAt.localeCompare(right.dueAt);
    if (left.dueAt !== right.dueAt) return left.dueAt ? -1 : 1;
    return left.priority - right.priority || String(right.item.postedAt || "").localeCompare(String(left.item.postedAt || ""));
  }).slice(0, 12);
}

function renderTask(task, checked) {
  const due = task.dueAt ? `${task.dueLabel} · ${formatDisplayDate(task.dueAt)}` : task.priorityLabel;
  return `
    <div class="task-row ${checked ? "completed" : ""}">
      <button class="task-check" data-action="toggle-task" data-id="${escapeHTML(task.id)}" aria-label="${checked ? "완료 취소" : "완료 표시"}" aria-pressed="${Boolean(checked)}">${checked ? "✓" : ""}</button>
      <div class="task-copy"><div class="task-title-line"><strong>${escapeHTML(task.title)}</strong><span class="task-suggestion-tag">추천</span></div><p class="task-evidence">게시물 근거: ${escapeHTML(task.evidence)}</p><a href="#/aion2/news/${encodeURIComponent(task.item.id)}">근거 ${escapeHTML(displayNewsCategory(task.item))} · ${escapeHTML(task.item.title)}</a></div>
      <span class="task-due">${escapeHTML(due)}</span>
    </div>`;
}

function renderTasksPage() {
  const checked = savedTasks();
  const taskItems = buildPatchTaskRecommendations();
  const count = taskItems.filter((task) => checked[task.id]).length;
  return `
    <main class="page-width game-page listing-page tasks-page">
      ${renderGameIntro("패치 후 할 일", "크롤링된 공지의 핵심 정보에서 먼저 할 일을 추천합니다.", "할 일")}
      <section class="task-panel">
        <div class="task-panel-heading"><div><span class="page-eyebrow">PATCH ACTIONS</span><h2>패치 후 추천 할 일</h2></div><span class="task-progress">${count} / ${taskItems.length} 완료</span></div>
        <p class="section-description">요약·분석과 중요 항목에서 쿠폰, 신청 기간, 이벤트 조건, 직업 변경 단서를 찾아 우선순위를 정합니다. 추천 근거와 원문을 확인한 뒤 체크해 보세요.</p>
        ${taskItems.length ? `<div class="task-list">${taskItems.map((task) => renderTask(task, checked[task.id])).join("")}</div>` : `<div class="task-empty"><strong>추천할 할 일이 아직 없습니다.</strong><p>다음 크롤링에서 실행할 내용이 있는 공지를 수집하면 이곳에 표시됩니다.</p></div>`}
        <div class="task-legend"><span><i class="legend-suggestion"></i>게시물에서 추정한 추천</span><span><i class="legend-official"></i>원문 근거 연결</span></div>
      </section>
    </main>`;
}

function renderDetail(id) {
  const item = newsItems.find((news) => news.id === id);
  if (!item || !isAionNewsItem(item) || ((item.sourceKey === "cm-story" || item.category === "CM 이야기" || item.category === "CM 아지트") && !isAionCmStory(item))) return `<main class="page-width not-found"><h1>정보를 찾을 수 없어요.</h1><a class="primary-button" href="#/aion2">아이온2 정보로 돌아가기</a></main>`;
  const bookmarked = isSaved(item.id);
  const summary = item.summary || item.excerpt || "요약 정보를 준비하지 못했습니다. 공식 원문을 확인해 주세요.";
  const analysis = item.analysis || "분석 정보가 없습니다. 아래 공식 원문에서 자세한 내용을 확인해 주세요.";
  const keyPoints = Array.isArray(item.keyPoints) ? item.keyPoints : [];
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const detailedSections = sections.length
    ? `<div class="analysis-sections"><h3>원문 파트별 핵심 내용</h3>${sections.map((section) => {
      const details = Array.isArray(section.importantDetails) ? section.importantDetails : [];
      return `<section class="analysis-section"><h4>${escapeHTML(section.heading)}</h4><p>${renderSentenceLines(section.summary)}</p>${details.length ? `<ul>${details.map((detail) => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>` : ""}</section>`;
    }).join("")}</div>`
    : keyPoints.length ? `<ul class="key-point-list">${keyPoints.map((point) => `<li>${escapeHTML(point)}</li>`).join("")}</ul>` : "";
  const sourceRoute = { notice: "notices", update: "updates", "cm-story": "cm-stories" }[item.sourceKey] || "news";
  return `
    <main class="page-width game-page detail-page">
      ${renderGameIntro("게시물 상세", "AI가 핵심 내용을 정리하고 분석한 결과를 확인하세요.", "게시물 상세")}
      <div class="detail-layout">
        <article class="detail-main">
          <div class="detail-title-row"><div><span class="category-pill category-${categoryClass(displayNewsCategory(item))}">${escapeHTML(displayNewsCategory(item))}</span><h1>${escapeHTML(item.title)}</h1></div><button class="bookmark-button detail-bookmark ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg></button></div>
          <section class="article-panel summary-panel"><div class="panel-heading"><h2>전체 내용 요약</h2><span class="summary-badge">전체 흐름</span></div><p class="summary-copy">${renderSentenceLines(summary)}</p></section>
          <section class="article-panel analysis-panel"><div class="panel-heading"><h2>AI 분석</h2><span class="example-label">이용자 관점</span></div><p class="analysis-copy">${renderSentenceLines(analysis)}</p>${detailedSections}<a class="article-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">공식 본문 링크 열기 <span aria-hidden="true">↗</span></a></section>
          <section class="article-panel community-notice-actions"><div><span class="page-eyebrow">DISCUSS THIS NOTICE</span><h2>이 공지에 대해 이야기해 보세요</h2><p>공식 원문과 필요한 분석 항목을 연결해 질문하거나 토론할 수 있습니다.</p></div><div><a class="secondary-button" href="#/community/new?gameId=aion2&type=question&newsId=${encodeURIComponent(item.id)}">이 공지로 질문하기</a><a class="primary-button" href="#/community/new?gameId=aion2&type=discussion&newsId=${encodeURIComponent(item.id)}">토론 시작하기</a></div></section>
          <section class="article-panel"><div class="panel-heading"><h2>수집 정보</h2><span class="example-label">공식 게시판</span></div><dl class="info-list"><div><dt>게시판</dt><dd>${escapeHTML(displayNewsSource(item))}</dd></div><div><dt>게시일</dt><dd>${escapeHTML(item.date)}</dd></div><div><dt>수정일</dt><dd>${item.updatedAt ? escapeHTML(formatDisplayDate(item.updatedAt)) : "수정 기록 없음"}</dd></div></dl></section>
          <section class="article-panel action-panel"><div><strong>정보가 정확하지 않나요?</strong><p>날짜, 수치, 직업 정보나 출처 문제를 알려주세요.</p></div><button class="secondary-button" data-action="report">정보 신고</button></section>
          <a class="back-link" href="#/aion2/${sourceRoute}">← ${escapeHTML(displayNewsCategory(item))} 목록</a>
        </article>
        <aside class="detail-side"><section class="source-panel"><span class="page-eyebrow">OFFICIAL SOURCE</span><h2>공식 게시물</h2><p>${escapeHTML(item.source)}에서 수집한 내용을 요약했습니다. 정확한 조건과 상세 내용은 원문에서 확인해 주세요.</p><div class="source-status-list"><div><span>게시일</span><strong>${escapeHTML(item.date)}</strong></div><div><span>표시 내용</span><strong>요약 · 분석</strong></div></div><a class="secondary-button full-width" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">공식 본문 열기 <span aria-hidden="true">↗</span></a></section></aside>
      </div>
    </main>`;
}

function renderSentenceLines(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.trim().replace(/[ \t]+/g, " ")
      .replace(/([가-힣][.!?]["'”’」』]?)\s+(?=[A-Za-z0-9가-힣“‘"'(])/gu, "$1\n")
      .split(/\n+/))
    .filter(Boolean)
    .map(escapeHTML)
    .join("<br />");
}

function renderModal() {
  return `<dialog class="app-dialog" id="app-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><dialog class="app-dialog tutorial-dialog" id="tutorial-dialog" aria-labelledby="tutorial-title"></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function normalizeChatText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^a-z0-9가-힣]/g, "");
}

function chatKnowledgeLines(item) {
  const lines = [
    { text: item.title, kind: "title", weight: 1.2 },
    { text: `${displayNewsCategory(item) || ""} ${displayNewsSource(item) || ""}`, kind: "category", weight: .8 },
    { text: item.summary, kind: "summary", weight: 1 },
    { text: item.analysis, kind: "analysis", weight: .85 },
    { text: item.excerpt, kind: "summary", weight: .65 },
    ...(Array.isArray(item.keyPoints) ? item.keyPoints.map((text) => ({ text, key: normalizeChatText(text), kind: "detail", weight: 1.8 })) : []),
    ...(Array.isArray(item.sections) ? item.sections.flatMap((section) => [
      { text: `${section.heading || ""} ${section.summary || ""}`, kind: "section", weight: 1.4 },
      ...(Array.isArray(section.importantDetails) ? section.importantDetails.map((text) => ({
        text: `${section.heading || ""} ${text}`,
        key: normalizeChatText(text),
        kind: "detail",
        weight: 2.2,
      })) : []),
    ]) : []),
  ];

  const extractedEvents = (Array.isArray(item.events) && item.events.length ? item.events : legacyCalendarEvents(item));
  for (const event of extractedEvents) {
    const kindLabel = { event: "이벤트", season: "시즌", "server-transfer": "서버 이전", "reward-deadline": "쿠폰 보상", policy: "정책", other: "일정" }[event.type] || "일정";
    const eventDates = [event.startAt && `시작 ${event.startAt}`, event.endAt && `종료 ${event.endAt}`, event.deadlineAt && `마감 ${event.deadlineAt}`].filter(Boolean);
    if (eventDates.length) lines.push({ text: `${event.title || ""} ${kindLabel} ${eventDates.join(" ")}`, kind: "date", weight: 2.5 });
    for (const condition of event.conditions || []) lines.push({ text: `${event.title || ""} 조건 ${condition}`, key: normalizeChatText(condition), kind: "condition", weight: 2.3 });
    if (event.reward) lines.push({ text: `${event.title || ""} 보상 ${event.reward}`, kind: "reward", weight: 2.3 });
    if (event.details) lines.push({ text: `${event.title || ""} ${event.details}`, kind: "detail", weight: 1.4 });
  }

  const unique = new Map();
  for (const line of lines) {
    if (typeof line.text !== "string" || !line.text.trim()) continue;
    const key = line.key || normalizeChatText(line.text);
    const existing = unique.get(key);
    if (!existing || line.weight > existing.weight) unique.set(key, line);
  }
  return [...unique.values()];
}

const chatStopWords = new Set([
  "알려줘", "알려주세요", "해주세요", "해줘", "있어", "있나요", "어떻게", "무엇", "뭐", "뭐야", "어떤", "인가요", "대한", "관련", "좀", "수", "있는", "하나요", "할까", "할수", "혹시", "그냥", "정도", "내용", "정보", "쓸", "쓰다", "되나요", "되는",
]);
const chatLexicon = [
  "쿠폰코드", "서버이전", "이전신청", "사용기간", "수령조건", "신청조건", "피해량", "계정당", "쿠폰", "코드", "보상", "수령", "지급", "획득", "만료", "기한", "기간", "시작", "종료", "마감", "서버", "이전", "신청", "접수", "정산", "한도", "이벤트", "출석", "접속", "조건", "대상", "참여", "방법", "경로", "등록", "직업", "클래스", "스킬", "검성", "수호성", "살성", "권성", "호법성", "궁성", "치유성", "업데이트", "패치", "변경", "밸런스", "상향", "하향", "시즌", "미션", "일정", "아이템", "강화",
];
const chatKeywordMap = {
  "쿠폰": ["쿠폰", "쿠폰코드", "등록", "코드", "만료", "사용기간"],
  "코드": ["쿠폰", "쿠폰코드", "등록번호", "쿠폰번호"],
  "사용": ["이용", "기간", "기한", "만료", "등록"],
  "보상": ["보상", "지급", "수령", "획득", "아이템"],
  "수령": ["받", "지급", "획득", "등록", "쿠폰"],
  "받": ["받", "지급", "수령", "획득", "보상"],
  "신청": ["신청", "접수", "이전기간", "신청시작", "신청마감"],
  "이전": ["서버이전", "무료이전", "이전신청", "재적용", "정산한도"],
  "서버": ["서버이전", "이전신청", "무료이전"],
  "이벤트": ["이벤트", "접속", "출석", "참여", "기간"],
  "조건": ["조건", "대상", "계정당", "참여", "접속", "수령", "신청", "방법"],
  "방법": ["방법", "경로", "등록", "입력", "이용", "신청", "설정"],
  "어디서": ["경로", "페이지", "등록", "입력", "메뉴", "이용"],
  "참여": ["참여", "접속", "출석", "시간", "대상", "조건"],
  "기간": ["기간", "시작", "종료", "만료", "마감", "기한"],
  "날짜": ["날짜", "시작", "종료", "만료", "마감", "일시", "기간"],
  "언제": ["시작", "종료", "기간", "일시", "날짜", "마감", "기한"],
  "종료": ["종료", "끝", "마감", "만료", "기한"],
  "직업": ["클래스", "스킬", "밸런스", "검성", "수호성", "살성", "권성", "호법성", "궁성", "치유성"],
  "클래스": ["직업", "스킬", "밸런스", "검성", "수호성", "살성", "권성", "호법성", "궁성", "치유성"],
  "스킬": ["스킬", "피해량", "계수", "효과", "밸런스"],
  "버프": ["상향", "피해량", "계수", "개선", "효과"],
  "너프": ["하향", "피해량", "계수", "조정", "효과"],
  "바뀌": ["변경", "조정", "추가", "개선", "수정", "패치"],
  "바뀜": ["변경", "조정", "추가", "개선", "수정", "패치"],
  "바뀐": ["변경", "조정", "추가", "개선", "수정", "패치"],
  "달라": ["변경", "조정", "추가", "개선", "수정"],
  "성능": ["피해량", "계수", "스킬", "밸런스", "상향", "하향"],
  "패치": ["업데이트", "변경", "조정", "추가", "개선", "수정"],
  "시즌": ["시즌", "시즌미션", "종료", "보상"],
};

function extractChatTokens(value) {
  const suffixes = /(으로부터|에서부터|한테서|에게서|으로|에서|부터|까지|한테|에게|이라면|이랑|하고|은|는|이|가|을|를|의|에|도|만|로|와|과|할|한|된|하는|했어요|했어)$/u;
  const rawTokens = String(value || "").toLocaleLowerCase("ko-KR").match(/[a-z0-9]+|[가-힣]{2,}/g) || [];
  const tokens = [];
  for (const rawToken of rawTokens) {
    const token = rawToken.replace(/(받으려면|받으면|받을수|받을|받지|받는)$/u, "받")
      .replace(/(쓰려면|사용하려면|사용하면|쓸수|쓸)$/u, "사용")
      .replace(/(바뀌었어|바뀌었|바뀐거|바뀜|바뀌는|달라졌어|달라졌|달라진|달라짐)$/u, "변경")
      .replace(suffixes, "");
    if (token.length >= 2 && !chatStopWords.has(token)) tokens.push(token);
    for (const keyword of chatLexicon) if (token.includes(keyword)) tokens.push(keyword);
  }
  return [...new Set(tokens.filter((token) => token.length >= 2 && !chatStopWords.has(token)))];
}

function analyzeChatQuestion(question, previousQuestion = "") {
  const initialTokens = extractChatTokens(question);
  const knownTopics = /쿠폰|서버|이전|이벤트|출석|접속|피시방|pc방|직업|클래스|스킬|검성|수호성|살성|권성|호법성|궁성|치유성|시즌|정산|아이템|업데이트|패치/iu;
  const followUp = /그럼|그거|그것|그중|그건|해당|그 내용|그 날짜|그 보상|그 조건/iu.test(question)
    || (!knownTopics.test(question) && initialTokens.length <= 3);
  const searchText = followUp && previousQuestion ? `${previousQuestion} ${question}` : question;
  const normalizedQuestion = normalizeChatText(searchText);
  const primaryTerms = extractChatTokens(searchText).map(normalizeChatText);
  const expandedTerms = new Set();
  const appendAliases = (aliases) => aliases.forEach((alias) => {
    const normalized = normalizeChatText(alias);
    if (normalized.length >= 2) expandedTerms.add(normalized);
  });

  for (const term of primaryTerms) appendAliases(chatKeywordMap[term] || []);
  const has = (pattern) => pattern.test(normalizedQuestion);
  const intents = {
    date: has(/언제|날짜|기간|기한|며칠|몇시|시각|일시/),
    deadline: has(/언제까지|끝|종료|마감|만료|기한|까지|마지막/),
    start: has(/언제부터|시작|오픈|접수/),
    condition: has(/조건|대상|참여|신청|수령|받|획득|방법|필요|가능/),
    method: has(/어디|어떻게|방법|경로|등록|입력|메뉴|사용법/),
    reward: has(/보상|아이템|쿠폰|지급|수령|받|획득/),
    class: has(/직업|클래스|스킬|밸런스|버프|너프|상향|하향|검성|수호성|살성|권성|호법성|궁성|치유성/),
    change: has(/바뀌|달라|변경|패치|추가|수정|조정|개선|신규|좋아졌|강화/),
    notice: has(/공지|안내/),
    update: has(/업데이트|패치노트/),
    cmStory: has(/cm아지트|cm이야기|운영소식/),
  };

  if (has(/쿠폰|쿠폰코드|코드|쿠폰번호/)) appendAliases(["쿠폰", "등록", "코드", "사용기간", "만료", "보상"]);
  if (has(/서버이전|무료이전|이전신청|서버옮기/)) appendAliases(["서버이전", "신청", "접수", "기간", "정산", "한도", "재적용"]);
  if (has(/이벤트|출석|접속|피시방|pc방/)) appendAliases(["이벤트", "접속", "출석", "응모", "경품", "시간", "기간", "조건"]);
  if (intents.class) appendAliases(["직업", "클래스", "스킬", "피해량", "계수", "효과", "밸런스", "상향", "하향"]);
  if (intents.change) appendAliases(["변경", "조정", "추가", "개선", "수정", "신규", "밸런스", "콘텐츠"]);
  if (intents.date) appendAliases(["시작", "종료", "기간", "일시", "날짜", "마감", "기한", "만료"]);
  if (intents.condition) appendAliases(["조건", "대상", "계정당", "접속", "참여", "신청", "수령", "방법", "필수"]);
  if (intents.method) appendAliases(["방법", "경로", "등록", "입력", "페이지", "메뉴", "이용"]);

  const phrases = [];
  for (let index = 0; index < primaryTerms.length - 1; index += 1) phrases.push(`${primaryTerms[index]}${primaryTerms[index + 1]}`);
  return { normalizedQuestion, primaryTerms: [...new Set(primaryTerms)], expandedTerms: [...expandedTerms], phrases, intents };
}

function buildChatTermWeights(query) {
  const corpus = newsItems.filter(isAionNewsItem).map((item) => normalizeChatText(chatKnowledgeLines(item).map((line) => line.text).join(" ")));
  const terms = [...new Set([...query.primaryTerms, ...query.expandedTerms])];
  return new Map(terms.map((term) => {
    const documentFrequency = corpus.reduce((count, document) => count + Number(document.includes(term)), 0);
    const inverseDocumentFrequency = 1 + Math.log((corpus.length + 1) / (documentFrequency + 1));
    return [term, inverseDocumentFrequency];
  }));
}

function scoreChatEvidence(line, query, termWeights) {
  const normalized = normalizeChatText(line.text);
  const primaryHits = query.primaryTerms.filter((term) => term.length >= 2 && normalized.includes(term));
  const expandedHits = query.expandedTerms.filter((term) => normalized.includes(term));
  const primaryScore = primaryHits.reduce((total, term) => total + (termWeights.get(term) || 1) * 3.2, 0);
  const expandedScore = Math.min(
    expandedHits.reduce((total, term) => total + (termWeights.get(term) || 1) * .55, 0),
    Math.max(1.5, primaryScore * .8),
  );
  let score = primaryScore + expandedScore;
  if (query.phrases.some((phrase) => phrase.length >= 4 && normalized.includes(phrase))) score += 2.5;
  if (line.kind === "title" && primaryHits.length) score += 1.2;

  const hasDate = /\d{4}[-./년]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}|\d{1,2}:\d{2}|\d{1,2}\s*시/u.test(line.text);
  if (query.intents.date && hasDate) score += 2.4;
  if (query.intents.deadline && /종료|마감|만료|기한|끝|사용기간|수령기간|재적용|까지/u.test(line.text)) score += 2.2;
  if (query.intents.start && /시작|오픈|접수|부터|기간/u.test(line.text)) score += 1.8;
  if (query.intents.condition && /대상|계정당|조건|참여|접속|수령|신청|필수|방법|경로|정산/u.test(line.text)) score += 1.7;
  if (query.intents.method && /방법|경로|등록|입력|페이지|메뉴|이용|설정/u.test(line.text)) score += 2;
  if (query.intents.reward && /보상|아이템|쿠폰|지급|수령|획득|등록/u.test(line.text)) score += 1.5;
  if (query.intents.class && /직업|클래스|스킬|피해량|계수|밸런스|검성|수호성|살성|권성|호법성|궁성|치유성/u.test(line.text)) score += 1.7;
  if (query.intents.change && /변경|조정|추가|개선|수정|상향|하향|신규/u.test(line.text)) score += 1.2;
  return { ...line, score: score * line.weight, primaryHits };
}

function answerNoticeQuestion(question, previousQuestion = "") {
  const query = analyzeChatQuestion(question, previousQuestion);
  if (!query.primaryTerms.length && !Object.values(query.intents).some(Boolean)) return {
    role: "assistant",
    text: "어떤 공지인지 찾을 수 있도록 게임 콘텐츠나 궁금한 항목을 함께 적어 주세요. 예: ‘쿠폰 코드는 뭐야?’, ‘서버 이전 신청은 언제 시작해?’, ‘PC방 출석 조건은?’",
    facts: [],
    sources: [],
  };

  const termWeights = buildChatTermWeights(query);
  const ranked = newsItems.filter(isAionNewsItem).map((item) => {
    const lines = chatKnowledgeLines(item).map((line) => scoreChatEvidence(line, query, termWeights)).filter((line) => line.score > 0);
    const evidence = [...lines].sort((left, right) => right.score - left.score);
    const uniqueMatches = new Set(lines.flatMap((line) => line.primaryHits));
    const titleScore = evidence.find((line) => line.kind === "title")?.score || 0;
    const score = (evidence[0]?.score || 0)
      + (evidence[1]?.score || 0) * .45
      + (evidence[2]?.score || 0) * .2
      + titleScore * .25
      + uniqueMatches.size * .7;
    const categoryBoost = (query.intents.notice && item.category === "공지")
      || (query.intents.update && item.category === "업데이트")
      || (query.intents.cmStory && displayNewsCategory(item) === "CM 아지트" && isAionCmStory(item)) ? 1.8 : 0;
    return { item, evidence, score: score + categoryBoost, matchedTerms: uniqueMatches.size };
  }).filter((result) => result.score > 0).sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const hasUsefulIntent = query.intents.date || query.intents.deadline || query.intents.start || query.intents.change || query.intents.class || query.intents.condition || query.intents.method || query.intents.reward;
  if (!best || best.score < 2.5 || (!best.matchedTerms && !hasUsefulIntent)) return {
    role: "assistant",
    text: "질문에 맞는 내용을 수집된 게시물에서 찾지 못했어요. ‘쿠폰’, ‘서버 이전’, ‘PC방 출석’, 직업 이름처럼 공지에 나올 핵심 단어를 더해 다시 물어봐 주세요.",
    facts: [],
    sources: [],
  };

  const facts = [];
  const seenFacts = new Set();
  for (const line of best.evidence) {
    const key = normalizeChatText(line.text);
    if (key.length < 3 || seenFacts.has(key)) continue;
    seenFacts.add(key);
    facts.push(line.text);
    if (facts.length === 5) break;
  }
  const sources = ranked.filter((result) => result.score >= best.score * .42).slice(0, 3).map(({ item }) => ({ id: item.id, title: item.title }));
  const text = query.intents.deadline || query.intents.date
    ? "질문의 핵심어와 날짜·기간 관련 근거를 우선 확인했어요. 필요한 조건과 원문도 함께 표시합니다."
    : query.intents.condition || query.intents.method || query.intents.reward
      ? "질문의 핵심어와 수령·참여 조건이 일치하는 근거를 모았어요. 해당 공지의 중요 항목을 확인해 보세요."
      : "질문의 핵심어가 제목, 요약, 파트별 중요 정보와 얼마나 일치하는지 비교해 관련 내용을 찾았어요.";
  return { role: "assistant", text, facts, sources };
}

function renderChatMessage(message) {
  if (message.role === "user") return `<article class="chat-message user"><div class="chat-bubble"><p>${escapeHTML(message.text)}</p></div></article>`;
  const facts = Array.isArray(message.facts) && message.facts.length ? `<ul>${message.facts.map((fact) => `<li>${escapeHTML(fact)}</li>`).join("")}</ul>` : "";
  const sources = Array.isArray(message.sources) && message.sources.length ? `<div class="chat-sources">${message.sources.map((source) => `<a href="#/aion2/news/${encodeURIComponent(source.id)}">공지 보기 · ${escapeHTML(source.title)} <span aria-hidden="true">↗</span></a>`).join("")}</div>` : "";
  return `<article class="chat-message assistant"><span class="chat-avatar" aria-hidden="true">T</span><div class="chat-bubble"><p>${escapeHTML(message.text)}</p>${facts}${sources}</div></article>`;
}

function renderChatbot() {
  const conversation = state.chatMessages.length
    ? state.chatMessages.map(renderChatMessage).join("")
    : `<article class="chat-message assistant"><span class="chat-avatar" aria-hidden="true">T</span><div class="chat-bubble"><p>질문의 핵심어를 크롤링된 제목·요약·중요 항목·일정과 비교해 관련 근거와 원문을 찾아드릴게요.</p><small>예: “쿠폰 사용 기한”, “서버 이전 신청”, “PC방 출석 조건”</small></div></article>`;
  return `<div class="chatbot-dock">
    <section class="chatbot-panel" aria-label="공지 질문 챗봇" ${state.chatOpen ? "" : "hidden"}>
      <div class="chatbot-heading"><div><strong>공지 질문하기</strong><small>핵심어와 중요 정보를 대조합니다</small></div><div><button type="button" data-action="clear-chat" aria-label="대화 지우기" title="대화 지우기">↻</button><button type="button" data-action="close-chatbot" aria-label="챗봇 닫기" title="닫기">×</button></div></div>
      <div class="chatbot-messages" id="chatbot-messages" role="log" aria-live="polite">${conversation}</div>
      <form class="chatbot-form" id="chatbot-form"><label class="sr-only" for="chatbot-question">공지에 대해 질문하기</label><input id="chatbot-question" name="question" type="text" maxlength="300" placeholder="공지에 대해 질문해 보세요" autocomplete="off" required /><button type="submit" aria-label="질문 보내기">↑</button></form>
    </section>
    <button class="chatbot-launcher ${state.chatOpen ? "open" : ""}" type="button" data-action="toggle-chatbot" aria-expanded="${state.chatOpen}" aria-label="${state.chatOpen ? "공지 질문 챗봇 닫기" : "공지 질문 챗봇 열기"}">${state.chatOpen ? "×" : "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-6l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z\"/><path d=\"M8 8h8M8 11h5\"/></svg><span>질문</span>"}</button>
  </div>`;
}

const tutorialSteps = [
  { title: "게임을 검색하고 팔로우하세요", body: "홈 검색창에서 아이온2, 도깨비의 세계, 템빨을 찾아보세요. 검색 결과에서 게임 이름을 누르면 해당 게임 화면으로 이동합니다.", tip: "팔로우 버튼을 누르면 홈에 아이콘 바로가기가 생겨요. 아이콘을 눌러 입장하고, 우클릭하거나 길게 눌러 팔로우를 해제할 수 있습니다." },
  { title: "새 소식과 공략을 확인하세요", body: "팔로우한 게임의 새 글은 홈의 게시글 영역에서 모아 볼 수 있고, 게임 화면에서는 공지·업데이트·공략을 찾아볼 수 있습니다. 홈 오른쪽에는 분석 내용에서 추린 공략도 표시됩니다.", tip: "아이온2 게시글은 AI 요약·항목별 분석·공식 원문 링크를 제공합니다. 다른 게임은 데이터 연동 범위에 따라 예시 또는 준비 중인 내용이 보일 수 있어요." },
  { title: "북마크와 할 일을 관리하세요", body: "게시글을 저장하거나 읽음 표시로 확인 상태를 관리하세요. 대시보드에서 팔로우한 게임, 북마크, 작성한 글, 패치 후 할 일을 한곳에서 볼 수 있습니다.", tip: "팔로우한 게임에 새 글이 올라오면 오른쪽 위 알림에서 확인할 수 있습니다. 북마크와 읽음 상태는 현재 브라우저에 저장돼요." },
  { title: "일정과 출시일을 놓치지 마세요", body: "대시보드 캘린더에서 공지에 나온 이벤트 기간, 서버 이전, 보상 수령 마감일을 확인할 수 있습니다. 홈의 출시 카운트다운은 출시 예정 게임의 남은 시간을 보여줍니다.", tip: "공지에서 날짜를 찾지 못한 일정은 표시되지 않을 수 있으니, 중요한 날짜는 공식 원문도 확인해 주세요." },
  { title: "챗봇에 공지 내용을 질문하세요", body: "화면 오른쪽 아래의 질문 버튼을 누르고 궁금한 키워드나 조건을 입력하세요. 챗봇이 수집된 공지와 분석 내용에서 관련 정보를 찾아 답변합니다.", tip: "답변에 연결된 출처를 열어 공식 원문을 함께 확인하면 정확한 조건과 예외를 놓치지 않을 수 있어요." },
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
  let items = newsItems.filter(isAionNewsItem);
  const kind = routeKind();
  if (kind === "notices") items = items.filter((item) => item.sourceKey === "notice");
  if (kind === "updates") items = items.filter((item) => item.sourceKey === "update");
  if (kind === "cm-stories") items = items.filter(isAionCmStory);
  if (state.filter !== "전체") items = items.filter((item) => displayNewsCategory(item) === state.filter);
  const query = state.query.trim().toLocaleLowerCase("ko-KR");
  if (query) items = items.filter((item) => `${item.title} ${item.excerpt} ${item.summary || ""} ${item.analysis || ""} ${(item.keyPoints || []).join(" ")} ${displayNewsCategory(item)} ${displayNewsSource(item)} ${item.meta}`.toLocaleLowerCase("ko-KR").includes(query));
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

function drawDokkaebiNewsList() {
  const list = app.querySelector("#dokkaebi-news-list");
  if (!list) return;
  let items = [...dokkaebiNewsItems];
  if (state.dokkaebiFilter !== "전체") items = items.filter((item) => item.category === state.dokkaebiFilter);
  const query = state.dokkaebiQuery.trim().toLocaleLowerCase("ko-KR");
  if (query) items = items.filter((item) => `${item.title} ${item.excerpt} ${item.summary} ${item.category} ${item.source} ${item.meta} ${item.keyPoints.join(" ")}`.toLocaleLowerCase("ko-KR").includes(query));
  list.innerHTML = items.map(renderDokkaebiNewsCard).join("");
  const count = app.querySelector("#dokkaebi-count");
  if (count) count.textContent = `${items.length}건`;
  const empty = app.querySelector("#dokkaebi-empty-state");
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
  const matches = gameCatalog.filter((item) => `${item.name} ${item.displayTitle || ""} ${item.aliases || ""}`.toLocaleLowerCase("ko-KR").includes(query));
  results.innerHTML = matches.length ? matches.map((item) => {
    const followed = isGameFollowed(item.id);
    const detail = item.id === game.id ? `최근 패치 · ${gameData.lastPatchDate || "아직 수집 전"}` : item.upcoming ? `출시 예정 · ${releaseDateLabel(item.releaseDate)}` : "소식 · 공지 · 업데이트 · 공략 검색";
    return `<div class="game-result"><a class="game-result-open" href="${escapeHTML(item.route)}" data-action="record-game-search" aria-label="${escapeHTML(item.name)} 정보 열기"><span class="game-result-mark" aria-hidden="true"><img src="${escapeHTML(item.icon)}" alt="" /></span><span class="game-result-copy"><strong>${escapeHTML(item.displayTitle || item.name)}</strong><small>${escapeHTML(detail)}</small></span></a><button class="game-follow-button ${followed ? "following" : ""}" type="button" data-action="toggle-follow" data-game-id="${escapeHTML(item.id)}" aria-label="${followed ? `${escapeHTML(item.name)} 팔로우 해제` : `${escapeHTML(item.name)} 팔로우`}" aria-pressed="${followed}">${followed ? "팔로우 해제" : "팔로우"}</button></div>`;
  }).join("") : `<div class="no-games"><strong>검색 결과가 없습니다.</strong><span>게임 이름을 다시 확인해 주세요.</span></div>`;
}

function render() {
  const tutorialWasOpen = Boolean(app.querySelector("#tutorial-dialog")?.open);
  syncFollowedNewsNotifications();
  syncCalendarNotifications();
  const kind = routeKind();
  if (kind === "detail") markNewsAsRead(detailId());
  let page;
  if (kind === "game-home") page = renderGameHome();
  else if (kind === "dokkaebi-hub") page = renderDokkaebiPage();
  else if (kind === "dokkaebi-detail") page = renderDokkaebiDetail(detailId());
  else if (kind === "game-hub") page = renderCatalogGamePage();
  else if (["news", "notices", "updates", "cm-stories"].includes(kind)) page = renderFeedPage(kind);
  else if (kind === "tasks") page = renderTasksPage();
  else if (kind === "bookmarks") page = renderBookmarksPage();
  else if (kind === "dashboard") page = renderDashboardPage();
  else if (kind === "detail") page = renderDetail(detailId());
  else if (kind.startsWith("community")) page = window.todaypatchCommunity?.renderPage(kind) || renderHome();
  else page = renderHome();
  const chatbot = ["dokkaebi-hub", "dokkaebi-detail"].includes(kind) ? "" : renderChatbot();
  app.innerHTML = `${renderHeader()}${page}${renderFooter()}${renderModal()}${chatbot}`;
  drawNewsList();
  drawDokkaebiNewsList();
  drawGameResults();
  startReleaseCountdowns();
  if (tutorialWasOpen) {
    renderTutorialStep();
    const tutorialDialog = app.querySelector("#tutorial-dialog");
    tutorialDialog?.showModal();
    tutorialDialog?.querySelector("#tutorial-title")?.focus();
  } else {
    maybeOpenTutorial();
  }
}

function openDialog(kind) {
  const dialog = app.querySelector("#app-dialog");
  const content = app.querySelector("#dialog-content");
  if (!dialog || !content) return;
  if (kind === "login") {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">TODAYPATCH ACCOUNT</span><h2 id="dialog-title">계정 로그인</h2><p>계정에 로그인하면 커뮤니티 게시글·댓글·알림을 여러 기기에서 이용할 수 있습니다. 팔로우, 북마크, 읽음 상태와 할 일은 현재 브라우저에 저장됩니다.</p><button class="primary-button dialog-primary" type="button" data-action="community-login">로그인 또는 계정 만들기</button>`;
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
  if (window.todaypatchCommunity?.isAction(action)) {
    event.preventDefault();
    void window.todaypatchCommunity.handleAction(action, button);
    return;
  }
  if (action === "toggle-notifications") {
    state.notificationsOpen = !state.notificationsOpen;
    app.querySelector(".notification-popover").hidden = !state.notificationsOpen;
    button.setAttribute("aria-expanded", String(state.notificationsOpen));
    if (state.notificationsOpen) window.todaypatchCommunity?.refreshNotifications().then(render);
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
    window.todaypatchCommunity?.markAllNotificationsRead().then(render).catch((error) => showToast(error.message));
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
  if (action === "dokkaebi-filter") {
    state.dokkaebiFilter = button.dataset.filter || "전체";
    app.querySelectorAll('[data-action="dokkaebi-filter"]').forEach((chip) => {
      const selected = chip.dataset.filter === state.dokkaebiFilter;
      chip.classList.toggle("selected", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
    drawDokkaebiNewsList();
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
  if (action === "record-article-view") {
    const storedViews = readStorage("todaypatch.articleViews", {});
    const views = storedViews && typeof storedViews === "object" && !Array.isArray(storedViews) ? storedViews : {};
    views[id] = (Number(views[id]) || 0) + 1;
    writeStorage("todaypatch.articleViews", views);
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
  if (action === "calendar-previous") {
    state.calendarOffset -= 1;
    render();
  }
  if (action === "calendar-next") {
    state.calendarOffset += 1;
    render();
  }
  if (action === "toggle-chatbot") {
    state.chatOpen = !state.chatOpen;
    render();
    if (state.chatOpen) app.querySelector("#chatbot-question")?.focus();
  }
  if (action === "close-chatbot") {
    state.chatOpen = false;
    render();
  }
  if (action === "clear-chat") {
    state.chatMessages = [];
    render();
    app.querySelector("#chatbot-question")?.focus();
  }
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
  window.todaypatchCommunity?.handleInput(event.target);
  if (event.target.id === "news-search") {
    state.query = event.target.value;
    drawNewsList();
  }
  if (event.target.id === "game-search") {
    state.gameQuery = event.target.value;
    drawGameResults();
  }
  if (event.target.id === "dokkaebi-search") {
    state.dokkaebiQuery = event.target.value;
    drawDokkaebiNewsList();
  }
});

app.addEventListener("change", (event) => {
  window.todaypatchCommunity?.handleChange(event.target);
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
  const query = state.gameQuery.trim().toLocaleLowerCase("ko-KR");
  if (!query) return;
  rememberGameSearch(state.gameQuery);
  const match = gameCatalog.find((item) => `${item.name} ${item.displayTitle || ""} ${item.aliases || ""}`.toLocaleLowerCase("ko-KR").includes(query));
  if (match) window.location.hash = match.route;
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
  if (window.todaypatchCommunity?.ownsForm(event.target)) {
    event.preventDefault();
    void window.todaypatchCommunity.handleSubmit(event.target);
    return;
  }
  if (event.target.id === "chatbot-form") {
    event.preventDefault();
    const question = String(new FormData(event.target).get("question") || "").trim();
    if (!question) return;
    const previousQuestion = [...state.chatMessages].reverse().find((message) => message.role === "user")?.text || "";
    state.chatMessages.push({ role: "user", text: question }, answerNoticeQuestion(question, previousQuestion));
    state.chatMessages = state.chatMessages.slice(-40);
    state.chatOpen = true;
    render();
    requestAnimationFrame(() => {
      const messages = app.querySelector("#chatbot-messages");
      if (messages) messages.scrollTop = messages.scrollHeight;
      app.querySelector("#chatbot-question")?.focus();
    });
    return;
  }
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
  state.dokkaebiFilter = dokkaebiRouteCategory();
  state.dokkaebiQuery = "";
  state.gameSearchFocused = false;
  render();
  window.todaypatchCommunity?.loadRoute();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.todaypatchCommunity?.init({
  getGameCatalog: () => gameCatalog,
  getNewsItems: () => newsItems,
  getRoute: () => currentRoute(),
  getRouteParts: () => routeParts(),
  getKind: () => routeKind(),
  isCommunityRoute: () => routeKind().startsWith("community"),
  render,
  showToast,
});
state.dokkaebiFilter = dokkaebiRouteCategory();
render();
window.todaypatchCommunity?.bootstrap();
