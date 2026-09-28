from __future__ import annotations

import json
from typing import Any

import httpx

from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com/v1"):
        self.api_key, self.model, self.base_url = api_key, model, base_url

    def complete_json(self, system: str, user: str, *, max_tokens: int = 2000) -> dict[str, Any] | None:
        try:
            r = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": 0.4,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                },
                timeout=60,
            )
            r.raise_for_status()
            return json.loads(r.json()["choices"][0]["message"]["content"])
        except Exception:
            return None
