const test = require('node:test');
const assert = require('node:assert/strict');

test('OTA quality checks run types, behavior and live plan reads in order', async () => {
  const { verifyReleaseChecks } = await import('../scripts/publish-ota.mjs');
  const calls = [];
  verifyReleaseChecks((command, args, options) => {
    calls.push({ command, args });
    assert.equal(options.stdio, 'inherit');
    assert.ok(options.cwd.endsWith('/mobile'));
  });
  assert.deepEqual(calls.slice(0, 2), [
    { command: 'npm', args: ['run', 'typecheck'] },
    { command: 'npm', args: ['test'] },
  ]);
  assert.equal(calls[2].command, 'python3');
  assert.ok(calls[2].args[0].endsWith('/scripts/check_live_plans.py'));
});

for (const failAt of [0, 1, 2]) {
  test(`OTA stops at failed quality stage ${failAt} instead of proceeding`, async () => {
    const { verifyReleaseChecks } = await import('../scripts/publish-ota.mjs');
    let calls = 0;
    const failure = new Error('failed check');
    assert.throws(() => verifyReleaseChecks(() => {
      if (calls++ === failAt) throw failure;
    }), error => error === failure);
    assert.equal(calls, failAt + 1);
  });
}
