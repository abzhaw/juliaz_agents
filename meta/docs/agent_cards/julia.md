# Agent Card: Julia

## What is it?
Julia is the **multi-agent platform** this project is building. It is not a single agent — it is a system of cooperating parts: OpenClaw (the communication layer), the Bridge (the MCP glue server), and the Backend API. Together they form a coherent AI-powered product.

> ⚠️ Julia is the **product being built** — not the builder. The builder is **Antigravity** (the IDE agent).

## What problem does it solve?
Julia is a platform for receiving goals via messaging apps, processing them with AI, and delivering results — all automatically. The backend API, communication layer, and message relay are all parts of Julia.

## How does it connect to the rest of the system?
Julia is made up of its components. OpenClaw handles external communication. The Bridge connects OpenClaw to the processing/orchestration layer. The Backend handles data storage and the REST API.

## Components of Julia

| Component | Role |
|---|---|
| **OpenClaw** | Telegram, WhatsApp, Slack, Discord messaging |
| **Bridge** | MCP server gluing OpenClaw to orchestration |
| **Backend API** | REST API + PostgreSQL (runs in Docker) |

## What is NOT Julia
- **Antigravity** (the IDE agent) is not Julia — Antigravity *builds* Julia
- The developer is not Julia

## Analogy
Julia is like a building that is under construction. Antigravity is the construction crew. The building doesn't do the building — it *is* what's being built.

---
*Updated: 2026-02-21 by Docs Agent*
