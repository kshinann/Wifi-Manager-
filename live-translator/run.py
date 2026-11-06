"""Start Live Translator:  python run.py  [--port 8000] [--host 0.0.0.0] [--no-browser]"""
import argparse
import threading
import webbrowser

import uvicorn

from translator.server import create_app


def main():
    p = argparse.ArgumentParser(description="Live meeting translator")
    p.add_argument("--host", default="0.0.0.0", help="0.0.0.0 lets phones on the same Wi-Fi join rooms")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--no-browser", action="store_true")
    p.add_argument("--ssl-certfile", help="HTTPS certificate (needed for phone microphones over Wi-Fi)")
    p.add_argument("--ssl-keyfile", help="HTTPS private key")
    a = p.parse_args()
    if not a.no_browser:
        scheme = "https" if a.ssl_certfile else "http"
        threading.Timer(1.5, lambda: webbrowser.open(f"{scheme}://localhost:{a.port}/")).start()
    print(f"Live Translator running on port {a.port}. Control panel: http://localhost:{a.port}/  (Ctrl+C to stop)")
    uvicorn.run(create_app(), host=a.host, port=a.port, log_level="warning",
                ssl_certfile=a.ssl_certfile, ssl_keyfile=a.ssl_keyfile)


if __name__ == "__main__":
    main()
