import { test, expect } from '@grafana/plugin-e2e';

test('smoke: should render query editor', async ({ panelEditPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await expect(panelEditPage.getQueryEditorRow('A').getByText('Metric')).toBeVisible();
});

test('data query maps a SimpleJSON time series into a frame', async ({
  panelEditPage,
  readProvisionedDataSource,
  selectors,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');

  // Intercept the proxied /query call and return a SimpleJSON time series.
  await page.route(/\/rl\/query$/, async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ target: 'Engineering', datapoints: [[42, 1718409600000]] }]),
    })
  );

  await panelEditPage.refreshPanel();
  await expect(panelEditPage.panel.fieldNames).toContainText(['time', 'Engineering']);
  await expect(panelEditPage.panel.data).toContainText(['42']);
});
