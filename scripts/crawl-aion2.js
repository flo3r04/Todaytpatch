const fs = require("node:fs/promises");
const path = require("node:path");

const feedUrl = "https://api-community.plaync.com/aion2/board/update_ko/article/search/moreArticle?moreSize=30&moreDirection=BEFORE";
const dataPath = path.join(__dirname, "..", "data", "aion2.js");

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

async function crawlLatestPatch() {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/json",
      Origin: "https://aion2.plaync.com",
      Referer: "https://aion2.plaync.com/ko-kr/board/update/list",
      "User-Agent": "Todaypatch/1.0 (official update date crawler)",
    },
  });
  if (!response.ok) throw new Error(`공식 업데이트 게시판 응답 오류: HTTP ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload.contentList)) throw new Error("공식 업데이트 게시판 응답 형식이 올바르지 않습니다.");

  const article = payload.contentList.find((item) => /(?:업데이트|패치)\s*노트/.test(item.title || ""));
  if (!article) throw new Error("최신 업데이트 노트를 찾지 못했습니다.");

  const postedAt = article.timestamps?.postedAt || article.timestamps?.publishedAt;
  if (!postedAt) throw new Error("업데이트 노트 게시일이 없습니다.");

  const urlPattern = article.rootBoard?.board?.boardUrlPattern;
  const url = urlPattern
    ? urlPattern.replace("{articleId}", encodeURIComponent(article.id))
    : `https://aion2.plaync.com/ko-kr/board/update/view?articleId=${encodeURIComponent(article.id)}`;

  return {
    lastPatchDate: formatKoreanDate(postedAt),
    title: article.title,
    url,
    postedAt,
    crawledAt: new Date().toISOString(),
  };
}

async function main() {
  const latestPatch = await crawlLatestPatch();
  const generatedData = `window.todaypatchGameData = ${JSON.stringify({ aion2: latestPatch }, null, 2)};\n`;
  await fs.writeFile(dataPath, generatedData, "utf8");
  console.log(`아이온2 최근 패치 날짜 갱신: ${latestPatch.lastPatchDate}`);
}

main().catch((error) => {
  console.error(`아이온2 크롤링 실패: ${error.message}`);
  process.exitCode = 1;
});
