import { test, expect } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

// The frontend data source issues every call through the Grafana data proxy as
// `…/rl/<path>`; match that stable suffix, not the version-specific proxy base.
const RL_QUERY = /\/rl\/query(\?.*)?$/;
const RL_SEARCH = /\/rl\/search(\?.*)?$/;

// The QueryEditor's mount-time metric lookup (getMetricOptions) POSTs /rl/search.
// Stub it so selecting the data source never does real I/O to the provisioned
// host (which isn't running in CI). Must be registered before datasource.set().
const mockSearch = (page: Page) =>
  page.route(RL_SEARCH, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

test('smoke: should render query editor', async ({ panelEditPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await mockSearch(page);
  await panelEditPage.datasource.set(ds.name);
  // Assert on the metric Select by its stable inputId. Matching the "Metric"
  // label text instead is ambiguous — it resolves to both the InlineField
  // label and its wrapper (Playwright strict-mode violation).
  await expect(panelEditPage.getQueryEditorRow('A').locator('#query-editor-metric')).toBeVisible();
});

test('data query maps a SimpleJSON time series into a frame', async ({
  panelEditPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });

  // Register both proxy mocks BEFORE selecting the data source, so the editor's
  // mount-time /rl/search and any auto-run /rl/query are intercepted
  // deterministically rather than racing the real (unreachable) proxy.
  await mockSearch(page);
  await page.route(RL_QUERY, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ target: 'Engineering', datapoints: [[42, 1718409600000]] }]),
    })
  );

  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');

  // This is a frontend data source: the query is issued as a proxied POST to
  // `/rl/query`, never `/api/ds/query`. refreshPanel's default predicate waits
  // on the latter, so it must be pointed at the actual request.
  await panelEditPage.refreshPanel({
    waitForResponsePredicateCallback: (r) => RL_QUERY.test(r.url()),
  });
  await expect(panelEditPage.panel.fieldNames).toContainText(['time', 'Engineering']);
  await expect(panelEditPage.panel.data).toContainText(['42']);
});
