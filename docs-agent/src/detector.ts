import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CollectorOutput } from './types.js';

/**
 * Run the existing bash structural detector (docs_drift_check.sh).
 *
 * The bash script performs 5 fast, free checks:
 *   1. Agent directories with SOUL.md → matching agent card exists?
 *   2. PM2 ecosystem entries → mentioned in overview?
 *   3. Hardcoded ports → documented?
 *   4. start-system.sh step count → matches README?
 *   5. Agent directories with SOUL.md → IDENTITY.md + HEARTBEAT.md exist?
 *
 * After execution, reads the JSON output from shared-findings/docs-agent.json.
 * Returns empty findings on any failure (graceful degradation).
 */
export async function runStructuralDetector(projectDir: string): Promise<CollectorOutput> {
  const empty: CollectorOutput = {
    agent: 'docs-agent',
    timestamp: new Date().toISOString(),
    findings: [],
    healthy: [],
  };

  const scriptPath = join(projectDir, 'docs-agent', 'scripts', 'docs_drift_check.sh');
  const sharedFindingsPath = join(projectDir, 'shared-findings', 'docs-agent.json');

  // Phase 1: Execute bash detector
  try {
    execFileSync('/bin/bash', [scriptPath], {
      cwd: projectDir,
      timeout: 30000,
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      },
    });
  } catch (e) {
    console.log(`[docs-agent] Structural detector failed: ${(e as Error).message}`);
    return empty;
  }

  // Phase 2: Read the JSON output
  try {
    if (!existsSync(sharedFindingsPath)) {
      console.log('[docs-agent] No shared-findings output from structural detector');
      return empty;
    }

    const raw = readFileSync(sharedFindingsPath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.agent || !Array.isArray(data.findings)) {
      console.log('[docs-agent] Structural detector output missing required fields');
      return empty;
    }

    console.log(`[docs-agent] Structural check: ${data.findings.length} findings`);
    return data as CollectorOutput;
  } catch (e) {
    console.log(`[docs-agent] Failed to parse structural detector output: ${(e as Error).message}`);
    return empty;
  }
}
