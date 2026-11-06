"""Sound-card input and output (mics, line-in, VB-Cable, radio transmitter feeds).

Uses `sounddevice` (PortAudio). Imported lazily so the rest of the app and the
tests work on machines without audio hardware.
"""
import queue
import threading

import numpy as np

from .audio_utils import resample, to_mono

TARGET_SR = 16000


def _sd():
    import sounddevice as sd
    return sd


def list_devices():
    try:
        sd = _sd()
        devices = sd.query_devices()
        hostapis = sd.query_hostapis()
    except Exception as e:  # PortAudio missing, no sound card, ...
        return {"inputs": [], "outputs": [], "error": f"Audio devices unavailable: {e}"}
    inputs, outputs = [], []
    for i, d in enumerate(devices):
        api = hostapis[d["hostapi"]]["name"]
        entry = {"index": i, "name": d["name"], "hostapi": api,
                 "label": f"{d['name']}  [{api}]", "samplerate": d["default_samplerate"]}
        if d["max_input_channels"] > 0:
            inputs.append(entry)
        if d["max_output_channels"] > 0:
            outputs.append(entry)
    default_in, default_out = sd.default.device
    return {"inputs": inputs, "outputs": outputs,
            "default_input": default_in, "default_output": default_out, "error": None}


class DeviceInput:
    """Captures from an input device and calls on_audio(float32 mono @16 kHz)."""

    def __init__(self, device, on_audio):
        self.device = device
        self.on_audio = on_audio
        self._stream = None

    def start(self):
        sd = _sd()
        info = sd.query_devices(self.device, "input")
        sr = int(info["default_samplerate"])

        def callback(indata, frames, time_info, status):
            self.on_audio(resample(to_mono(indata.copy()), sr, TARGET_SR))

        self._stream = sd.InputStream(device=self.device, samplerate=sr, channels=1,
                                      dtype="float32", blocksize=int(sr * 0.05), callback=callback)
        self._stream.start()

    def stop(self):
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            finally:
                self._stream = None


class DevicePlayer:
    """Plays clips one after another on a single output device (own thread)."""

    def __init__(self, device):
        self.device = device
        self._q = queue.Queue()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"play-{device}")
        self._thread.start()

    def play(self, samples, sr):
        self._q.put((samples, sr))

    def close(self):
        self._q.put(None)

    def _run(self):
        sd = _sd()
        while True:
            item = self._q.get()
            if item is None:
                return
            samples, sr = item
            try:
                info = sd.query_devices(self.device, "output")
                dev_sr = int(info["default_samplerate"])
                ch = min(2, int(info["max_output_channels"]))
                data = resample(samples, sr, dev_sr)
                frames = np.repeat(data[:, None], ch, axis=1).astype(np.float32)
                with sd.OutputStream(device=self.device, samplerate=dev_sr, channels=ch, dtype="float32") as s:
                    s.write(frames)
            except Exception as e:
                print(f"[audio] playback on device {self.device} failed: {e}")


class PlayerPool:
    def __init__(self, factory=DevicePlayer):
        self._factory = factory
        self._players = {}
        self._lock = threading.Lock()

    def play(self, device, samples, sr):
        with self._lock:
            p = self._players.get(device)
            if p is None:
                p = self._players[device] = self._factory(device)
        p.play(samples, sr)

    def close(self):
        with self._lock:
            for p in self._players.values():
                p.close()
            self._players.clear()
