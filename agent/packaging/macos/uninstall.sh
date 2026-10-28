#!/bin/bash
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }
PLIST="/Library/LaunchDaemons/com.aiguard.agent.plist"
launchctl bootout system "$PLIST" 2>/dev/null
rm -f "$PLIST"
rm -rf /Library/AIGuard
# Remove the managed block from /etc/hosts.
sed -i '' '/^# BEGIN AIGUARD/,/^# END AIGUARD/d' /etc/hosts
dscacheutil -flushcache; killall -HUP mDNSResponder 2>/dev/null
echo "AI Guard agent removed. Data in /Library/Application Support/AIGuard was kept."
