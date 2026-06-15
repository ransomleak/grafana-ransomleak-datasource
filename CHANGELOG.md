# Changelog

## 1.0.0 (Unreleased)

Initial release: RansomLeak human-risk data source for Grafana.

- Configure a RansomLeak **host** (`jsonData`) and **partner API key**
  (`secureJsonData`); the key is injected server-side by the `rl` data-proxy
  route and never reaches the browser.
- Query editor with a **metric** dropdown (live from `/search`, with a static
  fallback), optional **team** and **channel** filters, and a **time series /
  table** format toggle.
- `query()` maps SimpleJSON time-series and table responses to Grafana data
  frames; `testDatasource()` probes `/health`; `metricFindQuery()` backs
  template variables from `/search`.
- Bundled **"RansomLeak Human Risk"** dashboard.
- Licensed under AGPL-3.0.
