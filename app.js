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

const dokebiNewsItems = [
  {
    id: "dokebi-world-intro",
    category: "업데이트",
    title: "도깨비의 세계 공개 정보 모아보기",
    excerpt: "공식 채널에 공개된 세계관과 게임 소식을 한곳에서 정리합니다.",
    source: "정보 모음 예시",
    meta: "공개 정보 · 공식 소식",
    summary: "도깨비의 세계에 관해 공개된 공식 정보와 소식을 확인할 수 있도록 구성한 페이지 예시입니다.",
    topics: ["세계관", "공식 소식", "공개 정보"],
  },
  {
    id: "dokebi-adventure-guide",
    category: "공략",
    title: "도깨비의 세계 입문 가이드",
    excerpt: "게임을 시작하기 전에 확인할 기본 정보와 자주 묻는 내용을 모았습니다.",
    source: "이용자 공략 예시",
    meta: "입문 · 기본 정보",
    summary: "도깨비의 세계를 처음 접하는 이용자를 위해 공개된 기본 정보와 입문 팁을 정리하는 공략 예시입니다.",
    topics: ["입문 가이드", "기본 정보", "자주 묻는 질문"],
  },
  {
    id: "dokebi-news-watch",
    category: "이벤트",
    title: "도깨비의 세계 새 소식 확인하기",
    excerpt: "새로운 소식과 일정이 등록되면 이 페이지에서 검색할 수 있습니다.",
    source: "소식 연결 예시",
    meta: "새 소식 · 일정",
    summary: "공식 발표와 이벤트 일정이 연결되면 게시일과 원문 링크를 함께 보여주는 영역입니다.",
    topics: ["소식", "일정", "원문 링크"],
  },
];

const categories = ["전체", "업데이트", "이벤트", "직업", "점검", "공략"];
const games = [
  { id: "aion2", name: "아이온2", aliases: "aion2 아이온2", eyebrow: "AION2", data: newsItems },
  { id: "dokebi", name: "도깨비의 세계", aliases: "도깨비의 세계 도깨비 dokev dokebi", eyebrow: "DOKEBI WORLD", data: dokebiNewsItems },
];
const officialUpdateUrl = "https://aion2.plaync.com/ko-kr/board/update/list";
const launchDate = new Date("2026-11-26T00:00:00+09:00");
const state = { filter: "전체", query: "", gameQuery: "", tutorialStep: 0, skipTutorial: false };
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

function currentGameId() {
  const firstPart = routeParts()[0];
  return games.some((item) => item.id === firstPart) ? firstPart : "aion2";
}

function activeGame() {
  return games.find((item) => item.id === currentGameId()) || games[0];
}

function activeNews() {
  return activeGame().data;
}

function gamePath(path = "") {
  return `#/${currentGameId()}${path ? `/${path}` : ""}`;
}

function routeParts(route = currentRoute()) {
  return route.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function routeKind(route = currentRoute()) {
  const parts = routeParts(route);
  if (!parts.length) return "home";
  if (games.some((item) => item.id === parts[0])) {
    if (parts[1] === "updates" && parts[2]) return "detail";
    if (parts[1] === "updates") return "updates";
    if (["classes", "events", "guides", "tasks"].includes(parts[1])) return parts[1];
    return "game-home";
  }
  return "home";
}

function detailId() {
  return routeParts()[2];
}

function renderHeader() {
  const kind = routeKind();
  const inGame = kind !== "home";
  const current = activeGame();
  const links = [
    ["개요", gamePath(), "game-home"],
    ["업데이트", gamePath("updates"), "updates"],
    ["직업", gamePath("classes"), "classes"],
    ["이벤트", gamePath("events"), "events"],
    ["공략", gamePath("guides"), "guides"],
    ["할 일", gamePath("tasks"), "tasks"],
  ];

  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/" aria-label="오늘의 패치 게임 검색">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span>오늘의 패치</span>
        </a>
        ${inGame ? `<a class="header-game" href="${gamePath()}"><span class="header-divider" aria-hidden="true"></span>${current.id === "aion2" ? '<img class="aion2-logo aion2-logo-header" src="./assets/aion2-logo.png" alt="" />' : '<span class="dokebi-mark dokebi-mark-header" aria-hidden="true">도</span>'}${escapeHTML(current.name)}</a>
          <button class="mobile-menu-button" data-action="mobile-menu" aria-label="게임 메뉴 열기" aria-expanded="false">☰</button>
          <nav class="main-nav" id="main-nav" aria-label="${escapeHTML(current.name)} 메뉴">
            ${links.map(([label, href, route]) => `<a class="nav-link ${kind === route || (route === "updates" && kind === "detail") ? "active" : ""}" href="${href}" ${kind === route ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
          </nav>` : `<span class="header-caption">게임별 소식을 한곳에서</span>`}
      </div>
    </header>`;
}

function renderHome() {
  return `
    <main class="home-page page-width">
      <div class="dashboard-toolbar">
        <div><span class="home-eyebrow">TODAYPATCH</span><h1 id="home-title">게임 소식 모아보기</h1></div>
        <div class="dashboard-search">
          <label class="search-field game-search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input id="game-search" type="search" value="${escapeHTML(state.gameQuery)}" placeholder="게임 이름 검색" autocomplete="off" aria-label="게임 이름 검색" />
            <kbd>검색</kbd>
          </label>
          <div class="game-results" id="game-results" aria-live="polite"></div>
        </div>
      </div>
      <div class="dashboard-layout">
        <section class="dashboard-panel followed-panel" aria-labelledby="followed-title">
          <div class="dashboard-panel-heading"><div><span class="page-eyebrow">FOLLOWED GAMES</span><h2 id="followed-title">팔로우한 게임 게시글</h2></div><span class="panel-count">6건</span></div>
          <div class="followed-list">
            ${[
              ["공지", "[안내] AION2 2026 대한민국 게임대상 수상 및 쿠폰 안내"],
              ["공지", "[안내] 운영정책 위반 및 임시보호 계정들에 대한 게임 이용제한 안내 [351차]"],
              ["공지", "[안내] AION2 운영정책 변경 안내"],
              ["공지", "[안내] 무료 서버 이전 기간 중 거래소 정산 한도 임시 해제"],
              ["공지", "[안내] 11월 3주차 알려진 이슈 및 조치 안내 (수정 11/18 22:15)"],
              ["업데이트", "[안내] 11/18(수) 업데이트 노트 (수정 11/18 05:55)"],
            ].map(([label, title], index) => `<a class="followed-post" href="#/aion2/updates/${index === 5 ? "update-summary" : "maintenance-check"}"><div class="followed-meta"><span class="post-tag ${label === "업데이트" ? "post-tag-update" : ""}">${label}</span><time datetime="2026-11-18">2026. 11. 18.</time></div><strong>${title}</strong><span class="followed-source">아이온2 · 게시글 보기 <i aria-hidden="true">→</i></span></a>`).join("")}
          </div>
        </section>
        <aside class="dashboard-side" aria-label="출시 예정과 인기 콘텐츠">
          <section class="countdown-card" aria-labelledby="countdown-title">
            <div class="dashboard-panel-heading"><div><span class="countdown-eyebrow">COMING SOON</span><h2 id="countdown-title">출시 카운트다운</h2></div><span class="countdown-total">1개</span></div>
            <div class="launch-game"><div class="launch-mark" aria-hidden="true">템빨</div><div class="launch-copy"><div class="launch-date"><span>출시</span><time datetime="2026-11-26">11.26</time></div><strong>템빨: 오버기어드</strong><small>◷ &nbsp;출시까지 남은 시간</small></div></div>
            <div class="countdown-timer" aria-label="출시까지 남은 시간"><div><strong id="countdown-days">--</strong><span>Days</span></div><i>:</i><div><strong id="countdown-hours">--</strong><span>Hours</span></div><i>:</i><div><strong id="countdown-minutes">--</strong><span>Min</span></div><i>:</i><div><strong id="countdown-seconds">--</strong><span>Sec</span></div></div>
          </section>
          ${renderPopularPanel("POPULAR GUIDES", "인기 공략글", "열람 · 저장 · 내용 관련도", [
            ["쿠폰 등록 방법", "쿠폰을 등록할 수 있는 경로 두 가지를 안내합니다.", "update-summary"],
            ["이의 제기 방법", "제재 및 임시 보호 조치에 대한 확인 요청 방법을 안내합니다.", "maintenance-check"],
            ["이의 제기 및 문의", "정책 변경과 문의 방법을 안내합니다.", "class-changes"],
          ])}
          ${renderPopularPanel("POPULAR POSTS", "인기 게시글", "최근 반응이 많은 게시글", [
            ["AION2 2026 대한민국 게임대상 수상", "수상 기념 쿠폰과 등록 기간을 확인하세요.", "update-summary"],
            ["11/18(수) 업데이트 노트", "이번 업데이트의 주요 변경사항을 모았습니다.", "patch-guide"],
            ["11월 3주차 알려진 이슈", "현재 확인 중인 현상과 조치 내용을 확인하세요.", "maintenance-check"],
          ])}
        </aside>
      </div>
    </main>`;
}

function renderPopularPanel(eyebrow, title, note, items) {
  return `<section class="dashboard-panel popular-panel" aria-label="${title}"><div class="dashboard-panel-heading"><div><span class="page-eyebrow">${eyebrow}</span><h2>${title}</h2></div><span class="popular-note">${note}</span></div><div class="popular-list">${items.map(([name, description, id]) => `<a class="popular-item" href="#/aion2/updates/${id}"><strong>${name}</strong><span>${description}</span><small>[안내] ${name}</small></a>`).join("")}</div></section>`;
}

function renderGameIntro(title, description, crumb = title) {
  const current = activeGame();
  const gameIcon = current.id === "aion2" ? '<img class="aion2-logo aion2-logo-title" src="./assets/aion2-logo.png" alt="" />' : '<span class="dokebi-mark dokebi-mark-title" aria-hidden="true">도</span>';
  const officialAction = current.id === "aion2" ? `<div class="page-heading-actions"><span class="data-state"><i></i>공식 데이터 연결 전</span><a class="official-link" href="${officialUpdateUrl}" target="_blank" rel="noopener noreferrer">공식 업데이트 보기 <span aria-hidden="true">↗</span></a></div>` : "";
  return `
    <div class="breadcrumb"><a href="#/">게임 찾기</a><span aria-hidden="true">›</span><a href="${gamePath()}">${escapeHTML(current.name)}</a>${crumb === current.name ? "" : `<span aria-hidden="true">›</span><span>${escapeHTML(crumb)}</span>`}</div>
    <div class="page-heading"><div><span class="page-eyebrow">${current.eyebrow} GAME HUB</span><h1 class="${title === current.name ? "game-title" : ""}">${title === current.name ? gameIcon : ""}${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${crumb === current.name ? officialAction : ""}</div>`;
}

function renderDemoNote() {
  return `<div class="demo-note"><span class="demo-icon" aria-hidden="true">i</span><p>화면 구조를 확인하기 위한 예시입니다. 실제 공지·공략·일정은 데이터 연동 후 표시됩니다.</p></div>`;
}

function renderQuickLink(label, description, href, icon) {
  return `<a class="quick-link" href="${href}"><span class="quick-icon" aria-hidden="true">${icon}</span><span class="quick-copy"><strong>${label}</strong><small>${description}</small></span><span class="quick-arrow" aria-hidden="true">→</span></a>`;
}

function renderGameHome() {
  const current = activeGame();
  const preview = activeNews().slice(0, 3);
  return `
    <main class="page-width game-page">
      ${renderGameIntro(current.name, `${current.name} 소식과 공략을 모아보고 필요한 정보를 검색해 보세요.`, current.name)}
      ${renderDemoNote()}
      <section class="quick-links" aria-label="${escapeHTML(current.name)} 정보 바로가기">
        ${renderQuickLink("업데이트", "요약과 패치 변경점", gamePath("updates"), "↻")}
        ${renderQuickLink("직업별 변경", "직업과 주요 정보", gamePath("classes"), "✳")}
        ${renderQuickLink("이벤트", "기간과 참여 조건", gamePath("events"), "◇")}
        ${renderQuickLink("공략", "게임별 가이드 검색", gamePath("guides"), "⌁")}
        ${renderQuickLink("오늘 할 일", "체크리스트 관리", gamePath("tasks"), "✓")}
      </section>
      <section class="content-section preview-section">
        <div class="section-heading"><div><h2>최근 정보</h2><p>검색으로 소식과 공략 정보를 찾아보세요.</p></div><a class="section-link" href="${gamePath("updates")}">전체 업데이트 <span aria-hidden="true">→</span></a></div>
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
        <input id="news-search" type="search" value="${escapeHTML(state.query)}" placeholder="공지, 직업, 이벤트 검색" autocomplete="off" aria-label="${escapeHTML(activeGame().name)} 정보 검색" />
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
      <a class="news-main" href="${gamePath(`updates/${item.id}`)}" aria-label="${escapeHTML(item.title)} 열기">
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
  const current = activeGame();
  const page = {
    updates: [`${current.name} 업데이트`, "공식 소식과 관련 정보를 검색하고 유형별로 살펴보세요."],
    classes: ["직업별 변경점", "직업과 주요 요소에 영향을 주는 변경사항을 확인하세요."],
    events: ["이벤트와 일정", "참여 조건, 마감일, 보상 수령 기간을 한곳에서 확인하세요."],
    guides: [`${current.name} 공략`, "게임과 콘텐츠 정보를 검색해 공략을 찾아보세요."],
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
        <div class="task-panel-heading"><div><span class="page-eyebrow">PATCH CHECKLIST</span><h2>${escapeHTML(activeGame().name)} 체크리스트</h2></div><span class="task-progress">${count} / ${taskItems.length} 완료</span></div>
        <p class="section-description">완료 상태는 이 브라우저에 저장됩니다. 계정 동기화는 아직 연결되지 않았습니다.</p>
        <div class="task-list">${taskItems.map((task) => renderTask(task, checked[task.id])).join("")}</div>
        <div class="task-legend"><span><i class="legend-official"></i>공식 공지에서 추출</span><span><i class="legend-suggestion"></i>서비스 추천 행동</span></div>
      </section>
    </main>`;
}

function renderDetail(id) {
  const current = activeGame();
  const item = activeNews().find((news) => news.id === id);
  if (!item) return `<main class="page-width not-found"><h1>정보를 찾을 수 없어요.</h1><a class="primary-button" href="${gamePath("updates")}">${escapeHTML(current.name)} 정보로 돌아가기</a></main>`;
  const bookmarked = isSaved(item.id);
  const sourcePanel = current.id === "aion2" ? `<aside class="detail-side"><section class="source-panel"><span class="page-eyebrow">SOURCE & REVIEW</span><h2>공식 원문과 검토</h2><p>세부 공지와 분석 출처가 연결되기 전에는 공식 업데이트 목록에서 직접 확인할 수 있습니다.</p><div class="source-status-list"><div><span>원문 링크</span><strong>세부 연결 전</strong></div><div><span>AI 분석</span><strong>예시</strong></div><div><span>운영자 검토</span><strong>검토 전</strong></div></div><a class="secondary-button full-width" href="${officialUpdateUrl}" target="_blank" rel="noopener noreferrer">공식 업데이트 목록 <span aria-hidden="true">↗</span></a></section></aside>` : "";
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
          <a class="back-link" href="${gamePath("updates")}">← ${escapeHTML(current.name)} 전체 정보</a>
        </article>
        ${sourcePanel}
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
  let items = [...activeNews()];
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
  const query = state.gameQuery.trim().toLocaleLowerCase("ko-KR");
  const matches = games.filter((item) => item.aliases.toLocaleLowerCase("ko-KR").includes(query));
  results.innerHTML = matches.length ? matches.map((item) => `
    <a class="game-result" href="#/${item.id}" aria-label="${escapeHTML(item.name)} 정보 열기">
      ${item.id === "aion2" ? '<img class="aion2-logo aion2-logo-result" src="./assets/aion2-logo.png" alt="" />' : '<span class="dokebi-mark dokebi-mark-result" aria-hidden="true">도</span>'}
      <span class="game-result-copy"><strong>${escapeHTML(item.name)}</strong><small>업데이트 · 소식 · 이벤트 · 공략</small></span>
      <span class="game-result-arrow" aria-hidden="true">→</span>
    </a>`).join("") : `<div class="no-games"><strong>검색 결과가 없습니다.</strong><span>게임 이름을 다시 확인해 주세요.</span></div>`;
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
  updateCountdown();
}

function updateCountdown() {
  const remaining = Math.max(0, launchDate.getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const values = {
    "countdown-days": String(Math.floor(totalSeconds / 86400)).padStart(2, "0"),
    "countdown-hours": String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0"),
    "countdown-minutes": String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
    "countdown-seconds": String(totalSeconds % 60).padStart(2, "0"),
  };
  Object.entries(values).forEach(([id, value]) => {
    const output = app.querySelector(`#${id}`);
    if (output) output.textContent = value;
  });
}

function openDialog(kind) {
  const dialog = app.querySelector("#app-dialog");
  const content = app.querySelector("#dialog-content");
  if (!dialog || !content) return;
  dialog.dataset.kind = kind;
  if (kind === "tutorial") {
    const steps = [
      ["게임을 찾아 팔로우하세요", "검색창에서 게임을 찾고 팔로우하면 게임 소식과 바로가기를 한곳에서 확인할 수 있어요.", "출시 예정 게임은 남은 시간이 표시된 카운트다운에서 확인할 수 있습니다."],
      ["필요한 소식을 찾아보세요", "업데이트와 게임 게시글을 확인하고 검색과 분류 버튼으로 필요한 정보를 빠르게 찾을 수 있어요.", "새 소식은 홈의 팔로우한 게임 게시글에 모아 보여드립니다."],
      ["공략을 저장하고 활용하세요", "인기 공략글을 살펴보고 유용한 정보는 저장해 두었다가 게임 페이지에서 다시 확인할 수 있어요.", "저장한 정보와 체크리스트는 현재 사용 중인 브라우저에 보관됩니다."],
    ];
    const [title, body, note] = steps[state.tutorialStep];
    const finished = state.tutorialStep === steps.length - 1;
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="안내 닫기">×</button><div class="tutorial-topline"><span class="page-eyebrow">이용 가이드 · ${state.tutorialStep + 1} / ${steps.length}</span><div class="tutorial-progress" aria-label="${state.tutorialStep + 1}단계 / ${steps.length}단계">${steps.map((_, index) => `<i class="${index <= state.tutorialStep ? "complete" : ""}"></i>`).join("")}</div></div><span class="tutorial-step-label">STEP 0${state.tutorialStep + 1}</span><h2 class="tutorial-title" id="dialog-title">${title}</h2><p class="tutorial-body">${body}</p><div class="tutorial-hint"><span aria-hidden="true">i</span><p>${note}</p></div><div class="tutorial-actions"><label class="tutorial-skip"><input id="skip-tutorial" type="checkbox" ${state.skipTutorial ? "checked" : ""}><span>앞으로 자동으로 띄우지 않기</span></label><button class="primary-button" data-action="tutorial-next">${finished ? "시작하기" : "다음"}</button></div>`;
  } else if (kind === "login") {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">TODAYPATCH ACCOUNT</span><h2 id="dialog-title">로그인</h2><p>북마크와 할 일은 현재 이 브라우저에 저장됩니다. 계정 로그인과 기기 간 동기화는 아직 연결되지 않았습니다.</p><button class="primary-button dialog-primary" data-action="close-dialog">확인</button>`;
  } else {
    content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">REPORT INFORMATION</span><h2 id="dialog-title">정보 신고</h2><p>잘못된 날짜·수치·직업 정보나 오래된 공략을 알려주세요.</p><form id="report-form"><label for="report-reason">신고 내용</label><select id="report-reason" name="reason"><option>날짜 또는 기간이 달라요</option><option>직업·스킬 정보가 달라요</option><option>패치 버전이 오래됐어요</option><option>출처 링크가 열리지 않아요</option><option>기타</option></select><label for="report-detail">자세한 내용</label><textarea id="report-detail" name="detail" rows="3" placeholder="확인한 내용을 적어주세요."></textarea><button class="primary-button dialog-primary" type="submit">신고 내용 확인</button></form><span class="dialog-note">프로토타입에서는 신고가 저장되지 않습니다.</span>`;
  }
  if (!dialog.open) dialog.showModal();
}

function rememberTutorialDismissal(dialog) {
  if (dialog?.dataset.kind !== "tutorial") return;
  const skip = Boolean(app.querySelector("#skip-tutorial")?.checked);
  writeStorage(skip ? "todaypatch.skipTutorial" : "todaypatch.tutorialDone", true);
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
    if (event.target.id === "app-dialog") {
      rememberTutorialDismissal(event.target);
      event.target.close();
    }
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
  if (action === "close-dialog") {
    const dialog = app.querySelector("#app-dialog");
    rememberTutorialDismissal(dialog);
    dialog.close();
  }
  if (action === "tutorial-next") {
    state.skipTutorial = Boolean(app.querySelector("#skip-tutorial")?.checked);
    if (state.skipTutorial) writeStorage("todaypatch.skipTutorial", true);
    if (state.tutorialStep < 2) {
      state.tutorialStep += 1;
      openDialog("tutorial");
    } else {
      writeStorage("todaypatch.tutorialDone", true);
      app.querySelector("#app-dialog").close();
    }
  }
});

app.addEventListener("cancel", (event) => rememberTutorialDismissal(event.target), true);

app.addEventListener("input", (event) => {
  if (event.target.id === "skip-tutorial") state.skipTutorial = event.target.checked;
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
  if (event.target.id === "game-search" && event.key === "Enter") {
    const query = state.gameQuery.trim().toLocaleLowerCase("ko-KR");
    const firstMatch = games.find((item) => item.aliases.toLocaleLowerCase("ko-KR").includes(query));
    if (firstMatch) window.location.hash = `#/${firstMatch.id}`;
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
window.setInterval(updateCountdown, 1000);
if (routeKind() === "home" && !readStorage("todaypatch.skipTutorial", false) && !readStorage("todaypatch.tutorialDone", false)) {
  openDialog("tutorial");
}
