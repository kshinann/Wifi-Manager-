"""AI Guard agent command line.

    aiguard-agent enroll --server https://aiguard.example.com --token enr_xxx
    aiguard-agent run
    aiguard-agent status
"""

import argparse
import getpass
import json
import logging
import logging.handlers
import platform
import signal
import socket
import sys

from . import __version__
from .api import ApiError, ServerClient
from .catalog import current_os
from .config import AgentConfig, data_dir
from .store import Store


def _setup_logging(verbose: bool) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    try:
        handlers.append(logging.handlers.RotatingFileHandler(data_dir() / "agent.log", maxBytes=5_000_000,
                                                             backupCount=3))
    except OSError:
        pass
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, handlers=handlers,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def cmd_enroll(args) -> int:
    config = AgentConfig.load()
    if config.enrolled and not args.force:
        print(f"Already enrolled with {config.server_url} (device {config.device_id}). Use --force to re-enroll.")
        return 1
    client = ServerClient(args.server)
    try:
        result = client.enroll(args.token, hostname=socket.gethostname(), os=current_os(),
                               os_version=f"{platform.system()} {platform.release()}", agent_version=__version__,
                               os_user=getpass.getuser())
    except (ApiError, OSError) as exc:
        print(f"Enrollment failed: {exc}", file=sys.stderr)
        return 2
    config.server_url = args.server.rstrip("/")
    config.device_id = result["device_id"]
    config.device_token = result["device_token"]
    config.tenant_name = result["tenant_name"]
    if args.extension_id:
        config.allowed_extension_ids = tuple(args.extension_id)
    config.save()
    print(f"Enrolled as device {config.device_id} for {config.tenant_name}.")
    return 0


def cmd_run(args) -> int:
    from .service import Agent

    _setup_logging(args.verbose)
    config = AgentConfig.load()
    if not config.enrolled:
        logging.error("Agent is not enrolled. Run: aiguard-agent enroll --server URL --token TOKEN")
        return 1
    agent = Agent(config, Store(data_dir() / "agent.db"))
    agent.refresh_config()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: agent.stop())
    agent.run()
    return 0


def cmd_status(_args) -> int:
    config = AgentConfig.load()
    store = Store(data_dir() / "agent.db")
    cached = store.get_json("config") or {}
    print(json.dumps({
        "version": __version__, "enrolled": config.enrolled, "server": config.server_url,
        "device_id": config.device_id, "tenant": config.tenant_name,
        "policy_version": cached.get("policy_version"), "queued_events": store.outbox_size(),
        "usage_today_seconds": store.usage_today(),
    }, indent=2))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="aiguard-agent", description="AI Guard desktop agent")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    enroll = sub.add_parser("enroll", help="register this PC with the management server")
    enroll.add_argument("--server", required=True, help="e.g. https://aiguard.example.com")
    enroll.add_argument("--token", required=True, help="enrollment token from the portal")
    enroll.add_argument("--extension-id", action="append", help="restrict the local API to this extension id")
    enroll.add_argument("--force", action="store_true")
    enroll.set_defaults(func=cmd_enroll)

    run = sub.add_parser("run", help="run the agent in the foreground (used by the service)")
    run.add_argument("-v", "--verbose", action="store_true")
    run.set_defaults(func=cmd_run)

    status = sub.add_parser("status", help="show enrollment and queue status")
    status.set_defaults(func=cmd_status)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
