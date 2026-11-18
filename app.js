const newsItems = [
  {
    id: "update-summary",
    category: "업데이트",
    title: "아이온2 업데이트 핵심 내용 빠르게 보기",
    excerpt: "공식 공지의 주요 변경점과 적용 조건을 짧게 정리하고 근거 위치를 연결합니다.",
    source: "공식 공지",
    meta: "AI 요약 · 기준 버전 표기 예정",
    summary: "업데이트 공지가 연결되면 직업 밸런스, 콘텐츠·시스템 변경, 오류 수정 내용을 한눈에 읽을 수 있도록 정리합니다. 확정 정보에는 원문 근거와 적용 버전을 함께 표시합니다.",
    topics: ["직업 밸런스", "콘텐츠·시스템", "오류 수정"],
  },
  {
    id: "event-rewards",
    category: "이벤트",
    title: "이벤트 참여 조건과 보상 수령 기간",
    excerpt: "참여 대상, 종료일, 보상 지급 시점을 확인하고 놓치기 쉬운 일정을 챙겨요.",
    source: "공식 공지",
    meta: "참여 조건 · 기간 · 보상",
    summary: "이벤트 시작일과 종료일, 참여 조건, 보상을 공지에서 추출해 정리합니다. 마감일이 확인되면 오늘 할 일과 일정에도 연결합니다.",
    topics: ["참여 조건", "마감일", "보상"],
  },
  {
    id: "gladiator-skills",
    category: "직업 변경",
    title: "검성 스킬 조정 내용과 적용 조건",
    excerpt: "직업별 스킬 변경을 기준 버전과 함께 비교하고 원문 근거를 확인합니다.",
    source: "직업 브리핑",
    meta: "스킬 효과 · 변경 조건 · 근거 문단",
    summary: "직업과 스킬별로 변경 전·후 수치, 효과, 발동 조건을 정리합니다. 실제 수치가 연결되기 전에는 임의의 변경값을 표시하지 않습니다.",
    topics: ["스킬 변경", "변경 전·후", "근거 확인"],
  },
  {
    id: "maintenance",
    category: "점검",
    title: "점검 시간과 게임 이용 제한 확인하기",
    excerpt: "점검 일정과 영향 범위, 변경 안내를 원문과 함께 확인할 수 있어요.",
    source: "공식 공지",
    meta: "게시·수정 시각 · 원문 링크",
    summary: "점검 시간과 이용 제한 범위를 공지 원문 기준으로 보여줍니다. 공지가 수정되면 수정 시각과 주요 변경 내용을 함께 기록합니다.",
    topics: ["점검 시간", "이용 제한", "수정 이력"],
  },
  {
    id: "current-guides",
    category: "공략",
    title: "현재 패치 기준 공략을 찾아보기",
    excerpt: "게임·직업·패치 버전과 수정일을 보고 지금 기준에 맞는 공략을 찾으세요.",
    source: "이용자 공략",
    meta: "패치 버전 · 작성일 · 수정일",
    summary: "공략은 기준 패치 버전과 마지막 수정일을 함께 표시해 현재 버전과 맞는지 확인할 수 있도록 구성합니다.",
    topics: ["패치 버전", "직업", "콘텐츠"],
  },
];

const taskItems = [
  { id: "event-check", title: "이벤트 참여 조건과 마감일 확인", source: "공식 안내 항목", due: "마감일 확인" },
  { id: "class-check", title: "내 직업의 변경사항 살펴보기", source: "직업별 브리핑", due: "확인" },
  { id: "setup-check", title: "스킬 세팅 변경점 검토", source: "서비스 추천 행동", due: "선택" },
];

const categories = ["전체", "업데이트", "이벤트", "직업", "점검", "공략"];
const state = { filter: "전체", query: "" };
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

function routeKind(route = currentRoute()) {
  if (route.startsWith("#/updates/")) return "detail";
  if (route === "#/updates") return "updates";
  if (route === "#/guides") return "guides";
  if (route === "#/tasks") return "tasks";
  return "home";
}

function renderHeader() {
  const kind = routeKind();
  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/" aria-label="오늘의 패치 홈">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span>오늘의 패치</span>
        </a>
        <div class="game-picker">
          <button class="game-picker-button" data-action="game-menu" aria-expanded="false">
            아이온2 <span class="chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="game-menu" id="game-menu" hidden>
            <p class="menu-title">초기 지원 게임</p>
            <button class="game-option" data-action="choose-game">
              <span><strong>아이온2</strong><small>업데이트 · 공략 · 일정</small></span><span class="option-check">✓</span>
            </button>
          </div>
        </div>
        <button class="mobile-menu-button" data-action="mobile-menu" aria-label="메뉴 열기" aria-expanded="false">☰</button>
        <nav class="main-nav" id="main-nav" aria-label="주 메뉴">
          <a class="nav-link ${kind === "home" ? "active" : ""}" href="#/">홈</a>
          <a class="nav-link ${kind === "updates" || kind === "detail" ? "active" : ""}" href="#/updates">업데이트</a>
          <a class="nav-link ${kind === "guides" ? "active" : ""}" href="#/guides">공략</a>
          <a class="nav-link ${kind === "tasks" ? "active" : ""}" href="#/tasks">오늘 할 일</a>
        </nav>
        <p class="header-tagline">필요한 게임 소식만, 간결하게.</p>
        <button class="login-button" data-action="login">로그인</button>
      </div>
    </header>`;
}

function renderConceptNote() {
  return `<div class="concept-note"><span class="concept-dot"></span> 콘셉트 데이터 · 공지 내용과 일정은 실제 아이온2 정보가 아닌 예시입니다</div>`;
}

function renderHero() {
  return `
    <section class="hero page-width">
      <span class="eyebrow">게임 정보 탐색이 가벼워지는 곳</span>
      <h1>오늘의 게임 소식,<br />필요한 것만 한눈에.</h1>
      <p>아이온2 공식 공지에서 직업 변경점, 이벤트와 오늘 할 일을 모아 보여드려요.</p>
      <a class="primary-button" href="#/updates">최신 브리핑 보기 <span aria-hidden="true">→</span></a>
      <span class="hero-caption">공지 원문과 적용 버전을 함께 확인할 수 있어요.</span>
    </section>`;
}

function renderFilterBar() {
  return `
    <div class="feed-tools">
      <label class="search-field">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="news-search" type="search" value="${escapeHTML(state.query)}" placeholder="소식, 직업, 이벤트 검색" autocomplete="off" />
        <kbd>검색</kbd>
      </label>
      <div class="filter-row" aria-label="소식 유형 필터">
        <span class="filter-label">콘텐츠</span>
        ${categories.map((category) => `<button class="filter-chip ${state.filter === category ? "selected" : ""}" data-action="filter" data-filter="${category}" aria-pressed="${state.filter === category}">${category}</button>`).join("")}
        <button class="clear-filter" data-action="clear-filter">초기화</button>
      </div>
    </div>`;
}

function renderNewsCard(item) {
  const bookmarked = isSaved(item.id);
  return `
    <article class="news-card">
      <a class="news-main" href="#/updates/${item.id}" aria-label="${escapeHTML(item.title)} 열기">
        <div class="news-topline">
          <span class="category-pill category-${item.category === "직업 변경" ? "job" : item.category === "이벤트" ? "event" : item.category === "공략" ? "guide" : item.category === "점검" ? "maintenance" : "update"}">${escapeHTML(item.category)}</span>
          <span class="news-source">${escapeHTML(item.source)}</span>
          <span class="analysis-state"><i></i> AI 분석 · 예시</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="news-excerpt">${escapeHTML(item.excerpt)}</p>
        <div class="news-meta"><span>${escapeHTML(item.meta)}</span><span>원문 근거 연결 예정</span></div>
      </a>
      <button class="bookmark-button ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg>
      </button>
    </article>`;
}

function renderNewsListHeading(title, helper = "") {
  return `
    <div class="section-heading">
      <div><h2>${title}</h2>${helper ? `<p>${helper}</p>` : ""}</div>
      <span class="result-count" id="news-count"></span>
    </div>`;
}

function renderTodoCard(compact = false) {
  const checked = savedTasks();
  const count = taskItems.filter((task) => checked[task.id]).length;
  return `
    <section class="side-card todo-card ${compact ? "todo-compact" : ""}">
      <div class="side-card-heading"><div><span class="side-kicker">PATCH CHECKLIST</span><h2>오늘 할 일</h2></div><span class="count-pill">${count}/${taskItems.length} 완료</span></div>
      <p class="side-description">공지에서 가져온 항목과 서비스 추천 행동을 나눠 보여드려요.</p>
      <div class="task-list">${taskItems.map((task) => renderTask(task, checked[task.id])).join("")}</div>
      ${compact ? "" : `<a class="side-link" href="#/tasks">할 일 전체 보기 <span aria-hidden="true">→</span></a>`}
    </section>`;
}

function renderTask(task, checked) {
  return `
    <div class="task-row ${checked ? "completed" : ""}">
      <button class="task-check" data-action="toggle-task" data-id="${task.id}" aria-label="${checked ? "완료 취소" : "완료 표시"}" aria-pressed="${Boolean(checked)}">
        ${checked ? "✓" : ""}
      </button>
      <div class="task-copy"><strong>${escapeHTML(task.title)}</strong><span>${escapeHTML(task.source)}</span></div>
      <span class="task-due">${escapeHTML(task.due)}</span>
    </div>`;
}

function renderSourceCard() {
  return `
    <section class="side-card source-card">
      <div class="side-card-heading"><div><span class="side-kicker">SOURCE & REVIEW</span><h2>정보 기준 확인</h2></div><span class="verified-icon" aria-hidden="true">✓</span></div>
      <p class="side-description">출처와 검토 상태를 확인하고 믿을 수 있는 정보인지 살펴보세요.</p>
      <div class="source-status-list">
        <div><span class="status-symbol official"></span><span>공식 공지 원문</span><strong class="status-pending">연결 전</strong></div>
        <div><span class="status-symbol ai"></span><span>AI 분석</span><strong>예시 결과</strong></div>
        <div><span class="status-symbol review"></span><span>운영자 검토</span><strong class="status-pending">검토 전</strong></div>
      </div>
      <button class="text-action" data-action="report">잘못된 정보 신고 <span aria-hidden="true">→</span></button>
    </section>`;
}

function renderSidebar() {
  return `<aside class="sidebar">${renderTodoCard()}${renderSourceCard()}<section class="tip-card"><span class="tip-icon" aria-hidden="true">i</span><p><strong>패치 버전이 기준이에요</strong><br />공지와 공략에 적용 버전과 수정 시각을 함께 표시합니다.</p></section></aside>`;
}

function renderFeedSection(title, helper, includeTools = true) {
  return `
    <section class="feed-section">
      ${title ? renderNewsListHeading(title, helper) : ""}
      ${includeTools ? renderFilterBar() : ""}
      <div class="news-list" id="news-list"></div>
      <div class="empty-state" id="empty-state" hidden><span>⌕</span><strong>조건에 맞는 소식이 없어요.</strong><p>검색어나 필터를 바꿔 다시 살펴보세요.</p></div>
      <button class="load-more" data-action="load-more">소식 더 보기 <span aria-hidden="true">⌄</span></button>
    </section>`;
}

function renderHome() {
  return `${renderConceptNote()}${renderHero()}
    <main class="page-width home-content">
      <div class="home-section-heading">${renderNewsListHeading("오늘 올라온 주요 소식", "아이온2의 업데이트, 이벤트, 직업 변경 정보를 한곳에서 확인하세요.")}</div>
      <div class="content-grid">
        <div class="main-column">${renderFeedSection("", "", true)}</div>
        ${renderSidebar()}
      </div>
    </main>`;
}

function renderUpdates() {
  return `${renderConceptNote()}
    <main class="page-width listing-page">
      <div class="breadcrumb"><a href="#/">홈</a><span>›</span><span>게임별 소식</span></div>
      <div class="listing-title-row"><div><h1>${routeKind() === "guides" ? "아이온2 공략" : "아이온2 소식"}</h1><p>이 게임의 소식과 공략을, 최신 기준에 맞게 살펴보세요.</p></div><div class="patch-summary"><span class="patch-label">패치 버전</span><strong>공지 연결 후 표시</strong></div></div>
      <div class="content-grid listing-grid">
        <div class="main-column">
          <div class="filter-panel">${renderFilterBar()}</div>
          ${renderFeedSection(routeKind() === "guides" ? "패치 기준 공략" : "전체 소식", "검색과 콘텐츠 유형으로 필요한 정보를 찾아보세요.", false)}
        </div>
        ${renderSidebar()}
      </div>
    </main>`;
}

function renderDetail(id) {
  const item = newsItems.find((news) => news.id === id);
  if (!item) return `<main class="page-width not-found"><h1>소식을 찾을 수 없어요.</h1><a class="primary-button" href="#/updates">전체 소식 보기</a></main>`;
  const bookmarked = isSaved(item.id);
  return `${renderConceptNote()}
    <main class="page-width detail-page">
      <div class="breadcrumb"><a href="#/">아이온2</a><span>›</span><a href="#/updates">게임별 소식</a><span>›</span><span>${escapeHTML(item.category)}</span></div>
      <div class="detail-title-row">
        <div><span class="category-pill category-${item.category === "직업 변경" ? "job" : item.category === "이벤트" ? "event" : item.category === "공략" ? "guide" : item.category === "점검" ? "maintenance" : "update"}">${escapeHTML(item.category)}</span><h1>${escapeHTML(item.title)}</h1><p>${escapeHTML(item.excerpt)}</p></div>
        <button class="bookmark-button detail-bookmark ${bookmarked ? "saved" : ""}" data-action="bookmark" data-id="${item.id}" aria-label="${bookmarked ? "북마크 해제" : "북마크 저장"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.5-3.8L6.5 21V4.75Z" /></svg></button>
      </div>
      <div class="content-grid detail-grid">
        <div class="main-column article-column">
          <section class="article-panel summary-panel"><div class="panel-heading"><div><span class="side-kicker">AI PATCH BRIEF</span><h2>한눈에 요약</h2></div><span class="analysis-badge"><i></i> 예시 분석</span></div><p>${escapeHTML(item.summary)}</p><div class="topic-list">${item.topics.map((topic) => `<span>${escapeHTML(topic)}</span>`).join("")}</div></section>
          <section class="article-panel"><div class="panel-heading"><div><span class="side-kicker">CLASS & SKILL</span><h2>직업별 변경점</h2></div><span class="small-muted">원문 근거 연결 예정</span></div><div class="change-row"><span class="class-mark">검</span><div><strong>검성</strong><p>스킬 효과와 적용 조건을 패치 전·후로 비교해 보여줍니다.</p></div><span class="change-tag">예시 항목</span></div><div class="change-row"><span class="class-mark class-mark-blue">치</span><div><strong>치유성</strong><p>직업에 영향을 주는 변경사항을 근거 문단과 함께 확인합니다.</p></div><span class="change-tag">예시 항목</span></div></section>
          <section class="article-panel"><div class="panel-heading"><div><span class="side-kicker">EVENT & REWARD</span><h2>이벤트와 보상</h2></div><span class="small-muted">공지에 일정이 있을 때 표시</span></div><div class="event-detail"><div class="event-icon" aria-hidden="true">✦</div><div><strong>참여 조건과 보상 수령 기간</strong><p>참여 조건, 종료일, 보상 수령 시점을 공식 공지에서 가져와 체크리스트에 연결합니다.</p></div></div></section>
          <section class="article-panel action-panel"><div><strong>이 정보에 문제가 있나요?</strong><p>수치·날짜·직업 정보가 잘못되었다면 알려주세요.</p></div><button class="secondary-button" data-action="report">정보 신고</button></section>
        </div>
        <aside class="sidebar detail-sidebar">
          <section class="side-card source-card"><div class="side-card-heading"><div><span class="side-kicker">OFFICIAL SOURCE</span><h2>공식 원문</h2></div><span class="verified-icon" aria-hidden="true">↗</span></div><span class="category-pill category-update">${escapeHTML(item.source)}</span><p class="side-description">실제 공지 링크와 게시·수정 시각, 적용 버전이 연결되면 이곳에서 확인할 수 있어요.</p><div class="source-status-list"><div><span>원문 링크</span><strong class="status-pending">연결 전</strong></div><div><span>적용 버전</span><strong>확인 전</strong></div><div><span>마지막 수정</span><strong>정보 연결 후 표시</strong></div></div><button class="secondary-button full-width" data-action="source-info">공식 공지 보기 <span aria-hidden="true">↗</span></button></section>
          ${renderTodoCard(true)}
          <section class="side-card review-card"><span class="side-kicker">REVIEW STATUS</span><h2>분석 상태</h2><div class="review-status"><span class="status-symbol ai"></span><span>AI 요약</span><strong>예시</strong></div><div class="review-status"><span class="status-symbol review"></span><span>운영자 검토</span><strong class="status-pending">검토 전</strong></div><p class="review-footnote">공식 확인 내용과 서비스 추천 행동을 구분해 표시합니다.</p></section>
        </aside>
      </div>
      <a class="back-link" href="#/updates">← 전체 소식으로 돌아가기</a>
    </main>`;
}

function renderTasksPage() {
  return `${renderConceptNote()}<main class="page-width listing-page tasks-page"><div class="breadcrumb"><a href="#/">홈</a><span>›</span><span>오늘 할 일</span></div><div class="listing-title-row"><div><h1>패치 후 할 일</h1><p>공지에서 확인한 항목과 서비스가 제안하는 행동을 나눠 관리해요.</p></div><span class="category-pill category-update">아이온2</span></div><div class="tasks-layout">${renderTodoCard()}<section class="side-card task-note"><span class="side-kicker">HOW IT WORKS</span><h2>공식 안내와 추천 행동을 구분해요</h2><p>공지에 직접 명시된 참여 조건이나 보상 수령 안내는 출처와 함께 표시합니다. 스킬 세팅을 다시 살펴보는 일처럼 서비스가 제안하는 행동은 추천 항목으로 분리해요.</p><div class="legend-row"><span class="legend-dot official"></span>공식 공지에서 가져온 항목</div><div class="legend-row"><span class="legend-dot ai"></span>서비스가 제안하는 행동</div></section></div></main>`;
}

function renderModal() {
  return `<dialog class="app-dialog" id="app-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function render() {
  const route = currentRoute();
  const kind = routeKind(route);
  let page;
  if (kind === "detail") page = renderDetail(route.slice("#/updates/".length));
  else if (kind === "updates" || kind === "guides") page = renderUpdates();
  else if (kind === "tasks") page = renderTasksPage();
  else page = renderHome();
  app.innerHTML = `${renderHeader()}${page}${renderFooter()}${renderModal()}`;
  drawNewsList();
}

function renderFooter() {
  return `<footer class="site-footer"><div class="footer-inner page-width"><a class="footer-brand" href="#/">오늘의 패치</a><span>게임 정보의 기준을 한곳에서.</span><span class="footer-note">콘셉트 디자인 · 게시물과 일정은 예시입니다.</span></div></footer>`;
}

function visibleNews() {
  let items = [...newsItems];
  if (routeKind() === "guides") items = items.filter((item) => item.category === "공략");
  if (state.filter !== "전체") {
    items = items.filter((item) => state.filter === "직업" ? item.category === "직업 변경" : item.category === state.filter);
  }
  const query = state.query.trim().toLowerCase();
  if (query) items = items.filter((item) => `${item.title} ${item.excerpt} ${item.category} ${item.meta}`.toLowerCase().includes(query));
  return items;
}

function drawNewsList() {
  const list = app.querySelector("#news-list");
  if (!list) return;
  const items = visibleNews();
  list.innerHTML = items.map(renderNewsCard).join("");
  const count = app.querySelector("#news-count");
  if (count) count.textContent = `${items.length}개`;
  const empty = app.querySelector("#empty-state");
  if (empty) empty.hidden = items.length > 0;
}

function openDialog(kind) {
  const dialog = app.querySelector("#app-dialog");
  const content = app.querySelector("#dialog-content");
  if (!dialog || !content) return;
  if (kind === "login") {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="side-kicker">TODAYPATCH ACCOUNT</span><h2 id="dialog-title">로그인</h2><p>북마크와 할 일 저장 기능은 이 브라우저에서 사용할 수 있어요. 계정 연동은 서비스 준비 단계입니다.</p><button class="primary-button dialog-primary" data-action="close-dialog">확인</button>`;
  } else {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="side-kicker">REPORT INFORMATION</span><h2 id="dialog-title">정보 신고</h2><p>잘못된 날짜·수치·직업 정보나 오래된 공략을 알려주세요.</p><form id="report-form"><label for="report-reason">신고 내용</label><select id="report-reason" name="reason"><option>날짜 또는 기간이 달라요</option><option>직업·스킬 정보가 달라요</option><option>패치 버전이 오래됐어요</option><option>출처 링크가 열리지 않아요</option><option>기타</option></select><label for="report-detail">자세한 내용</label><textarea id="report-detail" name="detail" rows="3" placeholder="확인한 내용을 적어주세요."></textarea><button class="primary-button dialog-primary" type="submit">신고 내용 확인</button></form><span class="dialog-note">프로토타입에서는 신고가 저장되지 않습니다.</span>`;
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
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
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
    writeStorage("todaypatch.bookmarks", bookmarks.includes(id) ? bookmarks.filter((item) => item !== id) : [...bookmarks, id]);
    render();
    showToast(bookmarks.includes(id) ? "북마크를 해제했어요." : "소식을 북마크에 저장했어요.");
  }
  if (action === "toggle-task") {
    const checked = savedTasks();
    checked[id] = !checked[id];
    writeStorage("todaypatch.tasks", checked);
    render();
  }
  if (action === "game-menu") {
    const menu = app.querySelector("#game-menu");
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  if (action === "choose-game") {
    app.querySelector("#game-menu").hidden = true;
    app.querySelector(".game-picker-button").setAttribute("aria-expanded", "false");
    showToast("아이온2가 선택되어 있어요.");
  }
  if (action === "mobile-menu") {
    const nav = app.querySelector("#main-nav");
    const open = nav.classList.toggle("mobile-open");
    button.setAttribute("aria-expanded", String(open));
  }
  if (action === "login") openDialog("login");
  if (action === "report") openDialog("report");
  if (action === "close-dialog") app.querySelector("#app-dialog").close();
  if (action === "source-info") showToast("실제 공식 공지 연결 후 원문 링크가 표시됩니다.");
  if (action === "load-more") showToast("새 공지가 연결되면 더 많은 소식을 불러옵니다.");
});

app.addEventListener("input", (event) => {
  if (event.target.id === "news-search") {
    state.query = event.target.value;
    drawNewsList();
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "report-form") return;
  event.preventDefault();
  app.querySelector("#app-dialog").close();
  showToast("신고 양식을 확인했어요. 실제 저장 기능은 서비스 연동 후 제공됩니다.");
});

window.addEventListener("hashchange", () => {
  state.filter = "전체";
  state.query = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
