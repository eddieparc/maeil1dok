const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'publish-ota.mjs');

/**
 * The gate decides whether a shell OTA may be published. Two halves, tested the way
 * each is actually shaped:
 *
 *  - Argument handling runs the real script (`--check-only` keeps `eas update` from
 *    firing, so nothing here can publish).
 *  - The marker verdict is a pure function, imported directly.
 *
 * An earlier version stood up an HTTP server per marker case and HUNG: the gate's
 * `fetch` runs in a child process and leaves a keep-alive socket, so
 * `server.close()` never completed. Neither `Connection: close` nor
 * `closeAllConnections()` fixed it. That shape cost a 25-minute CI failure, so the
 * decision was extracted instead of the teardown being patched again.
 */
function runGate(args, { env = {} } = {}) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ? String(error.stdout) : '',
      stderr: error.stderr ? String(error.stderr) : '',
    };
  }
}

test('publishing without declaring intent is refused', () => {
  // Defaulting either way is the bug this gate exists to prevent: defaulting to skip
  // the web check restores the ordering bug (shell ahead of the web it depends on,
  // so an explicit logout silently fails to stick), and defaulting to require it
  // makes the task-5 rehearsal and the task-38 hotfix unpublishable.
  const result = runGate(['--platform', 'ios', '--check-only']);
  assert.equal(result.ok, false, 'an undeclared publish must not proceed');
  assert.match(result.stderr, /declare intent/);
});

test('declaring both intents at once is refused', () => {
  const result = runGate([
    '--platform', 'ios',
    '--requires-web', 'abc1234',
    '--no-web-dependency', 'rehearsal',
    '--check-only',
  ]);
  assert.equal(result.ok, false);
  assert.match(result.stderr, /mutually exclusive/);
});

test('a missing or unknown platform is refused', () => {
  const missing = runGate(['--no-web-dependency', 'rehearsal', '--check-only']);
  assert.equal(missing.ok, false, 'both platforms at once hides a half-failure');
  assert.match(missing.stderr, /--platform ios\|android is required/);

  const wrong = runGate([
    '--no-web-dependency', 'rehearsal', '--platform', 'both', '--check-only',
  ]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.stderr, /must be ios or android/);
});

test('the rehearsal and the hotfix can publish by waiving the web dependency', () => {
  const result = runGate([
    '--no-web-dependency', 'task 38 navigation hotfix carries no web-dependent change',
    '--platform', 'android',
    '--check-only',
  ]);
  assert.equal(result.ok, true, 'a shell-only change must remain publishable');
  assert.match(result.stdout, /web dependency waived/);
  assert.match(result.stdout, /check-only: would run npx eas update/);
  assert.match(result.stdout, /--platform android/);
});

test('an unreachable marker endpoint blocks the publish', () => {
  // Port 1 is never listening, so this exercises the real fetch failure path without
  // a server of our own.
  const result = runGate(
    ['--requires-web', 'a'.repeat(40), '--platform', 'ios', '--check-only'],
    { env: { WEB_ORIGIN: 'http://127.0.0.1:1' } },
  );
  assert.equal(result.ok, false);
  assert.match(result.stderr, /could not read/);
});

test('the marker verdict accepts only a matching commit', async () => {
  const { evaluateMarker } = await import(SCRIPT);
  const sha = 'a'.repeat(40);

  assert.equal(evaluateMarker({ commit: sha }, sha).ok, true);
  assert.equal(
    evaluateMarker({ commit: sha.slice(0, 8) }, sha.slice(0, 8)).ok,
    true,
  );

  const mismatch = evaluateMarker({ commit: 'b'.repeat(40) }, sha);
  assert.equal(mismatch.ok, false, 'the shell must not go out ahead of its web build');
  assert.match(mismatch.reason, /does not match --requires-web/);
});

test('a short sha may match a longer deployed marker, but not the reverse', async () => {
  const { evaluateMarker } = await import(SCRIPT);
  const full = 'c'.repeat(40);

  assert.equal(
    evaluateMarker({ commit: full }, full.slice(0, 8)).ok,
    true,
    'a short sha is a normal way to refer to a commit',
  );
  assert.equal(
    evaluateMarker({ commit: 'c'.repeat(8) }, full).ok,
    false,
    'a truncated deployed marker must not satisfy a full sha',
  );
});

test('an unknown or malformed marker blocks the publish', async () => {
  const { evaluateMarker } = await import(SCRIPT);
  const sha = 'a'.repeat(40);

  // A local build with no git context writes `unknown`. Accepting it would let any
  // shell publish claim it matched.
  const unknown = evaluateMarker({ commit: 'unknown' }, 'unknown');
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason, /unknown commit marker/);

  for (const bad of [null, undefined, 'not json', 42, {}, { commit: '' }, { builtAt: 'x' }]) {
    assert.equal(
      evaluateMarker(bad, sha).ok,
      false,
      `a marker of ${JSON.stringify(bad)} must not satisfy the gate`,
    );
  }
});


/**
 * Publishing is not delivery — the 2026-08-29 lesson.
 *
 * `eas update` reported success for months while the store binary received
 * nothing: it sends no update channel, so the server answered every check with
 * HTTP 400. The gate has to stop treating "published" as "reachable".
 */
test('the served update must actually change after a publish', async () => {
  const { evaluateServedUpdate } = await import(SCRIPT);

  // Nothing served for this runtime/channel: the publish went somewhere no
  // client will ever ask for.
  const nothing = evaluateServedUpdate({ before: 'a', after: null });
  assert.equal(nothing.ok, false);
  assert.match(nothing.reason, /serv/i);

  // Same id before and after means the publish did not become the served update.
  const unchanged = evaluateServedUpdate({ before: 'a', after: 'a' });
  assert.equal(unchanged.ok, false);
  assert.match(unchanged.reason, /unchanged|did not change/i);

  assert.equal(evaluateServedUpdate({ before: null, after: 'a' }).ok, true);
  assert.equal(evaluateServedUpdate({ before: 'a', after: 'b' }).ok, true);
});

test('the update target is derived from app config, never guessed', async () => {
  const { resolveUpdateTarget } = await import(SCRIPT);

  const target = resolveUpdateTarget({
    expo: {
      version: '1.2.2',
      runtimeVersion: { policy: 'appVersion' },
      extra: { eas: { projectId: 'abc-123' } },
    },
  });
  assert.equal(target.ok, true);
  assert.equal(target.runtimeVersion, '1.2.2');
  assert.equal(target.projectId, 'abc-123');

  // A different policy means the runtime cannot be read off `version`. Guessing
  // here would query a runtime no device uses and call the answer proof.
  const fingerprint = resolveUpdateTarget({
    expo: { version: '1.2.2', runtimeVersion: { policy: 'fingerprint' }, extra: { eas: { projectId: 'a' } } },
  });
  assert.equal(fingerprint.ok, false);

  const noProject = resolveUpdateTarget({
    expo: { version: '1.2.2', runtimeVersion: { policy: 'appVersion' }, extra: {} },
  });
  assert.equal(noProject.ok, false);
});

test('every run states that publishing does not prove reach', () => {
  const result = runGate([
    '--check-only',
    '--no-web-dependency',
    'reason',
    '--platform',
    'ios',
  ]);
  assert.equal(result.ok, true, result.stderr);
  // The store binary that shipped could not receive any update. An operator
  // reading only "Published!" concluded the fix had gone out; it had not.
  assert.match(result.stdout, /도달|reach/i);
});
