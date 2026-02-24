import { execFileSync } from 'child_process';
import type { SystemChange, ChangeType } from './types.js';

/**
 * Scan git history for system changes since the last run.
 *
 * Uses two strategies:
 *   1. `git log --name-status` for committed changes since lastGitHash
 *   2. `git diff --name-only` for uncommitted changes
 *
 * Classifies each changed file by path pattern:
 *   - SOUL.md added      → new_agent
 *   - SOUL.md deleted    → removed_agent
 *   - ecosystem.config   → config_change
 *   - docs/              → modified_file (documentation itself)
 *   - Other added files  → new_file
 *   - Other modified     → modified_file
 *   - Other deleted      → deleted_file
 */
export function scanGitChanges(projectDir: string, lastGitHash: string): SystemChange[] {
  const changes: SystemChange[] = [];

  try {
    // 1. Committed changes since last run
    const committed = gitNameStatus(projectDir, lastGitHash);
    for (const { status, path } of committed) {
      const change = classifyChange(status, path);
      if (change) changes.push(change);
    }

    // 2. Uncommitted changes (working tree)
    const uncommitted = gitDiffNameOnly(projectDir);
    for (const path of uncommitted) {
      // Uncommitted files are treated as modified (we don't know if they're new)
      const change = classifyChange('M', path);
      if (change) changes.push(change);
    }
  } catch (e) {
    console.log(`[docs-agent] Git scan failed: ${(e as Error).message}`);
    return [];
  }

  // Deduplicate by path (committed + uncommitted may overlap)
  const seen = new Set<string>();
  return changes.filter(c => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

/**
 * Get the current git HEAD hash.
 */
export function getCurrentGitHash(projectDir: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectDir,
      timeout: 5000,
      stdio: 'pipe',
    }).toString().trim();
  } catch {
    return '';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface GitNameStatusEntry {
  status: string;  // A, M, D, R, etc.
  path: string;
}

function gitNameStatus(projectDir: string, lastGitHash: string): GitNameStatusEntry[] {
  if (!lastGitHash) return [];

  const output = execFileSync(
    'git',
    ['log', '--name-status', '--format=', `${lastGitHash}..HEAD`],
    { cwd: projectDir, timeout: 10000, stdio: 'pipe' },
  ).toString().trim();

  if (!output) return [];

  return output.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split('\t');
      if (parts.length < 2) return null;
      return { status: parts[0].charAt(0), path: parts[1] };
    })
    .filter((entry): entry is GitNameStatusEntry => entry !== null);
}

function gitDiffNameOnly(projectDir: string): string[] {
  const output = execFileSync(
    'git',
    ['diff', '--name-only'],
    { cwd: projectDir, timeout: 10000, stdio: 'pipe' },
  ).toString().trim();

  if (!output) return [];
  return output.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function classifyChange(gitStatus: string, filePath: string): SystemChange | null {
  // SOUL.md changes → agent added/removed
  if (filePath.endsWith('/SOUL.md') || filePath === 'SOUL.md') {
    if (gitStatus === 'A') {
      const agentName = filePath.split('/')[0];
      return {
        type: 'new_agent',
        path: filePath,
        description: `New agent detected: ${agentName} (SOUL.md added)`,
      };
    }
    if (gitStatus === 'D') {
      const agentName = filePath.split('/')[0];
      return {
        type: 'removed_agent',
        path: filePath,
        description: `Agent removed: ${agentName} (SOUL.md deleted)`,
      };
    }
  }

  // Ecosystem config changes
  if (filePath.startsWith('ecosystem.config')) {
    return {
      type: 'config_change',
      path: filePath,
      description: 'PM2 ecosystem configuration changed',
    };
  }

  // Documentation changes
  if (filePath.startsWith('docs/')) {
    return {
      type: 'modified_file',
      path: filePath,
      description: `Documentation file changed: ${filePath}`,
    };
  }

  // Other file changes
  const typeMap: Record<string, ChangeType> = {
    A: 'new_file',
    M: 'modified_file',
    D: 'deleted_file',
  };

  const changeType = typeMap[gitStatus];
  if (!changeType) return null;

  return {
    type: changeType,
    path: filePath,
    description: `File ${gitStatus === 'A' ? 'added' : gitStatus === 'D' ? 'deleted' : 'modified'}: ${filePath}`,
  };
}
