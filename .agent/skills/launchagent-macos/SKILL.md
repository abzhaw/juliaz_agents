---
name: launchagent-macos
description: macOS LaunchAgent plists, RunAtLoad, scheduling, debugging. Use when configuring auto-start for Julia's services at login or debugging why a service didn't start on boot.
---

# macOS LaunchAgent

## Plist Template
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.juliaz.my-service</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/raphael/juliaz_agents/scripts/my-service.sh</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>/Users/raphael/juliaz_agents/logs/my-service.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/raphael/juliaz_agents/logs/my-service-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>/Users/raphael</string>
    </dict>
</dict>
</plist>
```

## Commands
```bash
# Install (load into launchd)
launchctl load ~/Library/LaunchAgents/com.juliaz.my-service.plist

# Unload (stop and remove)
launchctl unload ~/Library/LaunchAgents/com.juliaz.my-service.plist

# Validate plist syntax
plutil ~/Library/LaunchAgents/com.juliaz.my-service.plist

# Check if loaded
launchctl list | grep juliaz
```

## Key Rules
- Location: `~/Library/LaunchAgents/` (per-user, runs at login)
- Never use `StartInterval: 0` — it's meaningless and confusing
- Always set `KeepAlive: false` for one-shot scripts
- Always include `HOME` and correct `PATH` in EnvironmentVariables
- Add `sleep 30` at script start to let macOS settle after login
- Log stdout and stderr to separate files for debugging

## Julia's LaunchAgents
| Plist | Purpose |
|-------|---------|
| `com.juliaz.agents.startup` | Start all PM2 services + open Chrome at login |
| `com.juliaz.adhd-agent` | Run ADHD hygiene check every 6h |
| `ai.openclaw.gateway` | Keep OpenClaw gateway alive |
