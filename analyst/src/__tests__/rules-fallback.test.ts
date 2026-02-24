import { describe, it, expect } from 'vitest';
import { RulesFallback } from '../rules-fallback.js';
import type { IncidentState, CadenceState } from '../types.js';

describe('RulesFallback', () => {
  const fallback = new RulesFallback();

  it('recommends immediate notification for new critical incident', () => {
    const incidents: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001', status: 'open', severity: 'critical',
          title: 'Backend down', root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          duration_minutes: 0, escalation_level: 1,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(true);
    expect(result.notification_reason).toContain('new');
  });

  it('suppresses notification when circuit breaker is hit', () => {
    const incidents: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001', status: 'open', severity: 'critical',
          title: 'Backend down', root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          duration_minutes: 5, escalation_level: 1,
          notifications_sent: [],
        }
      },
      resolved: [],
    };
    const cadence: CadenceState = {
      last_digest_sent: new Date().toISOString(),
      last_digest_hash: 'abc',
      messages_this_hour: 6, // circuit breaker
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(false);
    expect(result.notification_reason).toContain('circuit breaker');
  });

  it('notifies on recovery', () => {
    const incidents: IncidentState = {
      incidents: {},
      resolved: [{
        id: 'INC-001', title: 'Backend down',
        resolved_at: new Date().toISOString(),
        duration_minutes: 195, auto_resolved: true,
      }],
    };

    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(true);
    expect(result.digest).toContain('Resolved');
  });

  it('generates an all-quiet digest when no incidents and no recent resolved', () => {
    const incidents: IncidentState = { incidents: {}, resolved: [] };
    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(false);
    expect(result.notification_reason).toContain('quiet');
  });

  it('includes severity and duration in digest', () => {
    const incidents: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001', status: 'open', severity: 'critical',
          title: 'Backend down', root_cause_hypothesis: 'Docker container crashed',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: '2026-02-24T11:30:00Z',
          last_seen: '2026-02-24T14:30:00Z',
          duration_minutes: 180, escalation_level: 3,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(true);
    expect(result.digest).toContain('🔴');
    expect(result.digest).toContain('Backend down');
    expect(result.digest).toContain('3h');
  });
});
