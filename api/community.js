const { randomUUID, createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { Pool } = require("pg");
const { sanitizePreferences } = require("../user-preferences");

const sessionCookie = "todaypatch_session";
const categories = new Set(["free", "question", "guide", "discussion"]);
const reportReasons = new Set(["spam", "abuse", "privacy", "copyright", "other"]);
const scryptAsync = promisify(scrypt);
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;

const pool = globalThis.__todaypatchPool || new Pool({
  connectionString: databaseUrl,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
globalThis.__todaypatchPool = pool;

let schemaPromise;
let dummyPasswordHashPromise;

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS community_accounts (
        id uuid PRIMARY KEY,
        display_name text NOT NULL,
        email text,
        password_hash text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query("ALTER TABLE community_accounts ADD COLUMN IF NOT EXISTS email text");
      await pool.query("ALTER TABLE community_accounts ADD COLUMN IF NOT EXISTS password_hash text");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS community_accounts_email_unique ON community_accounts (lower(email)) WHERE email IS NOT NULL");
      await pool.query(`CREATE TABLE IF NOT EXISTS community_sessions (
        token_hash char(64) PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_user_preferences (
        account_id uuid PRIMARY KEY REFERENCES community_accounts(id) ON DELETE CASCADE,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_posts (
        id uuid PRIMARY KEY,
        game_id varchar(80) NOT NULL,
        type varchar(20) NOT NULL CHECK (type IN ('free', 'question', 'guide', 'discussion')),
        title varchar(100) NOT NULL,
        body varchar(5000) NOT NULL,
        tags text[] NOT NULL DEFAULT '{}',
        author_id uuid NOT NULL REFERENCES community_accounts(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz,
        official jsonb,
        hidden boolean NOT NULL DEFAULT false,
        deleted_at timestamptz
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_comments (
        id uuid PRIMARY KEY,
        post_id uuid NOT NULL REFERENCES community_posts(id),
        author_id uuid NOT NULL REFERENCES community_accounts(id),
        body varchar(1000) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_post_likes (
        post_id uuid NOT NULL REFERENCES community_posts(id),
        account_id uuid NOT NULL REFERENCES community_accounts(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, account_id)
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_reports (
        id uuid PRIMARY KEY,
        post_id uuid NOT NULL REFERENCES community_posts(id),
        reporter_id uuid NOT NULL REFERENCES community_accounts(id),
        reason varchar(24) NOT NULL,
        detail varchar(1000) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz,
        decision varchar(16)
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_notifications (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES community_accounts(id),
        kind varchar(16) NOT NULL CHECK (kind IN ('comment', 'like')),
        post_id uuid NOT NULL REFERENCES community_posts(id),
        game_id varchar(80) NOT NULL,
        title varchar(100) NOT NULL,
        body varchar(180) NOT NULL DEFAULT '',
        actor_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        read_at timestamptz
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS community_auth_attempts (
        email_hash char(64) PRIMARY KEY,
        attempts integer NOT NULL DEFAULT 0,
        window_started_at timestamptz NOT NULL DEFAULT now(),
        locked_until timestamptz
      )`);
      await pool.query("CREATE INDEX IF NOT EXISTS community_posts_feed_idx ON community_posts (game_id, type, created_at DESC) WHERE deleted_at IS NULL AND hidden = false");
      await pool.query("CREATE INDEX IF NOT EXISTS community_comments_post_idx ON community_comments (post_id, created_at) WHERE deleted_at IS NULL");
      await pool.query("CREATE INDEX IF NOT EXISTS community_notifications_account_idx ON community_notifications (account_id, created_at DESC)");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS community_reports_active_unique ON community_reports (post_id, reporter_id) WHERE reviewed_at IS NULL");
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function json(res, status, value, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(value));
}

function error(res, status, message) {
  json(res, status, { error: message });
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return ["", ""];
    const key = part.slice(0, separator).trim();
    try { return [key, decodeURIComponent(part.slice(separator + 1).trim())]; }
    catch { return [key, ""]; }
  }).filter(([key]) => key));
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function safeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function publicAccount(account) {
  return account ? { id: account.id, displayName: account.display_name, createdAt: account.created_at, email: account.email || null } : null;
}

function normalizeEmail(value) {
  return safeText(value, 254).toLowerCase();
}

function validateEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePassword(value) {
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
  } catch {
    return false;
  }
}

function emailHash(email) {
  return createHash("sha256").update(email).digest("hex");
}

async function isAuthLocked(email) {
  const result = await pool.query("SELECT locked_until > now() AS locked FROM community_auth_attempts WHERE email_hash=$1", [emailHash(email)]);
  return Boolean(result.rows[0]?.locked);
}

async function recordAuthFailure(email) {
  await pool.query(`INSERT INTO community_auth_attempts AS existing (email_hash, attempts, window_started_at)
    VALUES ($1, 1, now())
    ON CONFLICT (email_hash) DO UPDATE SET
      attempts = CASE WHEN existing.window_started_at < now() - interval '15 minutes' THEN 1 ELSE existing.attempts + 1 END,
      window_started_at = CASE WHEN existing.window_started_at < now() - interval '15 minutes' THEN now() ELSE existing.window_started_at END,
      locked_until = CASE
        WHEN existing.window_started_at < now() - interval '15 minutes' THEN NULL
        WHEN existing.attempts + 1 >= 8 THEN now() + interval '15 minutes'
        ELSE existing.locked_until END`, [emailHash(email)]);
}

async function clearAuthFailures(email) {
  await pool.query("DELETE FROM community_auth_attempts WHERE email_hash=$1", [emailHash(email)]);
}

function asIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseRoute(req) {
  const fromRewrite = req.query?.route;
  if (fromRewrite) return Array.isArray(fromRewrite) ? fromRewrite.join("/") : String(fromRewrite);
  const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
  return url.pathname.replace(/^\/api\/community\/?/, "").replace(/^\/+|\/+$/g, "");
}

async function readJson(req) {
  let value = req.body;
  if (value === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 96 * 1024) {
        const problem = new Error("요청 내용이 너무 큽니다.");
        problem.statusCode = 413;
        throw problem;
      }
      chunks.push(chunk);
    }
    if (!size) return {};
    value = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value)) > 96 * 1024) {
    const problem = new Error("요청 내용이 너무 큽니다.");
    problem.statusCode = 413;
    throw problem;
  }
  if (typeof value === "string" || Buffer.isBuffer(value)) {
    try { value = JSON.parse(value.toString()); }
    catch {
      const problem = new Error("JSON 형식의 요청이 필요합니다.");
      problem.statusCode = 400;
      throw problem;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const problem = new Error("JSON 형식의 요청이 필요합니다.");
    problem.statusCode = 400;
    throw problem;
  }
  return value;
}

function validatePost(input) {
  const gameId = safeText(input.gameId, 80);
  const type = safeText(input.type, 20);
  const title = safeText(input.title, 100);
  const body = safeText(input.body, 5000);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(gameId)) return { error: "게임을 선택해 주세요." };
  if (!categories.has(type)) return { error: "글 종류를 선택해 주세요." };
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
    } catch { official = null; }
  }
  return { value: { gameId, type, title, body, tags, official } };
}

async function accountForRequest(req) {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (!token) return null;
  const result = await pool.query(`SELECT a.id, a.display_name, a.created_at, a.email
    FROM community_sessions s JOIN community_accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > now()`, [hashToken(token)]);
  return result.rows[0] || null;
}

function requireAccount(account, res) {
  if (!account) error(res, 401, "로그인이 필요합니다.");
  return account;
}

function isAdmin(req) {
  const expected = process.env.TODAYPATCH_ADMIN_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function postSelect(accountPlaceholder) {
  return `SELECT p.*, a.display_name AS author_name,
  COALESCE(l.like_count, 0)::int AS likes_count,
  COALESCE(c.comment_count, 0)::int AS comment_count,
  EXISTS (SELECT 1 FROM community_post_likes mine WHERE mine.post_id = p.id AND mine.account_id = ${accountPlaceholder}::uuid) AS liked
  FROM community_posts p
  LEFT JOIN community_accounts a ON a.id = p.author_id
  LEFT JOIN (SELECT post_id, count(*) AS like_count FROM community_post_likes GROUP BY post_id) l ON l.post_id = p.id
  LEFT JOIN (SELECT post_id, count(*) AS comment_count FROM community_comments WHERE deleted_at IS NULL GROUP BY post_id) c ON c.post_id = p.id`;
}

function publicPost(row, account, comments) {
  const result = {
    id: row.id,
    gameId: row.game_id,
    type: row.type,
    title: row.title,
    body: row.body,
    tags: row.tags || [],
    author: { id: row.author_id || "", displayName: row.author_name || "알 수 없는 게스트" },
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    official: row.official || null,
    likesCount: Number(row.likes_count || 0),
    commentCount: Number(row.comment_count || 0),
    liked: Boolean(row.liked),
    mine: Boolean(account && account.id === row.author_id),
  };
  if (comments) result.comments = comments;
  return result;
}

async function findPost(id, accountId) {
  const result = await pool.query(`${postSelect("$2")} WHERE p.id = $1`, [id, accountId]);
  return result.rows[0] || null;
}

async function loadComments(postId, account) {
  const result = await pool.query(`SELECT c.id, c.body, c.created_at, c.author_id, a.display_name AS author_name
    FROM community_comments c LEFT JOIN community_accounts a ON a.id = c.author_id
    WHERE c.post_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC`, [postId]);
  return result.rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: { id: row.author_id || "", displayName: row.author_name || "알 수 없는 게스트" },
    createdAt: asIso(row.created_at),
    mine: Boolean(account && account.id === row.author_id),
  }));
}

async function rateLimited(sql, accountId) {
  const result = await pool.query(sql, [accountId]);
  return Number(result.rows[0]?.count || 0) >= (sql.includes("community_posts") ? 5 : 20);
}

function secureCookie(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https" || req.socket?.encrypted ? "; Secure" : "";
}

async function dispatch(req, res, route, account) {
  const method = req.method || "GET";
  const path = `/${route}`.replace(/\/$/, "") || "/";
  const parts = path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));

  if (path === "/session" && method === "GET") {
    json(res, 200, { user: publicAccount(account) });
    return;
  }

  if (path === "/preferences" && method === "GET") {
    if (!requireAccount(account, res)) return;
    const result = await pool.query("SELECT preferences FROM community_user_preferences WHERE account_id=$1", [account.id]);
    json(res, 200, { preferences: sanitizePreferences(result.rows[0]?.preferences || {}) });
    return;
  }

  if (path === "/preferences" && method === "PUT") {
    if (!requireAccount(account, res)) return;
    const input = await readJson(req);
    const preferences = sanitizePreferences(input.preferences);
    await pool.query(`INSERT INTO community_user_preferences (account_id, preferences, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (account_id) DO UPDATE SET preferences=EXCLUDED.preferences, updated_at=now()`,
    [account.id, JSON.stringify(preferences)]);
    json(res, 200, { ok: true });
    return;
  }

  if (path === "/register" && method === "POST") {
    const input = await readJson(req);
    const email = normalizeEmail(input.email);
    const password = input.password;
    const displayName = safeText(input.displayName, 24);
    if (!validateEmail(email)) return error(res, 400, "올바른 이메일 주소를 입력해 주세요.");
    if (!validatePassword(password)) return error(res, 400, "비밀번호는 10자 이상 128자 이하로 입력해 주세요.");
    if (Array.from(displayName).length < 2) return error(res, 400, "닉네임을 2자 이상 입력해 주세요.");
    if (account?.email) return error(res, 409, "이미 계정으로 로그인되어 있습니다. 로그아웃한 뒤 새 계정을 만들어 주세요.");

    const passwordHash = await hashPassword(password);
    const token = randomUUID();
    const accountId = account?.id || randomUUID();
    const client = await pool.connect();
    let createdAccount;
    try {
      await client.query("BEGIN");
      const saved = account
        ? await client.query(`UPDATE community_accounts SET display_name=$1, email=$2, password_hash=$3
            WHERE id=$4 AND email IS NULL RETURNING id, display_name, email, created_at`, [displayName, email, passwordHash, accountId])
        : await client.query(`INSERT INTO community_accounts (id, display_name, email, password_hash)
            VALUES ($1,$2,$3,$4) RETURNING id, display_name, email, created_at`, [accountId, displayName, email, passwordHash]);
      if (!saved.rowCount) {
        await client.query("ROLLBACK");
        return error(res, 409, "이 게스트 계정은 이미 계정으로 전환되었습니다. 로그아웃하고 다시 시도해 주세요.");
      }
      createdAccount = saved.rows[0];
      await client.query("INSERT INTO community_sessions (token_hash, account_id, expires_at) VALUES ($1,$2,now() + interval '30 days')", [hashToken(token), accountId]);
      const oldToken = parseCookies(req.headers.cookie)[sessionCookie];
      if (oldToken) await client.query("DELETE FROM community_sessions WHERE token_hash=$1", [hashToken(oldToken)]);
      await client.query("COMMIT");
    } catch (cause) {
      await client.query("ROLLBACK");
      if (cause.code === "23505") return error(res, 409, "이미 가입된 이메일 주소입니다. 로그인해 주세요.");
      throw cause;
    } finally { client.release(); }
    json(res, account ? 200 : 201, { user: publicAccount(createdAccount) }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureCookie(req)}`,
    });
    return;
  }

  if (path === "/login" && method === "POST") {
    const input = await readJson(req);
    const email = normalizeEmail(input.email);
    const password = input.password;
    if (!validateEmail(email) || typeof password !== "string" || !password || Array.from(password).length > 128) {
      return error(res, 400, "이메일과 비밀번호를 확인해 주세요.");
    }
    if (await isAuthLocked(email)) return error(res, 429, "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요.");
    const result = await pool.query("SELECT id, display_name, email, password_hash, created_at FROM community_accounts WHERE lower(email)=$1 LIMIT 1", [email]);
    const found = result.rows[0];
    if (!dummyPasswordHashPromise) dummyPasswordHashPromise = hashPassword(randomUUID());
    const passwordValid = found?.password_hash
      ? await verifyPassword(password, found.password_hash)
      : await verifyPassword(password, await dummyPasswordHashPromise);
    if (!found?.password_hash || !passwordValid) {
      await recordAuthFailure(email);
      return error(res, 401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    await clearAuthFailures(email);
    const token = randomUUID();
    await pool.query("INSERT INTO community_sessions (token_hash, account_id, expires_at) VALUES ($1,$2,now() + interval '30 days')", [hashToken(token), found.id]);
    json(res, 200, { user: publicAccount(found) }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureCookie(req)}`,
    });
    return;
  }

  if (path === "/guest" && method === "POST") {
    await readJson(req);
    if (account) {
      json(res, 200, { user: publicAccount(account) });
      return;
    }
    const id = randomUUID();
    const token = randomUUID();
    const createdAt = new Date().toISOString();
    const displayName = `게스트-${randomUUID().slice(0, 4).toUpperCase()}`;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO community_accounts (id, display_name, created_at) VALUES ($1, $2, $3)", [id, displayName, createdAt]);
      await client.query("INSERT INTO community_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '365 days')", [hashToken(token), id]);
      await client.query("COMMIT");
    } catch (cause) {
      await client.query("ROLLBACK");
      throw cause;
    } finally { client.release(); }
    json(res, 201, { user: { id, displayName, createdAt } }, {
      "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secureCookie(req)}`,
    });
    return;
  }

  if (path === "/logout" && method === "POST") {
    const token = parseCookies(req.headers.cookie)[sessionCookie];
    if (token) await pool.query("DELETE FROM community_sessions WHERE token_hash = $1", [hashToken(token)]);
    json(res, 200, { ok: true }, { "Set-Cookie": `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(req)}` });
    return;
  }

  if (path === "/notifications" && method === "GET") {
    if (!requireAccount(account, res)) return;
    const result = await pool.query(`SELECT id, kind, post_id, game_id, title, body, actor_name, created_at, read_at
      FROM community_notifications WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`, [account.id]);
    json(res, 200, { notifications: result.rows.map((row) => ({
      id: row.id, kind: row.kind, postId: row.post_id, gameId: row.game_id, title: row.title,
      body: row.body, actorName: row.actor_name, createdAt: asIso(row.created_at), read: Boolean(row.read_at),
    })) });
    return;
  }

  if (parts[0] === "notifications" && parts[1] && parts[2] === "read" && method === "POST") {
    if (!requireAccount(account, res)) return;
    await readJson(req);
    const result = await pool.query(`UPDATE community_notifications SET read_at = COALESCE(read_at, now())
      WHERE id = $1 AND account_id = $2 RETURNING id`, [parts[1], account.id]);
    if (!result.rowCount) return error(res, 404, "알림을 찾을 수 없습니다.");
    json(res, 200, { ok: true });
    return;
  }

  if (path === "/posts" && method === "GET") {
    const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    const gameId = url.searchParams.get("gameId") || "";
    const type = url.searchParams.get("type") || "";
    const query = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";
    const result = await pool.query(`${postSelect("$1")}
      WHERE p.deleted_at IS NULL AND p.hidden = false
        AND ($2 = '' OR p.game_id = $2)
        AND ($3 = '' OR p.type = $3)
        AND ($4 = '' OR concat_ws(' ', p.title, p.body, array_to_string(p.tags, ' '), CASE p.type WHEN 'free' THEN '자유게시판' WHEN 'question' THEN '질문' WHEN 'guide' THEN '공략' WHEN 'discussion' THEN '토론' END) ILIKE '%' || $4 || '%')
      ORDER BY ${sort === "popular" ? "(COALESCE(l.like_count, 0) + 2 * COALESCE(c.comment_count, 0)) DESC, p.created_at DESC" : "p.created_at DESC"}
      LIMIT 300`, [account?.id || null, gameId, type, query]);
    json(res, 200, { posts: result.rows.map((row) => publicPost(row, account)) });
    return;
  }

  if (parts[0] === "posts" && parts[1] && parts.length === 2) {
    const post = await findPost(parts[1], account?.id || null);
    if (!post || post.deleted_at || (post.hidden && post.author_id !== account?.id)) {
      return error(res, 404, "게시글을 찾을 수 없습니다.");
    }
    if (method === "GET") {
      const comments = await loadComments(post.id, account);
      json(res, 200, { post: publicPost(post, account, comments) });
      return;
    }
    if (method === "PUT") {
      if (!requireAccount(account, res)) return;
      if (post.author_id !== account.id) return error(res, 403, "작성자만 글을 수정할 수 있습니다.");
      const validated = validatePost(await readJson(req));
      if (validated.error) return error(res, 400, validated.error);
      const value = validated.value;
      await pool.query(`UPDATE community_posts SET game_id=$1, type=$2, title=$3, body=$4, tags=$5,
        official=$6, updated_at=now() WHERE id=$7`, [value.gameId, value.type, value.title, value.body, value.tags, value.official, post.id]);
      const updated = await findPost(post.id, account.id);
      json(res, 200, { post: publicPost(updated, account, await loadComments(post.id, account)) });
      return;
    }
    if (method === "DELETE") {
      if (!requireAccount(account, res)) return;
      if (post.author_id !== account.id) return error(res, 403, "작성자만 글을 삭제할 수 있습니다.");
      await pool.query("UPDATE community_posts SET deleted_at=COALESCE(deleted_at, now()) WHERE id=$1", [post.id]);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (path === "/posts" && method === "POST") {
    if (!requireAccount(account, res)) return;
    if (await rateLimited("SELECT count(*)::int AS count FROM community_posts WHERE author_id=$1 AND created_at > now() - interval '10 minutes'", account.id)) {
      return error(res, 429, "글 작성이 잠시 제한되었습니다. 10분 후 다시 작성해 주세요.");
    }
    const validated = validatePost(await readJson(req));
    if (validated.error) return error(res, 400, validated.error);
    const value = validated.value;
    const result = await pool.query(`INSERT INTO community_posts (id, game_id, type, title, body, tags, author_id, official)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [randomUUID(), value.gameId, value.type, value.title, value.body, value.tags, account.id, value.official]);
    const post = await findPost(result.rows[0].id, account.id);
    json(res, 201, { post: publicPost(post, account) });
    return;
  }

  if (parts[0] === "posts" && parts[1] && parts[2] === "comments" && method === "POST") {
    if (!requireAccount(account, res)) return;
    const postId = parts[1];
    const body = safeText((await readJson(req)).body, 1000);
    if (!body) return error(res, 400, "댓글 내용을 입력해 주세요.");
    const client = await pool.connect();
    let comment;
    try {
      await client.query("BEGIN");
      const postResult = await client.query("SELECT id, author_id, game_id, title, hidden, deleted_at FROM community_posts WHERE id=$1 FOR UPDATE", [postId]);
      const post = postResult.rows[0];
      if (!post || post.deleted_at || post.hidden) {
        await client.query("ROLLBACK");
        return error(res, 404, "게시글을 찾을 수 없습니다.");
      }
      const limited = await client.query("SELECT count(*)::int AS count FROM community_comments WHERE author_id=$1 AND created_at > now() - interval '10 minutes'", [account.id]);
      if (Number(limited.rows[0].count) >= 20) {
        await client.query("ROLLBACK");
        return error(res, 429, "댓글 작성이 잠시 제한되었습니다. 10분 후 다시 작성해 주세요.");
      }
      const id = randomUUID();
      const inserted = await client.query(`INSERT INTO community_comments (id, post_id, author_id, body)
        VALUES ($1,$2,$3,$4) RETURNING id, body, created_at`, [id, postId, account.id, body]);
      comment = inserted.rows[0];
      if (post.author_id !== account.id) {
        await client.query(`INSERT INTO community_notifications (id, account_id, kind, post_id, game_id, title, body, actor_name)
          VALUES ($1,$2,'comment',$3,$4,'내 게시글에 댓글이 달렸습니다.',$5,$6)`, [randomUUID(), post.author_id, post.id, post.game_id, body.slice(0, 180), account.display_name]);
        await client.query(`DELETE FROM community_notifications WHERE account_id=$1 AND id IN (
          SELECT id FROM community_notifications WHERE account_id=$1 ORDER BY created_at DESC OFFSET 5000
        )`, [post.author_id]);
      }
      await client.query("COMMIT");
    } catch (cause) {
      await client.query("ROLLBACK");
      throw cause;
    } finally { client.release(); }
    json(res, 201, { comment: {
      id: comment.id, body: comment.body,
      author: { id: account.id, displayName: account.display_name },
      createdAt: asIso(comment.created_at), mine: true,
    } });
    return;
  }

  if (parts[0] === "comments" && parts[1] && method === "DELETE") {
    if (!requireAccount(account, res)) return;
    const result = await pool.query("SELECT author_id FROM community_comments WHERE id=$1 AND deleted_at IS NULL", [parts[1]]);
    const comment = result.rows[0];
    if (!comment) return error(res, 404, "댓글을 찾을 수 없습니다.");
    if (comment.author_id !== account.id) return error(res, 403, "작성자만 댓글을 삭제할 수 있습니다.");
    await pool.query("UPDATE community_comments SET deleted_at=now() WHERE id=$1", [parts[1]]);
    json(res, 200, { ok: true });
    return;
  }

  if (parts[0] === "posts" && parts[1] && parts[2] === "like" && method === "POST") {
    if (!requireAccount(account, res)) return;
    const client = await pool.connect();
    let liked = false;
    let likesCount = 0;
    try {
      await client.query("BEGIN");
      const postResult = await client.query("SELECT id, author_id, game_id, hidden, deleted_at FROM community_posts WHERE id=$1 FOR UPDATE", [parts[1]]);
      const post = postResult.rows[0];
      if (!post || post.deleted_at || post.hidden) {
        await client.query("ROLLBACK");
        return error(res, 404, "게시글을 찾을 수 없습니다.");
      }
      const existing = await client.query("SELECT 1 FROM community_post_likes WHERE post_id=$1 AND account_id=$2", [post.id, account.id]);
      if (existing.rowCount) {
        await client.query("DELETE FROM community_post_likes WHERE post_id=$1 AND account_id=$2", [post.id, account.id]);
      } else {
        await client.query("INSERT INTO community_post_likes (post_id, account_id) VALUES ($1,$2)", [post.id, account.id]);
        liked = true;
        if (post.author_id !== account.id) {
          await client.query(`INSERT INTO community_notifications (id, account_id, kind, post_id, game_id, title, actor_name)
            VALUES ($1,$2,'like',$3,$4,'내 게시글에 좋아요가 달렸습니다.',$5)`, [randomUUID(), post.author_id, post.id, post.game_id, account.display_name]);
          await client.query(`DELETE FROM community_notifications WHERE account_id=$1 AND id IN (
            SELECT id FROM community_notifications WHERE account_id=$1 ORDER BY created_at DESC OFFSET 5000
          )`, [post.author_id]);
        }
      }
      const count = await client.query("SELECT count(*)::int AS count FROM community_post_likes WHERE post_id=$1", [post.id]);
      likesCount = Number(count.rows[0].count);
      await client.query("COMMIT");
    } catch (cause) {
      await client.query("ROLLBACK");
      throw cause;
    } finally { client.release(); }
    json(res, 200, { liked, likesCount });
    return;
  }

  if (parts[0] === "posts" && parts[1] && parts[2] === "reports" && method === "POST") {
    if (!requireAccount(account, res)) return;
    const postResult = await pool.query("SELECT id FROM community_posts WHERE id=$1 AND deleted_at IS NULL", [parts[1]]);
    if (!postResult.rowCount) return error(res, 404, "게시글을 찾을 수 없습니다.");
    const input = await readJson(req);
    const reason = reportReasons.has(input.reason) ? input.reason : "other";
    try {
      await pool.query(`INSERT INTO community_reports (id, post_id, reporter_id, reason, detail)
        VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), parts[1], account.id, reason, safeText(input.detail, 1000)]);
    } catch (cause) {
      if (cause.code === "23505") return error(res, 409, "이미 이 게시글을 신고했습니다.");
      throw cause;
    }
    json(res, 201, { ok: true });
    return;
  }

  if (path === "/admin/reports" && method === "GET") {
    if (!isAdmin(req)) {
      return error(res, process.env.TODAYPATCH_ADMIN_TOKEN ? 403 : 503,
        process.env.TODAYPATCH_ADMIN_TOKEN ? "운영자 권한이 없습니다." : "운영자 검토 기능은 서버에 TODAYPATCH_ADMIN_TOKEN을 설정한 뒤 사용할 수 있습니다.");
    }
    const result = await pool.query(`SELECT r.id, r.post_id, r.reporter_id, r.reason, r.detail, r.created_at, r.reviewed_at, r.decision,
      reporter.display_name AS reporter_name, p.title AS post_title, p.body AS post_body, p.game_id AS post_game_id,
      p.type AS post_type, p.hidden AS post_hidden, p.author_id AS post_author_id, author.display_name AS post_author_name
      FROM community_reports r
      LEFT JOIN community_accounts reporter ON reporter.id=r.reporter_id
      LEFT JOIN community_posts p ON p.id=r.post_id
      LEFT JOIN community_accounts author ON author.id=p.author_id
      ORDER BY r.created_at DESC`);
    json(res, 200, { reports: result.rows.map((row) => ({
      id: row.id, postId: row.post_id, reporterId: row.reporter_id, reason: row.reason, detail: row.detail,
      createdAt: asIso(row.created_at), reviewedAt: asIso(row.reviewed_at), decision: row.decision,
      reporter: { id: row.reporter_id, displayName: row.reporter_name || "알 수 없는 게스트" },
      post: row.post_title === null ? null : {
        id: row.post_id, title: row.post_title, body: row.post_body, gameId: row.post_game_id,
        type: row.post_type, author: { id: row.post_author_id || "", displayName: row.post_author_name || "알 수 없는 게스트" }, hidden: Boolean(row.post_hidden),
      },
    })) });
    return;
  }

  if (parts[0] === "admin" && parts[1] === "reports" && parts[2] && method === "PATCH") {
    if (!isAdmin(req)) {
      return error(res, process.env.TODAYPATCH_ADMIN_TOKEN ? 403 : 503,
        process.env.TODAYPATCH_ADMIN_TOKEN ? "운영자 권한이 없습니다." : "운영자 검토 기능은 서버에 TODAYPATCH_ADMIN_TOKEN을 설정한 뒤 사용할 수 있습니다.");
    }
    const input = await readJson(req);
    if (!["hide", "keep", "restore"].includes(input.decision)) return error(res, 400, "처리 방법을 선택해 주세요.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT id, post_id FROM community_reports WHERE id=$1 FOR UPDATE", [parts[2]]);
      const report = result.rows[0];
      if (!report) {
        await client.query("ROLLBACK");
        return error(res, 404, "신고를 찾을 수 없습니다.");
      }
      if (input.decision !== "keep") {
        await client.query("UPDATE community_posts SET hidden=$1 WHERE id=$2", [input.decision === "hide", report.post_id]);
      }
      await client.query("UPDATE community_reports SET reviewed_at=now(), decision=$1 WHERE id=$2", [input.decision, report.id]);
      await client.query("COMMIT");
    } catch (cause) {
      await client.query("ROLLBACK");
      throw cause;
    } finally { client.release(); }
    json(res, 200, { ok: true });
    return;
  }

  error(res, 404, "API를 찾을 수 없습니다.");
}

module.exports = async function handler(req, res) {
  try {
    if (!databaseUrl) return error(res, 503, "데이터베이스 연결이 설정되지 않았습니다. Vercel에 DATABASE_URL을 등록해 주세요.");
    const route = parseRoute(req);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== "null") {
        try {
          if (new URL(origin).host !== req.headers.host) return error(res, 403, "다른 사이트에서 보낸 요청은 처리할 수 없습니다.");
        } catch { return error(res, 403, "요청 출처를 확인할 수 없습니다."); }
      }
    }
    await ensureSchema();
    const account = await accountForRequest(req);
    await dispatch(req, res, route, account);
  } catch (cause) {
    if (!res.headersSent) error(res, cause.statusCode || 500, cause.statusCode ? cause.message : "요청을 처리하지 못했습니다.");
    else res.destroy();
    if (!cause.statusCode) console.error("Vercel community API error:", cause);
  }
};
