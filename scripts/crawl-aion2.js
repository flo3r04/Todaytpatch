const fs = require("node:fs/promises");
const path = require("node:path");

const apiBase = "https://api-community.plaync.com/aion2";
const dataPath = path.join(__dirname, "..", "data", "aion2.js");
const itemsPerBoard = 10;
const boards = [
  {
    key: "notice",
    alias: "notice_ko",
    category: "공지",
    source: "아이온2 공식 공지",
    pageUrl: "https://aion2.plaync.com/ko-kr/board/notice/list",
    viewPath: "notice",
  },
  {
    key: "update",
    alias: "update_ko",
    category: "업데이트",
    source: "아이온2 공식 업데이트",
    pageUrl: "https://aion2.plaync.com/ko-kr/board/update/list",
    viewPath: "update",
  },
  {
    key: "cm-story",
    alias: "cm_story_ko",
    category: "CM 이야기",
    source: "아이온2 공식 CM 이야기",
    pageUrl: "https://aion2.plaync.com/ko-kr/board/cm_story/list",
    viewPath: "cm_story",
  },
];

function formatKoreanDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("게시일을 읽을 수 없습니다.");

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}. ${part("month")}. ${part("day")}.`;
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

function htmlToText(html) {
  const text = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(?:div|p|li|tr|table|h[1-6]|blockquote|section)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0|\u200b/g, " ")
    .replace(/[\t ]*\n[\t ]*/g, "\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return decodeHtmlEntities(text);
}

function makeExcerpt(bodyText, fallback) {
  const paragraphs = bodyText
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 18)
    .filter((paragraph) => !/^(?:안녕하세요|AION2\s*[–-]|아이온2입니다)/i.test(paragraph));
  const excerpt = (paragraphs[0] || fallback || bodyText).replace(/\s+/g, " ").trim();
  return excerpt.length > 180 ? `${excerpt.slice(0, 177).trimEnd()}…` : excerpt;
}

async function fetchJson(url, referer) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Origin: "https://aion2.plaync.com",
      Referer: referer,
      "User-Agent": "Todaypatch/1.0 (AION2 official board crawler)",
    },
  });
  if (!response.ok) throw new Error(`공식 게시판 응답 오류: HTTP ${response.status} (${url})`);
  return response.json();
}

async function crawlBoard(board) {
  const listUrl = `${apiBase}/board/${board.alias}/article/search/moreArticle?moreSize=30&moreDirection=BEFORE`;
  const payload = await fetchJson(listUrl, board.pageUrl);
  if (!Array.isArray(payload.contentList) || payload.contentList.length === 0) {
    throw new Error(`${board.category} 게시판에서 게시물을 찾지 못했습니다.`);
  }

  return payload.contentList.slice(0, itemsPerBoard).map((article) => ({ article, board }));
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function crawlArticle({ article, board }) {
  const detailUrl = `${apiBase}/board/${board.alias}/article/${encodeURIComponent(article.id)}`;
  const detail = await fetchJson(detailUrl, board.pageUrl);
  const detailArticle = detail.article || {};
  const bodyHtml = detailArticle.content?.content || "";
  const bodyText = htmlToText(bodyHtml);
  const timestamps = detailArticle.contentMeta?.timestamps || article.timestamps || {};
  const postedAt = timestamps.postedAt || timestamps.publishedAt;
  if (!postedAt) throw new Error(`${article.title || article.id} 게시일을 읽을 수 없습니다.`);

  const boardUrlPattern = detail.rootBoard?.board?.boardUrlPattern
    || article.rootBoard?.board?.boardUrlPattern;
  const url = boardUrlPattern
    ? boardUrlPattern.replace("{articleId}", encodeURIComponent(article.id))
    : `https://aion2.plaync.com/ko-kr/board/${board.viewPath}/view?articleId=${encodeURIComponent(article.id)}`;
  const updatedAt = timestamps.updatedAt || timestamps.updateDateTime || null;

  return {
    id: `${board.key}-${article.id}`,
    sourceKey: board.key,
    category: board.category,
    source: board.source,
    title: article.title || detailArticle.contentMeta?.title || "제목 없음",
    excerpt: makeExcerpt(bodyText, article.summary),
    bodyText,
    url,
    postedAt,
    updatedAt: updatedAt || null,
    date: formatKoreanDate(postedAt),
    meta: `${formatKoreanDate(postedAt)} 게시`,
  };
}

async function main() {
  const boardArticles = (await Promise.all(boards.map(crawlBoard))).flat();
  const newsItems = await mapWithConcurrency(boardArticles, 4, crawlArticle);
  newsItems.sort((left, right) => new Date(right.postedAt) - new Date(left.postedAt));

  const latestPatch = newsItems.find((item) => item.sourceKey === "update" && /(?:업데이트|패치)\s*노트/.test(item.title));
  if (!latestPatch) throw new Error("최신 업데이트 노트를 찾지 못했습니다.");

  const output = {
    aion2: {
      lastPatchDate: latestPatch.date,
      crawledAt: new Date().toISOString(),
      sources: boards.map(({ key, category, pageUrl }) => ({ key, category, pageUrl })),
      newsItems,
    },
  };
  const generatedData = `window.todaypatchGameData = ${JSON.stringify(output, null, 2)};\n`;
  await fs.writeFile(dataPath, generatedData, "utf8");
  console.log(`아이온2 크롤링 완료: 공지 ${newsItems.filter((item) => item.sourceKey === "notice").length}건, 업데이트 ${newsItems.filter((item) => item.sourceKey === "update").length}건, CM 이야기 ${newsItems.filter((item) => item.sourceKey === "cm-story").length}건`);
  console.log(`최근 패치 날짜: ${latestPatch.date}`);
}

main().catch((error) => {
  console.error(`아이온2 크롤링 실패: ${error.message}`);
  process.exitCode = 1;
});
