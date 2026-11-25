const candidateModels = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50000) {
        reject(new Error("요청 본문 용량 초과"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function callGemini(question, facts, sources) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
    error.status = 503;
    error.code = "GEMINI_API_KEY_NOT_CONFIGURED";
    throw error;
  }

  const factsText = facts && facts.length
    ? facts.map((f, i) => `${i + 1}. ${typeof f === "string" ? f : f.text || ""}`).join("\n")
    : "관련 공지 내용 없음";

  const sourcesText = sources && sources.length
    ? sources.map((s) => `- ${s.title || ""}`).join("\n")
    : "";

  const systemInstruction = `당신은 게임 '오늘의 패치'의 공지 전문 AI 어시스턴트입니다.
사용자의 질문에 대해 아래 제공된 [공지 근거 자료]를 바탕으로 게이머에게 정확하고 친절하며 명확하게 답변해 주세요.
근거 자료에 나온 사실만을 바탕으로 답변하고, 자료에 없는 내용을 추측하거나 지어내지 마세요.
핵심 내용(날짜, 시간, 보상, 조건, 수령 방법 등)을 2~4문장으로 알기 쉽게 요약하여 설명하세요.
공지 자료에 질문과 관련된 내용이 전혀 없다면 해당 공지에 관련 안내가 없음을 정중히 알리세요.`;

  const userContent = `[공지 근거 자료]
${factsText}
${sourcesText ? `\n[참고 출처]\n${sourcesText}` : ""}

[사용자 질문]
${question}`;

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API HTTP ${response.status}: ${errorText.slice(0, 300)}`);
      }

      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text)
        .join("")
        .trim();

      if (text) {
        return { answer: text, model };
      }
    } catch (err) {
      lastError = err;
      console.warn(`모델 ${model} 호출 실패, 다음 모델로 대체 시도:`, err.message);
    }
  }

  throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
  }

  try {
    const payload = await parseJsonBody(req);
    const question = String(payload.question || "").trim();
    if (!question) {
      return sendJson(res, 400, { error: "질문 내용이 필요합니다." });
    }
    if (question.length > 300) {
      return sendJson(res, 400, { error: "질문은 300자 이내로 입력해 주세요." });
    }

    const facts = Array.isArray(payload.context?.facts) ? payload.context.facts : [];
    const sources = Array.isArray(payload.context?.sources) ? payload.context.sources : [];

    const { answer, model } = await callGemini(question, facts, sources);
    return sendJson(res, 200, { ok: true, answer, model });
  } catch (err) {
    const status = err.status || 500;
    return sendJson(res, status, { error: err.message, code: err.code || "AI_CHAT_ERROR" });
  }
};
