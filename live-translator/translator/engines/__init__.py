"""Engine factory: builds the ASR / translation / TTS trio from the config."""
from dataclasses import dataclass
from typing import Any

from . import asr, translate, tts


@dataclass
class Engines:
    asr: Any
    translator: Any
    tts: Any

    def load_all(self, log=print):
        for part in (self.asr, self.translator, self.tts):
            log(f"Loading {part.label} ... (first run downloads the model)")
            part.load()
        log("Engines ready.")

    def labels(self):
        return {"asr": self.asr.label, "translate": self.translator.label, "tts": self.tts.label}


def build_engines(cfg):
    return Engines(asr=asr.build(cfg), translator=translate.build(cfg), tts=tts.build(cfg))
