"""Web server: operator control panel, listener rooms, caption overlay, browser mic."""
import asyncio
import contextlib
import socket
from pathlib import Path

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect

from . import hardware, languages
from .audio_utils import pcm16_to_float
from .config import ConfigStore
from .hub import Hub
from .pipeline import Manager

STATIC = Path(__file__).resolve().parent / "static"
LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # no packets sent; just picks the LAN interface
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return sorted(ips)


def create_app(store=None, engines_factory=None, input_factory=None, players=None):
    store = store or ConfigStore()
    hub = Hub()
    if engines_factory is None:
        from .engines import build_engines as engines_factory
    if players is None:
        from .audio_devices import PlayerPool
        players = PlayerPool()
    if input_factory is None:
        from .audio_devices import DeviceInput as input_factory
    manager = Manager(store, hub, players, engines_factory, input_factory)

    def is_admin(conn):
        host = conn.client.host if conn.client else ""
        if host in LOOPBACK:
            return True
        token = store.get().get("admin_token")
        supplied = conn.headers.get("x-admin-token") or conn.query_params.get("token")
        return bool(token) and supplied == token

    def admin(handler):
        async def wrapped(request):
            if not is_admin(request):
                return JSONResponse({"error": "Admin only. Open the panel on the PC running the app, "
                                              "or set an admin token in Settings."}, status_code=403)
            return await handler(request)
        return wrapped

    def page(name):
        async def handler(request):
            return FileResponse(STATIC / name)
        return handler

    # ---------------- public (listeners) ----------------
    async def public_info(request):
        cfg = store.get()
        channels = [{"id": c["id"], "route": r["name"], "lang": c["target_lang"],
                     "lang_name": languages.name(c["target_lang"]), "listeners": hub.listeners(f"ch:{c['id']}")}
                    for r in cfg["routes"] if r.get("enabled", True) for c in r["channels"] if c.get("web", True)]
        return JSONResponse({"channels": channels, "running": manager.state == "running",
                             "languages": languages.catalogue()})

    async def transcript(request):
        cid = request.path_params["cid"]
        lines = [f"{e['source']}\n→ {e['text']}\n" for e in hub.history[f"ch:{cid}"]
                 if isinstance(e, dict) and e.get("type") == "caption"]
        return PlainTextResponse("\n".join(lines) or "(no captions yet)",
                                 headers={"Content-Disposition": f'attachment; filename="transcript-{cid}.txt"'})

    async def ws_room(ws: WebSocket):
        await ws.accept()
        topic = f"ch:{ws.path_params['cid']}"
        sub = await hub.subscribe(topic, ws)
        try:
            while True:
                await ws.receive_text()  # keep-alive pings from the page
        except WebSocketDisconnect:
            pass
        finally:
            hub.unsubscribe(topic, sub)

    # ---------------- admin (operator) ----------------
    @admin
    async def get_config(request):
        return JSONResponse({"config": store.public(), "languages": languages.catalogue()})

    @admin
    async def put_config(request):
        try:
            store.update(await request.json())
        except (ValueError, TypeError) as e:
            return JSONResponse({"error": str(e)}, status_code=400)
        return JSONResponse({"ok": True, "config": store.public(),
                             "restart_needed": manager.state == "running"})

    @admin
    async def devices(request):
        from .audio_devices import list_devices
        return JSONResponse(await run_in_threadpool(list_devices))

    @admin
    async def status(request):
        port = request.url.port or 8000
        return JSONResponse({**manager.status(), "hardware": await run_in_threadpool(hardware.summary),
                             "lan_urls": [f"http://{ip}:{port}" for ip in lan_ips()],
                             "logs": list(manager.logs)[-50:]})

    @admin
    async def start(request):
        return JSONResponse({"started": manager.start_async(), "state": manager.state})

    @admin
    async def stop(request):
        await run_in_threadpool(manager.stop)
        return JSONResponse({"state": manager.state})

    @admin
    async def test_channel(request):
        body = await request.json()
        route, ch = manager.find_channel(body.get("channel"))
        if not route:
            return JSONResponse({"error": "Start the app first, then test a channel."}, status_code=400)
        src = route.cfg["source_lang"] if route.cfg["source_lang"] != "auto" else "en"
        text = body.get("text") or "Welcome everyone. The meeting will begin shortly."
        try:
            result = await run_in_threadpool(route.process_text, text, src, None, [ch])
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        return JSONResponse({"ok": True, "translation": result.get(ch["id"])})

    async def ws_control(ws: WebSocket):
        if not is_admin(ws):
            await ws.close(code=4403)
            return
        await ws.accept()
        sub = await hub.subscribe("control", ws)
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            hub.unsubscribe("control", sub)

    async def ws_speak(ws: WebSocket):
        """Browser/phone mic → route. Page sends 16 kHz mono Int16 PCM frames."""
        if not is_admin(ws):
            await ws.close(code=4403)
            return
        await ws.accept()
        rid = ws.path_params["rid"]
        try:
            while True:
                data = await ws.receive_bytes()
                route = manager.route(rid)
                if route is None or route.cfg["input"]["type"] != "browser":
                    await ws.send_text('{"type":"warn","text":"Route not running or not set to Browser mic"}')
                    continue
                route.feed(pcm16_to_float(data))
                await ws.send_text(f'{{"type":"level","level":{route.level:.4f}}}')
        except WebSocketDisconnect:
            pass

    @contextlib.asynccontextmanager
    async def lifespan(app):
        hub.bind(asyncio.get_running_loop())
        yield
        await run_in_threadpool(manager.stop)
        players.close()

    routes = [
        Route("/", page("control.html")),
        Route("/rooms", page("rooms.html")),
        Route("/room/{cid}", page("room.html")),
        Route("/overlay/{cid}", page("overlay.html")),
        Route("/speak/{rid}", page("speak.html")),
        Route("/api/public", public_info),
        Route("/api/transcript/{cid}", transcript),
        Route("/api/config", get_config, methods=["GET"]),
        Route("/api/config", put_config, methods=["PUT"]),
        Route("/api/devices", devices),
        Route("/api/status", status),
        Route("/api/start", start, methods=["POST"]),
        Route("/api/stop", stop, methods=["POST"]),
        Route("/api/test", test_channel, methods=["POST"]),
        WebSocketRoute("/ws/room/{cid}", ws_room),
        WebSocketRoute("/ws/control", ws_control),
        WebSocketRoute("/ws/speak/{rid}", ws_speak),
        Mount("/static", StaticFiles(directory=STATIC), name="static"),
    ]
    app = Starlette(routes=routes, lifespan=lifespan)
    app.state.manager, app.state.hub, app.state.store = manager, hub, store
    return app
