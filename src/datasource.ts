import {
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MetricFindValue,
  ScopedVars,
  SelectableValue,
  TestDataSourceResponse,
  createDataFrame,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv, isFetchError } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { describeMetric, metricSelectOptions } from './metrics';
import {
  DEFAULT_QUERY,
  QueryResponseItem,
  RansomLeakDataSourceOptions,
  RansomLeakQuery,
  TableColumn,
  TableResponseItem,
  TimeSeriesResponseItem,
  isTableResponseItem,
} from './types';

/**
 * RansomLeak data source.
 *
 * Every request goes through the Grafana data proxy route `rl` declared in
 * plugin.json, so requests are issued against the relative proxy URL
 * (`instanceSettings.url`) — never directly to the customer's host. Grafana
 * rewrites `…/rl/<path>` to `{jsonData.host}/api/integration/grafana/<path>`
 * server-side and injects the `Authorization: Bearer <apiKey>` header from
 * `secureJsonData`. The partner key therefore never reaches the browser.
 */
export class DataSource extends DataSourceApi<RansomLeakQuery, RansomLeakDataSourceOptions> {
  /** Relative Grafana proxy base, e.g. `/api/datasources/proxy/uid/<uid>`. */
  private readonly proxyUrl: string;
  /** Configured RansomLeak host (from `jsonData`), used only for a friendlier unset-host check. */
  private readonly host: string;

  constructor(instanceSettings: DataSourceInstanceSettings<RansomLeakDataSourceOptions>) {
    super(instanceSettings);
    this.proxyUrl = instanceSettings.url ?? '';
    this.host = instanceSettings.jsonData?.host ?? '';
  }

  /** Build a request URL for the `rl` data-proxy route, e.g. `…/rl/query`. */
  private rlUrl(path: string): string {
    return `${this.proxyUrl}/rl/${path}`;
  }

  getDefaultQuery(_app: CoreApp): Partial<RansomLeakQuery> {
    return DEFAULT_QUERY;
  }

  /** Skip targets that have no metric selected or are toggled off. */
  filterQuery(query: RansomLeakQuery): boolean {
    return !query.hide && Boolean(query.metric);
  }

  /** Interpolate dashboard variables in the facet fields (e.g. `$team`). */
  applyTemplateVariables(query: RansomLeakQuery, scopedVars: ScopedVars): RansomLeakQuery {
    const tsrv = getTemplateSrv();
    return {
      ...query,
      team: query.team ? tsrv.replace(query.team, scopedVars) : query.team,
      channel: query.channel ? tsrv.replace(query.channel, scopedVars) : query.channel,
      metric: query.metric ? tsrv.replace(query.metric, scopedVars) : query.metric,
    };
  }

  async query(request: DataQueryRequest<RansomLeakQuery>): Promise<DataQueryResponse> {
    const { range, intervalMs, maxDataPoints, scopedVars } = request;

    const targets = request.targets.filter((t) => this.filterQuery(t));
    if (targets.length === 0) {
      return { data: [] };
    }

    const framesPerTarget = await Promise.all(
      targets.map(async (raw) => {
        // applyTemplateVariables runs in the standard query path, but interpolate
        // here too so Explore / ad-hoc callers behave identically.
        const target = this.applyTemplateVariables(raw, scopedVars);
        const body = {
          metric: target.metric,
          team: target.team || undefined,
          channel: target.channel || undefined,
          format: target.format ?? 'time_series',
          range: { from: range.from.toISOString(), to: range.to.toISOString() },
          intervalMs,
          maxDataPoints,
        };

        const items = await this.post<QueryResponseItem[]>('query', body);
        return this.toFrames(target, items ?? []);
      })
    );

    return { data: framesPerTarget.flat() };
  }

  /** Map a SimpleJSON `rl/query` response into Grafana data frames. */
  private toFrames(target: RansomLeakQuery, items: QueryResponseItem[]): DataFrame[] {
    return items.map((item) =>
      isTableResponseItem(item) ? this.tableFrame(target, item) : this.timeSeriesFrame(target, item)
    );
  }

  private timeSeriesFrame(target: RansomLeakQuery, series: TimeSeriesResponseItem): DataFrame {
    // Defend against a 200 response that omits datapoints — degrade to an empty
    // frame rather than throwing and failing every target in the request.
    const datapoints = series.datapoints ?? [];
    const times = datapoints.map((d) => d[1]);
    const values = datapoints.map((d) => d[0]);
    const valueName = series.target || describeMetric(target.metric ?? '')?.label || target.metric || 'value';
    return createDataFrame({
      refId: target.refId,
      name: series.target || undefined,
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name: valueName, type: FieldType.number, values },
      ],
    });
  }

  private tableFrame(target: RansomLeakQuery, table: TableResponseItem): DataFrame {
    // isTableResponseItem already guarantees `columns` is an array; `rows` is not
    // guarded by it, so default that one against a partial response.
    const rows = table.rows ?? [];
    return createDataFrame({
      refId: target.refId,
      fields: table.columns.map((col, i) => ({
        name: col.text,
        type: columnFieldType(col.type),
        values: rows.map((row) => row[i] ?? null),
      })),
    });
  }

  /** "Save & test" probe — green when the partner key authenticates against `/health`. */
  async testDatasource(): Promise<TestDataSourceResponse> {
    if (!this.host) {
      return {
        status: 'error',
        message: 'Host is required. Set your RansomLeak base URL, e.g. https://app.ransomleak.com.',
      };
    }
    try {
      const res = await lastValueFrom(
        getBackendSrv().fetch<{ status?: string; message?: string }>({
          url: this.rlUrl('health'),
          method: 'GET',
          showErrorAlert: false,
        })
      );
      // getBackendSrv().fetch rejects on non-2xx, so any resolved response is healthy.
      if (res.status >= 200 && res.status < 300) {
        return { status: 'success', message: res.data?.message ?? 'RansomLeak API reachable. Key accepted.' };
      }
      return { status: 'error', message: `Unexpected status ${res.status} from RansomLeak /health.` };
    } catch (err) {
      return { status: 'error', message: this.errorMessage(err) };
    }
  }

  /** Cached metric list — the metric set is stable for a data source instance. */
  private metricOptionsCache?: Promise<Array<SelectableValue<string>>>;

  /** Template-variable support: `metricFindQuery("metrics")` lists the metric names. */
  async metricFindQuery(_query: string, _options?: unknown): Promise<MetricFindValue[]> {
    const metrics = await this.getMetricOptions();
    return metrics.map((m) => ({ text: m.label ?? m.value ?? '', value: m.value }));
  }

  /**
   * Live metric list for the query editor dropdown and template variables.
   * Caches only a successful, non-empty live list so N query rows in a panel
   * don't each issue an identical `/search` round-trip; a failed or empty
   * response returns the static fallback without poisoning the cache, so a
   * later call retries once the host becomes reachable.
   */
  async getMetricOptions(): Promise<Array<SelectableValue<string>>> {
    this.metricOptionsCache ??= this.loadMetricOptions();
    return this.metricOptionsCache;
  }

  private async loadMetricOptions(): Promise<Array<SelectableValue<string>>> {
    try {
      const live = await this.searchMetrics();
      if (live.length > 0) {
        return live;
      }
    } catch {
      /* fall through to the static fallback */
    }
    // No usable live list yet — don't cache the fallback so the next call retries.
    this.metricOptionsCache = undefined;
    return metricSelectOptions;
  }

  private async searchMetrics(): Promise<Array<SelectableValue<string>>> {
    const raw = await this.post<Array<string | { text?: string; value?: string }>>('search', {});
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((entry) => {
        const value = typeof entry === 'string' ? entry : (entry.value ?? entry.text ?? '');
        const described = describeMetric(value);
        return {
          value,
          label: described?.label ?? (typeof entry === 'string' ? entry : (entry.text ?? value)),
          description: described?.description,
        };
      })
      .filter((option) => Boolean(option.value)); // drop degenerate blank entries
  }

  /** POST JSON through the proxy route and return the parsed body. */
  private async post<T>(path: string, data: unknown): Promise<T> {
    const res = await lastValueFrom(
      getBackendSrv().fetch<T>({
        url: this.rlUrl(path),
        method: 'POST',
        data,
        showErrorAlert: false,
      })
    );
    return res.data;
  }

  private errorMessage(err: unknown): string {
    if (isFetchError(err)) {
      const status = err.status ? `${err.status} ` : '';
      const detail = err.data?.message || err.statusText || 'request failed';
      if (err.status === 401 || err.status === 403) {
        return `RansomLeak rejected the partner key (${status.trim()}). Check the API key.`;
      }
      return `Could not reach the RansomLeak API: ${status}${detail}. Check the host URL.`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    return 'Could not reach the RansomLeak API.';
  }
}

function columnFieldType(type: TableColumn['type']): FieldType {
  switch (type) {
    case 'time':
      return FieldType.time;
    case 'number':
      return FieldType.number;
    default:
      return FieldType.string;
  }
}
