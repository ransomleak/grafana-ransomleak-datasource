import React, { ChangeEvent, useEffect, useState } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, Input, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { DataSource } from '../datasource';
import { describeMetric, metricSelectOptions } from '../metrics';
import { RansomLeakDataSourceOptions, RansomLeakFormat, RansomLeakQuery } from '../types';

type Props = QueryEditorProps<DataSource, RansomLeakQuery, RansomLeakDataSourceOptions>;

const FORMAT_OPTIONS: Array<SelectableValue<RansomLeakFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
];

const LABEL_WIDTH = 14;

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
      // Drop a now-hidden channel value when the new metric isn't channel-faceted.
      channel: meta && !meta.channel ? undefined : query.channel,
    });
    onRunQuery();
  };

  const onTeamChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, team: event.target.value });
  };

  const onChannelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, channel: event.target.value });
  };

  const onFormatChange = (format: RansomLeakFormat) => {
    onChange({ ...query, format });
    onRunQuery();
  };

  const { metric, team, channel, format } = query;

  // Only phishing/smishing metrics are channel-faceted. Show the channel input
  // for those, and for live metrics not in the static catalog (unknown faceting),
  // but hide it for metrics the backend ignores it on.
  const described = metric ? describeMetric(metric) : undefined;
  const showChannel = described ? Boolean(described.channel) : Boolean(metric);

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
        <InlineField
          label="Team"
          labelWidth={LABEL_WIDTH}
          tooltip="Optional team filter. Supports variables, e.g. $team."
        >
          <Input
            id="query-editor-team"
            value={team ?? ''}
            onChange={onTeamChange}
            onBlur={onRunQuery}
            placeholder="All teams"
            width={28}
          />
        </InlineField>
        {showChannel && (
          <InlineField
            label="Channel"
            labelWidth={LABEL_WIDTH}
            tooltip="Optional channel filter for phishing/smishing metrics, e.g. email or sms."
          >
            <Input
              id="query-editor-channel"
              value={channel ?? ''}
              onChange={onChannelChange}
              onBlur={onRunQuery}
              placeholder="e.g. email"
              width={28}
            />
          </InlineField>
        )}
      </Stack>
    </Stack>
  );
}
