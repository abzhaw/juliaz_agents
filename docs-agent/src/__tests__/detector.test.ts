import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStructuralDetector } from '../detector.js';
import * as childProcess from 'child_process';
import * as fs from 'fs';

vi.mock('child_process');
vi.mock('fs');

const PROJECT_DIR = '/mock/project';

describe('runStructuralDetector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses shared-findings JSON after running bash script', async () => {
    const mockOutput = {
      agent: 'docs-agent',
      timestamp: '2026-02-24T12:00:00Z',
      findings: [
        {
          id: 'docs-1234',
          severity: 'low',
          category: 'documentation-drift',
          title: 'Missing agent card for *new-agent*',
          detail: 'Missing agent card for *new-agent* (has SOUL.md but no card)',
          first_seen: '2026-02-24T12:00:00Z',
          related_to: [],
        },
      ],
      healthy: [],
    };

    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''));
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockOutput));

    const result = await runStructuralDetector(PROJECT_DIR);

    expect(result.agent).toBe('docs-agent');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toContain('Missing agent card');
  });

  it('calls bash with correct script path', async () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''));
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await runStructuralDetector(PROJECT_DIR);

    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      '/bin/bash',
      [expect.stringContaining('docs_drift_check.sh')],
      expect.objectContaining({
        cwd: PROJECT_DIR,
        timeout: 30000,
      }),
    );
  });

  it('returns empty findings when bash script fails', async () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('bash: command not found');
    });

    const result = await runStructuralDetector(PROJECT_DIR);

    expect(result.agent).toBe('docs-agent');
    expect(result.findings).toHaveLength(0);
    expect(result.healthy).toHaveLength(0);
  });

  it('returns empty findings when JSON file does not exist', async () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''));
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await runStructuralDetector(PROJECT_DIR);

    expect(result.agent).toBe('docs-agent');
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty findings when JSON is malformed', async () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''));
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json{{{');

    const result = await runStructuralDetector(PROJECT_DIR);

    expect(result.agent).toBe('docs-agent');
    expect(result.findings).toHaveLength(0);
  });
});
