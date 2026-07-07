import os
from dotenv import load_dotenv

load_dotenv()

SUPPORTED_PROVIDERS = ["gemini", "groq", "claude"]
DEFAULT_PROVIDER    = "groq"

LABELS = {"gemini": "Gemini", "groq": "Groq", "claude": "Claude"}

def _check_key(env_var: str, provider: str) -> str:
    key = os.getenv(env_var, "").strip()
    if not key:
        raise ValueError(
            f"{provider} is not configured. "
            f"Add {env_var} to your .env to enable it."
        )
    return key

def _friendly_error(provider: str, e: Exception) -> str:
    """Turn a provider SDK exception into one short human sentence instead of
    dumping the raw multi-line API error into the UI."""
    name = LABELS.get(provider, provider.title())
    msg = str(e)
    low = msg.lower()
    if "429" in low or "quota" in low or "rate limit" in low or "rate_limit" in low:
        return (f"{name}'s free-tier limit is used up right now. "
                f"Switch to another provider (Groq is free) or try again shortly.")
    if "401" in low or "unauthorized" in low or "api key" in low or "api_key" in low:
        return f"{name} rejected the API key — check it in your environment."
    if "404" in low or "not found" in low:
        return f"{name}'s model is unavailable. It may have been retired."
    first = msg.strip().splitlines()[0] if msg.strip() else "unknown error"
    return f"{name} request failed: {first[:160]}"

def call_llm(prompt: str, provider: str = DEFAULT_PROVIDER,
             max_tokens: int = 500) -> str:
    """
    Single entry point for all LLM calls.
    provider: "gemini" | "groq" | "claude"
    Raises ValueError if the provider's API key is not configured, or
    RuntimeError with a short readable message on any API failure.
    """
    provider = provider.lower()
    try:
        return _dispatch(provider, prompt, max_tokens)
    except ValueError:
        raise  # not-configured / unknown provider — keep the specific message
    except Exception as e:
        raise RuntimeError(_friendly_error(provider, e))

def _dispatch(provider: str, prompt: str, max_tokens: int) -> str:
    if provider == "gemini":
        import google.generativeai as genai
        key = _check_key("GEMINI_API_KEY", "Gemini")
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip()

    elif provider == "groq":
        from groq import Groq
        key = _check_key("GROQ_API_KEY", "Groq")
        client = Groq(api_key=key)
        msg = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens
        )
        return msg.choices[0].message.content.strip()

    elif provider == "claude":
        import anthropic
        key = _check_key("ANTHROPIC_API_KEY", "Claude")
        client = anthropic.Anthropic(api_key=key)
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text.strip()

    else:
        raise ValueError(
            f"Unknown provider '{provider}'. "
            f"Supported: {SUPPORTED_PROVIDERS}"
        )
