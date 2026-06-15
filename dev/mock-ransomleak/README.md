# Mock RansomLeak API (development only)

A zero-dependency Node stand-in for the real RansomLeak Grafana query endpoints,
so the plugin can be exercised end-to-end without the production backend. **It is
dev tooling only** — webpack bundles the plugin from `src/` only, so nothing here
ships in the published plugin.

It implements the documented SimpleJSON contract:

| Method & path                               | Behaviour                                            |
| ------------------------------------------- | ---------------------------------------------------- |
| `GET  /api/integration/grafana/health`      | `200` when the Bearer key is valid (else `401`)      |
| `POST /api/integration/grafana/search`      | the 8 metric names                                   |
| `POST /api/integration/grafana/query`       | SimpleJSON time-series or table with realistic data  |

All endpoints require `Authorization: Bearer <key>`.

## Run

```bash
npm run mock
# or, with overrides:
MOCK_PORT=4000 RL_DEV_KEY=rl_dev_partner_key_demo node dev/mock-ransomleak/server.js
```

Defaults: port `4000`, key `rl_dev_partner_key_demo`.

## Wiring into Grafana

`provisioning/datasources/datasources.yml` already points a **RansomLeak** data
source at `http://host.docker.internal:4000` with the demo key, so
`npm run server` + `npm run mock` gives you a green **Save & test** and a
populated dashboard out of the box.

## Pointing at a real dev host instead

Edit `provisioning/datasources/datasources.yml` (or just reconfigure the data
source in the UI):

```yaml
jsonData:
  host: https://dev.ransomleak.example
secureJsonData:
  apiKey: <your real partner key>
```

The data generated here is deterministic per (metric, team, channel) and is **not
real**; it only demonstrates shapes and ranges.
