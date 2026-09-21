import React, { ChangeEvent, useEffect, useState } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, Input, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { DataSource } from '../datasource';
import { MetricDescriptor, describeMetric, metricSelectOptions } from '../metrics';
import { RansomLeakDataSourceOptions, RansomLeakFormat, RansomLeakQuery } from '../types';

type Props = QueryEditorProps<DataSource, RansomLeakQuery, RansomLeakDataSourceOptions>;

const FORMAT_OPTIONS: Array<SelectableValue<RansomLeakFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
];

const LABEL_WIDTH = 14;

/**
 * The optional facet filters, in render order. `flag` is the {@link MetricDescriptor} key that
 * says whether a metric accepts the facet — `undefined` means "always shown" (team applies to
 * every metric). Adding a facet is one entry here plus the matching descriptor flag, rather than
 * a fourth copy of the show-check, the reset rule and the input block.
 */
const FACETS: Array<{
  key: 'team' | 'campaign' | 'channel';
  flag?: 'campaign' | 'channel';
  label: string;
  tooltip: string;
  placeholder: string;
}> = [
  {
    key: 'team',
    label: 'Team',
    tooltip: 'Optional team filter. Supports variables, e.g. $team.',
    placeholder: 'All teams',
  },
  {
    key: 'campaign',
    flag: 'campaign',
    label: 'Campaign',
    tooltip: 'Optional training-campaign filter, by name or campaign id. Supports variables, e.g. $campaign.',
    placeholder: 'All campaigns',
  },
  {
    key: 'channel',
    flag: 'channel',
    label: 'Channel',
    tooltip: 'Optional channel filter for phishing/smishing metrics, e.g. email or sms.',
    placeholder: 'e.g. email',
  },
];

/**
 * Whether a metric accepts a facet. A metric the static catalog can't describe (live-only, from
 * `/search`) is assumed to accept it, so a new backend metric isn't stuck without its filters
 * until the plugin ships a matching descriptor.
 */
function metricAcceptsFacet(meta: MetricDescriptor | undefined, flag?: 'campaign' | 'channel'): boolean {
  if (!flag) {
    return true;
  }
  return meta ? Boolean(meta[flag]) : true;
}

export function QueryEditor({ datasource, query, onChange, onRunQuery }: Props) {
  const [metrics, setMetrics] = useState<Array<SelectableValue<string>>>(metricSelectOptions);

  // Prefer the live metric list from the configured host; fall back to the
  // static list (already the initial state) if the host isn't reachable yet.
  // getMetricOptions never rejects (it returns the static list on failure).
  useEffect(() => {
    let active = true;
    datasource.getMetricOptions().then((options) => {
      if (active && options.length > 0) {
        setMetrics(options);
      }
    });
    return () => {
      active = false;
    };
  }, [datasource]);

  const onMetricChange = (selected: SelectableValue<string>) => {
    const value = selected.value;
    const meta = value ? describeMetric(value) : undefined;
    onChange({
      ...query,
      metric: value,
      // Reset to the metric's natural orientation (tabular -> table, otherwise
      // time series); keep the user's choice for live metrics not in the catalog.
      format: meta ? (meta.table ? 'table' : 'time_series') : query.format,
      // Drop any facet value the new metric doesn't accept. Leaving a stale one behind would
      // either be silently ignored (channel) or 400 the panel (campaign) instead of widening it.
      ...Object.fromEntries(
        FACETS.filter((f) => !metricAcceptsFacet(meta, f.flag)).map((f) => [f.key, undefined]),
      ),
    });
    onRunQuery();
  };

  const onFacetChange = (key: (typeof FACETS)[number]['key']) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, [key]: event.target.value });
  };

  const onFormatChange = (format: RansomLeakFormat) => {
    onChange({ ...query, format });
    onRunQuery();
  };

  const { metric, format } = query;

  // A facet is offered only when the selected metric accepts it — team always, campaign on the
  // four training-campaign metrics, channel on the phishing/smishing ones.
  const described = metric ? describeMetric(metric) : undefined;
  // An unflagged facet (team) always shows, exactly as before this was table-driven; a flagged
  // one needs a metric selected first, since faceting is unknown until then.
  const visibleFacets = FACETS.filter((f) => (f.flag ? Boolean(metric) && metricAcceptsFacet(described, f.flag) : true));

  return (
    <Stack direction="column" gap={1}>
      <Stack gap={1} wrap="wrap">
        <InlineField label="Metric" labelWidth={LABEL_WIDTH} grow tooltip="Human-risk signal to query">
          {/* Select (not Combobox) keeps compatibility with Grafana >= 10.4.0; Combobox requires Grafana 11+. */}
          {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
          <Select
            inputId="query-editor-metric"
            options={metrics}
            value={metrics.find((m) => m.value === metric) ?? (metric ? { label: metric, value: metric } : null)}
            onChange={onMetricChange}
            placeholder="Select a metric"
            width={36}
          />
        </InlineField>
        <InlineField
          label="Format"
          labelWidth={LABEL_WIDTH}
          tooltip="Time series for charts/stats, table for per-employee breakdowns"
        >
          <RadioButtonGroup options={FORMAT_OPTIONS} value={format ?? 'time_series'} onChange={onFormatChange} />
        </InlineField>
      </Stack>
      <Stack gap={1} wrap="wrap">
        {visibleFacets.map((facet) => (
          <InlineField key={facet.key} label={facet.label} labelWidth={LABEL_WIDTH} tooltip={facet.tooltip}>
            <Input
              id={`query-editor-${facet.key}`}
              value={query[facet.key] ?? ''}
              onChange={onFacetChange(facet.key)}
              onBlur={onRunQuery}
              placeholder={facet.placeholder}
              width={28}
            />
          </InlineField>
        ))}
      </Stack>
    </Stack>
  );
}
