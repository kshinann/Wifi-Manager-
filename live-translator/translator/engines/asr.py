"""Speech-to-text engines. Input: mono float32 audio at 16 kHz."""
import threading

from .. import hardware, languages
from ..audio_utils import encode_wav

SAMPLE_RATE = 16000


class LocalWhisperASR:
    """faster-whisper running on this PC (GPU if present, else CPU)."""

    def __init__(self, cfg):
        local = cfg["local"]
        self._model_setting = local.get("whisper_model", "auto")
        self.device = hardware.resolve_device(local.get("device", "auto"))
        self.model_name = hardware.resolve_whisper_model(self._model_setting, self.device)
        self._model = None
        self._lock = threading.Lock()

    @property
    def label(self):
        return f"Whisper {self.model_name} ({self.device.upper()}, built-in)"

    def load(self):
        with self._lock:
            if self._model is None:
                hardware.prepare_cuda_dlls()
                from faster_whisper import WhisperModel
                if self.device == "cuda":
                    try:
                        self._model = WhisperModel(self.model_name, device="cuda", compute_type="float16")
                        return self
                    except Exception as e:  # driver/cuDNN problem: keep working on the CPU
                        print(f"[asr] GPU not usable ({e}); falling back to CPU.")
                        self.device = "cpu"
                        self.model_name = hardware.resolve_whisper_model(self._model_setting, "cpu")
                self._model = WhisperModel(self.model_name, device="cpu", compute_type="int8",
                                           cpu_threads=hardware.cpu_threads())
        return self

    def transcribe(self, audio, language=None):
        self.load()
        lang = languages.LANGUAGES.get(language, {}).get("whisper") if language else None
        with self._lock:  # one decode at a time per model
            segments, info = self._model.transcribe(
                audio, language=lang, beam_size=5 if self.device == "cuda" else 1,
                vad_filter=False, condition_on_previous_text=False)
            text = " ".join(s.text.strip() for s in segments).strip()
        return text, languages.normalize(info.language) or language


class OpenAIASR:
    def __init__(self, cfg):
        self.key = cfg["api_keys"].get("openai")
        if not self.key:
            raise ValueError("OpenAI API key is not set (Settings → API keys).")
        self.model = cfg["cloud"]["openai_asr_model"]
        self._client = None

    @property
    def label(self):
        return f"OpenAI {self.model}"

    def load(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.key)
        return self

    def transcribe(self, audio, language=None):
        self.load()
        kwargs = {}
        if language:
            kwargs["language"] = languages.LANGUAGES[language]["whisper"]
        result = self._client.audio.transcriptions.create(
            model=self.model, file=("speech.wav", encode_wav(audio, SAMPLE_RATE), "audio/wav"), **kwargs)
        return (result.text or "").strip(), language


def build(cfg):
    kind = cfg["engines"]["asr"]
    if kind == "openai":
        return OpenAIASR(cfg)
    return LocalWhisperASR(cfg)
