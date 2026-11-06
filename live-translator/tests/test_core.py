"""Run with:  python -m unittest discover -s tests   (no models or sound card needed)."""
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

import numpy as np

from translator import languages
from translator.audio_utils import decode_audio, encode_wav, resample
from translator.config import SECRET_PLACEHOLDER, ConfigStore, validate_routes
from translator.engines import Engines
from translator.segmenter import SpeechSegmenter

SR = 16000


def tone(seconds, amp=0.2, freq=220):
    t = np.arange(int(SR * seconds)) / SR
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def silence(seconds):
    return np.zeros(int(SR * seconds), dtype=np.float32)


class FakeASR:
    label = "fake-asr"
    def load(self): return self
    def transcribe(self, audio, language=None):
        return f"hello {len(audio) // SR}s", language or "en"


class FakeTranslator:
    label = "fake-mt"
    def load(self): return self
    def translate(self, text, src, tgt):
        return f"[{tgt}] {text}"


class FakeTTS:
    label = "fake-tts"
    def load(self): return self
    def synthesize(self, text, lang, voice=""):
        return tone(0.2), 24000


def fake_engines(cfg):
    return Engines(FakeASR(), FakeTranslator(), FakeTTS())


class FakePlayers:
    def __init__(self):
        self.played = []
    def play(self, device, samples, sr):
        self.played.append((device, len(samples), sr))
    def close(self):
        pass


class SegmenterTests(unittest.TestCase):
    def test_splits_on_pauses(self):
        seg = SpeechSegmenter(sample_rate=SR, silence_ms=600)
        audio = np.concatenate([silence(1), tone(1.5), silence(1), tone(2), silence(1)])
        out = []
        for i in range(0, len(audio), 800):  # 50 ms blocks like a live stream
            out += seg.feed(audio[i:i + 800])
        self.assertEqual(len(out), 2)
        self.assertAlmostEqual(len(out[0]) / SR, 1.5 + 0.6, delta=0.5)

    def test_ignores_short_clicks_and_noise(self):
        seg = SpeechSegmenter(sample_rate=SR)
        rng = np.random.default_rng(0)
        noise = (rng.standard_normal(SR * 3) * 0.002).astype(np.float32)
        audio = np.concatenate([noise, tone(0.1), noise])
        self.assertEqual(seg.feed(audio), [])

    def test_force_cuts_long_speech(self):
        seg = SpeechSegmenter(sample_rate=SR, max_segment_s=4)
        out = seg.feed(tone(10))
        self.assertGreaterEqual(len(out), 2)
        self.assertTrue(all(len(o) <= 4 * SR + SR // 10 for o in out))

    def test_flush_returns_tail(self):
        seg = SpeechSegmenter(sample_rate=SR)
        seg.feed(tone(1))
        self.assertIsNotNone(seg.flush())


class AudioUtilTests(unittest.TestCase):
    def test_wav_roundtrip(self):
        x = tone(0.5)
        y, sr = decode_audio(encode_wav(x, 22050))
        self.assertEqual(sr, 22050)
        self.assertEqual(len(y), len(x))
        self.assertLess(np.max(np.abs(x - y)), 1e-3)

    def test_resample_length(self):
        self.assertEqual(len(resample(tone(1), 16000, 48000)), 48000)


class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "config.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_keys_are_masked_and_kept(self):
        store = ConfigStore(self.path)
        store.update({"api_keys": {"anthropic": "sk-ant-secret"}})
        self.assertEqual(store.public()["api_keys"]["anthropic"], SECRET_PLACEHOLDER)
        store.update({"api_keys": {"anthropic": SECRET_PLACEHOLDER}})  # UI echo keeps the key
        self.assertEqual(ConfigStore(self.path).get()["api_keys"]["anthropic"], "sk-ant-secret")
        self.assertNotIn("sk-ant-secret", json.dumps(store.public()))

    def test_route_validation(self):
        with self.assertRaises(ValueError):
            validate_routes([{"id": "a", "channels": [{"id": "x", "target_lang": "xx"}]}])
        with self.assertRaises(ValueError):
            validate_routes([{"id": "a", "channels": [{"id": "x", "target_lang": "zh"},
                                                      {"id": "x", "target_lang": "ms"}]}])
        ok = validate_routes([{"id": "a", "source_lang": "en", "input": {"type": "device", "device": "3"},
                               "channels": [{"id": "a-zh", "target_lang": "zh", "outputs": ["5"]}]}])
        self.assertEqual(ok[0]["input"]["device"], 3)
        self.assertEqual(ok[0]["channels"][0]["outputs"], [5])

    def test_language_catalogue(self):
        for code in ("en", "zh", "ms"):
            self.assertIn(code, languages.LANGUAGES)
        self.assertEqual(languages.normalize("zh-CN"), "zh")
        self.assertIsNone(languages.normalize("klingon"))


class PipelineAndServerTests(unittest.TestCase):
    def setUp(self):
        from starlette.testclient import TestClient
        from translator.server import create_app

        self.tmp = tempfile.TemporaryDirectory()
        store = ConfigStore(Path(self.tmp.name) / "config.json")
        store.update({"routes": [{
            "id": "hall", "name": "Hall", "source_lang": "en", "input": {"type": "browser"},
            "channels": [{"id": "hall-zh", "target_lang": "zh", "outputs": [7]},
                         {"id": "hall-ms", "target_lang": "ms", "outputs": []}]}]})
        self.players = FakePlayers()
        self.app = create_app(store=store, engines_factory=fake_engines, input_factory=None, players=self.players)
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.tmp.cleanup()

    def wait_running(self):
        for _ in range(100):
            if self.client.get("/api/status").json()["state"] == "running":
                return
            time.sleep(0.05)
        self.fail("manager did not start")

    def test_pages_and_public_api(self):
        for path in ("/", "/rooms", "/room/hall-zh", "/overlay/hall-zh", "/speak/hall"):
            self.assertEqual(self.client.get(path).status_code, 200, path)
        pub = self.client.get("/api/public").json()
        self.assertEqual({c["id"] for c in pub["channels"]}, {"hall-zh", "hall-ms"})

    def test_browser_mic_to_room_captions_and_audio(self):
        self.assertTrue(self.client.post("/api/start").json()["started"])
        self.wait_running()
        with self.client.websocket_connect("/ws/room/hall-zh") as room:
            with self.client.websocket_connect("/ws/speak/hall") as mic:
                speech = np.concatenate([silence(0.5), tone(1.2), silence(1.2)])
                pcm = (speech * 32767).astype("<i2").tobytes()
                for i in range(0, len(pcm), 3200):
                    mic.send_bytes(pcm[i:i + 3200])
                    mic.receive_text()
            caption = json.loads(room.receive_text())
            self.assertEqual(caption["type"], "caption")
            self.assertTrue(caption["text"].startswith("[zh] hello"))
            wav = room.receive_bytes()
            self.assertEqual(wav[:4], b"RIFF")
        self.assertEqual(self.players.played[0][0], 7)  # spoken to sound output #7
        self.client.post("/api/stop")

    def test_test_button_and_transcript(self):
        self.client.post("/api/start")
        self.wait_running()
        r = self.client.post("/api/test", json={"channel": "hall-ms", "text": "Good morning"})
        self.assertEqual(r.json()["translation"], "[ms] Good morning")
        self.assertIn("[ms] Good morning", self.client.get("/api/transcript/hall-ms").text)
        self.client.post("/api/stop")

    def test_admin_api_rejects_remote_clients(self):
        from starlette.testclient import TestClient
        remote = TestClient(self.app, client=("192.168.1.50", 5000))
        self.assertEqual(remote.get("/api/config").status_code, 403)
        self.assertEqual(remote.get("/api/public").status_code, 200)
        self.client.put("/api/config", json={"admin_token": "letmein"})
        self.assertEqual(remote.get("/api/config", headers={"X-Admin-Token": "letmein"}).status_code, 200)

    def test_bad_routes_rejected(self):
        r = self.client.put("/api/config", json={"routes": [{"id": "x", "channels": [{"id": "c", "target_lang": "??"}]}]})
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    unittest.main()
