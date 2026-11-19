const gameData = window.todaypatchGameData?.aion2 || {};
const newsItems = Array.isArray(gameData.newsItems) ? gameData.newsItems : [];
const latestItem = (sourceKey) => newsItems.find((item) => item.sourceKey === sourceKey);
const taskItems = [
  { id: "read-latest-notice", title: "최신 공지 확인하기", item: latestItem("notice") },
  { id: "read-latest-update", title: "최신 업데이트 확인하기", item: latestItem("update") },
  { id: "read-latest-cm-story", title: "최신 CM 이야기 확인하기", item: latestItem("cm-story") },
];

const categories = ["전체", "공지", "업데이트", "CM 이야기"];
const game = { id: "aion2", name: "아이온2", aliases: "aion2 아이온2" };
const state = { filter: "전체", query: "", gameQuery: "" };
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
const followedGameIds = () => readStorage("todaypatch.followedGames", []);
const isSaved = (id) => savedNews().includes(id);
const isGameFollowed = (id) => followedGameIds().includes(id);

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
  if (parts[0] === "aion2") {
    if (parts[1] === "news" && parts[2]) return "detail";
    if (["news", "notices", "updates", "cm-stories", "tasks"].includes(parts[1])) return parts[1];
    return "game-home";
  }
  return "home";
}

function detailId() {
  const parts = routeParts();
  return parts[0] === "aion2" ? parts[2] : undefined;
}

function renderHeader() {
  const kind = routeKind();
  const inGame = kind !== "home";
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
          </nav>` : `<span class="header-caption">게임별 소식을 한곳에서</span>`}
        <button class="theme-toggle" type="button" data-action="toggle-theme" aria-label="${themeLabel}로 전환" title="${themeLabel}로 전환">${themeIcon}<span>${themeLabel}</span></button>
      </div>
    </header>`;
}

function renderHome() {
  return `
    <main class="home-page">
      <section class="home-search" aria-labelledby="home-title">
        <span class="home-eyebrow">TODAYPATCH</span>
        <h1 id="home-title">어떤 게임을 찾으세요?</h1>
        <p>공식 공지, 업데이트, CM 소식을 한곳에서 확인해 보세요.</p>
        <label class="search-field game-search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input id="game-search" type="search" value="${escapeHTML(state.gameQuery)}" placeholder="게임 이름 검색" autocomplete="off" aria-label="게임 이름 검색" />
          <kbd>검색</kbd>
        </label>
        <div class="game-results" id="game-results" aria-live="polite"></div>
      </section>
      ${renderFollowedGames()}
      <section class="home-guide" aria-labelledby="home-guide-title">
        <div class="home-guide-heading">
          <div><span class="home-guide-eyebrow">QUICK GUIDE</span><h2 id="home-guide-title">이용 방법</h2></div>
          <p>게임을 찾고 필요한 정보를 간편하게 확인해 보세요.</p>
        </div>
        <div class="guide-steps">
          <article class="guide-step">
            <div class="guide-step-top"><span class="guide-step-number">01</span><span class="guide-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg></span></div>
            <h3>게임 검색하기</h3>
            <p>검색창에 게임 이름을 입력하고 검색 결과를 선택하세요.</p>
          </article>
          <article class="guide-step">
            <div class="guide-step-top"><span class="guide-step-number">02</span><span class="guide-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2"/></svg></span></div>
            <h3>필요한 정보 확인하기</h3>
            <p>공지, 업데이트, CM 이야기 메뉴에서 원하는 내용을 찾아보세요.</p>
          </article>
          <article class="guide-step">
            <div class="guide-step-top"><span class="guide-step-number">03</span><span class="guide-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.5L6 20.5v-15a1 1 0 0 1 1-1Z"/><path d="m9 10 2 2 4-4"/></svg></span></div>
            <h3>저장하고 체크하기</h3>
            <p>관심 있는 게시물은 북마크하고 최신 소식은 체크리스트로 관리하세요.</p>
          </article>
        </div>
      </section>
    </main>`;
}

function renderFollowedGames() {
  const followed = isGameFollowed(game.id);
  const latestPatchDate = gameData.lastPatchDate || "아직 수집 전";
  return `
    <section class="home-following" aria-labelledby="home-following-title">
      <div class="home-following-heading"><div><span class="home-guide-eyebrow">YOUR GAMES</span><h2 id="home-following-title">팔로우한 게임</h2></div><p>관심 게임의 최신 패치 날짜를 모아봐요.</p></div>
      ${followed ? `<article class="followed-game-card"><a class="followed-game-link" href="#/aion2"><span class="game-result-mark" aria-hidden="true"><img src="./assets/aion2-logo.png" alt="" /></span><span class="game-result-copy"><strong>${escapeHTML(game.name)}</strong><small>최근 패치 · ${escapeHTML(latestPatchDate)}</small></span></a><button class="game-follow-button following" type="button" data-action="toggle-follow" data-game-id="${game.id}" aria-pressed="true">팔로잉</button></article>` : `<div class="following-empty"><span class="following-empty-icon" aria-hidden="true">＋</span><p><strong>아직 팔로우한 게임이 없어요.</strong><br />검색 결과에서 팔로우를 눌러 관심 게임을 추가하세요.</p></div>`}
    </section>`;
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
  return `
    <article class="news-card">
      <a class="news-main" href="#/aion2/news/${encodeURIComponent(item.id)}" aria-label="${escapeHTML(item.title)} 상세 보기">
        <div class="news-topline"><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><span class="news-source">${escapeHTML(item.source)} · ${escapeHTML(item.date)}</span></div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="news-excerpt">${escapeHTML(item.excerpt)}</p>
        <div class="news-meta">${escapeHTML(item.meta)}</div>
      </a>
      <a class="news-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(item.title)} 공식 본문 열기">본문 원문 <span aria-hidden="true">↗</span></a>
      <button class="bookmark-button ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg>
      </button>
    </article>`;
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
          <div class="detail-title-row"><div><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><h1>${escapeHTML(item.title)}</h1><p>${escapeHTML(item.excerpt)}</p></div><button class="bookmark-button detail-bookmark ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg></button></div>
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
  return `<dialog class="app-dialog" id="app-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
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
    results.innerHTML = "";
    return;
  }
  const matches = game.aliases.toLocaleLowerCase("ko-KR").includes(query);
  const latestPatchDate = gameData.lastPatchDate || "아직 수집 전";
  results.innerHTML = matches ? `
    <div class="game-result">
      <a class="game-result-open" href="#/aion2" aria-label="아이온2 정보 열기"><span class="game-result-mark" aria-hidden="true"><img src="./assets/aion2-logo.png" alt="" /></span><span class="game-result-copy"><strong>아이온2</strong><small>최근 패치 · ${escapeHTML(latestPatchDate)}</small></span></a>
      <button class="game-follow-button ${isGameFollowed(game.id) ? "following" : ""}" type="button" data-action="toggle-follow" data-game-id="${game.id}" aria-pressed="${isGameFollowed(game.id)}">${isGameFollowed(game.id) ? "팔로잉" : "팔로우"}</button>
    </div>` : `<div class="no-games"><strong>검색 결과가 없습니다.</strong><span>게임 이름을 다시 확인해 주세요.</span></div>`;
}

function render() {
  const kind = routeKind();
  let page;
  if (kind === "game-home") page = renderGameHome();
  else if (["news", "notices", "updates", "cm-stories"].includes(kind)) page = renderFeedPage(kind);
  else if (kind === "tasks") page = renderTasksPage();
  else if (kind === "detail") page = renderDetail(detailId());
  else page = renderHome();
  app.innerHTML = `${renderHeader()}${page}${renderFooter()}${renderModal()}`;
  drawNewsList();
  drawGameResults();
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
  const button = event.target.closest("[data-action]");
  if (!button) {
    if (event.target.id === "app-dialog") event.target.close();
    return;
  }
  const { action, id } = button.dataset;
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
  if (action === "bookmark") {
    const bookmarks = savedNews();
    const wasSaved = bookmarks.includes(id);
    writeStorage("todaypatch.bookmarks", wasSaved ? bookmarks.filter((item) => item !== id) : [...bookmarks, id]);
    render();
    showToast(wasSaved ? "북마크를 해제했어요." : "소식을 저장했어요.");
  }
  if (action === "toggle-follow") {
    const gameId = button.dataset.gameId;
    const followed = followedGameIds();
    const wasFollowed = followed.includes(gameId);
    writeStorage("todaypatch.followedGames", wasFollowed ? followed.filter((item) => item !== gameId) : [...followed, gameId]);
    render();
    showToast(wasFollowed ? "팔로우를 해제했어요." : "아이온2를 팔로우했어요.");
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

app.addEventListener("keydown", (event) => {
  if (event.target.id === "game-search" && event.key === "Enter" && game.aliases.toLocaleLowerCase("ko-KR").includes(state.gameQuery.trim().toLocaleLowerCase("ko-KR"))) {
    window.location.hash = "#/aion2";
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "report-form") return;
  event.preventDefault();
  app.querySelector("#app-dialog").close();
  showToast("신고 내용을 확인했어요. 저장 기능은 서비스 연동 후 제공됩니다.");
});

window.addEventListener("hashchange", () => {
  state.filter = "전체";
  state.query = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
