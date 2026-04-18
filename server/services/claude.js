const { GoogleGenerativeAI } = require("@google/generative-ai");
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: MODEL });
}

async function summarizeFile({ filename, fileContent }) {
  const client = getClient();
  if (!client) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const prompt = `You are a code analyst. In exactly 2-3 sentences, explain what this file does and why it matters to the codebase. Be specific and technical. File: ${filename}\n\nCode:\n${fileContent.slice(0, 15000)}`;

  const result = await client.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 220
    }
  });
  const text = result.response.text();
  return (text || "Summary unavailable").trim();
}

async function searchRelevantFiles({ query, fileList }) {
  const client = getClient();
  if (!client) {
    return [];
  }

  const prompt = `You are analyzing a codebase. Given this list of files and their descriptions, return ONLY a JSON array of file IDs that are most relevant to the query. Return max 10 files. No explanation, just the JSON array.\n\nQuery: ${query}\n\nFiles:\n${JSON.stringify(fileList).slice(0, 60000)}`;
  const result = await client.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 300
    }
  });
  const text = result.response.text();
  if (!text) return [];

  try {
    const cleaned = text.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10);
  } catch (_error) {
    return [];
  }
}

module.exports = { summarizeFile, searchRelevantFiles };
