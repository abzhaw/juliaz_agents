// ── Shared Finding Protocol (matches analyst/src/types.ts) ──────────────────

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  detail: string;
  raw_data?: Record<string, unknown>;
  first_seen: string;
  related_to?: string[];
}

export interface CollectorOutput {
  agent: string;
  timestamp: string;
  findings: Finding[];
  healthy: string[];
}

// ── Docs Agent — Change Detection ──────────────────────────────────────────

export type ChangeType =
  | 'new_agent'
  | 'removed_agent'
  | 'config_change'
  | 'new_file'
  | 'modified_file'
  | 'deleted_file';

export interface SystemChange {
  type: ChangeType;
  path: string;
  description: string;
  git_diff?: string;  // Actual diff content for LLM context (truncated to 2000 chars)
}

// ── Docs Agent — Proposals ─────────────────────────────────────────────────

export type ProposalTrigger =
  | 'drift_detected'
  | 'system_change'
  | 'missing_docs'
  | 'self_bootstrap';

export interface DocProposal {
  id: string;               // e.g. "prop-20260224-001"
  timestamp: string;        // ISO 8601
  trigger: ProposalTrigger;
  target_file: string;      // e.g. "docs/agent_cards/analyst.md"
  action: 'create' | 'update';
  content: string;          // The proposed markdown
  summary: string;          // One-line description for Telegram
  status: 'pending' | 'applied' | 'rejected';
}

export interface ProposalManifest {
  last_updated: string;
  proposals: DocProposal[];
}

// ── Docs Agent — State Persistence ─────────────────────────────────────────

export interface DocsAgentState {
  last_run: string;           // ISO 8601 of last successful run
  last_git_hash: string;      // Git HEAD hash at last run
  files_snapshot: Record<string, number>;  // path → mtime (epoch ms)
}

// ── Docs Agent — LLM Analysis ──────────────────────────────────────────────

export interface DriftAssessment {
  finding_id: string;
  semantic_severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;        // Why this matters
  suggested_fix: string;      // What to change
}

export interface ProposalRequest {
  target_file: string;
  action: 'create' | 'update';
  section?: string;           // For updates: which section to modify
  context: string;            // What the LLM needs to know to generate content
}

export interface LLMAnalysis {
  drift_assessments: DriftAssessment[];
  proposals: ProposalRequest[];
  telegram_summary: string;
}

// ── Doc Generation Target Types ────────────────────────────────────────────

export type DocTargetType =
  | 'agent_card'
  | 'soul_md'
  | 'identity_md'
  | 'heartbeat_md'
  | 'overview_section';
