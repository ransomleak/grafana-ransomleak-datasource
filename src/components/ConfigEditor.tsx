import React, { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineField, Input, SecretInput } from '@grafana/ui';
import { RansomLeakDataSourceOptions, RansomLeakSecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<RansomLeakDataSourceOptions, RansomLeakSecureJsonData> {}

const LABEL_WIDTH = 18;
const FIELD_WIDTH = 48;

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Trim and drop trailing slashes so the proxy route doesn't build `host//api/…`.
    const host = event.target.value.trim().replace(/\/+$/, '');
    onOptionsChange({
      ...options,
      jsonData: { ...jsonData, host },
    });
  };

  // Secret field — only ever stored in secureJsonData, encrypted server-side.
  const onApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: { ...options.secureJsonData, apiKey: event.target.value },
    });
  };

  const onResetApiKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: { ...options.secureJsonFields, apiKey: false },
      secureJsonData: { ...options.secureJsonData, apiKey: '' },
    });
  };

  return (
    <>
      <InlineField
        label="Host"
        labelWidth={LABEL_WIDTH}
        interactive
        tooltip="Base URL of your RansomLeak instance, e.g. https://app.ransomleak.com. The plugin appends /api/integration/grafana server-side."
      >
        <Input
          id="config-editor-host"
          value={jsonData.host ?? ''}
          onChange={onHostChange}
          placeholder="https://app.ransomleak.com"
          width={FIELD_WIDTH}
        />
      </InlineField>

      <InlineField
        label="Partner API key"
        labelWidth={LABEL_WIDTH}
        interactive
        tooltip="Your RansomLeak partner integration key. Stored encrypted (secureJsonData) and sent only from the Grafana server — it never reaches the browser."
      >
        <SecretInput
          required
          id="config-editor-api-key"
          isConfigured={Boolean(secureJsonFields?.apiKey)}
          value={secureJsonData?.apiKey ?? ''}
          placeholder="rl_partner_…"
          width={FIELD_WIDTH}
          onReset={onResetApiKey}
          onChange={onApiKeyChange}
        />
      </InlineField>
    </>
  );
}
