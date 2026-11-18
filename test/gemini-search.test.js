const test = require("node:test");
const assert = require("node:assert/strict");
const { GeminiSearchError, generateSearchIntent } = require("../lib/gemini-search");

test("requires a Gemini API key before making an external request", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      generateSearchIntent("free calculator"),
      (error) => error instanceof GeminiSearchError && error.code === "AI_NOT_CONFIGURED",
    );
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("converts Gemini intent into bounded, validated search terms", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    const request = JSON.parse(options.body);
    assert.match(request.contents[0].parts[0].text, /free graphing calculator/);
    return {
      ok: true,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({
                terms: ["calculator", "graphing", "calculator", "x".repeat(80), 12],
                category: "Study",
                price: "free",
              }) }],
            },
          }],
        };
      },
    };
  };

  try {
    const intent = await generateSearchIntent("free graphing calculator");
    assert.deepEqual(intent, {
      terms: ["calculator", "graphing", "x".repeat(60)],
      category: "Study",
      price: "free",
    });
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("reports provider authentication failures without exposing the API key", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = "private-test-key";
  global.fetch = async () => ({ ok: false, status: 403 });

  try {
    await assert.rejects(
      generateSearchIntent("camera"),
      (error) => error instanceof GeminiSearchError &&
        error.code === "AI_AUTH_FAILED" &&
        !error.message.includes("private-test-key"),
    );
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
