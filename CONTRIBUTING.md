# Contributing

Thanks for your interest in improving the RansomLeak data source for Grafana.

## Development setup

```bash
npm install
npm run dev     # watch-build the frontend
npm run mock    # dev RansomLeak API stand-in on :4000 (separate terminal)
npm run server  # Grafana in Docker, plugin + provisioning mounted
```

Open http://localhost:3000 (admin/admin). A **RansomLeak** data source is
provisioned against the mock, so Save & test is green and the bundled dashboard
renders. See [`dev/mock-ransomleak/README.md`](./dev/mock-ransomleak/README.md).

## Before opening a PR

All of these must pass:

```bash
npm run typecheck
npm run test:ci
npm run lint
npm run build
```

If you touched query/response handling, add or update a Jest test in
`src/datasource.test.ts` (it covers the SimpleJSON → DataFrame mapping). If you
changed the config or query editor, update the Playwright specs in `tests/`.

## Conventions

- Keep the plugin **frontend-only**; the partner key must stay in
  `secureJsonData` and only ever be injected server-side by the `rl` data-proxy
  route in `plugin.json`. Never read or transmit the key from the browser.
- Keep metric names identical to the documented backend contract and to the
  New Relic integration schema.
- Maintain Grafana `>= 10.4.0` compatibility (e.g. prefer `Select` over
  `Combobox`, which needs Grafana 11+).

## License

By contributing you agree that your contributions are licensed under the
project's [AGPL-3.0](./LICENSE) license.
