"""Voice-activity segmentation: turns a continuous audio stream into utterances.

Pure numpy so it runs (and is tested) anywhere. Audio is mono float32 at
`sample_rate`. An utterance ends after `silence_ms` of quiet, or is force-cut
at `max_segment_s` so long speeches still get translated with low delay.
"""
import numpy as np


class SpeechSegmenter:
    def __init__(self, sample_rate=16000, frame_ms=30, silence_ms=700, min_speech_ms=350,
                 max_segment_s=12.0, pre_roll_ms=240, min_rms=0.008, noise_ratio=3.0):
        self.sr = sample_rate
        self.frame = int(sample_rate * frame_ms / 1000)
        self.silence_frames = max(1, int(silence_ms / frame_ms))
        self.min_speech_frames = max(1, int(min_speech_ms / frame_ms))
        self.max_frames = int(max_segment_s * 1000 / frame_ms)
        self.pre_roll_frames = int(pre_roll_ms / frame_ms)
        self.min_rms = min_rms
        self.noise_ratio = noise_ratio
        self.noise_floor = min_rms / noise_ratio
        self._buf = np.zeros(0, dtype=np.float32)
        self._pre = []
        self._speech = []
        self._speech_frames = 0
        self._silent_run = 0
        self.level = 0.0  # last frame RMS, for the UI level meter

    @property
    def threshold(self):
        return max(self.min_rms, self.noise_floor * self.noise_ratio)

    def feed(self, samples):
        """Add audio; return a list of completed utterances (np.float32 arrays)."""
        out = []
        self._buf = np.concatenate([self._buf, np.asarray(samples, dtype=np.float32).ravel()])
        n = len(self._buf) // self.frame
        for i in range(n):
            frame = self._buf[i * self.frame:(i + 1) * self.frame]
            seg = self._process_frame(frame)
            if seg is not None:
                out.append(seg)
        self._buf = self._buf[n * self.frame:]
        return out

    def _process_frame(self, frame):
        rms = float(np.sqrt(np.mean(frame * frame))) if len(frame) else 0.0
        self.level = rms
        loud = rms >= self.threshold
        if not self._speech:
            if loud:
                self._speech = list(self._pre) + [frame]
                self._speech_frames = 1
                self._silent_run = 0
                self._pre = []
            else:
                # adapt the noise floor only while nobody is talking
                self.noise_floor = 0.95 * self.noise_floor + 0.05 * rms
                self._pre.append(frame)
                if len(self._pre) > self.pre_roll_frames:
                    self._pre.pop(0)
            return None

        self._speech.append(frame)
        if loud:
            self._speech_frames += 1
            self._silent_run = 0
        else:
            self._silent_run += 1
        if self._silent_run >= self.silence_frames or len(self._speech) >= self.max_frames:
            return self._emit()
        return None

    def _emit(self):
        frames, speech_frames = self._speech, self._speech_frames
        self._speech, self._speech_frames, self._silent_run = [], 0, 0
        if speech_frames < self.min_speech_frames:
            return None
        return np.concatenate(frames).astype(np.float32)

    def flush(self):
        """Return any utterance in progress (call when the input stops)."""
        if not self._speech:
            return None
        return self._emit()
