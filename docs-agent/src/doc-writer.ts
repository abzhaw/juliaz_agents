import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { DocProposal, ProposalManifest } from './types.js';

/**
 * DocWriter manages the proposal staging directory.
 *
 * Every documentation change the docs-agent suggests goes through this writer:
 *   1. The proposal is written as a standalone markdown file in proposals/
 *   2. The manifest (proposals/index.json) is updated with the new entry
 *   3. The human reviews and applies proposals manually
 *
 * The docs-agent NEVER overwrites production documentation directly.
 */
export class DocWriter {
  private counter = 0;

  constructor(
    private projectDir: string,
    private proposalsDir: string,
  ) {
    mkdirSync(this.proposalsDir, { recursive: true });
  }

  /**
   * Write a proposal file to the staging directory.
   * Returns the full path to the written file.
   */
  async writeProposal(proposal: DocProposal): Promise<string> {
    // Generate filename from proposal metadata
    const dateStr = proposal.timestamp.slice(0, 13).replace(/[T:]/g, '-');
    const slug = proposal.target_file
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const filename = `${dateStr}-${slug}.md`;
    const filePath = join(this.proposalsDir, filename);

    // Build file with YAML-style header
    const header = [
      '<!-- Docs Agent Proposal',
      `  id: ${proposal.id}`,
      `  target: ${proposal.target_file}`,
      `  action: ${proposal.action}`,
      `  trigger: ${proposal.trigger}`,
      `  generated: ${proposal.timestamp}`,
      `  status: ${proposal.status}`,
      '-->',
    ].join('\n');

    const content = `${header}\n\n${proposal.content}\n`;
    writeFileSync(filePath, content, 'utf-8');

    console.log(`[docs-agent] Wrote proposal: ${filename}`);
    return filePath;
  }

  /**
   * Update the manifest with new proposals.
   * Appends to existing proposals rather than replacing.
   */
  async updateManifest(newProposals: DocProposal[]): Promise<void> {
    const existing = await this.readManifest();

    const manifest: ProposalManifest = {
      last_updated: new Date().toISOString(),
      proposals: [...existing.proposals, ...newProposals],
    };

    const manifestPath = join(this.proposalsDir, 'index.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Read the existing proposal manifest.
   * Returns an empty manifest if no file exists.
   */
  async readManifest(): Promise<ProposalManifest> {
    const manifestPath = join(this.proposalsDir, 'index.json');

    try {
      if (!existsSync(manifestPath)) {
        return { last_updated: '', proposals: [] };
      }
      const raw = readFileSync(manifestPath, 'utf-8');
      return JSON.parse(raw) as ProposalManifest;
    } catch {
      return { last_updated: '', proposals: [] };
    }
  }

  /**
   * Generate a unique proposal ID.
   * Format: prop-YYYYMMDD-NNN
   */
  generateProposalId(): string {
    this.counter++;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `prop-${dateStr}-${String(this.counter).padStart(3, '0')}`;
  }
}
