"""Text translation engines."""
import threading

from .. import hardware, languages

SYSTEM_PROMPT = (
    "You are a live interpreter for a meeting. Translate the user's text from {src} to {tgt}. "
    "The text is a speech-recognition transcript, so fix obvious recognition slips silently. "
    "Keep names, numbers and meaning exact, use natural spoken {tgt}, and reply with the "
    "translation only - no notes, quotes or explanations. If the text is empty or only noise, "
    "reply with nothing."
)


def _system(src, tgt, glossary):
    prompt = SYSTEM_PROMPT.format(src=languages.name(src), tgt=languages.name(tgt))
    if glossary.strip():
        prompt += "\nAlways use this glossary (source = target):\n" + glossary.strip()
    return prompt


class LocalNLLBTranslator:
    """Meta NLLB-200 via Hugging Face transformers, running on this PC."""

    def __init__(self, cfg):
        self.model_name = cfg["local"]["nllb_model"]
        self.device = hardware.resolve_device(cfg["local"].get("device", "auto"))
        self._tok = self._model = None
        self._lock = threading.Lock()

    @property
    def label(self):
        return f"NLLB {self.model_name.split('/')[-1]} ({self.device.upper()}, built-in)"

    def load(self):
        with self._lock:
            if self._model is None:
                import torch
                from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
                self._tok = AutoTokenizer.from_pretrained(self.model_name)
                if self.device == "cuda" and not torch.cuda.is_available():
                    print("[translate] CUDA PyTorch not installed; using CPU (run upgrade-to-gpu.bat).")
                    self.device = "cpu"
                if self.device == "cpu":
                    torch.set_num_threads(hardware.cpu_threads())
                dtype = torch.float16 if self.device == "cuda" else torch.float32
                self._model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name, torch_dtype=dtype)
                self._model.to(self.device).eval()
        return self

    def translate(self, text, src, tgt):
        if not text.strip() or src == tgt:
            return text
        self.load()
        import torch
        with self._lock:
            self._tok.src_lang = languages.LANGUAGES[src]["nllb"]
            batch = self._tok(text, return_tensors="pt", truncation=True, max_length=400).to(self.device)
            tgt_id = self._tok.convert_tokens_to_ids(languages.LANGUAGES[tgt]["nllb"])
            with torch.inference_mode():
                out = self._model.generate(**batch, forced_bos_token_id=tgt_id, max_new_tokens=400,
                                           num_beams=4 if self.device == "cuda" else 2)  # 2 beams: faster on CPU
            return self._tok.batch_decode(out, skip_special_tokens=True)[0].strip()


class OpenAITranslator:
    def __init__(self, cfg):
        self.key = cfg["api_keys"].get("openai")
        if not self.key:
            raise ValueError("OpenAI API key is not set (Settings → API keys).")
        self.model = cfg["cloud"]["openai_translate_model"]
        self.glossary = cfg.get("glossary", "")
        self._client = None

    @property
    def label(self):
        return f"OpenAI {self.model}"

    def load(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.key)
        return self

    def translate(self, text, src, tgt):
        if not text.strip() or src == tgt:
            return text
        self.load()
        r = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": _system(src, tgt, self.glossary)},
                      {"role": "user", "content": text}])
        return (r.choices[0].message.content or "").strip()


class ClaudeTranslator:
    """Anthropic Claude via the official `anthropic` Python SDK."""

    def __init__(self, cfg):
        self.key = cfg["api_keys"].get("anthropic")
        if not self.key:
            raise ValueError("Anthropic API key is not set (Settings → API keys).")
        self.model = cfg["cloud"].get("claude_model") or "claude-opus-5-5"
        self.effort = cfg["cloud"].get("claude_effort") or "low"
        self.glossary = cfg.get("glossary", "")
        self._client = None

    @property
    def label(self):
        return f"Claude {self.model} (effort {self.effort})"

    def load(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic(api_key=self.key)
        return self

    def translate(self, text, src, tgt):
        if not text.strip() or src == tgt:
            return text
        self.load()
        # Server-side fallbacks: if a safety classifier declines, the API retries on
        # Anthropic's recommended fallback model inside the same call.
        response = self._client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            system=_system(src, tgt, self.glossary),
            messages=[{"role": "user", "content": text}],
            output_config={"effort": self.effort},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("Claude declined to translate this segment.")
        return "".join(b.text for b in response.content if b.type == "text").strip()


def build(cfg):
    kind = cfg["engines"]["translate"]
    if kind == "openai":
        return OpenAITranslator(cfg)
    if kind == "claude":
        return ClaudeTranslator(cfg)
    return LocalNLLBTranslator(cfg)
