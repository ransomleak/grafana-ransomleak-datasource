import { SelectableValue } from '@grafana/data';

/**
 * The human-risk metrics RansomLeak exposes to Grafana. Names mirror the New
 * Relic integration schema and the backend `/search` contract so both
 * integrations describe the same human risk. This list is the offline fallback
 * for the query editor dropdown; at runtime the editor prefers the live
 * `rl/search` response from the configured host.
 */
export interface MetricDescriptor {
  value: string;
  label: string;
  description: string;
  /** Naturally tabular (returned with `format: "table"`). */
  table?: boolean;
  /** Faceted by communication channel (e.g. `email`, `sms`). */
  channel?: boolean;
  /**
   * Accepts the training-campaign facet. True only for the metrics built on the
   * training `campaign` table — the phishing metrics are scoped by phishing
   * campaign, a different entity, so they deliberately do NOT set this.
   */
  campaign?: boolean;
}

export const METRICS: MetricDescriptor[] = [
  { value: 'human_risk_score', label: 'Human-risk score', description: 'Per-team human-risk score (0–100 gauge).' },
  {
    value: 'training_completion_rate',
    label: 'Training completion rate',
    description: 'Share of assigned security-awareness training completed.',
    campaign: true,
  },
  {
    value: 'assignments_overdue',
    label: 'Assignments overdue',
    description: 'Count of overdue training assignments.',
    campaign: true,
  },
  {
    value: 'phishing_click_rate',
    label: 'Phishing click rate',
    description: 'Simulated-phishing click rate for a channel.',
    channel: true,
  },
  {
    value: 'phishing_report_rate',
    label: 'Phishing report rate',
    description: 'Simulated-phishing report rate for a channel.',
    channel: true,
  },
  {
    value: 'overdue_users',
    label: 'Overdue users (table)',
    description: 'Employees with overdue training.',
    table: true,
    campaign: true,
  },
  {
    value: 'assignments_by_category',
    label: 'Assignments by category',
    description: 'Assignment volume per training category.',
    campaign: true,
  },
  {
    value: 'auto_assigned_via_grafana',
    label: 'Auto-assigned via Grafana',
    description: 'Rail B closed-loop count of users auto-assigned training from Grafana alerts.',
  },
];

const METRICS_BY_VALUE = new Map(METRICS.map((m) => [m.value, m]));

export function describeMetric(value: string): MetricDescriptor | undefined {
  return METRICS_BY_VALUE.get(value);
}

export const metricSelectOptions: Array<SelectableValue<string>> = METRICS.map((m) => ({
  value: m.value,
  label: m.label,
  description: m.description,
}));
