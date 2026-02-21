# The Agent System — A Plain-Language Guide

> **Who this is for**: Anyone who wants to understand what this project does, without needing to be a software developer.  
> **Maintained by**: The Docs Agent — updated automatically whenever the system changes.  
> **Last updated**: 2026-02-21

---

## What is this project?

This project is called **Julia's Agent System** (`juliaz_agents`). It is a collection of AI assistants — called **agents** — that work together like a small team of specialists.

Think of it like a small company:
- There is a **manager** who receives requests and decides who handles them.
- There are **specialists** who each own one area of work.
- They cooperate, pass tasks to each other, and report back.

The manager is called **Julia**. The specialists are called **OpenClaw**, the **Thesis Agent**, and the **Docs Agent** (who writes this document).

---

## The Big Picture

```
You (the user)
    │
    │  give goals and instructions
    ▼
Julia  ─────────────────────────────  The Manager
    │                                 Breaks down goals, decides who does what
    │
    ├──▶  OpenClaw ─────────────────  The Messenger
    │         Sends and receives messages on apps like Telegram
    │
    ├──▶  Thesis Agent ─────────────  The Researcher & Writer
    │         Documents the project for the master's thesis
    │
    └──▶  Docs Agent ────────────────  The Explainer (that's this one)
              Keeps documentation up to date in plain language
```

---

## The Agents, One by One

### 🧠 Julia — The Manager

Julia is the **central brain**. When you give her a goal, she breaks it down into smaller tasks and decides which specialist should handle each one. She does not send messages herself, and she does not research topics herself — she delegates those things to the right agent.

**Analogy**: Julia is like a project manager at a company. The project manager does not do all the work themselves, but they make sure the right person does each task, and they keep track of the big picture.

**What Julia can do:**
- Receive your goals and instructions
- Break complex goals into smaller tasks
- Decide which agent handles each task
- Build and manage the backend software (the Task API — see below)
- Learn new abilities by reading "skill files" (instruction documents called SKILL.md)

**What Julia cannot do:**
- Send messages to Telegram or WhatsApp (that's OpenClaw's job)
- Write thesis documentation without being asked

---

### 📡 OpenClaw — The Messenger

OpenClaw is the system's **communication layer**. It connects Julia to the outside world — apps like Telegram, WhatsApp, Slack, and Discord. When you send Julia a message via Telegram, OpenClaw receives it first, then passes it to Julia. When Julia wants to reply, she gives the reply to OpenClaw, who sends it back.

**Analogy**: OpenClaw is like a telephone switchboard operator. When a call comes in, the operator receives it and routes it to the right person. When someone needs to make a call, the operator handles the technical side of placing it.

**What OpenClaw can do:**
- Receive messages from Telegram (and other apps)
- Send Julia's replies back to you via Telegram
- Remember past conversations with each contact
- Keep a log of all communication activity
- Check its own health and restart itself if something goes wrong

**What OpenClaw cannot do:**
- Make decisions about what to reply — it relays Julia's words, it doesn't invent its own
- Read your files, write code, or change the system

**Current setup:**
- Telegram is connected ✅
- Security: only approved users can talk to the bot (pairing system)
- The bot runs locally on your computer, not on a remote server

---

### 📚 Thesis Agent — The Researcher & Writer

The Thesis Agent helps document this project for a **master's thesis**. It has three abilities: researching, writing, and logging.

**Analogy**: The Thesis Agent is like a research assistant. You hand them a folder of academic papers to read. They read those papers, summarise the relevant findings, and help you draft sections of your thesis. They never invent citations — they only use what you give them.

**What the Thesis Agent can do:**
- Read and summarise research papers (from `thesis/research_papers/` only)
- Draft thesis sections and save them for your review
- Log every milestone in the project in two formats:  
  — **By date** (what happened on which day)  
  — **By theme** (how topics evolved over time)

**What the Thesis Agent cannot do:**
- Use research from outside the designated folder (strict rule to prevent made-up citations)
- Publish drafts automatically — you review and approve first
- Change the software or communication setup

**How it stays up to date:**
After every 5 interactions with Julia, the Thesis Agent automatically saves a summary to the protocol documents. No manual trigger needed.

---

### 📄 Docs Agent — The Explainer

The Docs Agent is **this documentation system** — the one writing these words. Its job is to keep a clear, always-updated explanation of the entire system in plain language.

**Analogy**: The Docs Agent is like a company's communications officer who writes the internal handbook. Every time a new team member joins or a team's role changes, the handbook is updated.

**What the Docs Agent can do:**
- Update this overview document when the system changes
- Write one-page "agent cards" explaining each agent simply
- Read any agent's configuration to understand what changed

**What the Docs Agent cannot do:**
- Change how agents work — it only describes them
- Write code or send messages

---

## The Backend — The Product Being Built

Alongside the agent system, Julia is building a **Task Management API**. An API (Application Programming Interface) is a kind of service that other software can talk to — like asking a waiter to bring you food in a restaurant.

This API allows software to:
- Create tasks (to-do items)
- List all existing tasks
- Update tasks (mark as complete, change the title)
- Delete tasks

**Technology used** (simplified):
- **Node.js + TypeScript**: the programming language and runtime
- **PostgreSQL**: a database (think of it as a very organised spreadsheet that stores the tasks)
- **Docker**: a technology that packages the software so it runs the same way everywhere
- **Prisma**: a tool that makes it easy to talk to the database

---

## How It Was Built — The Philosophy

### Test-First Development
Every feature was tested before being built. A test in software is like a checklist: "does this feature do what it should?" Tests were written first (describing the desired behaviour), then the code was written to pass those tests. This approach is called **TDD** (Test-Driven Development).

### Specialisation and Boundaries
Each agent owns exactly one area. Julia handles orchestration. OpenClaw handles communication. The Thesis Agent handles documentation. They never step on each other's toes. This is intentional — it makes the system easier to understand, change, and debug.

### Security by Design
- The system only runs on your local machine (not exposed to the internet)
- The Telegram bot only responds to approved users
- No secrets or API keys are stored in the shared code repository

---

## Glossary — Technical Terms Explained

| Term | Plain-language explanation |
|---|---|
| **Agent** | An AI assistant with a specific job and set of abilities |
| **Skill** | A document that teaches an agent how to do a specific task |
| **API** | A service that software programs can talk to, like a phone number for a function |
| **Gateway** | A central hub that routes incoming and outgoing messages |
| **Telegram** | A messaging app (like WhatsApp) used to talk to the system |
| **Docker** | A tool that packages software so it runs consistently on any machine |
| **PostgreSQL** | A database — a system for storing and retrieving structured data |
| **TDD** | Test-Driven Development — writing tests before writing the code |
| **Repository (Repo)** | A folder where all the code and files for a project are stored, with version history |
| **Commit** | A saved snapshot of the project at a point in time |
| **WebSocket** | A way for two programs to stay connected and talk in real time |

---

*This document is maintained by the Docs Agent and updated automatically. Last updated: 2026-02-21.*
