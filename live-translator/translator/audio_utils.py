"""Small audio helpers: resampling, WAV encode/decode, MP3 decode."""
import io
import wave

import numpy as np


def to_mono(x):
    x = np.asarray(x, dtype=np.float32)
    return x.mean(axis=1) if x.ndim == 2 else x


def resample(x, src_sr, dst_sr):
    """Linear-interpolation resampler; good enough for speech."""
    x = np.asarray(x, dtype=np.float32)
    if src_sr == dst_sr or len(x) == 0:
        return x
    n = int(round(len(x) * dst_sr / src_sr))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t_src = np.arange(len(x), dtype=np.float64) / src_sr
    t_dst = np.arange(n, dtype=np.float64) / dst_sr
    return np.interp(t_dst, t_src, x).astype(np.float32)


def pcm16_to_float(data):
    return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0


def float_to_pcm16(x):
    x = np.clip(np.asarray(x, dtype=np.float32), -1.0, 1.0)
    return (x * 32767.0).astype("<i2").tobytes()


def encode_wav(samples, sample_rate):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(sample_rate))
        w.writeframes(float_to_pcm16(samples))
    return buf.getvalue()


def decode_audio(data):
    """Decode WAV or MP3 bytes to (mono float32 samples, sample_rate)."""
    if data[:4] == b"RIFF":
        with wave.open(io.BytesIO(data), "rb") as w:
            sr, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
            raw = w.readframes(w.getnframes())
        if width == 2:
            x = pcm16_to_float(raw)
        elif width == 4:
            x = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
        elif width == 1:
            x = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        else:
            raise ValueError(f"unsupported WAV sample width {width}")
        if ch > 1:
            x = x.reshape(-1, ch).mean(axis=1)
        return x.astype(np.float32), sr
    import miniaudio  # MP3/OGG/FLAC (edge-tts returns MP3)
    dec = miniaudio.decode(data, output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1)
    return pcm16_to_float(dec.samples.tobytes()), dec.sample_rate
