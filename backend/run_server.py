"""Entry point used to package the backend as a standalone executable for
the desktop app (see desktop/), which spawns this as a background process.
Also handy for running the server directly:

    python backend/run_server.py [port]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _configure_bundled_ffmpeg() -> None:
    """Bundle a static ffmpeg binary via imageio-ffmpeg and put it on PATH,
    so the desktop app works with no separate ffmpeg install. Falls back to
    whatever's already on PATH (or nothing) if that package is unavailable.
    """
    try:
        import imageio_ffmpeg

        ffmpeg_dir = os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass


def main() -> None:
    _configure_bundled_ffmpeg()

    import uvicorn

    from app.main import app

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8756
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
