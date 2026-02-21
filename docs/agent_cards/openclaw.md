# Agent Card: OpenClaw

## What is it?
OpenClaw is the **communication specialist**. It connects the Julia system to messaging apps like Telegram (and optionally WhatsApp, Slack, Discord). When you send a message to Julia via Telegram, OpenClaw is the one that actually receives it and passes it along. When Julia replies, OpenClaw is the one that delivers the reply back to you.

## What problem does it solve?
Julia doesn't know how to speak Telegram or WhatsApp — those are complex technical integrations. OpenClaw handles all of that complexity so Julia can focus on thinking and reasoning, while OpenClaw focuses on sending and receiving.

## How does it connect to the rest of the system?
OpenClaw is Julia's dedicated messenger. Julia sends tasks to OpenClaw with a simple instruction, like: "Send this message to the Telegram user." OpenClaw handles the rest and reports back when done. They communicate through a real-time channel (called a WebSocket — a permanent, open connection between two programs).

## What can it do?
- Receive incoming messages from Telegram and deliver them to Julia
- Send Julia's replies back to users on Telegram
- Manage multiple messaging channels at once (Telegram, WhatsApp, Slack, Discord)
- Remember who it has talked to and what was discussed
- Check its own health and recover from errors automatically
- Control access — only approved users can talk to the bot

## What can it NOT do?
- Make decisions or generate replies on its own — it relays Julia's answers
- Read your code files or change any software
- Connect to the internet freely — it only uses approved messaging platforms

## Current Setup
- **Telegram**: ✅ Connected
- **Security**: Pairing mode — new users need to be approved before they can chat
- **Location**: Runs on your local machine (not on a cloud server)
- **Model**: Uses GPT-5.1-codex for any AI reasoning it needs to do independently

## Analogy
OpenClaw is like a **telephone switchboard operator** from the old days. When a call comes in, the operator receives it, notes who's calling, and routes it to the right person. When someone inside needs to make a call, the operator places it for them.

---
*Updated: 2026-02-21 by Docs Agent*
