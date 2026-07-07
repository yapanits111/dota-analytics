import os
from dotenv import load_dotenv

load_dotenv()

SUPPORTED_PROVIDERS = ["gemini", "groq", "claude"]
DEFAULT_PROVIDER    = "gemini"

def _check_key(env_var: str, provider: str) -> str:
    key = os.getenv(env_var, "").strip()
    if not key:
        raise ValueError(
            f"{provider} is not configured. "
            f"Add {env_var} to your .env to enable it."
        )
    return key

def call_llm(prompt: str, provider: str = DEFAULT_PROVIDER,
             max_tokens: int = 500) -> str:
    """
    Single entry point for all LLM calls.
    provider: "gemini" | "groq" | "claude"
    Raises ValueError if the provider's API key is not configured.
    """
    provider = provider.lower()

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
