(() => {
  const typeNames = { free: "자유게시판", info: "정보", guide: "공략", question: "질문", discussion: "토론" };
  const typeOrder = ["free", "info", "guide", "question", "discussion"];
  const reportReasons = [
    ["spam", "광고·도배"], ["abuse", "욕설·괴롭힘"], ["privacy", "개인정보 노출"],
    ["copyright", "저작권 침해"], ["other", "기타"],
  ];
  const suggestedKeywords = ["기간", "보상", "직업", "스킬", "쿠폰", "이벤트", "시즌", "장비", "업데이트", "일정", "레이드"];
  const state = {
    user: null, sessionLoaded: false, posts: [], post: null, reports: [], feedPosts: [], myPosts: [], notifications: [],
    gameId: "aion2", type: "", sort: "latest", query: "", loading: false, error: "",
    adminToken: "", editorPost: null, authMode: "login", replyToCommentId: null, replyToAuthor: "",
  };
  let context = null;
  let sequence = 0;
  let searchTimer = 0;
  let preferenceSyncTimer = 0;
  let preferenceRevision = 0;
  let preferenceSyncErrorShown = false;
  const preferenceAccountKey = "todaypatch.preferencesAccount";
  const preferenceDirtyKey = "todaypatch.preferencesDirty";

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function gameCatalog() {
    return context?.getGameCatalog?.() || [];
  }

  function gameName(gameId) {
    return gameCatalog().find((game) => game.id === gameId)?.name || gameId || "게임";
  }

  function noticeById(id) {
    return (context?.getNewsItems?.() || []).find((item) => item.id === id) || null;
  }

  async function api(url, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.admin && state.adminToken) headers.Authorization = `Bearer ${state.adminToken}`;
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    let payload = {};
    try { payload = await response.json(); } catch { /* non-JSON response */ }
    if (!response.ok) {
      const error = new Error(payload.error || `요청에 실패했습니다 (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showError(error) {
    const message = location.protocol === "file:" || error instanceof TypeError
      ? "커뮤니티 서버에 연결할 수 없습니다. node server.js를 실행하고 localhost 주소로 접속해 주세요."
      : error?.message || "커뮤니티 요청을 처리하지 못했습니다.";
    context?.showToast?.(message);
    state.error = message;
  }

  function saveLocalValue(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Browser storage remains optional. */ }
  }

  function getPreferenceSnapshot() {
    return context?.getPreferences?.() || {};
  }

  function mergePreferenceSnapshots(remote, local) {
    const unique = (left, right, limit) => [...new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])])].slice(0, limit);
    const remotePosts = Array.isArray(remote.userPosts) ? remote.userPosts : [];
    const localPosts = Array.isArray(local.userPosts) ? local.userPosts : [];
    const posts = new Map(remotePosts.map((post) => [post.id, post]));
    for (const post of localPosts) posts.set(post.id, post);
    return {
      followedGames: unique(local.followedGames, remote.followedGames, 50),
      bookmarks: unique(local.bookmarks, remote.bookmarks, 2000),
      readNews: unique(local.readNews, remote.readNews, 5000),
      tasks: { ...(remote.tasks || {}), ...(local.tasks || {}) },
      userPosts: [...posts.values()].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || ""))).slice(0, 100),
      recentSearches: unique(local.recentSearches, remote.recentSearches, 5),
      theme: local.theme === "dark" || local.theme === "light" ? local.theme : remote.theme,
      skipTutorial: typeof local.skipTutorial === "boolean" ? local.skipTutorial : remote.skipTutorial === true,
    };
  }

  function reportPreferenceSyncError() {
    if (preferenceSyncErrorShown) return;
    preferenceSyncErrorShown = true;
    context?.showToast?.("계정 동기화에 실패했어요. 변경 사항은 이 기기에 저장되어 있습니다.");
  }

  async function flushPreferences() {
    if (!state.user || !context?.getPreferences) return;
    const revision = preferenceRevision;
    try {
      await api("/api/community/preferences", { method: "PUT", body: { preferences: getPreferenceSnapshot() } });
      saveLocalValue(preferenceAccountKey, state.user.id);
      if (revision === preferenceRevision) saveLocalValue(preferenceDirtyKey, "false");
      preferenceSyncErrorShown = false;
      if (revision !== preferenceRevision) schedulePreferenceSync();
    } catch {
      reportPreferenceSyncError();
    }
  }

  function schedulePreferenceSync() {
    preferenceRevision += 1;
    saveLocalValue(preferenceDirtyKey, "true");
    if (!state.user) return;
    window.clearTimeout(preferenceSyncTimer);
    preferenceSyncTimer = window.setTimeout(() => void flushPreferences(), 500);
  }

  async function syncPreferencesForCurrentUser() {
    if (!state.user || !context?.getPreferences || !context?.applyPreferences) return;
    try {
      const { preferences: remote = {} } = await api("/api/community/preferences");
      let marker = "";
      let dirty = false;
      try {
        marker = localStorage.getItem(preferenceAccountKey) || "";
        dirty = localStorage.getItem(preferenceDirtyKey) === "true";
      } catch { /* The current account can still load its saved settings. */ }
      const local = getPreferenceSnapshot();
      const preferences = marker === state.user.id
        ? dirty ? local : remote
        : marker ? remote : mergePreferenceSnapshots(remote, local);
      context.applyPreferences(preferences);
      const syncedPreferences = getPreferenceSnapshot();
      const revision = preferenceRevision;
      await api("/api/community/preferences", { method: "PUT", body: { preferences: syncedPreferences } });
      saveLocalValue(preferenceAccountKey, state.user.id);
      if (revision === preferenceRevision) saveLocalValue(preferenceDirtyKey, "false");
      preferenceSyncErrorShown = false;
    } catch {
      reportPreferenceSyncError();
    }
  }

  function routeParams() {
    const raw = (context?.getRoute?.() || window.location.hash || "").split("?")[1] || "";
    return new URLSearchParams(raw);
  }

  function linkToPost(post) {
    return `#/community/post/${encodeURIComponent(post.id)}?gameId=${encodeURIComponent(post.gameId)}`;
  }

  function renderAccountControl() {
    if (state.user) {
      return `<span class="community-account" title="${state.user.email ? "로그인된 계정" : "기기 전용 게스트 계정"}">${escapeHTML(state.user.displayName)}</span>${state.user.email ? "" : `<button class="community-login-button" type="button" data-action="community-login" data-mode="register">계정 연결</button>`}<button class="community-logout-button" type="button" data-action="community-logout">로그아웃</button>`;
    }
    return `<button class="community-login-button" type="button" data-action="community-login">로그인</button>`;
  }

  function openAuthDialog(mode = "login") {
    state.authMode = mode === "register" ? "register" : "login";
    const dialog = document.querySelector("#app-dialog");
    const content = document.querySelector("#dialog-content");
    if (!dialog || !content) return;
    const registering = state.authMode === "register";
    content.innerHTML = `<button class="dialog-close" type="button" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">TODAYPATCH ACCOUNT</span><h2 id="dialog-title">${registering ? "계정 만들기" : "로그인"}</h2><p>${registering ? "계정을 만들면 커뮤니티 글과 댓글을 여러 기기에서 이어서 이용할 수 있습니다." : "가입한 이메일과 비밀번호로 로그인하세요."}</p><form id="community-auth-form" data-mode="${state.authMode}">${registering ? `<label for="community-auth-name">닉네임</label><input id="community-auth-name" name="displayName" type="text" minlength="2" maxlength="24" autocomplete="nickname" placeholder="게시판에 표시할 이름" required />` : ""}<label for="community-auth-email">이메일</label><input id="community-auth-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="name@example.com" required /><label for="community-auth-password">비밀번호</label><input id="community-auth-password" name="password" type="password" minlength="${registering ? 10 : 1}" maxlength="128" autocomplete="${registering ? "new-password" : "current-password"}" placeholder="${registering ? "10자 이상" : "비밀번호"}" required />${registering ? `<label for="community-auth-password-confirm">비밀번호 확인</label><input id="community-auth-password-confirm" name="passwordConfirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" placeholder="비밀번호를 한 번 더 입력" required /><small class="community-auth-note">이메일 인증과 비밀번호 찾기는 아직 제공하지 않습니다. 사용 가능한 이메일로 가입해 주세요.</small>` : ""}<button class="primary-button dialog-primary" type="submit">${registering ? "가입하고 로그인" : "로그인"}</button></form><button class="community-auth-switch" type="button" data-action="community-auth-mode" data-mode="${registering ? "login" : "register"}">${registering ? "이미 계정이 있나요? 로그인" : "처음이신가요? 계정 만들기"}</button>`;
    if (!dialog.open) dialog.showModal();
    content.querySelector(registering ? "#community-auth-name" : "#community-auth-email")?.focus();
  }

  function renderNotificationItems() {
    return state.notifications.slice(0, 30).map((item) => `<a class="notification-item ${item.read ? "read" : "unread"}" href="#/community/post/${encodeURIComponent(item.postId)}?gameId=${encodeURIComponent(item.gameId)}" data-action="community-notification-open" data-id="${escapeHTML(item.id)}"><span class="notification-dot" aria-hidden="true"></span><span class="notification-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(gameName(item.gameId))} · ${escapeHTML(item.actorName)} · ${escapeHTML(formatDate(item.createdAt))}</small>${item.body ? `<small>${escapeHTML(item.body)}</small>` : ""}</span></a>`).join("");
  }

  function unreadNotificationCount() {
    return state.notifications.filter((item) => !item.read).length;
  }

  async function markAllNotificationsRead() {
    const unread = state.notifications.filter((item) => !item.read);
    await Promise.all(unread.map((item) => api(`/api/community/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST", body: {} })));
    state.notifications = state.notifications.map((item) => ({ ...item, read: true }));
  }

  function renderTypeChip(type, selected) {
    const label = type ? typeNames[type] : "전체";
    return `<button class="community-chip ${selected ? "selected" : ""}" type="button" data-action="community-type" data-type="${type}" aria-pressed="${selected}">${label}</button>`;
  }

  function renderPostCard(post) {
    const typeName = typeNames[post.type] || "게시글";
    const excerpt = String(post.body || "").replace(/\s+/g, " ").slice(0, 150);
    return `<article class="community-post-card">
      <div class="community-post-meta"><span class="community-type-badge type-${escapeHTML(post.type)}">${escapeHTML(typeName)}</span><span>${escapeHTML(gameName(post.gameId))}</span><span>${escapeHTML(post.author?.displayName || "게스트")}</span><time>${escapeHTML(formatDate(post.createdAt))}</time></div>
      <a class="community-post-main" href="${escapeHTML(linkToPost(post))}"><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(excerpt)}</p></a>
      ${post.tags?.length ? `<div class="community-tags">${post.tags.map((tag) => `<span>#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
      <div class="community-post-stats"><span>♡ ${post.likesCount || 0}</span><span>댓글 ${post.commentCount || 0}</span>${post.official ? `<span class="community-linked-source">공식 공지 연결</span>` : ""}</div>
    </article>`;
  }

  function renderCommunityBoard() {
    const params = routeParams();
    const selectedGameId = params.get("gameId") || state.gameId || "aion2";
    const games = gameCatalog();
    const options = games.map((game) => `<option value="${escapeHTML(game.id)}" ${game.id === selectedGameId ? "selected" : ""}>${escapeHTML(game.name)}</option>`).join("");
    const postsContent = state.loading
      ? `<div class="community-empty"><strong>게시글을 불러오고 있어요.</strong></div>`
      : state.error
        ? `<div class="community-empty"><strong>커뮤니티 서버에 연결할 수 없습니다.</strong><p>${escapeHTML(state.error)}</p><p>프로젝트 폴더에서 <code>node server.js</code>를 실행하고 localhost 주소로 접속해 주세요.</p></div>`
        : state.posts.length
          ? `<div class="community-post-list">${state.posts.map(renderPostCard).join("")}</div>`
          : `<div class="community-empty"><strong>아직 게시글이 없습니다.</strong><p>첫 글을 작성해 대화를 시작해 보세요.</p></div>`;
    return `<main class="page-width game-page community-page">
      <section class="community-hero"><div><span class="page-eyebrow">GAME COMMUNITY</span><h1>게임 커뮤니티</h1><p>게임별 질문과 공략, 자유로운 토론을 나눠 보세요.</p></div><a class="primary-button" href="#/community/new?gameId=${encodeURIComponent(selectedGameId)}">글 작성하기</a></section>
      <section class="community-board" aria-label="커뮤니티 게시글">
        <div class="community-toolbar"><label>게임<select id="community-game">${options || `<option value="aion2">아이온2</option>`}</select></label><label>정렬<select id="community-sort"><option value="latest" ${state.sort === "latest" ? "selected" : ""}>최신순</option><option value="popular" ${state.sort === "popular" ? "selected" : ""}>인기순</option></select></label>
          <label class="community-search"><span>키워드 검색</span><input id="community-search" type="search" value="${escapeHTML(state.query)}" placeholder="제목, 본문, 태그 검색" /></label></div>
        <div class="community-filter-row" aria-label="글 종류">${renderTypeChip("", !state.type)}${typeOrder.map((type) => renderTypeChip(type, state.type === type)).join("")}</div>
        <div class="community-list-heading"><h2>${escapeHTML(gameName(selectedGameId))} 게시글</h2><a href="#/community/moderation" data-action="community-moderation-open">운영자 검토</a></div>
        ${postsContent}
      </section>
    </main>`;
  }

  function renderOfficialContext(official) {
    if (!official) return "";
    const item = noticeById(official.newsId);
    const refs = Array.isArray(official.analysisRefs) ? official.analysisRefs : [];
    const sections = Array.isArray(item?.sections) ? item.sections : [];
    const linkedSections = refs.map((ref) => {
      if (ref === "summary") return item?.summary ? `<section><h4>전체 요약</h4><p>${escapeHTML(item.summary)}</p></section>` : "";
      if (ref === "analysis") return item?.analysis ? `<section><h4>분석</h4><p>${escapeHTML(item.analysis)}</p></section>` : "";
      const index = Number(ref.replace(/^section-/, ""));
      const section = Number.isInteger(index) ? sections[index] : null;
      return section ? `<section><h4>${escapeHTML(section.heading)}</h4><p>${escapeHTML(section.summary)}</p>${section.importantDetails?.length ? `<ul>${section.importantDetails.map((detail) => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>` : ""}</section>` : "";
    }).filter(Boolean).join("");
    return `<section class="community-official"><span class="page-eyebrow">OFFICIAL NOTICE</span><h2>연결된 공식 원문</h2><a href="${escapeHTML(official.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(official.title || item?.title || "공식 공지 원문 열기")} ↗</a>${linkedSections ? `<div class="community-analysis">${linkedSections}</div>` : item?.summary ? `<p>${escapeHTML(item.summary)}</p>` : ""}<a class="secondary-button" href="${escapeHTML(official.url)}" target="_blank" rel="noopener noreferrer">공식 원문으로 돌아가기</a></section>`;
  }

  function renderComments(comments = [], postId = "") {
    if (!comments.length) return `<div class="community-empty community-comment-empty"><p>첫 댓글을 남겨 보세요.</p></div>`;
    const roots = [];
    const repliesByParent = new Map();
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    for (const comment of comments) {
      if (comment.parentId && byId.has(comment.parentId)) {
        const list = repliesByParent.get(comment.parentId) || [];
        list.push(comment);
        repliesByParent.set(comment.parentId, list);
      } else {
        roots.push(comment);
      }
    }

    const renderReplyForm = (rootId) => {
      if (!state.user || state.replyToCommentId !== rootId) return "";
      const mention = state.replyToAuthor ? `@${state.replyToAuthor} ` : "";
      return `<form class="community-reply-form" data-role="community-reply-form" data-post-id="${escapeHTML(postId)}" data-parent-id="${escapeHTML(rootId)}">
        <div class="community-reply-form-head"><span>↳ ${escapeHTML(state.replyToAuthor || "댓글")}님에게 답글 작성</span><button type="button" data-action="community-reply-cancel">취소</button></div>
        <div class="community-reply-form-row">
          <label class="visually-hidden" for="community-reply-body-${escapeHTML(rootId)}">답글</label>
          <textarea id="community-reply-body-${escapeHTML(rootId)}" name="body" rows="2" maxlength="1000" placeholder="답글을 입력하세요" required>${escapeHTML(mention)}</textarea>
          <button class="primary-button" type="submit">답글 등록</button>
        </div>
      </form>`;
    };

    const renderReplyItem = (reply, rootId) => `
      <article class="community-comment community-reply-item">
        <span class="community-reply-arrow" aria-hidden="true">↳</span>
        <div class="community-reply-content">
          <div class="community-comment-meta">
            <strong>${escapeHTML(reply.author?.displayName || "게스트")}</strong>
            <time>${escapeHTML(formatDate(reply.createdAt))}</time>
            <div class="community-comment-actions">
              ${state.user ? `<button type="button" data-action="community-reply-open" data-id="${escapeHTML(rootId)}" data-author="${escapeHTML(reply.author?.displayName || "게스트")}">답글</button>` : ""}
              ${reply.mine ? `<button type="button" data-action="community-comment-delete" data-id="${escapeHTML(reply.id)}">삭제</button>` : ""}
            </div>
          </div>
          <p>${escapeHTML(reply.body)}</p>
        </div>
      </article>`;

    return `<div class="community-comment-list">${roots.map((comment) => {
      const replies = repliesByParent.get(comment.id) || [];
      return `<div class="community-comment-thread">
        <article class="community-comment ${comment.deleted ? "is-deleted" : ""}">
          <div class="community-comment-meta">
            <strong>${escapeHTML(comment.author?.displayName || "게스트")}</strong>
            <time>${escapeHTML(formatDate(comment.createdAt))}</time>
            <div class="community-comment-actions">
              ${!comment.deleted && state.user ? `<button type="button" data-action="community-reply-open" data-id="${escapeHTML(comment.id)}" data-author="${escapeHTML(comment.author?.displayName || "게스트")}">답글${replies.length ? ` ${replies.length}` : ""}</button>` : ""}
              ${comment.mine ? `<button type="button" data-action="community-comment-delete" data-id="${escapeHTML(comment.id)}">삭제</button>` : ""}
            </div>
          </div>
          <p>${escapeHTML(comment.body)}</p>
        </article>
        ${replies.length ? `<div class="community-replies">${replies.map((reply) => renderReplyItem(reply, comment.id)).join("")}</div>` : ""}
        ${renderReplyForm(comment.id)}
      </div>`;
    }).join("")}</div>`;
  }

  function renderCommunityDetail() {
    const post = state.post;
    if (state.loading) return `<main class="page-width game-page community-page"><div class="community-empty"><strong>게시글을 불러오고 있어요.</strong></div></main>`;
    if (state.error || !post) return `<main class="page-width game-page community-page"><div class="community-empty"><strong>${escapeHTML(state.error || "게시글을 찾을 수 없습니다.")}</strong><a href="#/community?gameId=${encodeURIComponent(state.gameId)}">게시판으로 돌아가기</a></div></main>`;
    const official = renderOfficialContext(post.official);
    return `<main class="page-width game-page community-page community-detail-page"><a class="back-link" href="#/community?gameId=${encodeURIComponent(post.gameId)}">← ${escapeHTML(gameName(post.gameId))} 게시판</a>
      <div class="community-detail-layout"><article class="community-detail-main"><div class="community-detail-title"><div class="community-post-meta"><span class="community-type-badge type-${escapeHTML(post.type)}">${escapeHTML(typeNames[post.type] || "게시글")}</span><span>${escapeHTML(gameName(post.gameId))}</span></div><h1>${escapeHTML(post.title)}</h1><div class="community-post-meta"><span>${escapeHTML(post.author?.displayName || "게스트")}</span><time>${escapeHTML(formatDate(post.updatedAt || post.createdAt))}${post.updatedAt ? " · 수정됨" : ""}</time></div></div>
        <div class="community-detail-body">${escapeHTML(post.body)}</div>${post.tags?.length ? `<div class="community-tags">${post.tags.map((tag) => `<span>#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
        <div class="community-detail-actions"><button class="secondary-button ${post.liked ? "is-liked" : ""}" type="button" data-action="community-like" data-id="${escapeHTML(post.id)}">${post.liked ? "♥ 좋아요" : "♡ 좋아요"} ${post.likesCount || 0}</button><button class="secondary-button" type="button" data-action="community-report" data-id="${escapeHTML(post.id)}">신고</button>${post.mine ? `<a class="secondary-button" href="#/community/new?gameId=${encodeURIComponent(post.gameId)}&edit=${encodeURIComponent(post.id)}">수정</a><button class="secondary-button" type="button" data-action="community-delete" data-id="${escapeHTML(post.id)}">삭제</button>` : ""}</div>
        <section class="community-comments"><div class="community-list-heading"><h2>댓글 <span>${post.commentCount || 0}</span></h2></div>${state.user ? `<form id="community-comment-form" data-post-id="${escapeHTML(post.id)}" class="community-comment-form"><label class="visually-hidden" for="community-comment-body">댓글</label><textarea id="community-comment-body" name="body" rows="3" maxlength="1000" placeholder="댓글을 입력하세요" required></textarea><button class="primary-button" type="submit">댓글 등록</button></form>` : `<div class="community-login-note"><p>댓글을 쓰려면 로그인하세요.</p><button class="primary-button" data-action="community-login">로그인</button></div>`}${renderComments(post.comments || [], post.id)}</section>
      </article><aside class="community-detail-side">${official || `<section class="community-official community-no-source"><span class="page-eyebrow">COMMUNITY</span><h2>자유로운 이야기</h2><p>공식 공지에 연결된 게시글은 원문 링크와 선택한 분석 항목을 함께 표시합니다.</p></section>`}</aside></div>
    </main>`;
  }

  function getEditorContext() {
    const params = routeParams();
    const editId = params.get("edit");
    const newsId = params.get("newsId");
    const post = editId ? state.editorPost : null;
    const official = post?.official || (newsId ? (() => {
      const item = noticeById(newsId);
      return item ? { newsId: item.id, title: item.title, url: item.url, analysisRefs: [] } : null;
    })() : null);
    const newsItem = official ? noticeById(official.newsId) : null;
    return { params, editId, post, official, newsItem };
  }

  function noticeTagSuggestions(item) {
    if (!item) return [];
    const text = [item.title, item.summary, item.analysis, ...(item.keyPoints || []), ...(item.sections || []).map((section) => section.heading)].join(" ");
    return suggestedKeywords.filter((keyword) => text.includes(keyword));
  }

  function renderEditor() {
    const { params, editId, post, official, newsItem } = getEditorContext();
    if (!state.user) return `<main class="page-width game-page community-page"><section class="community-login-card"><span class="page-eyebrow">TODAYPATCH ACCOUNT</span><h1>로그인 후 글을 작성할 수 있어요</h1><p>계정을 만들면 게시글·댓글·알림을 이 기기와 다른 기기에서 이어서 이용할 수 있습니다.</p><button class="primary-button" type="button" data-action="community-login" data-mode="register">계정 만들기</button><button class="secondary-button" type="button" data-action="community-login">이미 계정이 있어요</button></section></main>`;
    if (editId && !post && state.loading) return `<main class="page-width game-page community-page"><div class="community-empty"><strong>게시글을 불러오고 있어요.</strong></div></main>`;
    if (editId && !post && state.error) return `<main class="page-width game-page community-page"><div class="community-empty"><strong>${escapeHTML(state.error)}</strong><a href="#/community">게시판으로 돌아가기</a></div></main>`;
    const gameId = post?.gameId || params.get("gameId") || state.gameId || "aion2";
    const type = post?.type || params.get("type") || "free";
    const tagSuggestions = noticeTagSuggestions(newsItem);
    const existingTags = (post?.tags || []).join(", ");
    const analysisOptions = newsItem ? [
      ...(newsItem.summary ? [["summary", "전체 요약"]] : []),
      ...(newsItem.analysis ? [["analysis", "이용자 분석"]] : []),
      ...(newsItem.sections || []).map((section, index) => [`section-${index}`, section.heading]),
    ] : [];
    return `<main class="page-width game-page community-page"><a class="back-link" href="#/community?gameId=${encodeURIComponent(gameId)}">← 게시판</a><section class="community-editor"><div class="page-heading"><div><span class="page-eyebrow">${editId ? "EDIT POST" : "NEW POST"}</span><h1>${editId ? "게시글 수정" : "새 게시글"}</h1><p>공개 글은 게시 버튼을 눌렀을 때 게시판에 공개됩니다.</p></div></div>
      <form id="community-editor-form" data-edit-id="${escapeHTML(editId || "")}" data-game-id="${escapeHTML(gameId)}" data-news-id="${escapeHTML(official?.newsId || "")}">
        <div class="community-form-grid"><label>게임<select name="gameId" required>${gameCatalog().map((game) => `<option value="${escapeHTML(game.id)}" ${game.id === gameId ? "selected" : ""}>${escapeHTML(game.name)}</option>`).join("") || `<option value="aion2">아이온2</option>`}</select></label><label>글 종류<select name="type" required>${typeOrder.map((key) => `<option value="${key}" ${type === key ? "selected" : ""}>${typeNames[key]}</option>`).join("")}</select></label></div>
        <label for="community-title">제목</label><input id="community-title" name="title" type="text" maxlength="100" value="${escapeHTML(post?.title || "")}" placeholder="제목을 입력하세요" required />
        <label for="community-body">본문</label><textarea id="community-body" name="body" rows="12" maxlength="5000" placeholder="게임 이야기를 나눠 보세요" required>${escapeHTML(post?.body || "")}</textarea>
        <label for="community-tags-input">태그</label><input id="community-tags-input" name="tags" type="text" maxlength="200" value="${escapeHTML(existingTags)}" placeholder="쉼표로 구분해 입력 (예: 초보, 던전)" />
        ${tagSuggestions.length ? `<fieldset class="community-suggestions"><legend>공지에서 찾은 태그 후보 · 필요한 항목만 선택</legend><div>${tagSuggestions.map((tag) => `<label><input type="checkbox" name="suggestedTags" value="${escapeHTML(tag)}" ${post?.tags?.includes(tag) ? "checked" : ""} /><span>#${escapeHTML(tag)}</span></label>`).join("")}</div></fieldset>` : ""}
        ${official ? `<section class="community-linked-notice"><span class="page-eyebrow">LINKED OFFICIAL NOTICE</span><strong>${escapeHTML(official.title || newsItem?.title || "공식 공지")}</strong><a href="${escapeHTML(official.url)}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a>${analysisOptions.length ? `<fieldset class="community-suggestions"><legend>함께 표시할 분석 항목을 선택하세요</legend><div>${analysisOptions.map(([ref, label]) => `<label><input type="checkbox" name="analysisRefs" value="${escapeHTML(ref)}" ${official.analysisRefs?.includes(ref) ? "checked" : ""} /><span>${escapeHTML(label)}</span></label>`).join("")}</div></fieldset>` : ""}</section>` : `<p class="community-form-note">이미지 첨부와 실시간 채팅은 첫 버전에서 제공하지 않습니다.</p>`}
        <div class="community-form-actions"><span>게시글은 서버에 저장되며 모든 방문자에게 공개됩니다.</span><a class="secondary-button" href="#/community?gameId=${encodeURIComponent(gameId)}">취소</a><button class="primary-button" type="submit">${editId ? "수정 저장" : "게시하기"}</button></div>
      </form></section></main>`;
  }

  function renderModeration() {
    if (!state.adminToken) return `<main class="page-width game-page community-page"><section class="community-login-card"><span class="page-eyebrow">MODERATION</span><h1>운영자 검토</h1><p>서버의 <code>TODAYPATCH_ADMIN_TOKEN</code>과 일치하는 운영자 토큰이 필요합니다.</p><button class="primary-button" type="button" data-action="community-admin-login">운영자 토큰 입력</button><a class="back-link" href="#/community">게시판으로 돌아가기</a></section></main>`;
    const content = state.loading
      ? `<div class="community-empty"><strong>신고 목록을 불러오고 있어요.</strong></div>`
      : state.error
        ? `<div class="community-empty"><strong>${escapeHTML(state.error)}</strong><button class="secondary-button" data-action="community-admin-login">토큰 다시 입력</button></div>`
        : state.reports.length
          ? `<div class="community-report-list">${state.reports.map((report) => `<article class="community-report-card"><div class="community-post-meta"><span>${escapeHTML(report.post?.title || "삭제되었거나 숨긴 게시글")}</span><time>${escapeHTML(formatDate(report.createdAt))}</time><span>${report.reviewedAt ? "검토 완료" : "검토 대기"}</span></div>${report.post ? `<div class="community-moderation-post"><strong>${escapeHTML(report.post.title)}</strong><p>${escapeHTML(report.post.body)}</p><small>${escapeHTML(gameName(report.post.gameId))} · ${escapeHTML(report.post.author?.displayName || "게스트")}${report.post.hidden ? " · 숨김 처리 중" : ""}</small></div>` : ""}<p><strong>${escapeHTML(reportReasons.find(([key]) => key === report.reason)?.[1] || "기타")}</strong> · ${escapeHTML(report.detail || "상세 사유 없음")}</p>${!report.reviewedAt ? `<div class="community-detail-actions"><button class="secondary-button" data-action="community-review" data-id="${escapeHTML(report.id)}" data-decision="keep">게시 유지</button><button class="secondary-button" data-action="community-review" data-id="${escapeHTML(report.id)}" data-decision="hide">게시글 숨김</button></div>` : report.decision === "hide" ? `<button class="secondary-button" data-action="community-review" data-id="${escapeHTML(report.id)}" data-decision="restore">게시글 다시 공개</button>` : ""}</article>`).join("")}</div>`
          : `<div class="community-empty"><strong>접수된 신고가 없습니다.</strong></div>`;
    return `<main class="page-width game-page community-page"><div class="community-hero"><div><span class="page-eyebrow">MODERATION QUEUE</span><h1>신고 검토</h1><p>신고 내용을 확인한 뒤 운영자가 게시글 공개 상태를 결정합니다.</p></div><button class="secondary-button" data-action="community-admin-refresh">새로고침</button></div><section class="community-board">${content}</section></main>`;
  }

  function renderPage(kind) {
    if (kind === "community-detail") return renderCommunityDetail();
    if (kind === "community-new") return renderEditor();
    if (kind === "community-moderation") return renderModeration();
    return renderCommunityBoard();
  }

  function renderPreview(gameIds, limit = 4) {
    const allowed = new Set(gameIds || []);
    const posts = state.feedPosts.filter((post) => !allowed.size || allowed.has(post.gameId)).slice(0, limit);
    if (!posts.length) {
      return `<div class="community-preview-empty">${state.feedPosts.length ? "팔로우한 게임의 커뮤니티 글이 아직 없습니다." : "커뮤니티 서버에 연결하면 최신 게시글을 볼 수 있습니다."}</div>`;
    }
    return `<div class="community-preview-list">${posts.map((post) => `<a class="community-preview-item" href="${escapeHTML(linkToPost(post))}"><span class="community-type-badge type-${escapeHTML(post.type)}">${escapeHTML(typeNames[post.type] || "게시글")}</span><span class="community-preview-title">${escapeHTML(post.title)}</span><small>${escapeHTML(gameName(post.gameId))} · ${escapeHTML(post.author?.displayName || "게스트")}</small></a>`).join("")}</div>`;
  }

  function renderHomePreview({ gameIds = [], tab = "popular", limit = 6, writeGameId = "aion2", showGameName = false } = {}) {
    const allowed = new Set((gameIds || []).filter(Boolean));
    let posts = state.feedPosts.filter((post) => allowed.size && allowed.has(post.gameId));
    if (tab === "popular") {
      posts = [...posts].sort((left, right) => ((right.likesCount || 0) * 2 + (right.commentCount || 0) * 3) - ((left.likesCount || 0) * 2 + (left.commentCount || 0) * 3)
        || String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
    } else {
      posts = [...posts].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
    }
    const visible = posts.slice(0, limit);
    if (!visible.length) {
      return `<div class="home-hub-empty"><strong>아직 커뮤니티 글이 없어요.</strong><p>팔로우한 게임의 질문, 공략, 패치 후기를 가장 먼저 남겨 보세요.</p><a class="primary-button" href="#/community/new?gameId=${encodeURIComponent(writeGameId)}">첫 글 작성하기</a></div>`;
    }
    return `<div class="home-feed-grid">${visible.map((post) => {
      const likes = post.likesCount || 0;
      const comments = post.commentCount || 0;
      const excerpt = String(post.body || "").replace(/\s+/g, " ").trim().slice(0, 90);
      const metaPrefix = showGameName ? `${gameName(post.gameId)} · ` : "";
      return `<a class="home-feed-card" href="${escapeHTML(linkToPost(post))}">
        <div class="home-feed-card-top">
          <span class="community-type-badge type-${escapeHTML(post.type)}">${escapeHTML(typeNames[post.type] || "게시글")}</span>
          ${post.official ? `<span class="home-feed-linked">공지 연결</span>` : ""}
          <time>${escapeHTML(formatDate(post.createdAt))}</time>
        </div>
        <strong class="home-feed-card-title">${escapeHTML(post.title)}</strong>
        ${excerpt ? `<p class="home-feed-card-excerpt">${escapeHTML(excerpt)}</p>` : ""}
        <div class="home-feed-card-foot">
          <span>${escapeHTML(`${metaPrefix}${post.author?.displayName || "게스트"}`)}</span>
          <span class="home-community-stats"><span>♡ ${likes}</span><span>댓글 ${comments}</span></span>
        </div>
      </a>`;
    }).join("")}</div>`;
  }

  function homeFeedCount(gameIds = []) {
    const allowed = new Set((gameIds || []).filter(Boolean));
    return state.feedPosts.filter((post) => allowed.size && allowed.has(post.gameId)).length;
  }

  function getPopularPosts({ gameIds = [], type = "", limit = 6 } = {}) {
    const allowed = new Set((gameIds || []).filter(Boolean));
    return state.feedPosts
      .filter((post) => (!allowed.size || allowed.has(post.gameId)) && (!type || post.type === type))
      .sort((left, right) => ((right.likesCount || 0) * 2 + (right.commentCount || 0) * 3) - ((left.likesCount || 0) * 2 + (left.commentCount || 0) * 3)
        || String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
      .slice(0, limit);
  }

  function getMyPosts() {
    if (!state.user) return [];
    if (state.myPosts.length) return state.myPosts;
    return state.feedPosts.filter((post) => post.mine || post.author?.id === state.user.id);
  }

  function getMyPostsStats() {
    const posts = getMyPosts();
    return {
      count: posts.length,
      totalLikes: posts.reduce((sum, post) => sum + (post.likesCount || 0), 0),
      totalComments: posts.reduce((sum, post) => sum + (post.commentCount || 0), 0),
    };
  }

  function renderMyPostsDashboard(defaultGameId = "aion2") {
    if (!state.user) {
      return `<div class="dashboard-empty">
        <p>로그인하면 내가 커뮤니티에 작성한 공개 게시글을 한눈에 관리할 수 있어요.</p>
        <button class="primary-button" type="button" data-action="community-login">로그인하고 내 글 보기</button>
      </div>`;
    }
    const posts = getMyPosts();
    if (!posts.length) {
      return `<div class="dashboard-empty">
        <p>아직 커뮤니티에 작성한 게시글이 없습니다.</p>
        <a class="primary-button" href="#/community/new?gameId=${encodeURIComponent(defaultGameId)}">첫 게시글 작성하기 →</a>
      </div>`;
    }
    return `<div class="dashboard-my-posts-grid">${posts.map((post) => {
      const excerpt = String(post.body || "").replace(/\s+/g, " ").trim().slice(0, 110);
      return `<article class="dashboard-my-post-card">
        <div class="dashboard-my-post-top">
          <span class="dashboard-game-chip">${escapeHTML(gameName(post.gameId))}</span>
          <span class="community-type-badge type-${escapeHTML(post.type)}">${escapeHTML(typeNames[post.type] || "게시글")}</span>
          ${post.official ? `<span class="home-feed-linked">공지 연결</span>` : ""}
          <time>${escapeHTML(formatDate(post.updatedAt || post.createdAt))}</time>
        </div>
        <a class="dashboard-my-post-body" href="${escapeHTML(linkToPost(post))}">
          <strong>${escapeHTML(post.title)}</strong>
          ${excerpt ? `<p>${escapeHTML(excerpt)}</p>` : ""}
        </a>
        <div class="dashboard-my-post-foot">
          <span class="home-community-stats"><span>♡ ${post.likesCount || 0}</span><span>댓글 ${post.commentCount || 0}</span></span>
          <div class="dashboard-my-post-actions">
            <a href="${escapeHTML(linkToPost(post))}">보기</a>
            <a href="#/community/new?gameId=${encodeURIComponent(post.gameId)}&edit=${encodeURIComponent(post.id)}">수정</a>
          </div>
        </div>
      </article>`;
    }).join("")}</div>`;
  }

  async function loadMyPosts() {
    if (!state.user) {
      state.myPosts = [];
      return;
    }
    try {
      const result = await api("/api/community/posts?mine=1&sort=latest");
      state.myPosts = result.posts || [];
    } catch {
      state.myPosts = [];
    }
  }

  async function loadSession() {
    try {
      const result = await api("/api/community/session");
      if (!state.user) state.user = result.user;
      state.sessionLoaded = true;
    } catch {
      state.sessionLoaded = true;
    }
  }

  async function loadFeed() {
    try {
      const result = await api("/api/community/posts?sort=latest");
      state.feedPosts = result.posts || [];
    } catch {
      state.feedPosts = [];
    }
  }

  async function loadNotifications() {
    if (!state.user) {
      state.notifications = [];
      return;
    }
    try {
      const result = await api("/api/community/notifications");
      state.notifications = result.notifications || [];
    } catch {
      state.notifications = [];
    }
  }

  async function loadRoute() {
    if (!context || !context.isCommunityRoute?.()) return;
    const requestId = ++sequence;
    const kind = context.getKind();
    const params = routeParams();
    state.gameId = params.get("gameId") || state.gameId || "aion2";
    state.loading = true;
    state.error = "";
    if (kind === "community") {
      state.type = params.get("type") || "";
      state.sort = params.get("sort") === "popular" ? "popular" : "latest";
      state.query = params.get("q") || "";
      context.render();
      const query = new URLSearchParams({ gameId: state.gameId, sort: state.sort });
      if (state.type) query.set("type", state.type);
      if (state.query) query.set("q", state.query);
      try {
        const result = await api(`/api/community/posts?${query}`);
        if (requestId !== sequence) return;
        state.posts = result.posts || [];
      } catch (error) {
        if (requestId !== sequence) return;
        state.error = location.protocol === "file:" ? "게시글은 서버를 통해 저장됩니다. node server.js를 실행하고 http://localhost:4173로 접속해 주세요." : error.message;
      }
    } else if (kind === "community-detail") {
      const postId = context.getRouteParts()[2];
      if (state.post?.id !== postId) {
        state.replyToCommentId = null;
        state.replyToAuthor = "";
      }
      try {
        const result = await api(`/api/community/posts/${encodeURIComponent(postId)}`);
        if (requestId !== sequence) return;
        state.post = result.post;
        state.gameId = result.post.gameId;
      } catch (error) {
        if (requestId !== sequence) return;
        state.post = null;
        state.error = error.message;
      }
    } else if (kind === "community-new") {
      const editId = params.get("edit");
      state.editorPost = null;
      if (editId) {
        try {
          const result = await api(`/api/community/posts/${encodeURIComponent(editId)}`);
          if (requestId !== sequence) return;
          if (!result.post.mine) throw new Error("작성자만 글을 수정할 수 있습니다.");
          state.editorPost = result.post;
        } catch (error) {
          if (requestId !== sequence) return;
          state.error = error.message;
        }
      }
    } else if (kind === "community-moderation") {
      if (state.adminToken) {
        try {
          const result = await api("/api/community/admin/reports", { admin: true });
          if (requestId !== sequence) return;
          state.reports = result.reports || [];
        } catch (error) {
          if (requestId !== sequence) return;
          state.error = error.message;
        }
      }
    }
    if (requestId !== sequence) return;
    state.loading = false;
    context.render();
  }

  function init(options) {
    context = options;
  }

  async function bootstrap() {
    await Promise.all([loadSession(), loadFeed()]);
    await syncPreferencesForCurrentUser();
    await Promise.all([loadNotifications(), loadMyPosts()]);
    if (context?.isCommunityRoute?.()) await loadRoute();
    else context?.render();
  }

  function isAction(action) {
    return action.startsWith("community-");
  }

  async function handleAction(action, button) {
    const id = button.dataset.id;
    try {
      if (action === "community-login") {
        openAuthDialog(button.dataset.mode || "login");
      } else if (action === "community-auth-mode") {
        openAuthDialog(button.dataset.mode);
      } else if (action === "community-logout") {
        window.clearTimeout(preferenceSyncTimer);
        await flushPreferences();
        await api("/api/community/logout", { method: "POST", body: {} });
        state.user = null;
        state.notifications = [];
        state.myPosts = [];
        state.replyToCommentId = null;
        state.replyToAuthor = "";
        context.render();
        if (context.isCommunityRoute?.()) await loadRoute();
        context.showToast?.("로그아웃했습니다.");
      } else if (action === "community-reply-open") {
        if (!state.user) {
          context.showToast?.("답글을 작성하려면 로그인해 주세요.");
          return;
        }
        state.replyToCommentId = id || null;
        state.replyToAuthor = button.dataset.author || "";
        context.render();
        window.requestAnimationFrame(() => {
          const textarea = document.querySelector(`#community-reply-body-${CSS.escape(id || "")}`);
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          }
        });
      } else if (action === "community-reply-cancel") {
        state.replyToCommentId = null;
        state.replyToAuthor = "";
        context.render();
      } else if (action === "community-type") {
        state.type = button.dataset.type || "";
        updateRouteFilters();
      } else if (action === "community-moderation-open") {
        if (!state.adminToken) {
          const token = window.prompt("TODAYPATCH_ADMIN_TOKEN 값을 입력하세요. 입력한 값은 현재 탭에서만 사용됩니다.");
          if (!token) return;
          state.adminToken = token;
        }
        window.location.hash = "#/community/moderation";
      } else if (action === "community-admin-login") {
        const token = window.prompt("서버의 TODAYPATCH_ADMIN_TOKEN 값을 입력하세요. 입력한 값은 현재 탭에서만 사용됩니다.");
        if (!token) return;
        state.adminToken = token;
        state.error = "";
        await loadRoute();
      } else if (action === "community-admin-refresh") {
        await loadRoute();
      } else if (action === "community-notification-open") {
        await api(`/api/community/notifications/${encodeURIComponent(id)}/read`, { method: "POST", body: {} });
        state.notifications = state.notifications.map((item) => item.id === id ? { ...item, read: true } : item);
        context.render();
        const href = button.getAttribute("href");
        if (href) window.location.hash = href.slice(1);
      } else if (action === "community-notifications-read-all") {
        await markAllNotificationsRead();
        context.render();
      } else if (action === "community-review") {
        await api(`/api/community/admin/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: { decision: button.dataset.decision }, admin: true });
        context.showToast?.("신고 검토 내용을 저장했습니다.");
        await loadRoute();
      } else if (action === "community-like") {
        if (!state.user) {
          context.showToast?.("좋아요를 누르려면 로그인해 주세요.");
          return;
        }
        await api(`/api/community/posts/${encodeURIComponent(id)}/like`, { method: "POST", body: {} });
        await loadNotifications();
        await loadRoute();
      } else if (action === "community-delete") {
        if (!window.confirm("이 게시글을 삭제할까요?")) return;
        await api(`/api/community/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.feedPosts = state.feedPosts.filter((item) => item.id !== id);
        state.myPosts = state.myPosts.filter((item) => item.id !== id);
        context.showToast?.("게시글을 삭제했습니다.");
        window.location.hash = `#/community?gameId=${encodeURIComponent(state.post?.gameId || state.gameId)}`;
      } else if (action === "community-comment-delete") {
        if (!window.confirm("이 댓글을 삭제할까요?")) return;
        await api(`/api/community/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadRoute();
      } else if (action === "community-report") {
        if (!state.user) {
          context.showToast?.("신고하려면 로그인해 주세요.");
          return;
        }
        const dialog = document.querySelector("#app-dialog");
        const content = document.querySelector("#dialog-content");
        if (!dialog || !content) return;
        content.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="닫기">×</button><span class="page-eyebrow">REPORT POST</span><h2 id="dialog-title">게시글 신고</h2><form id="community-report-form" data-post-id="${escapeHTML(id)}"><label for="community-report-reason">신고 사유</label><select id="community-report-reason" name="reason">${reportReasons.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><label for="community-report-detail">상세 내용</label><textarea id="community-report-detail" name="detail" rows="3" maxlength="1000" placeholder="확인한 내용을 적어주세요"></textarea><button class="primary-button dialog-primary" type="submit">신고 접수</button></form><span class="dialog-note">신고 내용은 운영자 검토 화면에 전달됩니다.</span>`;
        dialog.showModal();
      }
    } catch (error) {
      showError(error);
      if (context.isCommunityRoute?.()) await loadRoute();
    }
  }

  function updateRouteFilters() {
    const params = new URLSearchParams({ gameId: state.gameId, sort: state.sort });
    if (state.type) params.set("type", state.type);
    if (state.query) params.set("q", state.query);
    window.location.hash = `#/community?${params}`;
  }

  function handleInput(target) {
    if (target.id === "community-search") {
      state.query = target.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(updateRouteFilters, 250);
    }
  }

  function handleChange(target) {
    if (target.id === "community-game") {
      state.gameId = target.value || "aion2";
      updateRouteFilters();
    }
    if (target.id === "community-sort") {
      state.sort = target.value === "popular" ? "popular" : "latest";
      updateRouteFilters();
    }
  }

  function ownsForm(form) {
    return ["community-auth-form", "community-editor-form", "community-comment-form", "community-report-form"].includes(form.id)
      || form.dataset?.role === "community-reply-form";
  }

  async function handleSubmit(form) {
    const data = new FormData(form);
    try {
      if (form.id === "community-auth-form") {
        const mode = form.dataset.mode === "register" ? "register" : "login";
        const password = String(data.get("password") || "");
        const body = { email: String(data.get("email") || "").trim(), password };
        if (mode === "register") {
          if (password !== String(data.get("passwordConfirm") || "")) {
            context.showToast?.("비밀번호 확인이 일치하지 않습니다.");
            return;
          }
          body.displayName = String(data.get("displayName") || "").trim();
        }
        const result = await api(`/api/community/${mode}`, { method: "POST", body });
        state.user = result.user;
        state.error = "";
        document.querySelector("#app-dialog")?.close();
        await syncPreferencesForCurrentUser();
        await Promise.all([loadNotifications(), loadMyPosts()]);
        context.render();
        context.showToast?.(mode === "register" ? "계정을 만들고 로그인했습니다." : "로그인했습니다.");
        if (context.isCommunityRoute?.()) await loadRoute();
      } else if (form.id === "community-editor-form") {
        if (!state.user) {
          context.showToast?.("로그인 후 게시할 수 있습니다.");
          return;
        }
        const tags = String(data.get("tags") || "").split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
        const suggested = data.getAll("suggestedTags").map(String);
        const officialId = form.dataset.newsId;
        const item = officialId ? noticeById(officialId) : null;
        const currentOfficial = state.editorPost?.official;
        const official = item ? {
          newsId: item.id,
          title: item.title,
          url: item.url,
          analysisRefs: data.getAll("analysisRefs").map(String),
        } : currentOfficial ? { ...currentOfficial, analysisRefs: data.getAll("analysisRefs").map(String) } : null;
        const payload = {
          gameId: String(data.get("gameId") || ""),
          type: String(data.get("type") || ""),
          title: String(data.get("title") || "").trim(),
          body: String(data.get("body") || "").trim(),
          tags: [...new Set([...tags, ...suggested])],
          official,
        };
        const editId = form.dataset.editId;
        const result = await api(editId ? `/api/community/posts/${encodeURIComponent(editId)}` : "/api/community/posts", {
          method: editId ? "PUT" : "POST", body: payload,
        });
        state.feedPosts = [result.post, ...state.feedPosts.filter((item) => item.id !== result.post.id)].slice(0, 300);
        state.myPosts = [result.post, ...state.myPosts.filter((item) => item.id !== result.post.id)].slice(0, 300);
        context.showToast?.(editId ? "게시글을 수정했습니다." : "게시글을 공개했습니다.");
        window.location.hash = linkToPost(result.post).slice(1);
      } else if (form.id === "community-comment-form" || form.dataset?.role === "community-reply-form") {
        if (!state.user) {
          context.showToast?.("댓글을 작성하려면 로그인해 주세요.");
          return;
        }
        const parentId = form.dataset.parentId || "";
        const payload = { body: String(data.get("body") || "").trim() };
        if (parentId) payload.parentId = parentId;
        await api(`/api/community/posts/${encodeURIComponent(form.dataset.postId)}/comments`, { method: "POST", body: payload });
        state.replyToCommentId = null;
        state.replyToAuthor = "";
        await Promise.all([loadNotifications(), loadFeed()]);
        await loadRoute();
        context.showToast?.(parentId ? "답글을 등록했습니다." : "댓글을 등록했습니다.");
      } else if (form.id === "community-report-form") {
        await api(`/api/community/posts/${encodeURIComponent(form.dataset.postId)}/reports`, {
          method: "POST", body: { reason: String(data.get("reason") || "other"), detail: String(data.get("detail") || "").trim() },
        });
        document.querySelector("#app-dialog")?.close();
        context.showToast?.("신고를 접수했습니다.");
      }
    } catch (error) {
      showError(error);
    }
  }

  window.todaypatchCommunity = {
    init, bootstrap, loadRoute, renderPage, renderAccountControl, renderPreview, renderHomePreview, homeFeedCount, getPopularPosts, getMyPostsStats, renderMyPostsDashboard, renderNotificationItems, unreadNotificationCount, markAllNotificationsRead, refreshNotifications: loadNotifications,
    getActiveGameId: () => state.post?.gameId || state.gameId || "aion2",
    hasRegisteredAccount: () => Boolean(state.user?.email),
    getPreferences: getPreferenceSnapshot, applyPreferences: (preferences) => context?.applyPreferences?.(preferences), schedulePreferenceSync,
    isAction, handleAction, handleInput, handleChange, ownsForm, handleSubmit,
  };
})();
