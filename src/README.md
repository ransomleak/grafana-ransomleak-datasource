# RansomLeak data source for Grafana

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Bring **human-risk observability** into Grafana. This data source queries the
RansomLeak API live so you can chart security-awareness training, per-team
human-risk score, and phishing/smishing outcomes next to the rest of your
operational telemetry — no exporting, no scraping, no second pane of glass.

Human risk is one of the largest and least-instrumented attack surfaces in most
organizations. Security-awareness data usually lives in a vendor portal, walled
off from the dashboards leadership and SecOps already watch. This plugin turns
RansomLeak into a first-class Grafana data source so human-risk trends sit
alongside your infrastructure, application, and security metrics — and can drive
the same alerts and review rituals.

## What you can build

- **Per-team human-risk score** over time (0–100), faceted by team.
- **Training completion** and **overdue assignments**, org-wide, per team, or
  scoped to a single training campaign.
- **Phishing click vs. report rate** by channel (email, SMS) to see whether
  people are getting better at spotting and reporting simulations.
- A **table of employees with overdue training** for targeted follow-up.
- A closed-loop count of users **auto-assigned training from Grafana alerts**.

A ready-made **"RansomLeak Human Risk"** dashboard ships with the plugin — find
it on the data source's **Dashboards** tab after install and click **Import**.

## Requirements

- Grafana **10.4.0** or newer.
- A RansomLeak account and a **partner integration API key**
  (Settings → Integrations in RansomLeak, or contact your RansomLeak admin).

## Getting started

1. **Connections → Add new connection → RansomLeak**, then **Add new data source**.
2. Set **Host** to your RansomLeak base URL, e.g. `https://app.ransomleak.com`.
   The plugin calls `…/api/integration/grafana` under that host.
3. Paste your **Partner API key**.
4. Click **Save & test**. A green result means the key authenticated.

Your API key is stored in Grafana's encrypted `secureJsonData` and is injected
**server-side** by Grafana's data proxy. It is never exposed to the browser and
never leaves your Grafana server except in the request to your RansomLeak host.

## Querying

In any panel, pick the **RansomLeak** data source and choose:

- **Metric** — the human-risk signal (e.g. `human_risk_score`,
  `training_completion_rate`, `phishing_click_rate`, `overdue_users`).
- **Team** — optional team filter. Supports dashboard variables, e.g. `$team`.
- **Campaign** — optional training-campaign filter, by campaign name or by
  campaign id. Available on `training_completion_rate`, `assignments_overdue`,
  `overdue_users` and `assignments_by_category`. Supports dashboard variables,
  e.g. `$campaign`. Campaign names are not unique in RansomLeak, so pass the id
  if you run several campaigns under the same name.
- **Channel** — optional channel filter for phishing/smishing metrics
  (`email`, `sms`).
- **Format** — *Time series* for charts and stats, *Table* for per-employee
  breakdowns.

## Security & privacy

- The plugin is frontend-only and holds no state of its own. It reads from your
  RansomLeak host through Grafana's data proxy using your key.
- No data is sent anywhere except your configured RansomLeak host.

## License

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See
[LICENSE](https://www.gnu.org/licenses/agpl-3.0.en.html).

## Support

- Website: https://ransomleak.com
- Integration docs: https://ransomleak.com/integrations/
- Issues: https://github.com/ransomleak/grafana-ransomleak-datasource/issues
