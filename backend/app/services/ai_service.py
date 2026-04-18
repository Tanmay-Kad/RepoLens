from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY
from app.services.parser_service import read_file_content

client = genai.Client(api_key=GEMINI_API_KEY)

async def generate_file_summary(file_path: str, filename: str, node_type: str) -> str:
    try:
        content = read_file_content(file_path)
        if not content.strip():
            return "This file appears to be empty."

        prompt = f"""You are a senior software engineer explaining code to a new developer.
Analyze this {filename} file and write a 2-3 sentence plain English summary.
Explain: what this file does, why it exists, and what would break if it were removed.
Be concise and clear. No technical jargon.

File content:
{content}

Summary:"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        return f"This is a {node_type} file named {filename}."

async def generate_onboarding_explanation(onboarding_path: list) -> str:
    try:
        files_list = "\n".join(
            [f"{i+1}. {f}" for i, f in enumerate(onboarding_path)]
        )
        prompt = f"""You are a senior engineer onboarding a new developer.
Given this ordered list of files to read, write a brief 3-4 sentence explanation
of WHY this reading order makes sense and what the developer will understand
after reading them in this sequence.

Files in order:
{files_list}

Explanation:"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        return "Read the files in this order to build understanding from the ground up."

async def answer_nl_query(query: str, nodes: list) -> dict:
    try:
        files_context = "\n".join([
            f"- {n['id']} ({n['node_type']}): {n.get('summary', 'No summary')}"
            for n in nodes[:50]
        ])

        prompt = f"""You are a codebase expert. A developer asks: "{query}"

Here are the files in the codebase with their summaries:
{files_context}

Answer the question and list the most relevant file paths that answer it.
Format your response as:
ANSWER: [your explanation in 2-3 sentences]
FILES: [comma separated list of relevant file paths]"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        text = response.text.strip()

        answer = ""
        relevant_files = []

        if "ANSWER:" in text:
            answer_part = text.split("ANSWER:")[1]
            if "FILES:" in answer_part:
                answer = answer_part.split("FILES:")[0].strip()
                files_part = answer_part.split("FILES:")[1].strip()
                relevant_files = [
                    f.strip() for f in files_part.split(",")
                    if f.strip()
                ]
            else:
                answer = answer_part.strip()
        else:
            answer = text

        return {
            "answer": answer,
            "relevant_files": relevant_files
        }
    except Exception as e:
        return {
            "answer": "Could not process query.",
            "relevant_files": []
        }