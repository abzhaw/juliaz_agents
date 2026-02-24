import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanGitChanges } from '../change-scanner.js';
import * as childProcess from 'child_process';

vi.mock('child_process');

const PROJECT_DIR = '/mock/project';
const LAST_HASH = 'abc123';

describe('scanGitChanges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no uncommitted changes
    vi.mocked(childProcess.execFileSync)
      .mockReturnValueOnce(Buffer.from(''))  // git log
      .mockReturnValueOnce(Buffer.from(''))  // git diff (uncommitted)
      .mockReturnValueOnce(Buffer.from(LAST_HASH)); // git rev-parse
  });

  it('detects a new agent when SOUL.md is added', () => {
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from('A\tnew-agent/SOUL.md\nA\tnew-agent/package.json\n'))
      .mockReturnValueOnce(Buffer.from(''))  // no uncommitted
      .mockReturnValueOnce(Buffer.from('def456'));  // current hash

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    const newAgent = changes.find(c => c.type === 'new_agent');
    expect(newAgent).toBeDefined();
    expect(newAgent!.path).toBe('new-agent/SOUL.md');
    expect(newAgent!.description).toContain('new-agent');
  });

  it('detects config changes when ecosystem.config.js is modified', () => {
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from('M\tecosystem.config.js\n'))
      .mockReturnValueOnce(Buffer.from(''))
      .mockReturnValueOnce(Buffer.from('def456'));

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    const config = changes.find(c => c.type === 'config_change');
    expect(config).toBeDefined();
    expect(config!.path).toBe('ecosystem.config.js');
  });

  it('detects deleted agents when SOUL.md is removed', () => {
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from('D\told-agent/SOUL.md\n'))
      .mockReturnValueOnce(Buffer.from(''))
      .mockReturnValueOnce(Buffer.from('def456'));

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    const removed = changes.find(c => c.type === 'removed_agent');
    expect(removed).toBeDefined();
    expect(removed!.path).toBe('old-agent/SOUL.md');
  });

  it('detects uncommitted documentation changes', () => {
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from(''))  // no committed changes
      .mockReturnValueOnce(Buffer.from('docs/agent_cards/new_card.md\n'))  // uncommitted
      .mockReturnValueOnce(Buffer.from('abc123'));

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    expect(changes.length).toBeGreaterThan(0);
    const docChange = changes.find(c => c.path === 'docs/agent_cards/new_card.md');
    expect(docChange).toBeDefined();
  });

  it('returns empty array when no changes since last hash', () => {
    // defaults from beforeEach: empty git log, empty git diff
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from(''))
      .mockReturnValueOnce(Buffer.from(''))
      .mockReturnValueOnce(Buffer.from(LAST_HASH));

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    expect(changes).toHaveLength(0);
  });

  it('handles git failure gracefully', () => {
    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockImplementation(() => {
        throw new Error('git not found');
      });

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    expect(changes).toHaveLength(0);
  });

  it('classifies multiple change types in a single diff', () => {
    const gitLog = [
      'A\tnew-agent/SOUL.md',
      'M\tecosystem.config.js',
      'M\tdocs/agent_system_overview.md',
      'A\tanalyist/src/index.ts',
      'D\told-agent/SOUL.md',
    ].join('\n');

    vi.mocked(childProcess.execFileSync)
      .mockReset()
      .mockReturnValueOnce(Buffer.from(gitLog + '\n'))
      .mockReturnValueOnce(Buffer.from(''))
      .mockReturnValueOnce(Buffer.from('def456'));

    const changes = scanGitChanges(PROJECT_DIR, LAST_HASH);

    const types = changes.map(c => c.type);
    expect(types).toContain('new_agent');
    expect(types).toContain('config_change');
    expect(types).toContain('removed_agent');
    expect(types).toContain('modified_file');
  });
});
