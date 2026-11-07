"""Build dist/LiveTranslator-Trial-EN-ZH.zip (Windows trial package).

    python tools/make_trial_zip.py
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "LiveTranslator-Trial-EN-ZH.zip"
TOP = "LiveTranslator-Trial-EN-ZH"
SKIP_DIRS = {"data", "dist", ".venv", "__pycache__", "tests", "tools", "models"}


def files():
    for p in sorted(ROOT.rglob("*")):
        rel = p.relative_to(ROOT)
        if p.is_file() and not (set(rel.parts) & SKIP_DIRS) and p.suffix != ".pyc":
            yield p, rel


def main():
    OUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for p, rel in files():
            data = p.read_bytes()
            if p.suffix == ".bat":  # Windows needs CRLF line endings
                data = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            z.writestr(f"{TOP}/{rel.as_posix()}", data)
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
