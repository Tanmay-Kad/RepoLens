from google import genai
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
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Summary error for {filename}: {e}")
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
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Onboarding explanation error: {e}")
        return "Read the files in this order to build understanding from the ground up."

async def answer_nl_query(query: str, nodes: list) -> dict:
    try:
        print(f"Processing NL query: {query}")
        print(f"Total nodes available: {len(nodes)}")

        if not nodes:
            return {
                "answer": "No files found in this repository to search through.",
                "relevant_files": []
            }

        files_context = "\n".join([
            f"- {n['id']} ({n.get('node_type', 'unknown')}): {n.get('summary', 'No summary available')}"
            for n in nodes[:60]
        ])

        prompt = f"""You are an expert software engineer helping a developer understand a codebase.

A developer is asking: "{query}"

Here are the files in the codebase with their types and descriptions:
{files_context}

Please provide:
1. A clear, helpful answer to the developer's question based on the files available
2. List the most relevant files that relate to their question

Respond in this exact format:
ANSWER: [Write 2-4 sentences explaining where/how this is handled in the codebase. Be specific about file names.]
FILES: [List the relevant file paths separated by commas. Only include files from the list above.]

If you cannot find relevant files, still provide a helpful answer based on what you can see."""

        print("Calling Gemini API for NL query...")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        text = response.text.strip()
        print(f"Gemini response: {text[:200]}...")

        answer = ""
        relevant_files = []

        if "ANSWER:" in text and "FILES:" in text:
            answer_part = text.split("ANSWER:")[1]
            answer = answer_part.split("FILES:")[0].strip()
            files_part = text.split("FILES:")[1].strip()
            relevant_files = [
                f.strip()
                for f in files_part.split(",")
                if f.strip() and len(f.strip()) > 2
            ]
        elif "ANSWER:" in text:
            answer = text.split("ANSWER:")[1].strip()
        else:
            answer = text

        if not answer:
            answer = "I found some potentially relevant files based on your query. Please check the highlighted files."

        print(f"Answer: {answer[:100]}")
        print(f"Relevant files: {relevant_files}")

        return {
            "answer": answer,
            "relevant_files": relevant_files
        }

    except Exception as e:
        print(f"NL Query error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "answer": f"Error processing query: {str(e)}",
            "relevant_files": []
        }