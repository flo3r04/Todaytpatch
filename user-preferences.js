const MAX_PREFERENCES_BYTES = 80 * 1024;
const idPattern = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,119}$/u;

function uniqueStrings(value, limit, maxLength, pattern = null) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && item.length <= maxLength && (!pattern || pattern.test(item))))].slice(0, limit);
}

function sanitizePreferences(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("개인 설정 형식이 올바르지 않습니다.");
    error.statusCode = 400;
    throw error;
  }

  const tasks = {};
  if (input.tasks && typeof input.tasks === "object" && !Array.isArray(input.tasks)) {
    for (const [key, value] of Object.entries(input.tasks).slice(0, 500)) {
      if (idPattern.test(key) && typeof value === "boolean") tasks[key] = value;
    }
  }

  const userPosts = Array.isArray(input.userPosts) ? input.userPosts.slice(0, 100).flatMap((post) => {
    if (!post || typeof post !== "object" || Array.isArray(post)) return [];
    const id = typeof post.id === "string" ? post.id.trim() : "";
    const title = typeof post.title === "string" ? post.title.trim() : "";
    const body = typeof post.body === "string" ? post.body : "";
    const createdAt = typeof post.createdAt === "string" && Number.isFinite(Date.parse(post.createdAt))
      ? post.createdAt
      : "";
    if (!idPattern.test(id) || !title || title.length > 100 || !body.trim() || body.length > 5000 || !createdAt) return [];
    return [{ id, title, body, createdAt }];
  }) : [];

  const preferences = {
    followedGames: uniqueStrings(input.followedGames, 50, 120, idPattern),
    bookmarks: uniqueStrings(input.bookmarks, 2000, 120, idPattern),
    readNews: uniqueStrings(input.readNews, 5000, 120, idPattern),
    tasks,
    userPosts,
    recentSearches: uniqueStrings(input.recentSearches, 5, 80),
    theme: input.theme === "dark" ? "dark" : "light",
    skipTutorial: input.skipTutorial === true,
  };

  if (Buffer.byteLength(JSON.stringify(preferences), "utf8") > MAX_PREFERENCES_BYTES) {
    const error = new Error("개인 설정 데이터가 너무 큽니다. 대시보드의 개인 메모를 정리한 뒤 다시 저장해 주세요.");
    error.statusCode = 413;
    throw error;
  }
  return preferences;
}

module.exports = { sanitizePreferences };
