import type {
  CollectorOutput,
  Finding,
  IncidentState,
  Incident,
  ResolvedIncident,
} from './types.js';

/**
 * IncidentManager processes collector findings into an incident lifecycle.
 *
 * Key behaviors:
 * - Creates new incidents when unmatched findings appear
 * - Updates duration/escalation for persistent incidents
 * - Resolves incidents when all their contributing findings disappear
 * - Groups low-severity findings into a single "housekeeping" incident
 * - Critical/high findings become individual incidents (can correlate via related_to)
 * - Trims resolved history to last 50 entries
 */
export class IncidentManager {
  private counter = 0;

  generateId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.counter++;
    return `INC-${date}-${String(this.counter).padStart(3, '0')}`;
  }

  getEscalationLevel(durationMinutes: number): number {
    if (durationMinutes < 15) return 1;
    if (durationMinutes < 60) return 2;
    if (durationMinutes < 240) return 3;
    return 4;
  }

  processFindings(
    collectorOutputs: CollectorOutput[],
    currentState: IncidentState
  ): IncidentState {
    // Derive "now" from the latest collector timestamp (deterministic + testable)
    // Falls back to wall clock if no collectors provided
    const latestTimestamp = collectorOutputs
      .map(o => o.timestamp)
      .filter(Boolean)
      .sort()
      .pop();
    const now = latestTimestamp || new Date().toISOString();

    // Collect all current finding IDs from all collectors
    const allFindings = new Map<string, Finding>();
    for (const output of collectorOutputs) {
      for (const f of output.findings) {
        allFindings.set(f.id, f);
      }
    }

    const allFindingIds = new Set(allFindings.keys());
    const newIncidents: Record<string, Incident> = {};
    const newResolved: ResolvedIncident[] = [...currentState.resolved];

    // Phase 1: Update existing incidents — check if still active or resolved
    for (const [incId, incident] of Object.entries(currentState.incidents)) {
      const stillActive = incident.contributing_findings.filter(
        fId => allFindingIds.has(fId)
      );

      if (stillActive.length === 0) {
        // All contributing findings have disappeared → resolve
        newResolved.push({
          id: incId,
          title: incident.title,
          resolved_at: now,
          duration_minutes: incident.duration_minutes,
          auto_resolved: true,
        });
      } else {
        // Update duration from first_seen to now
        const firstSeen = new Date(incident.first_seen);
        const lastSeen = new Date(now);
        const durationMs = lastSeen.getTime() - firstSeen.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        newIncidents[incId] = {
          ...incident,
          last_seen: now,
          duration_minutes: durationMinutes,
          contributing_findings: stillActive,
          escalation_level: this.getEscalationLevel(durationMinutes),
        };

        // Remove these findings from the "unmatched" pool
        for (const fId of stillActive) {
          allFindingIds.delete(fId);
        }
      }
    }

    // Phase 2: Create new incidents for unmatched findings
    const unmatchedFindings = [...allFindingIds]
      .map(id => allFindings.get(id)!)
      .filter(Boolean);

    const criticalFindings = unmatchedFindings.filter(
      f => f.severity === 'critical' || f.severity === 'high'
    );
    const otherFindings = unmatchedFindings.filter(
      f => f.severity !== 'critical' && f.severity !== 'high'
    );

    // Critical/high findings → individual incidents (grouped by related_to)
    const claimed = new Set<string>();
    for (const finding of criticalFindings) {
      if (claimed.has(finding.id)) continue;

      const related = [finding.id];
      claimed.add(finding.id);

      // Pull in any findings referenced by related_to
      if (finding.related_to) {
        for (const relId of finding.related_to) {
          if (allFindingIds.has(relId) && !claimed.has(relId)) {
            related.push(relId);
            claimed.add(relId);
          }
        }
      }

      const incId = this.generateId();
      newIncidents[incId] = {
        id: incId,
        status: 'open',
        severity: finding.severity as Incident['severity'],
        title: finding.title,
        root_cause_hypothesis: '',
        contributing_findings: related,
        first_seen: finding.first_seen || now,
        last_seen: now,
        duration_minutes: 0,
        escalation_level: 1,
        notifications_sent: [],
      };
    }

    // Low/medium/info findings → single housekeeping incident
    const housekeepingFindings = otherFindings.filter(f => !claimed.has(f.id));
    if (housekeepingFindings.length > 0) {
      const incId = this.generateId();
      newIncidents[incId] = {
        id: incId,
        status: 'open',
        severity: 'low',
        title: `${housekeepingFindings.length} housekeeping findings`,
        root_cause_hypothesis: '',
        contributing_findings: housekeepingFindings.map(f => f.id),
        first_seen: now,
        last_seen: now,
        duration_minutes: 0,
        escalation_level: 1,
        notifications_sent: [],
      };
    }

    // Trim resolved history to last 50
    const trimmedResolved = newResolved.slice(-50);

    return {
      incidents: newIncidents,
      resolved: trimmedResolved,
    };
  }
}
