"""Pre-meeting self-check: hardware, sound devices, and a full English → Mandarin run.

It speaks an English sentence with the TTS engine, recognises it with the ASR
engine, translates it, speaks the Mandarin, saves it to data/selftest-zh.wav and
plays it on the PC speakers. Run with:  python run.py --selftest
"""
import time

from . import hardware
from .audio_utils import encode_wav, resample
from .config import DATA_DIR

SENTENCE = "Good morning everyone. Welcome to today's meeting. Let us begin with the first item."


def run(store):
    cfg = store.get()
    ok = True

    def step(title):
        print(f"\n== {title}")

    def fail(msg):
        nonlocal ok
        ok = False
        print(f"   FAIL  {msg}")

    step("1. Processor")
    hw = hardware.summary()
    print("   GPU:", hw["gpu_name"] if hw["gpu"] else "none - built-in AI will run on the CPU (slower, ~3-6 s delay)")

    step("2. Sound devices")
    from .audio_devices import find_output, list_devices
    devs = list_devices()
    if devs.get("error"):
        fail(devs["error"])
    else:
        default_in = next((d["label"] for d in devs["inputs"] if d["index"] == devs.get("default_input")), "none")
        print("   Microphone (Windows default):", default_in)
        for route in cfg["routes"]:
            for ch in route["channels"]:
                for name in ch.get("output_names") or []:
                    idx = find_output(name)
                    if idx is None:
                        print(f"   WARN  '{name}' not found - install VB-Cable to send Mandarin into a meeting "
                              "(the web room still works).")
                    else:
                        print(f"   OK    '{name}' found (device #{idx}) - Mandarin voice will go there.")

    step("3. Loading AI engines (first time downloads 1-3 GB, please wait)")
    from .engines import build_engines
    try:
        eng = build_engines(cfg)
        eng.load_all(lambda m: print("  ", m))
    except Exception as e:
        fail(f"could not load engines: {e}")
        return _summary(False)

    step("4. English → Mandarin test")
    try:
        en_audio, sr = eng.tts.synthesize(SENTENCE, "en")
        t0 = time.monotonic()
        heard, _ = eng.asr.transcribe(resample(en_audio, sr, 16000), "en")
        t1 = time.monotonic()
        print(f"   Heard:      {heard}   (speech→text {t1 - t0:.1f} s)")
        zh = eng.translator.translate(heard or SENTENCE, "en", "zh")
        t2 = time.monotonic()
        print(f"   Mandarin:   {zh}   (translation {t2 - t1:.1f} s)")
        zh_audio, zsr = eng.tts.synthesize(zh, "zh")
        t3 = time.monotonic()
        print(f"   Voice made in {t3 - t2:.1f} s")
        delay = t3 - t0
        print(f"   → Expected delay after each sentence: about {delay:.1f} s "
              f"(engines: {', '.join(eng.labels().values())})")
        if delay > 6:
            print("   TIP   That is slow. In the control panel → AI engines, set Whisper model to 'base', "
                  "or add a GPU later (run upgrade-to-gpu.bat).")
        out = DATA_DIR / "selftest-zh.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(encode_wav(zh_audio, zsr))
        print(f"   Saved: {out}")
        try:
            import sounddevice as sd
            print("   Playing Mandarin on the PC speakers...")
            sd.play(zh_audio, zsr)
            sd.wait()
        except Exception as e:
            print(f"   (could not play: {e})")
        if not heard:
            fail("speech recognition returned nothing")
    except Exception as e:
        fail(f"pipeline error: {e}")
    return _summary(ok)


def _summary(ok):
    print("\n" + ("ALL GOOD - run start.bat for the meeting." if ok else
                  "Some checks failed - see FAIL lines above."))
    return 0 if ok else 1
