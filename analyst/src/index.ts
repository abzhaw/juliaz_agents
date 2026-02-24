import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { IncidentManager } from './incidents.js';
import { AnalystLLM } from './llm.js';
import { TelegramSender } from './telegram.js';
import type { CollectorOutput, IncidentState, CadenceState, Suppressions } from './types.js';

// ── Configuration ────────────────────────────────────────────────────────────

const PROJECT_DIR = process.env.PROJECT_DIR || '/Users/raphael/juliaz_agents';
dotenv.config({ path: join(PROJECT_DIR, '.env.secrets') });

const SHARED_DIR = join(PROJECT_DIR, 'shared-findings');
const CONFIG_DIR = join(PROJECT_DIR, 'analyst', 'config');
const INCIDENTS_FILE = join(SHARED_DIR, 'incidents.json');
const CADENCE_FILE = join(SHARED_DIR, 'cadence.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJSON<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Load all collector outputs from shared-findings/*.json.
 * Skips incidents.json and cadence.json (Analyst's own state files).
 */
function loadCollectorFindings(): CollectorOutput[] {
  const outputs: CollectorOutput[] = [];
  if (!existsSync(SHARED_DIR)) return outputs;

  for (const file of readdirSync(SHARED_DIR)) {
    if (!file.endsWith('.json')) continue;
    if (file === 'incidents.json' || file === 'cadence.json') continue;

    try {
      const data = JSON.parse(readFileSync(join(SHARED_DIR, file), 'utf-8'));
      if (data.agent && Array.isArray(data.findings)) {
        outputs.push(data as CollectorOutput);
      }
    } catch {
      console.log(`[analyst] Skipping invalid file: ${file}`);
    }
  }

  return outputs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[analyst] Starting analysis cycle...');

  // 1. Load all inputs
  const collectorOutputs = loadCollectorFindings();
  const incidents = readJSON<IncidentState>(INCIDENTS_FILE, { incidents: {}, resolved: [] });
  const cadence = readJSON<CadenceState>(CADENCE_FILE, {
    last_digest_sent: '',
    last_digest_hash: '',
    messages_this_hour: 0,
    last_daily_digest: '',
    last_weekly_digest: '',
  });
  const suppressions = readJSON<Suppressions>(
    join(CONFIG_DIR, 'suppressions.json'),
    { known_safe_ports: {}, known_safe_processes: [], suppressed_findings: {}, language_tags: [] }
  );

  const totalFindings = collectorOutputs.reduce((n, o) => n + o.findings.length, 0);
  console.log(
    `[analyst] Loaded ${collectorOutputs.length} collectors, ` +
    `${totalFindings} total findings, ` +
    `${Object.keys(incidents.incidents).length} open incidents`
  );

  // 2. Process incidents (rules-based, always runs)
  const incidentManager = new IncidentManager();
  const updatedIncidents = incidentManager.processFindings(collectorOutputs, incidents);

  // 3. Call LLM for correlation and digest
  const llm = new AnalystLLM();
  const analysis = await llm.analyze(collectorOutputs, updatedIncidents, cadence, suppressions);

  // 4. Apply LLM's incident updates (if any)
  if (analysis.incidents_update) {
    for (const update of analysis.incidents_update) {
      if (update.action === 'update' && updatedIncidents.incidents[update.id]) {
        updatedIncidents.incidents[update.id].root_cause_hypothesis = update.root_cause;
        updatedIncidents.incidents[update.id].title = update.title;
        updatedIncidents.incidents[update.id].severity = update.severity;
      }
    }
  }

  // 5. Save updated incident state
  writeJSON(INCIDENTS_FILE, updatedIncidents);

  // 6. Send Telegram if needed
  if (analysis.should_notify && analysis.digest) {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '8519931474';

    if (token) {
      const telegram = new TelegramSender(token, chatId);
      const sent = await telegram.send(analysis.digest, cadence);

      if (sent) {
        // Update cadence state
        const now = new Date();
        const lastHour = cadence.last_digest_sent
          ? new Date(cadence.last_digest_sent)
          : new Date(0);
        const sameHour = now.getHours() === lastHour.getHours() &&
                         now.toDateString() === lastHour.toDateString();

        const newCadence: CadenceState = {
          last_digest_sent: now.toISOString(),
          last_digest_hash: createHash('md5').update(analysis.digest).digest('hex').slice(0, 8),
          messages_this_hour: sameHour ? cadence.messages_this_hour + 1 : 1,
          last_daily_digest: cadence.last_daily_digest,
          last_weekly_digest: cadence.last_weekly_digest,
        };
        writeJSON(CADENCE_FILE, newCadence);
      }
    } else {
      console.log('[analyst] No TELEGRAM_BOT_TOKEN — skipping notification');
      console.log('[analyst] Would have sent:', analysis.digest.slice(0, 200));
    }
  } else {
    console.log(`[analyst] No notification needed: ${analysis.notification_reason || 'all quiet'}`);
  }

  console.log(
    `[analyst] Analysis complete. ` +
    `${Object.keys(updatedIncidents.incidents).length} open incidents, ` +
    `${updatedIncidents.resolved.length} resolved.`
  );
}

main().catch(e => {
  console.error('[analyst] Fatal error:', e);
  process.exit(1);
});
