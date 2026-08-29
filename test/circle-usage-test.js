'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const CircleUsage = require('../lib/circle-usage');

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test('sums matching builds across pages without exposing the token in the URL', async () => {
  const output = [];
  const requests = [];
  const pages = [
    [
      { queued_at: '2026-08-05T00:00:00.000Z', build_time_millis: 90_000 },
      { queued_at: '2026-07-31T00:00:00.000Z', build_time_millis: 600_000 },
    ],
    [{ queued_at: '2026-08-06T00:00:00.000Z', build_time_millis: 30_000 }],
    [],
  ];
  const fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return response(pages.shift());
  };

  const usage = new CircleUsage({
    PAGE: 2,
    CIRCLE_TOKEN: 'secret-token',
    MAX_MINUTE: 10,
    STARTTIME: '2026-08-01T00:00:00.000Z',
    OUTPUT_FUNCTION: (line) => output.push(line),
    FETCH_FUNCTION: fetch,
  });

  await usage.run();

  assert.deepEqual(output, ['Circle CI usage: 2min/10min (20%)']);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].options.headers['Circle-Token'], 'secret-token');
  assert.equal(requests[0].url.includes('secret-token'), false);
  assert.equal(new URL(requests[1].url).searchParams.get('offset'), '2');
});

test('requires a token before making a request', async () => {
  const usage = new CircleUsage({ FETCH_FUNCTION: async () => response([]) });
  await assert.rejects(usage.run(), /CIRCLE_TOKEN is required/);
});

test('reports API failures without including credentials', async () => {
  const usage = new CircleUsage({
    CIRCLE_TOKEN: 'do-not-print-me',
    FETCH_FUNCTION: async () => response({}, 401),
  });
  await assert.rejects(usage.run(), /^Error: CircleCI API request failed: HTTP 401$/);
});

test('rejects invalid page sizes and start times', () => {
  assert.throws(() => new CircleUsage({ PAGE: 101 }), /PAGE must be an integer/);
  assert.throws(() => new CircleUsage({ STARTTIME: 'not-a-date' }), /Invalid STARTTIME/);
});
