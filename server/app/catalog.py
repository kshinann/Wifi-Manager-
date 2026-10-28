"""Built-in AI tool catalog, seeded into ai_tools with tenant_id NULL."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AITool

BUILTIN_TOOLS: list[dict] = [
    {"key": "chatgpt", "name": "ChatGPT", "vendor": "OpenAI", "category": "chat",
     "domains": ["chatgpt.com", "chat.openai.com", "sora.com"],
     "processes": {"windows": ["ChatGPT.exe"], "macos": ["ChatGPT"]}},
    {"key": "openai_api", "name": "OpenAI API", "vendor": "OpenAI", "category": "api",
     "domains": ["api.openai.com"], "processes": {}},
    {"key": "claude", "name": "Claude", "vendor": "Anthropic", "category": "chat",
     "domains": ["claude.ai"],
     "processes": {"windows": ["Claude.exe"], "macos": ["Claude"]}},
    {"key": "anthropic_api", "name": "Anthropic API", "vendor": "Anthropic", "category": "api",
     "domains": ["api.anthropic.com"], "processes": {}},
    {"key": "gemini", "name": "Google Gemini", "vendor": "Google", "category": "chat",
     "domains": ["gemini.google.com", "aistudio.google.com", "notebooklm.google.com"], "processes": {}},
    {"key": "gemini_api", "name": "Gemini API", "vendor": "Google", "category": "api",
     "domains": ["generativelanguage.googleapis.com"], "processes": {}},
    {"key": "copilot", "name": "Microsoft Copilot", "vendor": "Microsoft", "category": "chat",
     "domains": ["copilot.microsoft.com", "copilot.cloud.microsoft"],
     "processes": {"windows": ["Copilot.exe", "M365Copilot.exe"], "macos": ["Microsoft Copilot"]}},
    {"key": "github_copilot", "name": "GitHub Copilot", "vendor": "GitHub", "category": "coding",
     "domains": ["api.githubcopilot.com", "copilot-proxy.githubusercontent.com"], "processes": {}},
    {"key": "perplexity", "name": "Perplexity", "vendor": "Perplexity AI", "category": "search",
     "domains": ["perplexity.ai", "api.perplexity.ai"],
     "processes": {"windows": ["Perplexity.exe"], "macos": ["Perplexity"]}},
    {"key": "deepseek", "name": "DeepSeek", "vendor": "DeepSeek", "category": "chat",
     "domains": ["chat.deepseek.com", "api.deepseek.com"], "processes": {}},
    {"key": "grok", "name": "Grok", "vendor": "xAI", "category": "chat",
     "domains": ["grok.com", "api.x.ai"], "processes": {}},
    {"key": "mistral", "name": "Mistral Le Chat", "vendor": "Mistral AI", "category": "chat",
     "domains": ["chat.mistral.ai", "api.mistral.ai"], "processes": {}},
    {"key": "meta_ai", "name": "Meta AI", "vendor": "Meta", "category": "chat",
     "domains": ["meta.ai"], "processes": {}},
    {"key": "qwen", "name": "Qwen Chat", "vendor": "Alibaba", "category": "chat",
     "domains": ["chat.qwen.ai", "dashscope.aliyuncs.com"], "processes": {}},
    {"key": "poe", "name": "Poe", "vendor": "Quora", "category": "chat",
     "domains": ["poe.com"], "processes": {"windows": ["Poe.exe"], "macos": ["Poe"]}},
    {"key": "character_ai", "name": "Character.AI", "vendor": "Character.AI", "category": "chat",
     "domains": ["character.ai"], "processes": {}},
    {"key": "midjourney", "name": "Midjourney", "vendor": "Midjourney", "category": "image",
     "domains": ["midjourney.com"], "processes": {}},
    {"key": "cursor", "name": "Cursor", "vendor": "Anysphere", "category": "coding",
     "domains": ["api2.cursor.sh", "api3.cursor.sh"],
     "processes": {"windows": ["Cursor.exe"], "macos": ["Cursor"]}},
    {"key": "windsurf", "name": "Windsurf", "vendor": "Windsurf", "category": "coding",
     "domains": ["server.codeium.com", "windsurf.com"],
     "processes": {"windows": ["Windsurf.exe"], "macos": ["Windsurf"]}},
    {"key": "ollama", "name": "Ollama (local models)", "vendor": "Ollama", "category": "local",
     "domains": [], "processes": {"windows": ["ollama.exe", "ollama app.exe"], "macos": ["ollama", "Ollama"]}},
    {"key": "lm_studio", "name": "LM Studio (local models)", "vendor": "LM Studio", "category": "local",
     "domains": [], "processes": {"windows": ["LM Studio.exe"], "macos": ["LM Studio"]}},
]


def seed_builtin_tools(db: Session) -> None:
    existing = {t.key: t for t in db.scalars(select(AITool).where(AITool.tenant_id.is_(None)))}
    for spec in BUILTIN_TOOLS:
        row = existing.get(spec["key"])
        if row is None:
            db.add(AITool(tenant_id=None, **spec))
        else:
            # Keep built-ins in sync with code so catalog updates ship with releases.
            for field, value in spec.items():
                setattr(row, field, value)
    db.commit()


def tools_for_tenant(db: Session, tenant_id: str) -> list[AITool]:
    """Built-ins plus tenant-defined tools; a tenant tool overrides a built-in with the same key."""
    rows = db.scalars(
        select(AITool).where((AITool.tenant_id.is_(None)) | (AITool.tenant_id == tenant_id)).order_by(AITool.name)
    ).all()
    merged: dict[str, AITool] = {}
    for row in rows:
        if row.key not in merged or row.tenant_id is not None:
            merged[row.key] = row
    return sorted(merged.values(), key=lambda t: t.name.lower())
