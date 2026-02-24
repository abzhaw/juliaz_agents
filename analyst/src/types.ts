// Shared Finding Protocol — all collectors produce this shape

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  detail: string;
  raw_data?: Record<string, unknown>;
  first_seen: string;
  related_to?: string[];
}

export interface CollectorOutput {
  agent: string;
  timestamp: string;
  findings: Finding[];
  healthy: string[];
}

export interface Incident {
  id: string;
  status: 'open' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  root_cause_hypothesis: string;
  contributing_findings: string[];
  first_seen: string;
  last_seen: string;
  duration_minutes: number;
  escalation_level: number;
  notifications_sent: NotificationRecord[];
}

export interface NotificationRecord {
  at: string;
  type: 'new_incident' | 'escalation' | 'recovery' | 'daily' | 'weekly';
  message?: string;
}

export interface ResolvedIncident {
  id: string;
  title: string;
  resolved_at: string;
  duration_minutes: number;
  auto_resolved: boolean;
}

export interface IncidentState {
  incidents: Record<string, Incident>;
  resolved: ResolvedIncident[];
}

export interface CadenceState {
  last_digest_sent: string;
  last_digest_hash: string;
  messages_this_hour: number;
  last_daily_digest: string;
  last_weekly_digest: string;
}

export interface IncidentUpdate {
  id: string;
  action: 'create' | 'update' | 'resolve';
  status: 'open' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  root_cause: string;
  correlated_findings: string[];
  suggested_action: string;
}

export interface AnalystResponse {
  incidents_update: IncidentUpdate[];
  resolved_incidents: string[];
  should_notify: boolean;
  notification_reason: string;
  digest: string;
}

export interface Suppressions {
  known_safe_ports: Record<string, string>;
  known_safe_processes: string[];
  suppressed_findings: Record<string, { reason: string; suppressed_by: string; date: string }>;
  language_tags: string[];
}
