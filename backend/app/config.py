import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGODB_URI = os.getenv("MONGODB_URI")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

SUPPORTED_LANGUAGES = ["python", "javascript", "typescript"]

TEMP_REPO_PATH = "temp_repos"

NODE_TYPES = {
    "entry": ["main.py", "app.py", "index.py", "server.py", "run.py",
              "main.js", "index.js", "app.js", "server.js", "main.ts",
              "index.ts", "app.ts", "server.ts"],
    "config": ["config.py", "settings.py", "constants.py", "config.js",
               "settings.js", "constants.js", ".env", "config.ts"],
    "external": ["requests", "axios", "boto3", "stripe", "twilio",
                 "sendgrid", "firebase", "supabase", "openai", "gemini"],
    "utility": ["utils", "helpers", "common", "shared", "tools",
                "util", "helper", "lib", "libs"],
    "business": []
}