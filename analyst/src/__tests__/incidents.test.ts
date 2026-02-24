import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentManager } from '../incidents.js';
import type { CollectorOutput, IncidentState } from '../types.js';

describe('IncidentManager', () => {
  let manager: IncidentManager;

  beforeEach(() => {
    manager = new IncidentManager();
  });

  it('creates a new incident from a new finding', () => {
    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T11:30:00Z',
      findings: [{
        id: 'hc-backend-http-000',
        severity: 'critical',
        category: 'service-down',
        title: 'Backend API unreachable',
        detail: 'HTTP 000',
        first_seen: '2026-02-24T11:30:00Z',
      }],
      healthy: [],
    }];

    const result = manager.processFindings(findings, { incidents: {}, resolved: [] });
    const incidents = Object.values(result.incidents);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe('open');
    expect(incidents[0].contributing_findings).toContain('hc-backend-http-000');
  });

  it('updates duration for persistent findings', () => {
    const state: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001',
          status: 'open',
          severity: 'critical',
          title: 'Backend down',
          root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: '2026-02-24T11:30:00Z',
          last_seen: '2026-02-24T11:45:00Z',
          duration_minutes: 15,
          escalation_level: 1,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T12:30:00Z',
      findings: [{
        id: 'hc-backend-http-000',
        severity: 'critical',
        category: 'service-down',
        title: 'Backend API unreachable',
        detail: 'HTTP 000',
        first_seen: '2026-02-24T11:30:00Z',
      }],
      healthy: [],
    }];

    const result = manager.processFindings(findings, state);
    expect(result.incidents['INC-001'].duration_minutes).toBe(60);
  });

  it('resolves incidents when findings disappear', () => {
    const state: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001',
          status: 'open',
          severity: 'critical',
          title: 'Backend down',
          root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: '2026-02-24T11:30:00Z',
          last_seen: '2026-02-24T14:45:00Z',
          duration_minutes: 195,
          escalation_level: 3,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    // No findings — backend recovered, appears in healthy list
    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T15:15:00Z',
      findings: [],
      healthy: ['Backend API (3000): HTTP 200'],
    }];

    const result = manager.processFindings(findings, state);
    expect(Object.keys(result.incidents)).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].id).toBe('INC-001');
    expect(result.resolved[0].auto_resolved).toBe(true);
  });

  it('computes escalation level based on duration', () => {
    expect(manager.getEscalationLevel(10)).toBe(1);   // <15min
    expect(manager.getEscalationLevel(30)).toBe(2);   // 15min-1h
    expect(manager.getEscalationLevel(120)).toBe(3);  // 1h-4h
    expect(manager.getEscalationLevel(300)).toBe(4);  // 4h+
  });

  it('groups low-severity findings into a housekeeping incident', () => {
    const findings: CollectorOutput[] = [{
      agent: 'docs-agent',
      timestamp: '2026-02-24T11:30:00Z',
      findings: [
        {
          id: 'docs-drift-1',
          severity: 'low',
          category: 'documentation-drift',
          title: 'README out of date',
          detail: 'Missing new agent docs',
          first_seen: '2026-02-24T11:30:00Z',
        },
        {
          id: 'docs-drift-2',
          severity: 'low',
          category: 'documentation-drift',
          title: 'Agent card missing',
          detail: 'No card for Analyst',
          first_seen: '2026-02-24T11:30:00Z',
        },
      ],
      healthy: [],
    }];

    const result = manager.processFindings(findings, { incidents: {}, resolved: [] });
    const incidents = Object.values(result.incidents);
    // Both low-severity findings should be grouped into one housekeeping incident
    expect(incidents).toHaveLength(1);
    expect(incidents[0].severity).toBe('low');
    expect(incidents[0].contributing_findings).toContain('docs-drift-1');
    expect(incidents[0].contributing_findings).toContain('docs-drift-2');
  });

  it('preserves resolved history (max 50)', () => {
    const existingResolved = Array.from({ length: 55 }, (_, i) => ({
      id: `INC-OLD-${i}`,
      title: `Old incident ${i}`,
      resolved_at: '2026-02-20T10:00:00Z',
      duration_minutes: 30,
      auto_resolved: true,
    }));

    const state: IncidentState = {
      incidents: {},
      resolved: existingResolved,
    };

    const result = manager.processFindings([], state);
    expect(result.resolved.length).toBeLessThanOrEqual(50);
  });
});
