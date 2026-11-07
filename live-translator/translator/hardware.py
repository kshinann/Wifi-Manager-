"""Detect whether an NVIDIA GPU is usable and pick sensible local model sizes."""
import functools
import os
import sys


@functools.lru_cache(maxsize=1)
def prepare_cuda_dlls():
    """On Windows, let faster-whisper find cuBLAS/cuDNN installed by pip
    (nvidia-cublas-cu12 / nvidia-cudnn-cu12, see upgrade-to-gpu.bat)."""
    if sys.platform != "win32":
        return
    for base in sys.path:
        nvidia = os.path.join(base, "nvidia")
        if not os.path.isdir(nvidia):
            continue
        for pkg in os.listdir(nvidia):
            bin_dir = os.path.join(nvidia, pkg, "bin")
            if os.path.isdir(bin_dir):
                os.add_dll_directory(bin_dir)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


def cpu_threads():
    return max(1, os.cpu_count() or 4)


@functools.lru_cache(maxsize=1)
def cuda_available():
    prepare_cuda_dlls()
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
