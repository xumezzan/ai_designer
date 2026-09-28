"""LLM provider interface. Business logic never talks to a vendor SDK directly."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def complete_json(self, system: str, user: str, *, max_tokens: int = 2000) -> dict[str, Any] | None:
        """Return a parsed JSON object, or None if the provider failed."""


class NullProvider(LLMProvider):
    """No LLM configured — the rules engine handles everything."""

    name = "rules"

    def complete_json(self, system: str, user: str, *, max_tokens: int = 2000):
        return None
