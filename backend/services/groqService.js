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

export const queryCodebaseAI = async ({ query, fileManifest }) => {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const prompt = `You are a Senior Software Architect assisting a user in navigating a large codebase.

The user is asking a natural language question about the architecture:
"QUESTION: ${query}"

Here is the flat array manifest of all physical files parsed in the repository:
${JSON.stringify(fileManifest, null, 2)}

Your task is to identify up to 5 files from the manifest that are MOST LIKELY to contain the logic or architectural module the user is searching for, based on naming conventions and standard architectural patterns.

Respond strictly in this JSON format with no markdown wrappers or extra text:
{
  "matches": [
    {
      "file": "exact/path/from/manifest.js",
      "reason": "One specific sentence explaining why this file likely handles the requested logic."
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are an explicit architectural search engine returning valid JSON mapping arrays.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content.trim();
  return JSON.parse(content);
};

export const chatWithCodebaseAI = async ({ messages, fileManifest }) => {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const systemPrompt = `You are a Senior Software Architect assisting a developer. 
You are having a direct conversation with them. 

Here is the flat array manifest of all physical files parsed in their repository:
${JSON.stringify(fileManifest, null, 2)}

Your task is to answer their questions accurately about the codebase. 
If they ask where a feature is located (like "where is the login feature implemented"), identify the file paths from the manifest and explicitly name them. Answer in pure text format (markdown is okay, e.g., using backticks for file names). Keep responses concise, direct, and conversational. Do not output JSON.`;

  const backendMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: backendMessages,
    temperature: 0.3,
  });

  return response.choices[0].message.content.trim();
};

export const generateOnboardingReasons = async (orderedFiles) => {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const prompt = `You are a Senior Software Architect assigning an onboarding sequence to a new developer. 
I have topologically analyzed the codebase and determined the following optimal reading order for the files:
${JSON.stringify(orderedFiles, null, 2)}

For each file in the sequence, write a highly descriptive short paragraph explaining strictly WHY the developer should read this file next, referencing its structural category (e.g., Entry Point, Utility). Assign an "Estimated Importance" (High, Medium, Low) and "Learning Time Minutes" (integer 5 to 30) for each.

Respond strictly in this JSON format inside an array of "steps":
{
  "steps": [
    {
      "file": "path/name.js",
      "reason": "String explaining why they should read it.",
      "importance": "High",
      "timeMinutes": 10
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You calculate structural architectural logic. Output valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content.trim();
  return JSON.parse(content);
};
