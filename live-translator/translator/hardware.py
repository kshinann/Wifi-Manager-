"""Detect whether an NVIDIA GPU is usable and pick sensible local model sizes."""
import functools


@functools.lru_cache(maxsize=1)
def cuda_available():
    try:
        import ctranslate2  # installed with faster-whisper
        if ctranslate2.get_cuda_device_count() > 0:
            return True
    except Exception:
        pass
    try:
        import torch
        return bool(torch.cuda.is_available())
    except Exception:
        return False


def resolve_device(setting):
    if setting in ("cuda", "cpu"):
        return setting
    return "cuda" if cuda_available() else "cpu"


def resolve_whisper_model(setting, device):
    if setting and setting != "auto":
        return setting
    # GPU: best accuracy at near real-time. CPU: small keeps delay to a few seconds.
    return "large-v3-turbo" if device == "cuda" else "small"


def summary():
    gpu = cuda_available()
    name = None
    if gpu:
        try:
            import torch
            name = torch.cuda.get_device_name(0)
        except Exception:
            name = "NVIDIA GPU"
    return {"gpu": gpu, "gpu_name": name}
