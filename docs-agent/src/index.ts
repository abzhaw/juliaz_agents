import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import dotenv from 'dotenv';
import { runStructuralDetector } from './detector.js';
import { scanGitChanges, getCurrentGitHash } from './change-scanner.js';
import { DocsAgentLLM } from './llm.js';
import { DocWriter } from './doc-writer.js';
import { TelegramSender } from './telegram.js';
import type {
  CollectorOutput,
  DocsAgentState,
  DocProposal,
  DocTargetType,
  ProposalTrigger,
} from './types.js';

// ── Configuration ────────────────────────────────────────────────────────────

const PROJECT_DIR = process.env.PROJECT_DIR || '/Users/raphael/juliaz_agents';
dotenv.config({ path: join(PROJECT_DIR, '.env.secrets') });

const DOCS_AGENT_DIR = join(PROJECT_DIR, 'docs-agent');
const SHARED_DIR = join(PROJECT_DIR, 'shared-findings');
const PROPOSALS_DIR = join(DOCS_AGENT_DIR, 'proposals');
const STATE_FILE = join(DOCS_AGENT_DIR, 'memory', 'state.json');
const CADENCE_FILE = join(DOCS_AGENT_DIR, 'memory', 'cadence.json');

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

function inferDocTargetType(targetFile: string): DocTargetType {
  if (targetFile.includes('agent_cards/')) return 'agent_card';
  if (targetFile.endsWith('SOUL.md')) return 'soul_md';
  if (targetFile.endsWith('IDENTITY.md')) return 'identity_md';
  if (targetFile.endsWith('HEARTBEAT.md')) return 'heartbeat_md';
  return 'overview_section';
}

function inferTrigger(action: string, targetFile: string): ProposalTrigger {
  if (targetFile.includes('docs-agent/')) return 'self_bootstrap';
  if (action === 'create') return 'missing_docs';
  return 'drift_detected';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[docs-agent] Starting documentation check cycle...');

  // 1. Load state from last run
  const defaultState: DocsAgentState = {
    last_run: '',
    last_git_hash: '',
    files_snapshot: {},
  };
  const state = readJSON<DocsAgentState>(STATE_FILE, defaultState);

  const cadence = readJSON(CADENCE_FILE, {
    messages_this_hour: 0,
    last_digest_hash: '',
    last_digest_sent: '',
  });

  // 2. Phase 1: Run structural detector (bash script — free, fast)
  console.log('[docs-agent] Phase 1: Structural checks...');
  const structuralFindings = await runStructuralDetector(PROJECT_DIR);
  console.log(`[docs-agent] Structural: ${structuralFindings.findings.length} findings`);

  // 3. Phase 2: Scan for system changes since last run
  console.log('[docs-agent] Phase 2: Change detection...');
  const changes = scanGitChanges(PROJECT_DIR, state.last_git_hash);
  console.log(`[docs-agent] Changes: ${changes.length} detected since last run`);

  // 4. Decision: do we need LLM reasoning?
  const needsLLM = structuralFindings.findings.length > 0 || changes.length > 0;

  if (!needsLLM) {
    console.log('[docs-agent] All synchronized, no changes. Skipping LLM.');
    writeSharedFindings(structuralFindings);
    updateState(state);
    console.log('[docs-agent] Documentation check complete.');
    return;
  }

  // 5. Phase 3: LLM reasoning — analyze drift and changes
  console.log('[docs-agent] Phase 3: LLM analysis...');
  const llm = new DocsAgentLLM();
  const analysis = await llm.analyzeDrift(structuralFindings.findings, changes);
  console.log(`[docs-agent] Analysis: ${analysis.drift_assessments.length} assessments, ${analysis.proposals.length} proposal requests`);

  // 6. Phase 4: Generate documentation proposals
  console.log('[docs-agent] Phase 4: Generating proposals...');
  const writer = new DocWriter(PROJECT_DIR, PROPOSALS_DIR);
  const proposals: DocProposal[] = [];

  for (const request of analysis.proposals) {
    const targetType = inferDocTargetType(request.target_file);

    // Call LLM to generate actual documentation content
    const content = await llm.generateDoc(request.context, targetType, request.target_file);

    const proposal: DocProposal = {
      id: writer.generateProposalId(),
      timestamp: new Date().toISOString(),
      trigger: inferTrigger(request.action, request.target_file),
      target_file: request.target_file,
      action: request.action,
      content,
      summary: `${request.action === 'create' ? 'Create' : 'Update'} ${request.target_file}`,
      status: 'pending',
    };

    await writer.writeProposal(proposal);
    proposals.push(proposal);
  }

  if (proposals.length > 0) {
    await writer.updateManifest(proposals);
    console.log(`[docs-agent] Generated ${proposals.length} proposals`);
  }

  // 7. Write enriched shared-findings output
  writeSharedFindings(structuralFindings, analysis.drift_assessments);

  // 8. Send Telegram summary
  const telegramSummary = buildTelegramMessage(
    structuralFindings.findings.length,
    changes.length,
    proposals,
    analysis.telegram_summary,
  );

  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '8519931474';

  if (token && telegramSummary) {
    const telegram = new TelegramSender(token, chatId);
    const sent = await telegram.send(telegramSummary, cadence);

    if (sent) {
      const newCadence = {
        messages_this_hour: cadence.messages_this_hour + 1,
        last_digest_hash: TelegramSender.hashDigest(telegramSummary),
        last_digest_sent: new Date().toISOString(),
      };
      writeJSON(CADENCE_FILE, newCadence);
    }
  } else if (!token) {
    console.log('[docs-agent] No TELEGRAM_BOT_TOKEN — skipping notification');
    if (telegramSummary) {
      console.log('[docs-agent] Would have sent:', telegramSummary.slice(0, 300));
    }
  }

  // 9. Update state for next run
  updateState(state);

  console.log(`[docs-agent] Documentation check complete. ${proposals.length} proposals generated.`);
}

// ── Shared Findings Output ───────────────────────────────────────────────────

function writeSharedFindings(
  structural: CollectorOutput,
  assessments?: Array<{ finding_id: string; semantic_severity: string; explanation: string }>,
): void {
  type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
  const validSeverities = new Set<string>(['critical', 'high', 'medium', 'low', 'info']);

  // Enrich findings with LLM severity assessments
  const enrichedFindings = structural.findings.map(f => {
    const assessment = assessments?.find(a => a.finding_id === f.id);
    if (assessment && validSeverities.has(assessment.semantic_severity)) {
      return {
        ...f,
        severity: assessment.semantic_severity as Severity,
        raw_data: { ...f.raw_data, llm_explanation: assessment.explanation },
      };
    }
    return f;
  });

  const output: CollectorOutput = {
    agent: 'docs-agent',
    timestamp: new Date().toISOString(),
    findings: enrichedFindings,
    healthy: structural.healthy,
  };

  mkdirSync(SHARED_DIR, { recursive: true });
  writeJSON(join(SHARED_DIR, 'docs-agent.json'), output);
}

// ── State Persistence ────────────────────────────────────────────────────────

function updateState(state: DocsAgentState): void {
  const currentHash = getCurrentGitHash(PROJECT_DIR);
  const newState: DocsAgentState = {
    last_run: new Date().toISOString(),
    last_git_hash: currentHash || state.last_git_hash,
    files_snapshot: state.files_snapshot, // TODO: update file mtime snapshot
  };
  writeJSON(STATE_FILE, newState);
}

// ── Telegram Message ─────────────────────────────────────────────────────────

function buildTelegramMessage(
  findingCount: number,
  changeCount: number,
  proposals: DocProposal[],
  llmSummary: string,
): string {
  if (findingCount === 0 && changeCount === 0 && proposals.length === 0) {
    return ''; // Nothing to report
  }

  const parts: string[] = [];
  parts.push('*Docs Agent — Documentation Update*');
  parts.push('');

  if (findingCount > 0) {
    parts.push(`*Structural drift:* ${findingCount} finding(s)`);
  }
  if (changeCount > 0) {
    parts.push(`*System changes:* ${changeCount} detected`);
  }

  if (proposals.length > 0) {
    parts.push('');
    parts.push(`*Proposals generated:* ${proposals.length}`);
    for (const p of proposals.slice(0, 5)) {
      parts.push(`  - ${p.action} \`${p.target_file}\``);
    }
    if (proposals.length > 5) {
      parts.push(`  ...and ${proposals.length - 5} more`);
    }
    parts.push('');
    parts.push('Review: `docs-agent/proposals/index.json`');
  }

  if (llmSummary) {
    parts.push('');
    parts.push(llmSummary);
  }

  return parts.join('\n');
}

// ── Entry Point ──────────────────────────────────────────────────────────────

main().catch(e => {
  console.error('[docs-agent] Fatal error:', e);
  process.exit(1);
});
