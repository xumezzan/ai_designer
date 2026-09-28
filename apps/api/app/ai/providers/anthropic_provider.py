from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-latest"):
        self.api_key, self.model = api_key, model

    def complete_json(self, system: str, user: str, *, max_tokens: int = 2000) -> dict[str, Any] | None:
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system + "\nRespond with a single JSON object and nothing else.",
                    "messages": [{"role": "user", "content": user}],
                },
                timeout=60,
            )
            r.raise_for_status()
            text = "".join(b.get("text", "") for b in r.json()["content"])
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else None
        except Exception:
            return None
