# Changelog

## 1.1.0 (Unreleased)

- Query editor gains an optional **Campaign** filter (name or campaign id) on the
  four campaign-backed metrics: `training_completion_rate`, `assignments_overdue`,
  `overdue_users`, `assignments_by_category`. Supports dashboard variables
  (`$campaign`). The phishing metrics are scoped by *phishing* campaign — a
  different entity — so they deliberately do not take this facet.
- A campaign value left over from a previously selected metric is dropped rather
  than sent, so switching a panel's metric can't 400 it.

## 1.0.0

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
