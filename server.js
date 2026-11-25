const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { sanitizePreferences } = require("./user-preferences");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";
const privateDir = path.join(root, ".private");
const storePath = path.join(privateDir, "community.json");
const sessionCookie = "todaypatch_session";
const scryptAsync = promisify(scrypt);
const categoryIds = new Set(["free", "info", "guide", "question", "discussion"]);
const categoryNames = { free: "자유게시판", info: "정보", guide: "공략", question: "질문", discussion: "토론" };
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

let communityStore = { accounts: [], sessions: {}, posts: [], comments: [], reports: [], notifications: [], preferences: {}, authFailures: {} };
let persistQueue = Promise.resolve();
let dummyPasswordHashPromise;

function normalizeStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return communityStore;
  return {
    accounts: Array.isArray(value.accounts) ? value.accounts : [],
    sessions: value.sessions && typeof value.sessions === "object" && !Array.isArray(value.sessions) ? value.sessions : {},
    posts: Array.isArray(value.posts) ? value.posts : [],
    comments: Array.isArray(value.comments) ? value.comments : [],
    reports: Array.isArray(value.reports) ? value.reports : [],
    notifications: Array.isArray(value.notifications) ? value.notifications : [],
    preferences: value.preferences && typeof value.preferences === "object" && !Array.isArray(value.preferences) ? value.preferences : {},
    authFailures: value.authFailures && typeof value.authFailures === "object" && !Array.isArray(value.authFailures) ? value.authFailures : {},
  };
}

async function loadCommunityStore() {
  await fs.promises.mkdir(privateDir, { recursive: true });
  try {
    communityStore = normalizeStore(JSON.parse(await fs.promises.readFile(storePath, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("커뮤니티 저장 파일을 읽지 못해 빈 저장소로 시작합니다.");
  }
}

function persistCommunityStore() {
  persistQueue = persistQueue.catch(() => {}).then(async () => {
    await fs.promises.mkdir(privateDir, { recursive: true });
    const temporaryPath = `${storePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporaryPath, JSON.stringify(communityStore, null, 2), "utf8");
    await fs.promises.rename(temporaryPath, storePath);
  });
  return persistQueue;
}

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(value));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return ["", ""];
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { return [key, decodeURIComponent(value)]; } catch { return [key, ""]; }
  }).filter(([key]) => key));
}

function currentAccount(request) {
  const token = parseCookies(request.headers.cookie)[sessionCookie];
  const accountId = token && communityStore.sessions[token];
  return communityStore.accounts.find((account) => account.id === accountId) || null;
}

function publicAccount(account) {
  return account ? { id: account.id, displayName: account.displayName, createdAt: account.createdAt, email: account.email || null } : null;
}

function normalizeEmail(value) {
  return safeText(value, 254).toLowerCase();
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value) {
  return typeof value === "string" && Array.from(value).length >= 10 && Array.from(value).length <= 128;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt$16384$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, workFactor, saltValue, hashValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || workFactor !== "16384" || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64url");
    const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltValue, "base64url"), expected.length, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

function authFailureKey(email) {
  return createHash("sha256").update(email).digest("hex");
}

function isAuthLocked(email) {
  const record = communityStore.authFailures[authFailureKey(email)];
  return Boolean(record?.lockedUntil && Date.parse(record.lockedUntil) > Date.now());
}

function recordAuthFailure(email) {
  const key = authFailureKey(email);
  const now = Date.now();
  const previous = communityStore.authFailures[key];
  const inWindow = previous && now - Date.parse(previous.windowStartedAt) < 15 * 60 * 1000;
  const attempts = inWindow ? (previous.attempts || 0) + 1 : 1;
  communityStore.authFailures[key] = {
    attempts,
    windowStartedAt: inWindow ? previous.windowStartedAt : new Date(now).toISOString(),
    lockedUntil: attempts >= 8 ? new Date(now + 15 * 60 * 1000).toISOString() : null,
  };
}

function clearAuthFailures(email) {
  delete communityStore.authFailures[authFailureKey(email)];
}

function requireAccount(request, response) {
  const account = currentAccount(request);
  if (!account) sendError(response, 401, "로그인이 필요합니다.");
  return account;
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 96 * 1024) {
      const error = new Error("요청 내용이 너무 큽니다.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
    return value;
  } catch {
    const error = new Error("JSON 형식의 요청이 필요합니다.");
    error.statusCode = 400;
    throw error;
  }
}

function safeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateCommunityPost(input) {
  const gameId = safeText(input.gameId, 80);
  const type = safeText(input.type, 20);
  const title = safeText(input.title, 100);
  const body = safeText(input.body, 5000);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(gameId)) return { error: "게임을 선택해 주세요." };
  if (!categoryIds.has(type)) return { error: "글 종류를 선택해 주세요." };
  if (!title || !body) return { error: "제목과 본문을 입력해 주세요." };
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : [])
    .map((tag) => safeText(tag, 24).replace(/^#/, ""))
    .filter(Boolean))].slice(0, 8);
  let official = null;
  if (input.official && typeof input.official === "object") {
    const url = safeText(input.official.url, 1000);
    try {
      if (url && new URL(url).protocol === "https:") {
        official = {
          newsId: safeText(input.official.newsId, 160),
          title: safeText(input.official.title, 200),
          url,
          analysisRefs: [...new Set((Array.isArray(input.official.analysisRefs) ? input.official.analysisRefs : [])
            .map((item) => safeText(item, 160)).filter(Boolean))].slice(0, 20),
        };
      }
    } catch {
      official = null;
    }
  }
  return { value: { gameId, type, title, body, tags, official } };
}

function findPost(id) {
  return communityStore.posts.find((post) => post.id === id) || null;
}

function authorFor(id) {
  const account = communityStore.accounts.find((item) => item.id === id);
  return account ? { id: account.id, displayName: account.displayName } : { id: "", displayName: "알 수 없는 게스트" };
}

function commentCount(postId) {
  return communityStore.comments.filter((comment) => comment.postId === postId && !comment.deletedAt).length;
}

function addCommunityNotification(accountId, kind, post, actor, body = "", customTitle = "") {
  if (!accountId || accountId === actor.id) return;
  communityStore.notifications.unshift({
    id: randomUUID(), accountId, kind, postId: post.id, gameId: post.gameId,
    title: customTitle || (kind === "comment" ? "내 게시글에 댓글이 달렸습니다." : "내 게시글에 좋아요가 달렸습니다."),
    body: body.slice(0, 180), actorName: actor.displayName, createdAt: new Date().toISOString(), readAt: null,
  });
  communityStore.notifications = communityStore.notifications.slice(0, 5000);
}

function publicPost(post, account, includeComments = false) {
  const result = {
    id: post.id,
    gameId: post.gameId,
    type: post.type,
    title: post.title,
    body: post.body,
    tags: post.tags,
    author: authorFor(post.authorId),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt || null,
    official: post.official || null,
    likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
    commentCount: commentCount(post.id),
    liked: Boolean(account && Array.isArray(post.likes) && post.likes.includes(account.id)),
    mine: Boolean(account && account.id === post.authorId),
  };
  if (includeComments) {
    const activeReplyParentIds = new Set(
      communityStore.comments
        .filter((comment) => comment.postId === post.id && !comment.deletedAt && comment.parentId)
        .map((comment) => comment.parentId),
    );
    result.comments = communityStore.comments
      .filter((comment) => comment.postId === post.id && (!comment.deletedAt || activeReplyParentIds.has(comment.id)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((comment) => {
        const deleted = Boolean(comment.deletedAt);
        return {
          id: comment.id,
          parentId: comment.parentId || null,
          body: deleted ? "삭제된 댓글입니다." : comment.body,
          deleted,
          author: deleted ? { id: "", displayName: "삭제됨" } : authorFor(comment.authorId),
          createdAt: comment.createdAt,
          mine: !deleted && Boolean(account && account.id === comment.authorId),
        };
      });
  }
  return result;
}

function postRateLimited(accountId) {
  const windowStart = Date.now() - 10 * 60 * 1000;
  return communityStore.posts.filter((post) => post.authorId === accountId && Date.parse(post.createdAt) > windowStart).length >= 5;
}

function commentRateLimited(accountId) {
  const windowStart = Date.now() - 10 * 60 * 1000;
  return communityStore.comments.filter((item) => item.authorId === accountId && Date.parse(item.createdAt) > windowStart).length >= 20;
}

function isAdmin(request) {
  const expected = process.env.TODAYPATCH_ADMIN_TOKEN;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function handleApi(request, response, requestUrl) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.origin;
    if (origin && origin !== "null") {
      try {
        if (new URL(origin).host !== request.headers.host) {
          sendError(response, 403, "다른 사이트에서 보낸 요청은 처리할 수 없습니다.");
          return;
        }
      } catch {
        sendError(response, 403, "요청 출처를 확인할 수 없습니다.");
        return;
      }
    }
  }

  const method = request.method;
  const pathname = requestUrl.pathname;
  const account = currentAccount(request);

  if (pathname === "/api/chat" && method === "POST") {
    const chatHandler = require("./api/chat");
    await chatHandler(request, response);
    return;
  }

  if (pathname === "/api/community/session" && method === "GET") {
    sendJson(response, 200, { user: publicAccount(account) });
    return;
  }
  if (pathname === "/api/community/preferences" && method === "GET") {
    if (!account) {
      sendError(response, 401, "로그인이 필요합니다.");
      return;
    }
    sendJson(response, 200, { preferences: sanitizePreferences(communityStore.preferences[account.id] || {}) });
    return;
  }
  if (pathname === "/api/community/preferences" && method === "PUT") {
    if (!account) {
      sendError(response, 401, "로그인이 필요합니다.");
      return;
    }
    const input = await readJson(request);
    communityStore.preferences[account.id] = sanitizePreferences(input.preferences);
    await persistCommunityStore();
    sendJson(response, 200, { ok: true });
    return;
  }
  if (pathname === "/api/community/register" && method === "POST") {
    const input = await readJson(request);
    const email = normalizeEmail(input.email);
    const password = input.password;
    const displayName = safeText(input.displayName, 24);
    if (!validEmail(email)) {
      sendError(response, 400, "올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    if (!validPassword(password)) {
      sendError(response, 400, "비밀번호는 10자 이상 128자 이하로 입력해 주세요.");
      return;
    }
    if (displayName.length < 2) {
      sendError(response, 400, "닉네임은 2자 이상 입력해 주세요.");
      return;
    }
    if (communityStore.accounts.some((item) => item.email && item.email.toLowerCase() === email)) {
      sendError(response, 409, "이미 가입된 이메일입니다. 로그인해 주세요.");
      return;
    }

    const token = randomUUID();
    const passwordHash = await hashPassword(password);
    let accountRecord = account;
    if (accountRecord) {
      if (accountRecord.email) {
        sendError(response, 409, "이미 계정으로 로그인되어 있습니다.");
        return;
      }
      accountRecord.email = email;
      accountRecord.passwordHash = passwordHash;
      accountRecord.displayName = displayName;
    } else {
      accountRecord = {
        id: randomUUID(),
        email,
        passwordHash,
        displayName,
        createdAt: new Date().toISOString(),
      };
      communityStore.accounts.push(accountRecord);
    }
    const oldToken = parseCookies(request.headers.cookie)[sessionCookie];
    if (oldToken) delete communityStore.sessions[oldToken];
    communityStore.sessions[token] = accountRecord.id;
    clearAuthFailures(email);
    await persistCommunityStore();
    const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    sendJson(response, account ? 200 : 201, { user: publicAccount(accountRecord) }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    });
    return;
  }
  if (pathname === "/api/community/login" && method === "POST") {
    const input = await readJson(request);
    const email = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";
    if (!validEmail(email) || !password || password.length > 128) {
      sendError(response, 400, "이메일과 비밀번호를 확인해 주세요.");
      return;
    }
    if (isAuthLocked(email)) {
      sendError(response, 429, "로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.");
      return;
    }
    const found = communityStore.accounts.find((item) => item.email && item.email.toLowerCase() === email);
    if (!dummyPasswordHashPromise) dummyPasswordHashPromise = hashPassword(randomUUID());
    const passwordMatches = await verifyPassword(password, found?.passwordHash || await dummyPasswordHashPromise);
    if (!found || !passwordMatches) {
      recordAuthFailure(email);
      await persistCommunityStore();
      sendError(response, 401, "이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    clearAuthFailures(email);
    const token = randomUUID();
    communityStore.sessions[token] = found.id;
    await persistCommunityStore();
    const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    sendJson(response, 200, { user: publicAccount(found) }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    });
    return;
  }
  if (pathname === "/api/community/notifications" && method === "GET") {
    if (!account) {
      sendError(response, 401, "로그인이 필요합니다.");
      return;
    }
    const notifications = communityStore.notifications.filter((item) => item.accountId === account.id).slice(0, 100).map((item) => ({
      id: item.id, kind: item.kind, postId: item.postId, gameId: item.gameId, title: item.title,
      body: item.body, actorName: item.actorName, createdAt: item.createdAt, read: Boolean(item.readAt),
    }));
    sendJson(response, 200, { notifications });
    return;
  }
  const notificationReadMatch = pathname.match(/^\/api\/community\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && method === "POST") {
    if (!account) {
      sendError(response, 401, "로그인이 필요합니다.");
      return;
    }
    const notification = communityStore.notifications.find((item) => item.id === decodeURIComponent(notificationReadMatch[1]) && item.accountId === account.id);
    if (!notification) {
      sendError(response, 404, "알림을 찾을 수 없습니다.");
      return;
    }
    notification.readAt = notification.readAt || new Date().toISOString();
    await persistCommunityStore();
    sendJson(response, 200, { ok: true });
    return;
  }
  if (pathname === "/api/community/guest" && method === "POST") {
    await readJson(request);
    if (account) {
      sendJson(response, 200, { user: publicAccount(account) });
      return;
    }
    const id = randomUUID();
    const token = randomUUID();
    const accountRecord = {
      id,
      displayName: `게스트-${randomUUID().slice(0, 4).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    communityStore.accounts.push(accountRecord);
    communityStore.sessions[token] = id;
    await persistCommunityStore();
    const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    sendJson(response, 201, { user: publicAccount(accountRecord) }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    });
    return;
  }
  if (pathname === "/api/community/logout" && method === "POST") {
    const token = parseCookies(request.headers.cookie)[sessionCookie];
    if (token && communityStore.sessions[token]) {
      delete communityStore.sessions[token];
      await persistCommunityStore();
    }
    sendJson(response, 200, { ok: true }, { "Set-Cookie": `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
    return;
  }

  if (pathname === "/api/community/posts" && method === "GET") {
    const gameId = requestUrl.searchParams.get("gameId") || "";
    const type = requestUrl.searchParams.get("type") || "";
    const query = (requestUrl.searchParams.get("q") || "").trim().toLocaleLowerCase("ko-KR");
    const mineOnly = requestUrl.searchParams.get("mine") === "1";
    const sort = requestUrl.searchParams.get("sort") === "popular" ? "popular" : "latest";
    if (mineOnly && !account) {
      sendJson(response, 200, { posts: [] });
      return;
    }
    const posts = communityStore.posts.filter((post) => !post.deletedAt
      && (!post.hidden || (mineOnly && post.authorId === account?.id))
      && (!mineOnly || post.authorId === account?.id)
      && (!gameId || post.gameId === gameId)
      && (!type || post.type === type)
      && (!query || `${post.title} ${post.body} ${(post.tags || []).join(" ")} ${categoryNames[post.type] || ""}`.toLocaleLowerCase("ko-KR").includes(query)));
    posts.sort((a, b) => sort === "popular"
      ? ((b.likes?.length || 0) + commentCount(b.id) * 2) - ((a.likes?.length || 0) + commentCount(a.id) * 2) || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt));
    sendJson(response, 200, { posts: posts.slice(0, 300).map((post) => publicPost(post, account)) });
    return;
  }
  if (pathname === "/api/community/posts" && method === "POST") {
    const author = requireAccount(request, response);
    if (!author) return;
    if (postRateLimited(author.id)) {
      sendError(response, 429, "글 작성이 잠시 제한되었습니다. 10분 후 다시 작성해 주세요.");
      return;
    }
    const input = await readJson(request);
    const validated = validateCommunityPost(input);
    if (validated.error) {
      sendError(response, 400, validated.error);
      return;
    }
    const post = { id: randomUUID(), ...validated.value, authorId: author.id, createdAt: new Date().toISOString(), likes: [], hidden: false };
    communityStore.posts.push(post);
    await persistCommunityStore();
    sendJson(response, 201, { post: publicPost(post, author) });
    return;
  }

  const postMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)$/);
  if (postMatch) {
    const post = findPost(decodeURIComponent(postMatch[1]));
    if (!post || post.deletedAt || (post.hidden && post.authorId !== account?.id)) {
      sendError(response, 404, "게시글을 찾을 수 없습니다.");
      return;
    }
    if (method === "GET") {
      sendJson(response, 200, { post: publicPost(post, account, true) });
      return;
    }
    if (method === "PUT") {
      const author = requireAccount(request, response);
      if (!author) return;
      if (post.authorId !== author.id) {
        sendError(response, 403, "작성자만 글을 수정할 수 있습니다.");
        return;
      }
      const input = await readJson(request);
      const validated = validateCommunityPost(input);
      if (validated.error) {
        sendError(response, 400, validated.error);
        return;
      }
      Object.assign(post, validated.value, { updatedAt: new Date().toISOString() });
      await persistCommunityStore();
      sendJson(response, 200, { post: publicPost(post, author, true) });
      return;
    }
    if (method === "DELETE") {
      const author = requireAccount(request, response);
      if (!author) return;
      if (post.authorId !== author.id) {
        sendError(response, 403, "작성자만 글을 삭제할 수 있습니다.");
        return;
      }
      post.deletedAt = new Date().toISOString();
      await persistCommunityStore();
      sendJson(response, 200, { ok: true });
      return;
    }
  }

  const commentCollection = pathname.match(/^\/api\/community\/posts\/([^/]+)\/comments$/);
  if (commentCollection && method === "POST") {
    const author = requireAccount(request, response);
    if (!author) return;
    const post = findPost(decodeURIComponent(commentCollection[1]));
    if (!post || post.deletedAt || post.hidden) {
      sendError(response, 404, "게시글을 찾을 수 없습니다.");
      return;
    }
    if (commentRateLimited(author.id)) {
      sendError(response, 429, "댓글 작성이 잠시 제한되었습니다. 10분 후 다시 작성해 주세요.");
      return;
    }
    const input = await readJson(request);
    const body = safeText(input.body, 1000);
    const rawParentId = safeText(input.parentId, 80);
    if (!body) {
      sendError(response, 400, "댓글 내용을 입력해 주세요.");
      return;
    }
    let parentComment = null;
    let resolvedParentId = null;
    if (rawParentId) {
      parentComment = communityStore.comments.find((item) => item.id === rawParentId && item.postId === post.id && !item.deletedAt);
      if (!parentComment) {
        sendError(response, 404, "답글을 달 원본 댓글을 찾을 수 없습니다.");
        return;
      }
      resolvedParentId = parentComment.parentId || parentComment.id;
    }
    const comment = { id: randomUUID(), postId: post.id, parentId: resolvedParentId, authorId: author.id, body, createdAt: new Date().toISOString() };
    communityStore.comments.push(comment);
    addCommunityNotification(post.authorId, "comment", post, author, body, resolvedParentId ? "내 게시글에 답글이 달렸습니다." : "내 게시글에 댓글이 달렸습니다.");
    if (parentComment && parentComment.authorId !== post.authorId) {
      addCommunityNotification(parentComment.authorId, "comment", post, author, body, "내 댓글에 답글이 달렸습니다.");
    }
    await persistCommunityStore();
    sendJson(response, 201, { comment: { id: comment.id, parentId: resolvedParentId, body, author: { id: author.id, displayName: author.displayName }, createdAt: comment.createdAt, mine: true } });
    return;
  }

  const commentMatch = pathname.match(/^\/api\/community\/comments\/([^/]+)$/);
  if (commentMatch && method === "DELETE") {
    const author = requireAccount(request, response);
    if (!author) return;
    const comment = communityStore.comments.find((item) => item.id === decodeURIComponent(commentMatch[1]) && !item.deletedAt);
    if (!comment) {
      sendError(response, 404, "댓글을 찾을 수 없습니다.");
      return;
    }
    if (comment.authorId !== author.id) {
      sendError(response, 403, "작성자만 댓글을 삭제할 수 있습니다.");
      return;
    }
    comment.deletedAt = new Date().toISOString();
    await persistCommunityStore();
    sendJson(response, 200, { ok: true });
    return;
  }

  const likeMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/like$/);
  if (likeMatch && method === "POST") {
    const author = requireAccount(request, response);
    if (!author) return;
    const post = findPost(decodeURIComponent(likeMatch[1]));
    if (!post || post.deletedAt || post.hidden) {
      sendError(response, 404, "게시글을 찾을 수 없습니다.");
      return;
    }
    post.likes = Array.isArray(post.likes) ? post.likes : [];
    const index = post.likes.indexOf(author.id);
    if (index >= 0) post.likes.splice(index, 1);
    else {
      post.likes.push(author.id);
      addCommunityNotification(post.authorId, "like", post, author);
    }
    await persistCommunityStore();
    sendJson(response, 200, { liked: index < 0, likesCount: post.likes.length });
    return;
  }

  const reportMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/reports$/);
  if (reportMatch && method === "POST") {
    const reporter = requireAccount(request, response);
    if (!reporter) return;
    const post = findPost(decodeURIComponent(reportMatch[1]));
    if (!post || post.deletedAt) {
      sendError(response, 404, "게시글을 찾을 수 없습니다.");
      return;
    }
    if (communityStore.reports.some((item) => item.postId === post.id && item.reporterId === reporter.id && !item.reviewedAt)) {
      sendError(response, 409, "이미 이 게시글을 신고했습니다.");
      return;
    }
    const input = await readJson(request);
    const reasons = new Set(["spam", "abuse", "privacy", "copyright", "other"]);
    const reason = reasons.has(input.reason) ? input.reason : "other";
    const report = { id: randomUUID(), postId: post.id, reporterId: reporter.id, reason, detail: safeText(input.detail, 1000), createdAt: new Date().toISOString(), reviewedAt: null, decision: null };
    communityStore.reports.push(report);
    await persistCommunityStore();
    sendJson(response, 201, { ok: true });
    return;
  }

  if (pathname === "/api/community/admin/reports" && method === "GET") {
    if (!isAdmin(request)) {
      sendError(response, process.env.TODAYPATCH_ADMIN_TOKEN ? 403 : 503, process.env.TODAYPATCH_ADMIN_TOKEN ? "운영자 권한이 없습니다." : "운영자 검토 기능은 서버에 TODAYPATCH_ADMIN_TOKEN을 설정한 뒤 사용할 수 있습니다.");
      return;
    }
    const reports = communityStore.reports.map((report) => {
      const post = findPost(report.postId);
      return {
        ...report,
        reporter: authorFor(report.reporterId),
        post: post ? {
          id: post.id, title: post.title, body: post.body, gameId: post.gameId,
          type: post.type, author: authorFor(post.authorId), hidden: Boolean(post.hidden),
        } : null,
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    sendJson(response, 200, { reports });
    return;
  }
  const moderationMatch = pathname.match(/^\/api\/community\/admin\/reports\/([^/]+)$/);
  if (moderationMatch && method === "PATCH") {
    if (!isAdmin(request)) {
      sendError(response, process.env.TODAYPATCH_ADMIN_TOKEN ? 403 : 503, process.env.TODAYPATCH_ADMIN_TOKEN ? "운영자 권한이 없습니다." : "운영자 검토 기능은 서버에 TODAYPATCH_ADMIN_TOKEN을 설정한 뒤 사용할 수 있습니다.");
      return;
    }
    const input = await readJson(request);
    if (!["hide", "keep", "restore"].includes(input.decision)) {
      sendError(response, 400, "처리 방법을 선택해 주세요.");
      return;
    }
    const report = communityStore.reports.find((item) => item.id === decodeURIComponent(moderationMatch[1]));
    if (!report) {
      sendError(response, 404, "신고를 찾을 수 없습니다.");
      return;
    }
    const post = findPost(report.postId);
    if (post && input.decision !== "keep") post.hidden = input.decision === "hide";
    report.reviewedAt = new Date().toISOString();
    report.decision = input.decision;
    await persistCommunityStore();
    sendJson(response, 200, { ok: true });
    return;
  }

  sendError(response, 404, "API를 찾을 수 없습니다.");
}

const server = http.createServer(async (request, response) => {
  let requestUrl;
  try {
    requestUrl = new URL(request.url, `http://${request.headers.host}`);
  } catch {
    sendError(response, 400, "잘못된 요청 주소입니다.");
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    try {
      await handleApi(request, response, requestUrl);
    } catch (error) {
      if (!response.headersSent) sendError(response, error.statusCode || 500, error.statusCode ? error.message : "요청을 처리하지 못했습니다.");
      else response.destroy();
      if (!error.statusCode) console.error("커뮤니티 API 오류:", error);
    }
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (filePath === privateDir || filePath.startsWith(`${privateDir}${path.sep}`)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  });
});

loadCommunityStore().then(() => {
  server.listen(port, host, () => {
    console.log(`오늘의 패치 로컬 미리보기: http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("커뮤니티 저장소를 준비하지 못했습니다:", error);
  process.exitCode = 1;
});
