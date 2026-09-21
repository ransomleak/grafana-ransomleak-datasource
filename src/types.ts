import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

/** Output shape a query target asks the RansomLeak API for. */
export type RansomLeakFormat = 'time_series' | 'table';

/**
 * A single query target in the panel editor.
 *
 * `metric` selects what human-risk signal to pull (see {@link METRICS}); `team`,
 * `campaign` and `channel` are optional facet filters (all support dashboard
 * variables, e.g. `$team`). `format` decides whether the API returns a time
 * series or a table.
 */
export interface RansomLeakQuery extends DataQuery {
  metric?: string;
  team?: string;
  /**
   * Training-campaign filter: a campaign name, or a campaign id when names collide
   * (campaign names are not unique). Only the four campaign-backed metrics accept
   * it — see {@link MetricDescriptor.campaign}; the API 400s on the others rather
   * than silently returning tenant-wide numbers.
   */
  campaign?: string;
  channel?: string;
  format: RansomLeakFormat;
}

export const DEFAULT_QUERY: Partial<RansomLeakQuery> = {
  metric: 'human_risk_score',
  format: 'time_series',
};

/**
 * Non-secret config stored on the data source instance (`jsonData`). The
 * RansomLeak API base URL lives here; the partner API key never does — it is
 * kept in {@link RansomLeakSecureJsonData} and injected server-side by the
 * Grafana data proxy route (`rl`) defined in plugin.json.
 */
export interface RansomLeakDataSourceOptions extends DataSourceJsonData {
  host?: string;
}

/**
 * Secret config (`secureJsonData`). Stored encrypted by Grafana, never sent to
 * the browser. The proxy route templates it into an `Authorization: Bearer`
 * header so the key stays server-side.
 */
export interface RansomLeakSecureJsonData {
  apiKey?: string;
}

// --- SimpleJSON-style response shapes returned by POST `rl/query` ------------

/** One datapoint: `[value, epochMillis]`. `value` may be null for gaps. */
export type SimpleJsonDatapoint = [number | null, number];

/** A time-series series, e.g. one per team when a metric is faceted. */
export interface TimeSeriesResponseItem {
  target: string;
  datapoints: SimpleJsonDatapoint[];
}

export interface TableColumn {
  text: string;
  /** SimpleJSON column type: `time` | `number` | `string`. Defaults to string. */
  type?: 'time' | 'number' | 'string';
}

export type TableCell = string | number | null;
export type TableRow = TableCell[];

export interface TableResponseItem {
  type: 'table';
  columns: TableColumn[];
  rows: TableRow[];
}

export type QueryResponseItem = TimeSeriesResponseItem | TableResponseItem;

export function isTableResponseItem(item: QueryResponseItem): item is TableResponseItem {
  // Require columns to be an array so a series carrying a stray `type` field
  // can't be mis-routed into the table mapping path.
  const candidate = item as TableResponseItem;
  return candidate.type === 'table' && Array.isArray(candidate.columns);
}
