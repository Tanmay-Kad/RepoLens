import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize in each function or dynamically check so env vars are picked up if they changed?
// Wait, we can just instantiate it globally since dotenv/config is now at the top of server.js
const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateFileSummary = async ({ fileName, dependencies, dependents, repoUrl }) => {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Format array if it comes as an array, else just string
  const depsStr = Array.isArray(dependencies) ? dependencies.join(', ') : dependencies;
  const dependentsStr = Array.isArray(dependents) ? dependents.join(', ') : dependents;

  const prompt = `You are a senior software architect analyzing a codebase.

Analyze this file from a GitHub repository and provide a concise technical summary.

File: ${fileName}
Repository: ${repoUrl}
Dependencies (files this imports): ${depsStr || 'None'}
Dependents (files that import this): ${dependentsStr || 'None'}

Respond in exactly this JSON format with no markdown or extra text:
{
  "purpose": "One sentence describing what this file does.",
  "importance": "One sentence explaining why this file matters in the codebase.",
  "riskIfChanged": "Explain exactly what downstream systems or specific dependent files will break if this file is modified."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
};

export const searchFilesWithAI = async ({ query, nodes }) => {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Pass max 200 nodes to avoid massive token usage, or just pass all if small.
  // We'll pass the node IDs (file paths)
  const nodePaths = nodes.map(n => n.id).join('\\n');

  const prompt = `You are a codebase expert. 
A user is searching the repository with this query: "${query}"

Here is the list of files in the repository:
${nodePaths}

Identify which files are most likely relevant to the user's query. Return ONLY a JSON array of exact file paths from the list above. Return maximum 10 paths.
Example: ["src/auth/login.js", "src/models/User.js"]
No markdown, no extra text, just the JSON array.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
};
