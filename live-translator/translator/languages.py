"""Language catalogue shared by every engine.

Each entry maps our short language code to the code/voice each engine expects.
English, Mandarin and Malay are the primary languages; the rest are extras.
"""

LANGUAGES = {
    "en": {"name": "English", "whisper": "en", "nllb": "eng_Latn",
           "edge_voice": "en-US-JennyNeural", "sapi_hint": ["en", "english", "zira", "david"]},
    "zh": {"name": "Mandarin Chinese (简体中文)", "whisper": "zh", "nllb": "zho_Hans",
           "edge_voice": "zh-CN-XiaoxiaoNeural", "sapi_hint": ["zh", "chinese", "huihui", "kangkang", "yaoyao"]},
    "ms": {"name": "Bahasa Melayu", "whisper": "ms", "nllb": "zsm_Latn",
           "edge_voice": "ms-MY-YasminNeural", "sapi_hint": ["ms", "malay", "rizwan"]},
    "ta": {"name": "Tamil (தமிழ்)", "whisper": "ta", "nllb": "tam_Taml",
           "edge_voice": "ta-IN-PallaviNeural", "sapi_hint": ["ta", "tamil", "valluvar"]},
    "id": {"name": "Bahasa Indonesia", "whisper": "id", "nllb": "ind_Latn",
           "edge_voice": "id-ID-GadisNeural", "sapi_hint": ["id", "indonesian", "andika"]},
    "ja": {"name": "Japanese (日本語)", "whisper": "ja", "nllb": "jpn_Jpan",
           "edge_voice": "ja-JP-NanamiNeural", "sapi_hint": ["ja", "japanese", "haruka", "ayumi"]},
    "ko": {"name": "Korean (한국어)", "whisper": "ko", "nllb": "kor_Hang",
           "edge_voice": "ko-KR-SunHiNeural", "sapi_hint": ["ko", "korean", "heami"]},
    "ar": {"name": "Arabic (العربية)", "whisper": "ar", "nllb": "arb_Arab",
           "edge_voice": "ar-SA-ZariyahNeural", "sapi_hint": ["ar", "arabic", "hoda"]},
    "fr": {"name": "French", "whisper": "fr", "nllb": "fra_Latn",
           "edge_voice": "fr-FR-DeniseNeural", "sapi_hint": ["fr", "french", "hortense"]},
    "es": {"name": "Spanish", "whisper": "es", "nllb": "spa_Latn",
           "edge_voice": "es-ES-ElviraNeural", "sapi_hint": ["es", "spanish", "helena"]},
}

# Whisper sometimes reports these codes; fold them into our catalogue.
_ALIASES = {"zh-cn": "zh", "zh-tw": "zh", "cmn": "zh", "yue": "zh", "chinese": "zh",
            "english": "en", "malay": "ms", "may": "ms", "zsm": "ms"}


def normalize(code):
    """Return our language code for an engine-reported code (or None)."""
    if not code:
        return None
    c = str(code).strip().lower()
    c = _ALIASES.get(c, c)
    return c if c in LANGUAGES else None


def name(code):
    return LANGUAGES.get(code, {}).get("name", code)


def catalogue(allowed=None):
    return [{"code": k, "name": v["name"], "voice": v["edge_voice"]} for k, v in LANGUAGES.items()
            if not allowed or k in allowed]
