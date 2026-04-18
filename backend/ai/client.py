from __future__ import annotations

from functools import lru_cache

import google.generativeai as genai

from config import get_settings


@lru_cache(maxsize=1)
def get_gemini_model() -> genai.GenerativeModel | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-1.5-flash")
