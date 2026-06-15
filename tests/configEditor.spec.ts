import { test, expect } from '@grafana/plugin-e2e';

test('smoke: should render config editor', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await createDataSourceConfigPage({ type: ds.type });
  await expect(page.getByLabel('Host')).toBeVisible();
  await expect(page.getByLabel('Partner API key')).toBeVisible();
});

test('"Save & test" is green when the partner key is accepted', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  selectors,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  const healthPath = `${selectors.apis.DataSource.proxy(
    configPage.datasource.uid,
    configPage.datasource.id.toString()
  )}/rl/health`;
  await page.route(healthPath, async (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'ok', message: 'Key accepted.' }) })
  );
  await expect(configPage.saveAndTest({ path: healthPath })).toBeOK();
});

test('"Save & test" shows an error alert when the key is rejected', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  selectors,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  const healthPath = `${selectors.apis.DataSource.proxy(
    configPage.datasource.uid,
    configPage.datasource.id.toString()
  )}/rl/health`;
  await page.route(healthPath, async (route) => route.fulfill({ status: 401, body: 'Unauthorized' }));
  await expect(configPage.saveAndTest({ path: healthPath })).not.toBeOK();
  await expect(configPage).toHaveAlert('error');
});
