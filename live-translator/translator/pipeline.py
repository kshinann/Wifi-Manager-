"""The live pipeline: input audio -> utterances -> ASR -> translate -> captions + speech.

A *route* is one input (a mic, a meeting's audio via VB-Cable, a radio line-in,
or a browser mic) in one source language. It has one or more *channels*, each a
target language that is shown as captions in a web room and/or spoken out of
sound-card outputs (another meeting's virtual mic, a radio transmitter, speakers).
"""
import queue
import threading
import time
import traceback
from collections import deque
from concurrent.futures import ThreadPoolExecutor

from . import languages
from .audio_utils import encode_wav
from .segmenter import SpeechSegmenter

TARGET_SR = 16000


class Route:
    def __init__(self, cfg, engines, hub, players, vad, log, input_factory=None):
        self.cfg = cfg
        self.id = cfg["id"]
        self.engines = engines
        self.hub = hub
        self.players = players
        self.log = log
        self.segmenter = SpeechSegmenter(sample_rate=TARGET_SR, silence_ms=vad.get("silence_ms", 700),
                                         max_segment_s=vad.get("max_segment_s", 12),
                                         min_rms=vad.get("min_rms", 0.008))
        self._input_factory = input_factory
        self._input = None
        self._q = queue.Queue()
        self._feed_lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=max(1, len(cfg["channels"])),
                                        thread_name_prefix=f"ch-{self.id}")
        self._worker = None
        self._running = False
        self.stats = {"utterances": 0, "last_latency_s": None, "backlog": 0}

    # ---- lifecycle -------------------------------------------------------
    def start(self):
        self._running = True
        self._worker = threading.Thread(target=self._run, daemon=True, name=f"route-{self.id}")
        self._worker.start()
        if self.cfg["input"]["type"] == "device" and self._input_factory:
            self._input = self._input_factory(self.cfg["input"]["device"], self.feed)
            self._input.start()

    def stop(self):
        self._running = False
        if self._input:
            self._input.stop()
            self._input = None
        with self._feed_lock:
            tail = self.segmenter.flush()
        if tail is not None:
            self._q.put(tail)
        self._q.put(None)
        if self._worker:
            self._worker.join(timeout=30)
        self._pool.shutdown(wait=False)

    @property
    def level(self):
        return self.segmenter.level

    # ---- audio in --------------------------------------------------------
    def feed(self, samples_16k):
        if not self._running:
            return
        with self._feed_lock:
            for utt in self.segmenter.feed(samples_16k):
                self._q.put(utt)

    def _run(self):
        while True:
            utt = self._q.get()
            if utt is None:
                return
            self.stats["backlog"] = self._q.qsize()
            if self.stats["backlog"] > 3:
                self.log(f"[{self.cfg['name']}] falling behind ({self.stats['backlog']} queued). "
                         "Use a GPU, a smaller model, or cloud AI for lower delay.")
            try:
                self.process_utterance(utt)
            except Exception as e:
                self.log(f"[{self.cfg['name']}] error: {e}")
                traceback.print_exc()

    # ---- processing ------------------------------------------------------
    def process_utterance(self, audio):
        t0 = time.monotonic()
        src = None if self.cfg["source_lang"] == "auto" else self.cfg["source_lang"]
        text, detected = self.engines.asr.transcribe(audio, src)
        if not text or not text.strip():
            return
        lang = languages.normalize(detected) or src or "en"
        self.process_text(text.strip(), lang, t0=t0)

    def process_text(self, text, lang, t0=None, channels=None):
        """Translate text into every channel; returns {channel_id: translation}."""
        t0 = t0 or time.monotonic()
        self.stats["utterances"] += 1
        ts = time.time()
        self.hub.publish("control", {"type": "source", "route": self.id, "lang": lang, "text": text, "ts": ts})
        chans = channels or self.cfg["channels"]
        futures = {c["id"]: self._pool.submit(self._channel, c, text, lang, ts) for c in chans}
        results = {}
        for cid, f in futures.items():
            try:
                results[cid] = f.result()
            except Exception as e:
                self.log(f"[{cid}] {e}")
        self.stats["last_latency_s"] = round(time.monotonic() - t0, 2)
        return results

    def _channel(self, ch, text, lang, ts):
        tgt = ch["target_lang"]
        translated = text if tgt == lang else self.engines.translator.translate(text, lang, tgt)
        if not translated:
            return ""
        event = {"type": "caption", "route": self.id, "channel": ch["id"], "lang": tgt,
                 "source_lang": lang, "source": text, "text": translated, "ts": ts}
        topic = f"ch:{ch['id']}"
        self.hub.publish(topic, event, keep=True)
        self.hub.publish("control", event)
        if ch.get("speak", True) and (ch.get("outputs") or (ch.get("web", True) and self.hub.listeners(topic))):
            samples, sr = self.engines.tts.synthesize(translated, tgt, ch.get("voice", ""))
            for dev in ch.get("outputs") or []:
                self.players.play(dev, samples, sr)
            if ch.get("web", True):
                self.hub.publish(topic, encode_wav(samples, sr))
        return translated


class Manager:
    """Owns engines and routes; started/stopped from the control panel."""

    def __init__(self, store, hub, players, engines_factory, input_factory=None, output_resolver=None):
        self.store = store
        self.hub = hub
        self.players = players
        self.engines_factory = engines_factory
        self.input_factory = input_factory
        self.output_resolver = output_resolver
        self.state = "stopped"
        self.error = None
        self.engines = None
        self.routes = {}
        self.logs = deque(maxlen=200)
        self._lock = threading.Lock()

    def log(self, msg):
        line = f"{time.strftime('%H:%M:%S')}  {msg}"
        print(line)
        self.logs.append(line)
        self.hub.publish("control", {"type": "log", "text": line})

    def start_async(self):
        with self._lock:
            if self.state in ("starting", "running"):
                return False
            self.state, self.error = "starting", None
        threading.Thread(target=self._start, daemon=True, name="manager-start").start()
        return True

    def _start(self):
        try:
            cfg = self.store.get()
            self.engines = self.engines_factory(cfg)
            self.engines.load_all(self.log)
            routes = {}
            for rc in cfg["routes"]:
                if not rc.get("enabled", True) or not rc["channels"]:
                    continue
                self._resolve_output_names(rc)
                r = Route(rc, self.engines, self.hub, self.players, cfg["vad"], self.log, self.input_factory)
                try:
                    r.start()
                except Exception as e:  # e.g. device unplugged: keep the other routes alive
                    r.stop()
                    self.log(f"Route '{rc['name']}' could not open its input: {e}")
                    continue
                routes[r.id] = r
                self.log(f"Route '{rc['name']}' live → " +
                         ", ".join(languages.name(c["target_lang"]) for c in rc["channels"]))
            with self._lock:
                self.routes = routes
                self.state = "running"
            if not routes:
                self.log("No routes are live. Check the inputs above, or add a route in the Routes section.")
        except Exception as e:
            traceback.print_exc()
            with self._lock:
                self.state, self.error = "error", str(e)
            self.log(f"Start failed: {e}")
            self._stop_routes()

    def _resolve_output_names(self, rc):
        for ch in rc["channels"]:
            for name in ch.get("output_names") or []:
                idx = self.output_resolver(name) if self.output_resolver else None
                if idx is None:
                    self.log(f"Output '{name}' not found on this PC (is VB-Cable installed?). "
                             f"{languages.name(ch['target_lang'])} still goes to the web room.")
                elif idx not in ch["outputs"]:
                    ch["outputs"] = list(ch["outputs"]) + [idx]
                    self.log(f"{languages.name(ch['target_lang'])} voice → sound output '{name}' (#{idx})")

    def stop(self):
        self._stop_routes()
        with self._lock:
            self.state = "stopped"
        self.log("Stopped.")

    def _stop_routes(self):
        with self._lock:
            routes, self.routes = self.routes, {}
        for r in routes.values():
            try:
                r.stop()
            except Exception as e:
                print(f"stop {r.id}: {e}")

    def route(self, rid):
        return self.routes.get(rid)

    def find_channel(self, cid):
        for r in self.routes.values():
            for c in r.cfg["channels"]:
                if c["id"] == cid:
                    return r, c
        return None, None

    def status(self):
        return {
            "state": self.state,
            "error": self.error,
            "engines": self.engines.labels() if self.engines else None,
            "routes": {rid: {"level": round(r.level, 4), **r.stats} for rid, r in self.routes.items()},
        }
