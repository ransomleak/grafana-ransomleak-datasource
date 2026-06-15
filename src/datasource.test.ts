import { DataQueryRequest, FieldType, dateTime } from '@grafana/data';
import { of, throwError } from 'rxjs';

import { DataSource } from './datasource';
import { RansomLeakQuery } from './types';

const fetchMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ fetch: fetchMock }),
  getTemplateSrv: () => ({ replace: (s: string) => s }),
  isFetchError: (e: unknown) => typeof e === 'object' && e !== null && 'status' in e,
}));

function makeDataSource() {
  return new DataSource({
    id: 1,
    uid: 'rl-test',
    type: 'ransomleak-ransomleak-datasource',
    name: 'RansomLeak',
    url: '/api/datasources/proxy/uid/rl-test',
    jsonData: { host: 'https://dev.ransomleak.example' },
    meta: {} as never,
    readOnly: false,
    access: 'proxy',
  } as never);
}

function request(targets: RansomLeakQuery[]): DataQueryRequest<RansomLeakQuery> {
  return {
    targets,
    range: { from: dateTime('2026-05-01T00:00:00Z'), to: dateTime('2026-05-31T00:00:00Z'), raw: { from: '', to: '' } },
    intervalMs: 60000,
    maxDataPoints: 100,
    scopedVars: {},
    requestId: 'r1',
    interval: '1m',
    timezone: 'UTC',
    app: 'dashboard',
    startTime: 0,
  } as DataQueryRequest<RansomLeakQuery>;
}

afterEach(() => fetchMock.mockReset());

describe('DataSource.query', () => {
  it('maps a SimpleJSON time series (one frame per series)', async () => {
    fetchMock.mockReturnValue(
      of({
        status: 200,
        data: [
          {
            target: 'Engineering',
            datapoints: [
              [40, 1714521600000],
              [42, 1714608000000],
            ],
          },
          {
            target: 'Sales',
            datapoints: [
              [55, 1714521600000],
              [53, 1714608000000],
            ],
          },
        ],
      })
    );

    const ds = makeDataSource();
    const res = await ds.query(request([{ refId: 'A', metric: 'human_risk_score', format: 'time_series' }]));

    expect(res.data).toHaveLength(2);
    const [eng, sales] = res.data;
    expect(eng.fields[0].type).toBe(FieldType.time);
    expect(eng.fields[1].name).toBe('Engineering');
    expect(eng.fields[1].values).toEqual([40, 42]);
    expect(sales.fields[1].name).toBe('Sales');

    // Verify the proxied URL + body the data source sent.
    const call = fetchMock.mock.calls[0][0];
    expect(call.url).toBe('/api/datasources/proxy/uid/rl-test/rl/query');
    expect(call.method).toBe('POST');
    expect(call.data.metric).toBe('human_risk_score');
    expect(call.data.format).toBe('time_series');
    expect(call.data.range.from).toBe('2026-05-01T00:00:00.000Z');
  });

  it('maps a SimpleJSON table into a typed frame', async () => {
    fetchMock.mockReturnValue(
      of({
        status: 200,
        data: [
          {
            type: 'table',
            columns: [
              { text: 'User', type: 'string' },
              { text: 'Days overdue', type: 'number' },
            ],
            rows: [
              ['alice@acme.com', 12],
              ['bob@acme.com', 3],
            ],
          },
        ],
      })
    );

    const ds = makeDataSource();
    const res = await ds.query(request([{ refId: 'A', metric: 'overdue_users', format: 'table' }]));

    expect(res.data).toHaveLength(1);
    const frame = res.data[0];
    expect(frame.fields.map((f: { name: string }) => f.name)).toEqual(['User', 'Days overdue']);
    expect(frame.fields[0].type).toBe(FieldType.string);
    expect(frame.fields[1].type).toBe(FieldType.number);
    expect(frame.fields[1].values).toEqual([12, 3]);
  });

  it('skips targets with no metric selected', async () => {
    const ds = makeDataSource();
    const res = await ds.query(request([{ refId: 'A', format: 'time_series' }]));
    expect(res.data).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades gracefully when a 200 response omits datapoints/columns/rows', async () => {
    // A series with no datapoints and a table with no rows must not throw.
    fetchMock
      .mockReturnValueOnce(of({ status: 200, data: [{ target: 'Engineering' }] }))
      .mockReturnValueOnce(of({ status: 200, data: [{ type: 'table', columns: [{ text: 'User' }] }] }));

    const ds = makeDataSource();
    const series = await ds.query(request([{ refId: 'A', metric: 'human_risk_score', format: 'time_series' }]));
    expect(series.data).toHaveLength(1);
    expect(series.data[0].fields[0].values).toEqual([]);

    const table = await ds.query(request([{ refId: 'A', metric: 'overdue_users', format: 'table' }]));
    expect(table.data).toHaveLength(1);
    expect(table.data[0].fields[0].name).toBe('User');
    expect(table.data[0].fields[0].values).toEqual([]);
  });
});

describe('DataSource.testDatasource', () => {
  it('returns success on HTTP 200 from /health', async () => {
    fetchMock.mockReturnValue(of({ status: 200, data: { status: 'ok', message: 'Key accepted.' } }));
    const ds = makeDataSource();
    const res = await ds.testDatasource();
    expect(res.status).toBe('success');
    expect(fetchMock.mock.calls[0][0].url).toBe('/api/datasources/proxy/uid/rl-test/rl/health');
  });

  it('returns an error message when the key is rejected (401)', async () => {
    // lastValueFrom rejects with the fetch error the proxy surfaces.
    fetchMock.mockReturnValue(throwError(() => ({ status: 401, statusText: 'Unauthorized' })));
    const ds = makeDataSource();
    const res = await ds.testDatasource();
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/rejected the partner key/i);
  });

  it('fails fast with a clear message when the host is unset (no request made)', async () => {
    const ds = new DataSource({
      id: 1,
      uid: 'rl-test',
      type: 'ransomleak-ransomleak-datasource',
      name: 'RansomLeak',
      url: '/api/datasources/proxy/uid/rl-test',
      jsonData: {},
      meta: {} as never,
      readOnly: false,
      access: 'proxy',
    } as never);
    const res = await ds.testDatasource();
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/host is required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
