const metrics = require('./metrics');
const { DB } = require('./database/database.js');

beforeEach(() => {
  metrics.httpCounts = new Map();
  metrics.authCounts = { success: 0, failure: 0 };
  metrics.activeUsers = 0;
  metrics.pizzaSold = 0;
  metrics.pizzaFailures = 0;
  metrics.pizzaRevenueCents = 0;
  metrics.lastPizzaLatencyMs = 0;
  metrics.endpointLatency = new Map();
  jest.restoreAllMocks();
});

test('authAttempt increments counters', () => {
  metrics.authAttempt(true);
  metrics.authAttempt(false);
  expect(metrics.authCounts.success).toBe(1);
  expect(metrics.authCounts.failure).toBe(1);
});

test('pizzaPurchase records success and revenue', () => {
  metrics.pizzaPurchase(true, 123, 500, 2);
  expect(metrics.pizzaSold).toBe(2);
  expect(metrics.pizzaRevenueCents).toBe(500);
  expect(metrics.lastPizzaLatencyMs).toBe(123);
  metrics.pizzaPurchase(false, 50, 0, 0);
  expect(metrics.pizzaFailures).toBe(1);
});

test('requestTracker counts requests and latency', (done) => {
  const req = { method: 'GET', route: { path: '/test' }, baseUrl: '', path: '/test' };
  const listeners = {};
  const res = {
    statusCode: 200,
    on: (ev, cb) => { listeners[ev] = cb; },
  };
  metrics.requestTracker(req, res, () => {
    listeners.finish();
    const key = 'GET|/test|2xx';
    expect(metrics.httpCounts.get(key)).toBe(1);
    done();
  });
});

test('buildMetric returns expected shape', () => {
  const m = metrics.buildMetric('foo', 'gauge', '1', 5, [{ key: 'k', value: { stringValue: 'v' } }]);
  expect(m.name).toBe('foo');
  expect(m.unit).toBe('1');
  expect(m.gauge.dataPoints[0].asInt).toBe(5);
});

test('sendToGrafana queries DB and posts metrics', async () => {
  jest.spyOn(DB, 'getActiveUsers').mockResolvedValue(7);
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await metrics.sendToGrafana();
  expect(DB.getActiveUsers).toHaveBeenCalledWith(5);
  expect(metrics.activeUsers).toBe(7);
  expect(global.fetch).toHaveBeenCalled();
});