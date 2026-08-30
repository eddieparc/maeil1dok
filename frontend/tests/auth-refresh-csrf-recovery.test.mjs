import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const importTsModule = async (source) => {
  const { code } = await transform(source, { format: 'esm', loader: 'ts', sourcemap: false });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const source = await readFile(
  new URL('../app/composables/authSessionPolicy.ts', import.meta.url),
  'utf8',
);
const { refreshWithCsrfRecovery } = await importTsModule(source);

/**
 * A refresh answered 403 is NOT a signed-out user.
 *
 * Measured in production 2026-08-30: a shell user was signed out at 10:00 KST and
 * the server log shows the exact sequence -- `refresh_401 403 cause=csrf` followed
 * immediately by a logout call. `refreshToken()` treated 401 and 403 the same and
 * called `performLogout()` for both.
 *
 * Those are different answers. 401 is the server refusing the identity; the
 * session really is over. 403 here is a CSRF failure, which says nothing about the
 * session -- and it is *expected* for a shell user, because the shell signs in
 * natively and bridges the session in, so the web never receives the login
 * response that carries `X-CSRFToken`. It starts with no token at all.
 *
 * So 403 must do two things and neither of them is a logout: recover the token
 * from `/auth/csrf/` and retry once, and if that still fails, hold the session and
 * surface "we could not tell" instead of destroying it.
 */
function harness({ statuses, recovered = 'fresh-token' }) {
  const calls = { attempts: 0, recoveries: 0, logouts: 0 };
  const deps = {
    attempt: async () => {
      const next = statuses[Math.min(calls.attempts, statuses.length - 1)];
      calls.attempts += 1;
      return next;
    },
    recoverCsrfToken: async () => {
      calls.recoveries += 1;
      return recovered;
    },
    logout: async () => {
      calls.logouts += 1;
    },
  };
  return { deps, calls };
}

const OK = { status: 200, ok: true, access: 'new-access' };
const CSRF = { status: 403, ok: false };
const REJECTED = { status: 401, ok: false };
const OFFLINE = { status: 0, ok: false };

test('Given a CSRF failure that recovers Then the refresh succeeds and nobody is signed out', async () => {
  const { deps, calls } = harness({ statuses: [CSRF, OK] });

  const outcome = await refreshWithCsrfRecovery(deps, {});

  assert.deepEqual(outcome, { ok: true });
  assert.equal(calls.recoveries, 1, 'the token must be re-fetched, not given up on');
  assert.equal(calls.attempts, 2);
  assert.equal(calls.logouts, 0);
});

test('Given a CSRF failure that keeps failing Then the session is held, not destroyed', async () => {
  // This is the production case. Signing the user out here is the harm: the
  // session is fine and only the CSRF handshake is broken.
  const { deps, calls } = harness({ statuses: [CSRF, CSRF] });

  const outcome = await refreshWithCsrfRecovery(deps, {});

  assert.deepEqual(outcome, { ok: false, reason: 'unreachable' });
  assert.equal(calls.logouts, 0, 'a CSRF failure is never a confirmed sign-out');
});

test('Given the CSRF endpoint itself is unavailable Then it still does not sign out', async () => {
  const { deps, calls } = harness({ statuses: [CSRF], recovered: null });

  const outcome = await refreshWithCsrfRecovery(deps, {});

  assert.deepEqual(outcome, { ok: false, reason: 'unreachable' });
  assert.equal(calls.attempts, 1, 'no point retrying with the same missing token');
  assert.equal(calls.logouts, 0);
});

test('Given a 401 Then the sign-out behaviour is unchanged', async () => {
  // The protection is not widened away: a server that refuses the identity still
  // ends the session.
  const { deps, calls } = harness({ statuses: [REJECTED] });

  const outcome = await refreshWithCsrfRecovery(deps, {});

  assert.deepEqual(outcome, { ok: false, reason: 'rejected' });
  assert.equal(calls.logouts, 1);
  assert.equal(calls.recoveries, 0, '401 is not a CSRF problem');
});

test('Given a 401 with logout suppressed Then the caller decides', async () => {
  const { deps, calls } = harness({ statuses: [REJECTED] });

  const outcome = await refreshWithCsrfRecovery(deps, { logoutOnFailure: false });

  assert.deepEqual(outcome, { ok: false, reason: 'rejected' });
  assert.equal(calls.logouts, 0);
});

test('Given a transport failure Then it is unreachable and untouched', async () => {
  const { deps, calls } = harness({ statuses: [OFFLINE] });

  const outcome = await refreshWithCsrfRecovery(deps, {});

  assert.deepEqual(outcome, { ok: false, reason: 'unreachable' });
  assert.equal(calls.recoveries, 0);
  assert.equal(calls.logouts, 0);
});

test('Given an immediate success Then no recovery is attempted', async () => {
  const { deps, calls } = harness({ statuses: [OK] });

  assert.deepEqual(await refreshWithCsrfRecovery(deps, {}), { ok: true });
  assert.equal(calls.recoveries, 0);
  assert.equal(calls.attempts, 1);
});

test('Given a 200 with no access token Then it is rejected without a sign-out', async () => {
  // Matches the existing contract: a malformed success is not a logout trigger.
  const { deps, calls } = harness({ statuses: [{ status: 200, ok: true }] });

  assert.deepEqual(await refreshWithCsrfRecovery(deps, {}), { ok: false, reason: 'rejected' });
  assert.equal(calls.logouts, 0);
});
