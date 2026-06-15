# Publishing to the Grafana plugin catalog

This plugin is **catalog-ready** but not yet signed or submitted. Signing needs a
real Grafana Cloud access-policy token and submission publishes the plugin under
your org on grafana.com — both are credential-gated, outward-facing actions, so
they are intentionally left for a maintainer to run. This file is the exact
checklist.

## 0. One-time prerequisites

- A [Grafana Cloud account](https://grafana.com/signup). **The org slug must be
  `ransomleak`**, because the plugin id is `ransomleak-ransomleak-datasource` and
  the catalog requires the id prefix to match your org slug. If your slug differs,
  rename the id in `src/plugin.json`, `package.json`, `provisioning/`, and the
  dashboard's datasource references to `<your-slug>-…` first.
- A **Grafana Cloud access policy token** with the `plugins:write` scope
  (the “Plugin publisher” role). Create it under **Account → Access Policies**.
- The plugin source pushed to a **public** repository (AGPL requires source
  availability), e.g. `https://github.com/ransomleak/grafana-ransomleak-datasource`.

## 1. Build

```bash
npm ci
npm run build
```

Produces `dist/` containing `module.js`, `plugin.json` (with `%VERSION%`/`%TODAY%`
substituted), `dashboards/`, `img/`, `LICENSE`, `README.md`, `CHANGELOG.md`.

## 2. Validate locally (the same checks the catalog runs)

```bash
PLUGIN_ID=ransomleak-ransomleak-datasource
cp -r dist "$PLUGIN_ID"
zip -qr "$PLUGIN_ID.zip" "$PLUGIN_ID"
rm -rf "$PLUGIN_ID"
npx @grafana/plugin-validator@latest "$PLUGIN_ID.zip"
```

Expected: **no errors**. A `warning: unsigned plugin` is normal for a new plugin,
and the AGPL-link warning only appears if the validator host can't reach gnu.org.

## 3. Sign

Signing writes a `MANIFEST.txt` into `dist/`.

```bash
export GRAFANA_ACCESS_POLICY_TOKEN=<your-access-policy-token>
npm run sign        # = npx @grafana/sign-plugin
```

> For the public community catalog, sign with the **default** (no `--rootUrls`).
> Use `--rootUrls https://your-grafana.example` only for a private signature on
> your own instances.

Then repackage `dist/` (now including `MANIFEST.txt`) into the zip as in step 2.

## 4. Submit

1. Go to **https://grafana.com/auth/sign-in → My Account → Plugins → Submit Plugin**.
2. Provide the packaged zip URL (a public GitHub Release asset is ideal — see the
   scaffolded `.github/workflows/release.yml`, which builds, signs, and attaches
   the zip when you push a `vX.Y.Z` tag with the `GRAFANA_ACCESS_POLICY_TOKEN`
   repo secret set) and the **public source repository URL**.
3. Automated validation runs, then a manual review (security + quality + a test
   install). Be ready to provide a test RansomLeak tenant + partner key.
4. On approval, Grafana signs the plugin at **community** level and lists it.

### Recommended automated path

Push a tag instead of doing steps 1–3 by hand:

```bash
# add GRAFANA_ACCESS_POLICY_TOKEN as a repo secret first
npm version minor
git push origin main --follow-tags
```

The release workflow builds, signs, and produces the catalog-ready artifact.

## Avoid the documented denial reasons

- **Don't fork an existing plugin** — this is an original data source.
- **Don't embed multiple plugins** — single datasource, single id.
- **Frame value broadly** — human-risk observability for any Grafana user running
  RansomLeak (see `src/README.md`), not a niche one-off.
- Keep the **AGPL-3.0** `LICENSE` and `package.json` license field intact.

## What is NOT done here

- The plugin is **unsigned** (`dist/` has no `MANIFEST.txt` yet).
- Nothing has been pushed to grafana.com.

Both are deliberate: they require your Grafana Cloud credentials and publish
externally.
