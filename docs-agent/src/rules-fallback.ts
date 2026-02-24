import type { Finding, SystemChange, LLMAnalysis, DriftAssessment, ProposalRequest } from './types.js';

/**
 * Rules-based fallback for when no LLM is available.
 *
 * Produces structured analysis using simple heuristics:
 *   - Missing SOUL.md files → high severity, propose creation from template
 *   - Missing agent cards   → medium severity, propose creation
 *   - Undocumented PM2 entries → low severity, propose overview update
 *   - New agents detected   → high severity, propose full doc set
 *
 * Generated docs use skeleton templates with TODO markers instead of prose.
 * This ensures the docs-agent never goes silent even without API keys.
 */
export class RulesFallback {
  analyzeDrift(findings: Finding[], changes: SystemChange[]): LLMAnalysis {
    const assessments: DriftAssessment[] = [];
    const proposals: ProposalRequest[] = [];
    const summaryParts: string[] = [];

    // Assess each structural finding
    for (const finding of findings) {
      const assessment = this.assessFinding(finding);
      assessments.push(assessment);

      const proposal = this.proposalForFinding(finding);
      if (proposal) proposals.push(proposal);
    }

    // Assess each system change
    for (const change of changes) {
      const changeProposals = this.proposalsForChange(change);
      proposals.push(...changeProposals);
    }

    // Build Telegram summary
    if (findings.length === 0 && changes.length === 0) {
      summaryParts.push('All documentation synchronized — no drift detected.');
    } else {
      if (findings.length > 0) {
        summaryParts.push(`*Structural drift:* ${findings.length} finding(s)`);
      }
      if (changes.length > 0) {
        summaryParts.push(`*System changes:* ${changes.length} detected`);
      }
      if (proposals.length > 0) {
        summaryParts.push(`*Proposals:* ${proposals.length} generated (rules-based, review needed)`);
        for (const p of proposals.slice(0, 5)) {
          summaryParts.push(`  - ${p.action} \`${p.target_file}\``);
        }
        if (proposals.length > 5) {
          summaryParts.push(`  ...and ${proposals.length - 5} more`);
        }
      }
    }

    return {
      drift_assessments: assessments,
      proposals,
      telegram_summary: summaryParts.join('\n'),
    };
  }

  /**
   * Generate skeleton documentation content for a target type.
   * Uses TODO markers where LLM-generated prose would normally go.
   */
  generateDoc(context: string, targetFile: string): string {
    if (targetFile.includes('agent_cards/')) {
      return this.skeletonAgentCard(context);
    }
    if (targetFile.endsWith('SOUL.md')) {
      return this.skeletonSoulMd(context);
    }
    if (targetFile.endsWith('IDENTITY.md')) {
      return this.skeletonIdentityMd(context);
    }
    if (targetFile.endsWith('HEARTBEAT.md')) {
      return this.skeletonHeartbeatMd(context);
    }
    return `<!-- TODO: Generate documentation for ${targetFile} -->\n\n${context}\n`;
  }

  // ── Finding assessment ────────────────────────────────────────────────────

  private assessFinding(finding: Finding): DriftAssessment {
    const title = finding.title.toLowerCase();

    if (title.includes('missing identity') || title.includes('missing soul')) {
      return {
        finding_id: finding.id,
        semantic_severity: 'high',
        explanation: 'Identity files define how an agent operates. Missing files may indicate an incomplete agent setup.',
        suggested_fix: 'Create the missing identity file using the standard template.',
      };
    }

    if (title.includes('missing agent card')) {
      return {
        finding_id: finding.id,
        semantic_severity: 'medium',
        explanation: 'Agent cards are the primary reference for understanding what each agent does.',
        suggested_fix: 'Create an agent card following the standard template.',
      };
    }

    if (title.includes('pm2 service') || title.includes('not in agent')) {
      return {
        finding_id: finding.id,
        semantic_severity: 'low',
        explanation: 'The system overview should list all PM2 services for operational awareness.',
        suggested_fix: 'Add the missing service to agent_system_overview.md.',
      };
    }

    if (title.includes('port')) {
      return {
        finding_id: finding.id,
        semantic_severity: 'medium',
        explanation: 'Undocumented ports can cause confusion during debugging and operations.',
        suggested_fix: 'Document the port assignment in the system overview.',
      };
    }

    // Default
    return {
      finding_id: finding.id,
      semantic_severity: finding.severity === 'critical' ? 'critical' : 'low',
      explanation: 'Documentation drift detected by structural check.',
      suggested_fix: 'Review and update the relevant documentation.',
    };
  }

  // ── Proposal generation ───────────────────────────────────────────────────

  private proposalForFinding(finding: Finding): ProposalRequest | null {
    const title = finding.title.toLowerCase();

    if (title.includes('missing agent card')) {
      const agentMatch = finding.detail.match(/\*([^*]+)\*/);
      const agentName = agentMatch ? agentMatch[1] : 'unknown';
      return {
        target_file: `docs/agent_cards/${agentName.replace(/-/g, '_')}.md`,
        action: 'create',
        context: `Agent "${agentName}" has a SOUL.md but no agent card. ${finding.detail}`,
      };
    }

    if (title.includes('missing identity') || title.includes('missing heartbeat')) {
      const agentMatch = finding.detail.match(/\*([^*]+)\*/);
      const agentName = agentMatch ? agentMatch[1] : 'unknown';
      const fileType = title.includes('identity') ? 'IDENTITY.md' : 'HEARTBEAT.md';
      return {
        target_file: `${agentName}/${fileType}`,
        action: 'create',
        context: `Agent "${agentName}" is missing ${fileType}. ${finding.detail}`,
      };
    }

    return null;
  }

  private proposalsForChange(change: SystemChange): ProposalRequest[] {
    const proposals: ProposalRequest[] = [];

    if (change.type === 'new_agent') {
      const agentName = change.path.split('/')[0];
      proposals.push({
        target_file: `docs/agent_cards/${agentName.replace(/-/g, '_')}.md`,
        action: 'create',
        context: `New agent detected: ${agentName}. ${change.description}`,
      });
    }

    if (change.type === 'config_change') {
      proposals.push({
        target_file: 'docs/agent_system_overview.md',
        action: 'update',
        section: 'Agent Configuration',
        context: `System configuration changed. ${change.description}`,
      });
    }

    return proposals;
  }

  // ── Skeleton templates ────────────────────────────────────────────────────

  private skeletonAgentCard(context: string): string {
    return `# Agent Card — TODO: Agent Name

## Identity

| Field | Value |
|-------|-------|
| **Name** | TODO |
| **Role** | TODO |
| **Workspace** | TODO |
| **Status** | TODO |

## What It Does

<!-- TODO: Describe what this agent does. Context: ${context.slice(0, 200)} -->

## Behavior

- TODO: Describe agent behavior patterns

## Key Files

| File | Purpose |
|------|---------|
| \`SOUL.md\` | Core identity and principles |
| TODO | TODO |

## Dependencies

- TODO: List dependencies

## Automation

- **Schedule**: TODO
- **Config**: TODO
`;
  }

  private skeletonSoulMd(context: string): string {
    return `# TODO: Agent Name — Soul

## Who I Am

<!-- TODO: Describe identity. Context: ${context.slice(0, 200)} -->

## My Principles

1. TODO: First principle
2. TODO: Second principle

## What I Do

- TODO: Core responsibilities

## What I Don't Do

- TODO: Boundaries
`;
  }

  private skeletonIdentityMd(context: string): string {
    return `# TODO: Agent Name — Identity

| Field | Value |
|-------|-------|
| Name | TODO |
| Role | TODO |
| Schedule | TODO |
| Language | TODO |

## What I Do

<!-- TODO: Technical spec. Context: ${context.slice(0, 200)} -->

## Dependencies

- TODO: List dependencies
`;
  }

  private skeletonHeartbeatMd(context: string): string {
    return `# TODO: Agent Name — Heartbeat

## Health Indicators

- **Healthy**: TODO
- **Degraded**: TODO
- **Error**: TODO

## Logs

\`\`\`bash
# TODO: How to check logs
\`\`\`

## Manual Run

\`\`\`bash
# TODO: How to run manually
\`\`\`
`;
  }
}
