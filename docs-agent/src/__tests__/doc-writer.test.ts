import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocWriter } from '../doc-writer.js';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DocProposal } from '../types.js';

const TEST_DIR = join(tmpdir(), 'docs-agent-test-' + Date.now());
const PROPOSALS_DIR = join(TEST_DIR, 'proposals');

describe('DocWriter', () => {
  let writer: DocWriter;

  beforeEach(() => {
    mkdirSync(PROPOSALS_DIR, { recursive: true });
    writer = new DocWriter(TEST_DIR, PROPOSALS_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('writes a proposal file to the proposals directory', async () => {
    const proposal: DocProposal = {
      id: 'prop-20260224-001',
      timestamp: '2026-02-24T14:00:00Z',
      trigger: 'drift_detected',
      target_file: 'docs/agent_cards/new_agent.md',
      action: 'create',
      content: '# Agent Card — New Agent\n\n## What It Does\n\nThis agent does things.',
      summary: 'Create agent card for new-agent',
      status: 'pending',
    };

    const filePath = await writer.writeProposal(proposal);

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('target: docs/agent_cards/new_agent.md');
    expect(content).toContain('action: create');
    expect(content).toContain('# Agent Card — New Agent');
  });

  it('creates and reads a manifest with proposals', async () => {
    const proposals: DocProposal[] = [
      {
        id: 'prop-001',
        timestamp: '2026-02-24T14:00:00Z',
        trigger: 'drift_detected',
        target_file: 'docs/agent_cards/a.md',
        action: 'create',
        content: '# A',
        summary: 'Create A',
        status: 'pending',
      },
      {
        id: 'prop-002',
        timestamp: '2026-02-24T14:00:00Z',
        trigger: 'system_change',
        target_file: 'docs/agent_cards/b.md',
        action: 'update',
        content: '# B',
        summary: 'Update B',
        status: 'pending',
      },
    ];

    await writer.updateManifest(proposals);

    const manifest = await writer.readManifest();
    expect(manifest.proposals).toHaveLength(2);
    expect(manifest.proposals[0].id).toBe('prop-001');
    expect(manifest.proposals[1].id).toBe('prop-002');
  });

  it('appends to existing manifest instead of replacing', async () => {
    const first: DocProposal[] = [{
      id: 'prop-001',
      timestamp: '2026-02-24T14:00:00Z',
      trigger: 'drift_detected',
      target_file: 'a.md',
      action: 'create',
      content: '# A',
      summary: 'Create A',
      status: 'pending',
    }];

    await writer.updateManifest(first);

    const second: DocProposal[] = [{
      id: 'prop-002',
      timestamp: '2026-02-24T15:00:00Z',
      trigger: 'system_change',
      target_file: 'b.md',
      action: 'create',
      content: '# B',
      summary: 'Create B',
      status: 'pending',
    }];

    await writer.updateManifest(second);

    const manifest = await writer.readManifest();
    expect(manifest.proposals).toHaveLength(2);
  });

  it('returns empty manifest when no file exists', async () => {
    const manifest = await writer.readManifest();
    expect(manifest.proposals).toHaveLength(0);
    expect(manifest.last_updated).toBe('');
  });

  it('generates a unique proposal ID', () => {
    const id1 = writer.generateProposalId();
    const id2 = writer.generateProposalId();
    expect(id1).toMatch(/^prop-\d{8}-\d{3,}$/);
    expect(id1).not.toBe(id2);
  });
});
