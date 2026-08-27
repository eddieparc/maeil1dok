const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'publish-ota.mjs');

/**
 * The gate decides whether a shell OTA may be published. What it must get right:
 *
 * - Intent is DECLARED, never defaulted. Defaulting to skip the web check restores
 *   the ordering bug (shell published before the web it depends on, so an explicit
 *   logout silently fails to stick); defaulting to require it makes the task-5
 *   rehearsal and the task-38 navigation hotfix unpublishable, including any later
 *   re-publish of that hotfix.
 * - One platform per invocation, because a combined publish can half-fail behind a
 *   single exit code.
 * - A mismatched or unreachable web marker BLOCKS.
 *
 * Every case runs the real script. `--check-only` keeps `eas update` from firing, so
 * nothing here can publish.
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

async function withMarkerServer(marker, run) {
  const server = http.createServer((request, response) => {
    if (request.url !== '/_build-marker.json') {
      response.writeHead(404).end();
      return;
    }
    if (marker === null) {
      response.writeHead(500).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(typeof marker === 'string' ? marker : JSON.stringify(marker));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('publishing without declaring intent is refused', () => {
  const result = runGate(['--platform', 'ios', '--check-only']);
  assert.equal(result.ok, false, 'an undeclared publish must not proceed');
  assert.match(result.stderr, /declare intent/);
});

test('declaring both intents at once is refused', () => {
  const result = runGate([
    '--platform',
    'ios',
    '--requires-web',
    'abc1234',
    '--no-web-dependency',
    'rehearsal',
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
    '--no-web-dependency',
    'rehearsal',
    '--platform',
    'both',
    '--check-only',
  ]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.stderr, /must be ios or android/);
});

test('the rehearsal and the hotfix can publish by waiving the web dependency', () => {
  const result = runGate([
    '--no-web-dependency',
    'task 38 navigation hotfix carries no web-dependent change',
    '--platform',
    'android',
    '--check-only',
  ]);
  assert.equal(result.ok, true, 'a shell-only change must remain publishable');
  assert.match(result.stdout, /web dependency waived/);
  assert.match(result.stdout, /check-only: would run npx eas update/);
  assert.match(result.stdout, /--platform android/);
});

test('a matching web marker allows a Phase 1 shell OTA', async () => {
  const sha = 'a'.repeat(40);
  await withMarkerServer({ commit: sha, builtAt: '2026-08-27T00:00:00.000Z' }, (origin) => {
    const result = runGate(
      ['--requires-web', sha, '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /web marker OK/);
  });
});

test('a mismatched web marker blocks the publish', async () => {
  await withMarkerServer({ commit: 'b'.repeat(40) }, (origin) => {
    const result = runGate(
      ['--requires-web', 'a'.repeat(40), '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(result.ok, false, 'the shell must not go out ahead of its web build');
    assert.match(result.stderr, /does not match --requires-web/);
  });
});

test('an unknown commit marker blocks the publish', async () => {
  // A local build with no git context writes `unknown`. Accepting it would let any
  // shell publish claim it matched.
  await withMarkerServer({ commit: 'unknown' }, (origin) => {
    const result = runGate(
      ['--requires-web', 'unknown', '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(result.ok, false);
    assert.match(result.stderr, /unknown commit marker/);
  });
});

test('an unreachable or broken marker endpoint blocks the publish', async () => {
  await withMarkerServer(null, (origin) => {
    const failing = runGate(
      ['--requires-web', 'a'.repeat(40), '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(failing.ok, false);
    assert.match(failing.stderr, /returned 500/);
  });

  await withMarkerServer('not json at all', (origin) => {
    const malformed = runGate(
      ['--requires-web', 'a'.repeat(40), '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(malformed.ok, false);
    assert.match(malformed.stderr, /is not JSON/);
  });
});

test('a short sha may match a longer deployed marker, but not the reverse', async () => {
  const full = 'c'.repeat(40);
  await withMarkerServer({ commit: full }, async (origin) => {
    const short = runGate(
      ['--requires-web', full.slice(0, 8), '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(short.ok, true, 'a short sha is a normal way to refer to a commit');
  });

  await withMarkerServer({ commit: 'c'.repeat(8) }, async (origin) => {
    const longer = runGate(
      ['--requires-web', full, '--platform', 'ios', '--check-only'],
      { env: { WEB_ORIGIN: origin } },
    );
    assert.equal(
      longer.ok,
      false,
      'a truncated deployed marker must not satisfy a full sha',
    );
  });
});
