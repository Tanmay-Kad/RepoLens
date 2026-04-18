import { GoogleGenerativeAI } from '@google/generative-ai';

export const generateFileSummary = async ({ fileName, dependencies, dependents, repoUrl }) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a senior software architect analyzing a codebase.

Analyze this file from a GitHub repository and provide a concise technical summary.

File: ${fileName}
Repository: ${repoUrl}
Dependencies (files this imports): ${dependencies}
Dependents (files that import this): ${dependents}

Respond in exactly this JSON format with no markdown or extra text:
{
  "purpose": "One sentence describing what this file does.",
  "importance": "One sentence explaining why this file matters in the codebase.",
  "riskIfChanged": "One sentence describing what might break if this file is modified."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown fences if present
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
};
