from app.core.config import get_settings
from .base import LLMProvider, NullProvider


def get_provider() -> LLMProvider:
    s = get_settings()
    if s.ai_provider == "openai" and s.openai_api_key:
        from .openai_provider import OpenAIProvider

        return OpenAIProvider(s.openai_api_key, s.openai_model)
    if s.ai_provider == "anthropic" and s.anthropic_api_key:
        from .anthropic_provider import AnthropicProvider

        return AnthropicProvider(s.anthropic_api_key, s.anthropic_model)
    return NullProvider()
