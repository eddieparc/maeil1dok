const fs = require('node:fs');
const assert = require('node:assert/strict');

function planFlowFixture() {
  const fixture = JSON.parse(fs.readFileSync(process.env.PLAN_FLOW_FIXTURE_PATH, 'utf8'));
  assert.equal(fixture.version, 1);
  assert.equal(fixture.today, '2026-09-24');
  assert.ok(fixture.responses);
  const canonical = path => {
    const url = new URL(path, 'https://test');
    url.searchParams.sort();
    return url.pathname + url.search;
  };
  const entries = new Map(Object.entries(fixture.responses).map(([path, response]) =>
    [canonical(path), response]));
  const calls = [];
  return {
    ...fixture,
    calls,
    fetch: async path => {
      calls.push(path);
      const response = entries.get(canonical(path));
      assert.ok(response, `Django must export the actual requested route: ${path}`);
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.body,
      };
    },
  };
}

module.exports = { planFlowFixture };
