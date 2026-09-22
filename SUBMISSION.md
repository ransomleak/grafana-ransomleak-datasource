# Publishing to the Grafana plugin catalog

## Current state (verified 2026-09-22)

**The plugin HAS been submitted.** `grafana.com/orgs/ransomleak/plugins` lists
`ransomleak-ransomleak-datasource (1.0.0)` under *Submitted Plugins* with status
**Received**, carrying reviewer test instructions. Do not read the steps below as
"nothing has happened yet" — an earlier version of this file said exactly that
long after the submission existed, and it was believed.

What is true today:

| | State |
|---|---|
| Org slug | `ransomleak` — matches the plugin id prefix, prerequisite satisfied |
| Submission | **exists**, at version **1.0.0**, status *Received* (review pending) |
| Latest release | **v1.1.0** (campaign facet) — newer than what is under review |
| Signing | **not done**: no `MANIFEST.txt`; `GRAFANA_ACCESS_POLICY_TOKEN` is unset as a repo secret, so `release.yml` skips its signing step and publishes an unsigned zip |
| Published in catalog | no — still awaiting review |

So the next action is **Update Submission** on the existing row (§4), not *Submit
New Plugin*. Whether to bump it to v1.1.0 mid-review, or let 1.0.0 clear first and
update after, is a judgement call — updating may affect queue position.

Signing and submission are credential-gated, outward-facing actions, so they are
left for a maintainer to run. This file is the checklist.

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

1. Go to **https://grafana.com/orgs/ransomleak/plugins** (sign in first if needed).
   A submission already exists — use **Update Submission** on the
   `ransomleak-ransomleak-datasource` row rather than *Submit New Plugin*, which
   would create a duplicate. *Submit New Plugin* applies only to a genuinely new
   plugin id.
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

- The plugin is **unsigned** (`dist/` has no `MANIFEST.txt`, and the repo secret
  `GRAFANA_ACCESS_POLICY_TOKEN` is unset, so `release.yml`'s signing step is
  skipped — `package-plugin` guards it with `if: inputs.policy_token != ''`, so
  the release still succeeds and simply ships unsigned). Unsigned is expected for
  a first review; Grafana signs at community level on approval.
- The submission is **still at 1.0.0** while v1.1.0 is the latest release.
- The plugin is **not yet published** in the catalog — review is pending.

Keep this section honest. It previously claimed nothing had been pushed to
grafana.com, which stayed wrong for months and misled a later reader.
