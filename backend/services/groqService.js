import OpenAI from 'openai';

export const generateFileSummary = async ({ fileName, dependencies, dependents, repoUrl, codeContent }) => {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const prompt = `You are a senior software architect analyzing a codebase.

Analyze this file logic from a GitHub repository and provide a concise technical summary.

File: ${fileName}
Repository: ${repoUrl}
Dependencies: ${dependencies}
Dependents: ${dependents}

SOURCE CODE:
${codeContent}

Respond in exactly this JSON format with no markdown or extra text:
{
  "purpose": "One sentence describing what this code logic actually does.",
  "importance": "One sentence explaining why this logic matters in the overall architecture.",
  "riskIfChanged": "One sentence describing what logic might break or which dependencies might be affected if modified."
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a technical architect that outputs only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content.trim();
  return JSON.parse(content);
};
