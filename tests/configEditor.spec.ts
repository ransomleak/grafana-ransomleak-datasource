import { test, expect } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

// The proxied health probe. The path literal and the route regex derive from one
// source so a rename can't drift the route mock and the saveAndTest path apart;
// the regex tolerates the version-specific proxy base prefix + an optional query.
const RL_HEALTH_PATH = '/rl/health';
const RL_HEALTH = new RegExp(`${RL_HEALTH_PATH}(\\?.*)?$`);

// testDatasource() short-circuits with "Host is required" unless a host is set,
// so fill one before Save & test. The probe is mocked per-test and the partner
// key is injected server-side (never read in the browser), so only the host
// matters here. Use the semantic label locator, like the smoke test below.
const fillHost = (page: Page) => page.getByLabel('Host').fill('https://app.ransomleak.com');

test('smoke: should render config editor', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await createDataSourceConfigPage({ type: ds.type });
  await expect(page.getByLabel('Host')).toBeVisible();
  await expect(page.getByLabel('Partner API key')).toBeVisible();
});

test('"Save & test" is green when the partner key is accepted', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  await fillHost(page);
  await page.route(RL_HEALTH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', message: 'Key accepted.' }),
    })
  );
  // Assert both the probe outcome (200, not merely "not an error") and the
  // success banner Grafana renders — symmetric with the rejected-key test.
  const health = await configPage.saveAndTest({ path: RL_HEALTH_PATH });
  expect(health.status()).toBe(200);
  await expect(configPage).toHaveAlert('success');
});

test('"Save & test" shows an error alert when the key is rejected', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  await fillHost(page);
  await page.route(RL_HEALTH, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthorized' }) })
  );
  // Assert the probe actually returned 401. `.not.toBeOK()` would be vacuously
  // satisfied if saveAndTest rejected on a timeout (probe never fired), so check
  // the concrete status and rely on the alert as the rendered-outcome guard.
  const health = await configPage.saveAndTest({ path: RL_HEALTH_PATH });
  expect(health.status()).toBe(401);
  await expect(configPage).toHaveAlert('error');
});
