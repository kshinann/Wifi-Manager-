"""Text-to-speech engines. Output: (mono float32 samples, sample_rate)."""
import asyncio
import os
import tempfile
import threading

from .. import languages
from ..audio_utils import decode_audio


class EdgeTTS:
    """Microsoft Edge neural voices via `edge-tts`: free, no key, needs internet.
    Excellent Mandarin (zh-CN-XiaoxiaoNeural / YunxiNeural) and Malay voices."""

    label = "Edge neural voices (free, online)"

    def load(self):
        import edge_tts  # noqa: F401
        return self

    def synthesize(self, text, lang, voice=""):
        import edge_tts
        voice = voice or languages.LANGUAGES[lang]["edge_voice"]

        async def run():
            audio = bytearray()
            async for chunk in edge_tts.Communicate(text, voice).stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
            return bytes(audio)

        return decode_audio(asyncio.run(run()))


class LocalSAPITTS:
    """Windows built-in voices (offline) via pyttsx3.
    For Mandarin, install the Chinese (Simplified) speech pack in Windows Settings →
    Time & Language → Speech."""

    label = "Windows voices (offline, built-in)"
    _lock = threading.Lock()  # pyttsx3 is not thread-safe

    def load(self):
        import pyttsx3  # noqa: F401
        return self

    def _pick_voice(self, engine, lang, wanted):
        voices = engine.getProperty("voices")
        if wanted:
            for v in voices:
                if wanted.lower() in (v.id + " " + v.name).lower():
                    return v.id
        hints = languages.LANGUAGES[lang]["sapi_hint"]
        for v in voices:
            blob = " ".join([v.id, v.name] + [str(x) for x in (getattr(v, "languages", None) or [])]).lower()
            if any(h in blob for h in hints):
                return v.id
        raise RuntimeError(f"No Windows voice installed for {languages.name(lang)}. "
                           "Add the speech pack in Windows Settings, or use Edge/OpenAI voices.")

    def synthesize(self, text, lang, voice=""):
        import pyttsx3
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            with self._lock:
                engine = pyttsx3.init()
                engine.setProperty("voice", self._pick_voice(engine, lang, voice))
                engine.save_to_file(text, path)
                engine.runAndWait()
                engine.stop()
            with open(path, "rb") as f:
                return decode_audio(f.read())
        finally:
            try:
                os.remove(path)
            except OSError:
                pass


class OpenAITTS:
    def __init__(self, cfg):
        self.key = cfg["api_keys"].get("openai")
        if not self.key:
            raise ValueError("OpenAI API key is not set (Settings → API keys).")
        self.model = cfg["cloud"]["openai_tts_model"]
        self.default_voice = cfg["cloud"]["openai_tts_voice"]
        self._client = None

    @property
    def label(self):
        return f"OpenAI {self.model}"

    def load(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.key)
        return self

    def synthesize(self, text, lang, voice=""):
        self.load()
        # Edge-style voice names don't apply to OpenAI; fall back to the configured voice.
        v = voice if voice and "Neural" not in voice else self.default_voice
        r = self._client.audio.speech.create(model=self.model, voice=v, input=text, response_format="wav")
        return decode_audio(r.content)


def build(cfg):
    kind = cfg["engines"]["tts"]
    if kind == "openai":
        return OpenAITTS(cfg)
    if kind == "local":
        return LocalSAPITTS()
    return EdgeTTS()
