/**
 * Letter Scheduler — generates and sends a daily letter from Raphael to Julia.
 *
 * How it works:
 *   1. Runs a check every 30 minutes
 *   2. If it's past LETTER_HOUR (default 8am) and no letter exists for today → generate one
 *   3. Pulls recent memories from the backend (last 7 days) for context
 *   4. Reads Raphael's daily seed from orchestrator/data/daily-seed.md (if it exists)
 *   5. Claude writes a warm, personal letter in Raphael's voice
 *   6. Saves the letter to the backend DB
 *   7. If Lob is configured, sends it as a real physical letter
 *   8. Archives the seed file so it's not used twice
 *
 * To add your words to tomorrow's letter:
 *   Write anything into orchestrator/data/daily-seed.md
 *   The AI will weave your words into the letter naturally.
 *   The file is archived after use.
 *
 * Environment variables:
 *   LETTER_HOUR=8          ← Hour to send (0-23, default 8am)
 *   BACKEND_URL            ← defaults to http://localhost:3000
 *   + Lob env vars (see lob.ts) for physical sending
 */

import OpenAI from 'openai';
import 'dotenv/config';
import { sendLetter } from './lob.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';
const LETTER_HOUR = Number(process.env.LETTER_HOUR ?? 8);
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(DATA_DIR, 'daily-seed.md');

function log(msg: string): void {
    console.log(`[letter-scheduler] ${new Date().toISOString()} — ${msg}`);
}

function todayDateString(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function letterExistsToday(): Promise<boolean> {
    try {
        const res = await fetch(`${BACKEND}/letters`);
        if (!res.ok) return false;
        const letters = await res.json() as Array<{ createdAt: string }>;
        const today = todayDateString();
        return letters.some(l => l.createdAt.slice(0, 10) === today);
    } catch {
        return false;
    }
}

async function fetchRecentMemories(): Promise<string[]> {
    try {
        const res = await fetch(`${BACKEND}/memories`);
        if (!res.ok) return [];
        const memories = await res.json() as Array<{ content: string; createdAt: string; category: string }>;
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return memories
            .filter(m => new Date(m.createdAt).getTime() > sevenDaysAgo)
            .slice(0, 10)
            .map(m => `[${m.category}] ${m.content}`);
    } catch {
        return [];
    }
}

function readSeed(): string | null {
    if (!fs.existsSync(SEED_FILE)) return null;
    try {
        const content = fs.readFileSync(SEED_FILE, 'utf-8').trim();
        if (!content) return null;
        log(`Seed file read (${content.length} chars) — will archive after generation`);
        return content;
    } catch {
        return null;
    }
}

function archiveSeed(): void {
    const archiveName = `daily-seed-${todayDateString()}.used.md`;
    fs.renameSync(SEED_FILE, path.join(DATA_DIR, archiveName));
    log(`Seed file archived as ${archiveName}`);
}

async function generateLetter(seed: string | null, memories: string[]): Promise<string> {
    const memoryContext = memories.length > 0
        ? `\nThings Julia has shared recently:\n${memories.map(m => `- ${m}`).join('\n')}\n`
        : '';

    const seedContext = seed
        ? `\nRaphael's note for today's letter (his own words to weave in naturally):\n${seed}\n`
        : '';

    const prompt = `You are helping Raphael write a daily letter to his dear friend Julia, who has cancer.

The letter must feel like it genuinely comes from Raphael — warm, personal, from the heart. Not from an AI.
${seedContext}${memoryContext}
Write a heartfelt letter from Raphael to Julia.
- Start with "Dear Julia,"
- 150-250 words
- Warm and personal, not formal or clinical
- If she shared something recently, reference it gently — it shows he listened
- End with love and encouragement
- Close with "With love, Raphael"
- No headers, no bullet points — just the letter`;

    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) throw new Error('Unexpected response from OpenAI');
    return reply.trim();
}

async function saveLetterToBackend(content: string, status: string, lobId?: string): Promise<number> {
    const res = await fetch(`${BACKEND}/letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content,
            status,
            lobId: lobId ?? null,
            sentAt: status === 'SENT' ? new Date().toISOString() : null
        })
    });
    const letter = await res.json() as { id: number };
    return letter.id;
}

async function updateLetterStatus(id: number, status: string, lobId?: string): Promise<void> {
    await fetch(`${BACKEND}/letters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status,
            lobId: lobId ?? undefined,
            sentAt: status === 'SENT' ? new Date().toISOString() : undefined
        })
    });
}

async function runDailyLetter(): Promise<void> {
    const now = new Date();
    if (now.getHours() < LETTER_HOUR) return; // too early

    if (await letterExistsToday()) return; // already done today

    log(`Generating today's letter...`);

    try {
        // Read seed content into memory — NO filesystem changes yet.
        // If generation or save fails, the seed file remains on disk for retry.
        const seed = readSeed();

        const memories = await fetchRecentMemories();

        const letterText = await generateLetter(seed, memories);
        log(`Letter generated (${letterText.length} chars)`);

        // Save as DRAFT first — seed still on disk in case this throws.
        const letterId = await saveLetterToBackend(letterText, 'DRAFT');

        // Both generate and save succeeded — safe to archive the seed now.
        try {
            if (fs.existsSync(SEED_FILE)) {
                archiveSeed();
            }
        } catch (archiveErr) {
            // The letter is already saved; losing the archive step is not fatal.
            log(`Warning: could not archive seed file: ${archiveErr}`);
        }

        // Attempt physical sending via Lob
        const result = await sendLetter(letterText);

        if (result.sent && result.lobId) {
            await updateLetterStatus(letterId, 'SENT', result.lobId);
            log(`✅ Letter sent physically via Lob (${result.lobId})`);
        } else {
            log(`📝 Letter saved as DRAFT. ${result.reason}`);
        }
    } catch (err) {
        log(`Error generating letter: ${err}`);
    }
}

export function startLetterScheduler(): void {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        // Create an empty seed file as a template
        fs.writeFileSync(SEED_FILE, '# Daily Letter Seed\n\nWrite anything here and it will be woven into today\'s letter.\nThis file is archived after use and needs to be recreated for the next day.\n');
        log(`Created data directory and seed template at ${SEED_FILE}`);
    }

    log(`Started. Will check for daily letter every 30 minutes (sends at ${LETTER_HOUR}:00)`);

    // Check immediately on startup, then every 30 minutes
    runDailyLetter().catch(err => log(`Startup check error: ${err}`));
    setInterval(() => {
        runDailyLetter().catch(err => log(`Scheduled check error: ${err}`));
    }, CHECK_INTERVAL_MS);
}
