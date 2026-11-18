const newsItems = [
  {
    id: "update-summary",
    category: "업데이트",
    title: "업데이트 요약 카드 예시",
    excerpt: "핵심 변경 내용과 적용 버전, 공식 원문 근거가 연결되는 영역입니다.",
    source: "공식 공지 연결 예정",
    meta: "적용 버전 · 게시일 · 수정일",
    summary: "공식 업데이트 공지를 연결하면 핵심 변경점과 적용 조건을 먼저 보여줍니다. 각 항목에는 원문 링크와 기준 버전을 함께 표시합니다.",
    topics: ["핵심 변경점", "적용 버전", "원문 근거"],
  },
  {
    id: "class-changes",
    category: "직업",
    title: "직업별 변경점 비교 예시",
    excerpt: "스킬 효과와 수치를 패치 전·후로 비교하고 근거 문단을 확인합니다.",
    source: "분석 결과 연결 예정",
    meta: "직업 · 스킬 · 변경 전후",
    summary: "직업별 스킬 변경 정보가 수집되면 효과, 수치, 발동 조건을 패치 전·후로 비교합니다. 확인되지 않은 수치는 표시하지 않습니다.",
    topics: ["직업별 브리핑", "패치 전·후", "근거 문단"],
  },
  {
    id: "event-schedule",
    category: "이벤트",
    title: "이벤트 일정과 보상 안내 예시",
    excerpt: "참여 조건, 종료일, 보상 수령 기간을 한곳에서 확인합니다.",
    source: "공식 공지 연결 예정",
    meta: "참여 조건 · 기간 · 보상",
    summary: "이벤트 일정과 참여 조건, 보상 수령 기간을 공식 공지 기준으로 정리합니다. 마감일이 있는 항목은 할 일 목록과 연결합니다.",
    topics: ["참여 조건", "마감일", "보상"],
  },
  {
    id: "patch-guide",
    category: "공략",
    title: "패치 버전별 공략 찾기 예시",
    excerpt: "직업, 콘텐츠, 기준 버전과 수정일을 보고 공략을 비교합니다.",
    source: "이용자 공략 연결 예정",
    meta: "직업 · 콘텐츠 · 기준 버전",
    summary: "이용자 공략이 등록되면 대상 직업과 콘텐츠, 기준 패치 버전, 마지막 수정일을 표시해 현재 버전과 맞는지 살펴볼 수 있도록 합니다.",
    topics: ["패치 버전", "직업", "콘텐츠"],
  },
  {
    id: "maintenance-check",
    category: "점검",
    title: "점검 일정 확인 예시",
    excerpt: "점검 시간과 게임 이용 제한 범위를 원문과 함께 확인합니다.",
    source: "공식 공지 연결 예정",
    meta: "점검 시간 · 영향 범위 · 수정 이력",
    summary: "점검 일정이 연결되면 시간과 이용 제한 범위, 변경 안내를 공식 원문과 함께 표시합니다.",
    topics: ["점검 시간", "이용 제한", "수정 이력"],
  },
];

const taskItems = [
  { id: "event-check", title: "이벤트 참여 조건과 마감일 확인", source: "공식 안내에서 추출", due: "일정 연결 후 표시" },
  { id: "class-check", title: "내 직업의 변경사항 살펴보기", source: "직업별 브리핑", due: "확인" },
  { id: "setup-check", title: "필요한 세팅과 공략 다시 보기", source: "서비스 추천 행동", due: "선택" },
];

const categories = ["전체", "업데이트", "이벤트", "직업", "점검", "공략"];
const game = { name: "아이온2", aliases: "aion2 아이온2" };
const officialUpdateUrl = "https://aion2.plaync.com/ko-kr/board/update/list";
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

const savedTasks = () => readStorage("todaypatch.tasks", {});
const savedNews = () => readStorage("todaypatch.bookmarks", []);
const isSaved = (id) => savedNews().includes(id);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
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
    if (parts[1] === "updates" && parts[2]) return "detail";
    if (parts[1] === "updates") return "updates";
    if (["classes", "events", "guides", "tasks"].includes(parts[1])) return parts[1];
    return "game-home";
  }
  if (parts[0] === "updates" && parts[1]) return "detail";
  if (parts[0] === "updates") return "updates";
  if (parts[0] === "guides") return "guides";
  if (parts[0] === "tasks") return "tasks";
  return "home";
}

function detailId() {
  const parts = routeParts();
  return parts[0] === "aion2" ? parts[2] : parts[1];
}

function renderHeader() {
  const kind = routeKind();
  const inGame = kind !== "home";
  const links = [
    ["개요", "#/aion2", "game-home"],
    ["업데이트", "#/aion2/updates", "updates"],
    ["직업", "#/aion2/classes", "classes"],
    ["이벤트", "#/aion2/events", "events"],
    ["공략", "#/aion2/guides", "guides"],
    ["할 일", "#/aion2/tasks", "tasks"],
  ];

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
            ${links.map(([label, href, route]) => `<a class="nav-link ${kind === route || (route === "updates" && kind === "detail") ? "active" : ""}" href="${href}" ${kind === route ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
          </nav>` : `<span class="header-caption">게임별 소식을 한곳에서</span>`}
      </div>
    </header>`;
}

function renderHome() {
  return `
    <main class="home-page">
      <section class="home-search" aria-labelledby="home-title">
        <span class="home-eyebrow">TODAYPATCH</span>
        <h1 id="home-title">어떤 게임을 찾으세요?</h1>
        <p>게임을 선택하고 업데이트와 공략 정보를 확인해 보세요.</p>
        <label class="search-field game-search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input id="game-search" type="search" value="${escapeHTML(state.gameQuery)}" placeholder="게임 이름 검색" autocomplete="off" aria-label="게임 이름 검색" />
          <kbd>검색</kbd>
        </label>
        <div class="game-results" id="game-results" aria-live="polite"></div>
      </section>
    </main>`;
}

function renderGameIntro(title, description, crumb = title) {
  return `
    <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><a href="#/aion2">아이온2</a>${crumb === "아이온2" ? "" : `<span aria-hidden="true">›</span><span>${escapeHTML(crumb)}</span>`}</div>
    <div class="page-heading"><div><span class="page-eyebrow">AION2 GAME HUB</span><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${crumb === "아이온2" ? `<div class="page-heading-actions"><span class="data-state"><i></i>공식 데이터 연결 전</span><a class="official-link" href="${officialUpdateUrl}" target="_blank" rel="noopener noreferrer">공식 업데이트 보기 <span aria-hidden="true">↗</span></a></div>` : ""}</div>`;
}

function renderDemoNote() {
  return `<div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>화면 구조를 확인하기 위한 예시입니다. 실제 공지·공략·일정은 데이터 연동 후 표시됩니다.</p></div>`;
}

function renderQuickLink(label, description, href, icon) {
  return `<a class="quick-link" href="${href}"><span class="quick-icon" aria-hidden="true">${icon}</span><span class="quick-copy"><strong>${label}</strong><small>${description}</small></span><span class="quick-arrow" aria-hidden="true">→</span></a>`;
}

function renderGameHome() {
  const preview = newsItems.slice(0, 3);
  return `
    <main class="page-width game-page">
      ${renderGameIntro("아이온2", "공식 업데이트부터 직업별 변경점까지 필요한 정보를 모아보세요.", "아이온2")}
      ${renderDemoNote()}
      <section class="quick-links" aria-label="아이온2 정보 바로가기">
        ${renderQuickLink("업데이트", "요약과 패치 변경점", "#/aion2/updates", "↻")}
        ${renderQuickLink("직업별 변경", "스킬과 밸런스", "#/aion2/classes", "✳")}
        ${renderQuickLink("이벤트", "기간과 참여 조건", "#/aion2/events", "◇")}
        ${renderQuickLink("공략", "패치 기준으로 찾기", "#/aion2/guides", "⌁")}
        ${renderQuickLink("오늘 할 일", "체크리스트 관리", "#/aion2/tasks", "✓")}
      </section>
      <section class="content-section preview-section">
        <div class="section-heading"><div><h2>최근 정보</h2><p>요약과 근거 링크를 함께 확인하는 정보 카드 예시</p></div><a class="section-link" href="#/aion2/updates">전체 업데이트 <span aria-hidden="true">→</span></a></div>
        <div class="news-list">${preview.map(renderNewsCard).join("")}</div>
      </section>
    </main>`;
}

function renderFilterBar(kind) {
  const pageCategories = {
    updates: categories,
    classes: ["전체", "직업"],
    events: ["전체", "이벤트"],
    guides: ["전체", "공략"],
  }[kind];
  return `
    <div class="feed-tools">
      <label class="search-field news-search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input id="news-search" type="search" value="${escapeHTML(state.query)}" placeholder="공지, 직업, 이벤트 검색" autocomplete="off" aria-label="아이온2 정보 검색" />
        <kbd>검색</kbd>
      </label>
      <div class="filter-row" aria-label="정보 유형 필터">
        ${pageCategories.map((category) => `<button class="filter-chip ${state.filter === category ? "selected" : ""}" data-action="filter" data-filter="${category}" aria-pressed="${state.filter === category}">${category}</button>`).join("")}
        <button class="clear-filter" data-action="clear-filter">초기화</button>
      </div>
    </div>`;
}

function categoryClass(category) {
  return category === "직업" ? "class" : category === "이벤트" ? "event" : category === "공략" ? "guide" : category === "점검" ? "maintenance" : "update";
}

function renderNewsCard(item) {
  const bookmarked = isSaved(item.id);
  return `
    <article class="news-card">
      <a class="news-main" href="#/aion2/updates/${item.id}" aria-label="${escapeHTML(item.title)} 열기">
        <div class="news-topline"><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><span class="news-source">${escapeHTML(item.source)}</span></div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="news-excerpt">${escapeHTML(item.excerpt)}</p>
        <div class="news-meta">${escapeHTML(item.meta)}</div>
      </a>
      <button class="bookmark-button ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg>
      </button>
    </article>`;
}

function renderFeedPage(kind) {
  const page = {
    updates: ["아이온2 업데이트", "공식 공지와 관련 정보를 검색하고 유형별로 살펴보세요."],
    classes: ["직업별 변경점", "직업과 스킬에 영향을 주는 변경사항을 패치 기준으로 확인하세요."],
    events: ["이벤트와 일정", "참여 조건, 마감일, 보상 수령 기간을 한곳에서 확인하세요."],
    guides: ["아이온2 공략", "직업과 콘텐츠, 기준 패치 버전으로 공략을 찾아보세요."],
  }[kind];
  const filter = { classes: "직업", events: "이벤트", guides: "공략" }[kind];
  return `
    <main class="page-width game-page listing-page">
      ${renderGameIntro(page[0], page[1], page[0])}
      ${renderDemoNote()}
      <section class="content-section feed-section">
        ${renderFilterBar(kind)}
        <div class="section-heading list-heading"><div><h2>${kind === "updates" ? "전체 정보" : page[0]}</h2><p>검색 결과 <span id="news-count"></span></p></div></div>
        <div class="news-list" id="news-list"></div>
        <div class="empty-state" id="empty-state" hidden><span aria-hidden="true">⌕</span><strong>검색 결과가 없어요.</strong><p>다른 단어를 입력하거나 필터를 바꿔보세요.</p></div>
      </section>
    </main>`;
}

function renderTask(task, checked) {
  return `
    <div class="task-row ${checked ? "completed" : ""}">
      <button class="task-check" data-action="toggle-task" data-id="${task.id}" aria-label="${checked ? "완료 취소" : "완료 표시"}" aria-pressed="${Boolean(checked)}">${checked ? "✓" : ""}</button>
      <div class="task-copy"><strong>${escapeHTML(task.title)}</strong><span>${escapeHTML(task.source)}</span></div>
      <span class="task-due">${escapeHTML(task.due)}</span>
    </div>`;
}

function renderTasksPage() {
  const checked = savedTasks();
  const count = taskItems.filter((task) => checked[task.id]).length;
  return `
    <main class="page-width game-page listing-page tasks-page">
      ${renderGameIntro("패치 후 할 일", "공지에서 필요한 행동과 서비스 추천 항목을 나눠 관리합니다.", "할 일")}
      ${renderDemoNote()}
      <section class="task-panel">
        <div class="task-panel-heading"><div><span class="page-eyebrow">PATCH CHECKLIST</span><h2>아이온2 체크리스트</h2></div><span class="task-progress">${count} / ${taskItems.length} 완료</span></div>
        <p class="section-description">완료 상태는 이 브라우저에 저장됩니다. 계정 동기화는 아직 연결되지 않았습니다.</p>
        <div class="task-list">${taskItems.map((task) => renderTask(task, checked[task.id])).join("")}</div>
        <div class="task-legend"><span><i class="legend-official"></i>공식 공지에서 추출</span><span><i class="legend-suggestion"></i>서비스 추천 행동</span></div>
      </section>
    </main>`;
}

function renderDetail(id) {
  const item = newsItems.find((news) => news.id === id);
  if (!item) return `<main class="page-width not-found"><h1>정보를 찾을 수 없어요.</h1><a class="primary-button" href="#/aion2/updates">아이온2 정보로 돌아가기</a></main>`;
  const bookmarked = isSaved(item.id);
  return `
    <main class="page-width game-page detail-page">
      ${renderGameIntro("정보 상세", "출처와 적용 버전, 변경 내용을 확인하세요.", "상세 정보")}
      ${renderDemoNote()}
      <div class="detail-layout">
        <article class="detail-main">
          <div class="detail-title-row"><div><span class="category-pill category-${categoryClass(item.category)}">${escapeHTML(item.category)}</span><h1>${escapeHTML(item.title)}</h1><p>${escapeHTML(item.excerpt)}</p></div><button class="bookmark-button detail-bookmark ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}" aria-pressed="${bookmarked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg></button></div>
          <section class="article-panel"><div class="panel-heading"><h2>한눈에 요약</h2><span class="example-label">예시 구성</span></div><p>${escapeHTML(item.summary)}</p><div class="topic-list">${item.topics.map((topic) => `<span>${escapeHTML(topic)}</span>`).join("")}</div></section>
          <section class="article-panel"><div class="panel-heading"><h2>정보 기준</h2><span class="example-label">실제 정보 연결 후 표시</span></div><dl class="info-list"><div><dt>출처</dt><dd>${escapeHTML(item.source)}</dd></div><div><dt>적용 버전</dt><dd>정보 연결 후 표시</dd></div><div><dt>게시일 · 수정일</dt><dd>정보 연결 후 표시</dd></div></dl></section>
          <section class="article-panel action-panel"><div><strong>정보가 정확하지 않나요?</strong><p>날짜, 수치, 직업 정보나 출처 문제를 알려주세요.</p></div><button class="secondary-button" data-action="report">정보 신고</button></section>
          <a class="back-link" href="#/aion2/updates">← 아이온2 전체 정보</a>
        </article>
        <aside class="detail-side"><section class="source-panel"><span class="page-eyebrow">SOURCE & REVIEW</span><h2>공식 원문과 검토</h2><p>세부 공지와 분석 출처가 연결되기 전에는 공식 업데이트 목록에서 직접 확인할 수 있습니다.</p><div class="source-status-list"><div><span>원문 링크</span><strong>세부 연결 전</strong></div><div><span>AI 분석</span><strong>예시</strong></div><div><span>운영자 검토</span><strong>검토 전</strong></div></div><a class="secondary-button full-width" href="${officialUpdateUrl}" target="_blank" rel="noopener noreferrer">공식 업데이트 목록 <span aria-hidden="true">↗</span></a></section></aside>
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
  if (kind === "classes") items = items.filter((item) => item.category === "직업");
  if (kind === "events") items = items.filter((item) => item.category === "이벤트");
  if (kind === "guides") items = items.filter((item) => item.category === "공략");
  if (state.filter !== "전체") items = items.filter((item) => item.category === state.filter);
  const query = state.query.trim().toLocaleLowerCase("ko-KR");
  if (query) items = items.filter((item) => `${item.title} ${item.excerpt} ${item.category} ${item.meta} ${item.summary}`.toLocaleLowerCase("ko-KR").includes(query));
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
  const matches = game.aliases.toLocaleLowerCase("ko-KR").includes(state.gameQuery.trim().toLocaleLowerCase("ko-KR"));
  results.innerHTML = matches ? `
    <a class="game-result" href="#/aion2" aria-label="아이온2 정보 열기">
      <span class="game-result-mark" aria-hidden="true">A</span>
      <span class="game-result-copy"><strong>아이온2</strong><small>업데이트 · 직업 · 이벤트 · 공략</small></span>
      <span class="game-result-arrow" aria-hidden="true">→</span>
    </a>` : `<div class="no-games"><strong>검색 결과가 없습니다.</strong><span>게임 이름을 다시 확인해 주세요.</span></div>`;
}

function render() {
  const kind = routeKind();
  let page;
  if (kind === "game-home") page = renderGameHome();
  else if (["updates", "classes", "events", "guides"].includes(kind)) page = renderFeedPage(kind);
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
