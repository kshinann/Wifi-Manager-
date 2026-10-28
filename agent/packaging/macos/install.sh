#!/bin/bash
# Installs the AI Guard agent as a launchd daemon and enrolls this Mac.
#   sudo ./install.sh --server https://aiguard.example.com --token enr_xxx [--extension-id ID]
set -euo pipefail

SERVER="" TOKEN="" EXTENSION_ID=""
BINARY="$(cd "$(dirname "$0")" && pwd)/aiguard-agent"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --extension-id) EXTENSION_ID="$2"; shift 2 ;;
    --binary) BINARY="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[[ -n "$SERVER" && -n "$TOKEN" ]] || { echo "usage: sudo $0 --server URL --token TOKEN" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

INSTALL_DIR="/Library/AIGuard"
PLIST="/Library/LaunchDaemons/com.aiguard.agent.plist"

launchctl bootout system "$PLIST" 2>/dev/null || true
mkdir -p "$INSTALL_DIR"
install -m 0755 "$BINARY" "$INSTALL_DIR/aiguard-agent"
mkdir -p "/Library/Application Support/AIGuard"
chmod 700 "/Library/Application Support/AIGuard"

ENROLL=("$INSTALL_DIR/aiguard-agent" enroll --server "$SERVER" --token "$TOKEN" --force)
[[ -n "$EXTENSION_ID" ]] && ENROLL+=(--extension-id "$EXTENSION_ID")
"${ENROLL[@]}"

install -m 0644 "$(dirname "$0")/com.aiguard.agent.plist" "$PLIST"
launchctl bootstrap system "$PLIST"
echo "AI Guard agent installed and running."
