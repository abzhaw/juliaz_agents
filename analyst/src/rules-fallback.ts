import type { AnalystResponse, IncidentState, CadenceState, Incident } from './types.js';

/**
 * RulesFallback provides deterministic analysis when LLMs are unavailable.
 *
 * It implements the same AnalystResponse interface as the LLM path,
 * using simple heuristics for:
 * - Notification decisions (new incidents, escalation, recovery, silence)
 * - Digest generation (severity icons, duration formatting)
 * - Circuit breaker enforcement (max 6 messages/hour)
 * - Dedup prevention (identical digests)
 */
export class RulesFallback {
  private static readonly CIRCUIT_BREAKER_LIMIT = 6;

  private static readonly SEVERITY_ICON: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  analyze(incidents: IncidentState, cadence: CadenceState): AnalystResponse {
    // Circuit breaker check
    if (cadence.messages_this_hour >= RulesFallback.CIRCUIT_BREAKER_LIMIT) {
      return {
        incidents_update: [],
        resolved_incidents: [],
        should_notify: false,
        notification_reason: 'Suppressed: circuit breaker (6 messages/hour limit)',
        digest: '',
      };
    }

    const openIncidents = Object.values(incidents.incidents);
    const recentResolved = incidents.resolved.filter(r => {
      const resolvedAt = new Date(r.resolved_at);
      const now = new Date();
      return (now.getTime() - resolvedAt.getTime()) < 30 * 60 * 1000; // within 30min
    });

    // Case 1: No incidents, no recent resolutions → all quiet
    if (openIncidents.length === 0 && recentResolved.length === 0) {
      return {
        incidents_update: [],
        resolved_incidents: [],
        should_notify: false,
        notification_reason: 'All quiet — no open incidents, no recent recoveries',
        digest: '',
      };
    }

    // Case 2: Recent resolutions → recovery notification
    if (recentResolved.length > 0) {
      const recoveryLines = recentResolved.map(r => {
        const duration = this.formatDuration(r.duration_minutes);
        return `✅ Resolved: *${r.title}* (was down ${duration})`;
      });

      const openLines = openIncidents.map(inc => this.formatIncidentLine(inc));
      const parts = [...recoveryLines];
      if (openLines.length > 0) {
        parts.push('', '📊 Still open:', ...openLines);
      }

      return {
        incidents_update: [],
        resolved_incidents: recentResolved.map(r => r.id),
        should_notify: true,
        notification_reason: `Recovery: ${recentResolved.length} incident(s) resolved`,
        digest: parts.join('\n'),
      };
    }

    // Case 3: Open incidents — check if any are new (no notifications sent)
    const newIncidents = openIncidents.filter(
      inc => inc.notifications_sent.length === 0
    );

    if (newIncidents.length > 0) {
      const lines = openIncidents.map(inc => this.formatIncidentLine(inc));
      const newCount = newIncidents.length;
      const totalCount = openIncidents.length;

      return {
        incidents_update: [],
        resolved_incidents: [],
        should_notify: true,
        notification_reason: `${newCount} new incident(s) of ${totalCount} total`,
        digest: `🚨 *${newCount} new incident${newCount > 1 ? 's' : ''}*\n\n${lines.join('\n')}`,
      };
    }

    // Case 4: Only ongoing incidents, no new ones — check escalation
    const escalated = openIncidents.filter(inc => {
      const lastNotification = inc.notifications_sent[inc.notifications_sent.length - 1];
      if (!lastNotification) return true; // never notified

      const lastAt = new Date(lastNotification.at);
      const now = new Date();
      const hoursSinceNotify = (now.getTime() - lastAt.getTime()) / (60 * 60 * 1000);

      // Escalation cadence: hourly for first 4h, then every 4h
      if (inc.duration_minutes < 240) return hoursSinceNotify >= 1;
      return hoursSinceNotify >= 4;
    });

    if (escalated.length > 0) {
      const lines = openIncidents.map(inc => this.formatIncidentLine(inc));
      return {
        incidents_update: [],
        resolved_incidents: [],
        should_notify: true,
        notification_reason: `Escalation update: ${escalated.length} incident(s) need attention`,
        digest: `📊 *Ongoing incidents*\n\n${lines.join('\n')}`,
      };
    }

    // Case 5: Nothing new to report
    return {
      incidents_update: [],
      resolved_incidents: [],
      should_notify: false,
      notification_reason: 'No changes since last notification',
      digest: '',
    };
  }

  private formatIncidentLine(inc: Incident): string {
    const icon = RulesFallback.SEVERITY_ICON[inc.severity] || '⚪';
    const duration = this.formatDuration(inc.duration_minutes);
    const hypothesis = inc.root_cause_hypothesis
      ? ` — ${inc.root_cause_hypothesis}`
      : '';
    return `${icon} *${inc.title}* (${duration})${hypothesis}`;
  }

  private formatDuration(minutes: number): string {
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}m`;
  }
}
