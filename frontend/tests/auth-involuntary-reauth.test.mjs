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

const reauthMarkerSource = await readFile(
  new URL('../app/composables/reauthMarker.ts', import.meta.url),
  'utf8',
);

const {
  REAUTH_MARKER_KEY,
  REAUTH_MARKER_MAX_AGE_MS,
  createReauthMarker,
  parseReauthMarker,
  shouldReportInvoluntaryReauth,
  classifyAuthRender,
} = await importTsModule(reauthMarkerSource);

test('Given a successful authentication When creating the marker Then it records when it was set', () => {
  const marker = createReauthMarker(1_700_000_000_000);
  assert.equal(marker.at, 1_700_000_000_000);
  assert.equal(typeof REAUTH_MARKER_KEY, 'string');
  assert.ok(REAUTH_MARKER_KEY.length > 0);
});

test('Given a stored marker When parsing garbage Then it degrades to null instead of throwing', () => {
  assert.equal(parseReauthMarker(null), null);
  assert.equal(parseReauthMarker('not json'), null);
  assert.equal(parseReauthMarker('{"at":"yesterday"}'), null);
  assert.deepEqual(parseReauthMarker('{"at":123}'), { at: 123 });
});

test('Given a marked session landing on login involuntarily Then it is reported', () => {
  const marker = createReauthMarker(1_000);
  assert.equal(
    shouldReportInvoluntaryReauth({ marker, landedOnLogin: true, voluntaryLogout: false, now: 2_000 }),
    true,
  );
});

test('Given a voluntary logout Then landing on login is never reported', () => {
  // The marker is cleared on voluntary logout, but the flag is asserted as well:
  // a race that leaves the marker behind must not manufacture a false signal.
  const marker = createReauthMarker(1_000);
  assert.equal(
    shouldReportInvoluntaryReauth({ marker, landedOnLogin: true, voluntaryLogout: true, now: 2_000 }),
    false,
  );
});

test('Given no marker Then landing on login is a plain first-time sign-in', () => {
  assert.equal(
    shouldReportInvoluntaryReauth({ marker: null, landedOnLogin: true, voluntaryLogout: false, now: 2_000 }),
    false,
  );
});

test('Given a marked session that did not land on login Then nothing is reported', () => {
  const marker = createReauthMarker(1_000);
  assert.equal(
    shouldReportInvoluntaryReauth({ marker, landedOnLogin: false, voluntaryLogout: false, now: 2_000 }),
    false,
  );
});

test('Given a marker older than the max age Then it is too stale to prove anything', () => {
  const marker = createReauthMarker(0);
  assert.equal(
    shouldReportInvoluntaryReauth({
      marker,
      landedOnLogin: true,
      voluntaryLogout: false,
      now: REAUTH_MARKER_MAX_AGE_MS + 1,
    }),
    false,
  );
});

test('Given an SSR render When classifying Then hit, miss and anon are distinguished', () => {
  assert.equal(classifyAuthRender({ hadAuthCookie: true, resolvedUser: true }), 'hit');
  assert.equal(classifyAuthRender({ hadAuthCookie: true, resolvedUser: false }), 'miss');
  assert.equal(classifyAuthRender({ hadAuthCookie: false, resolvedUser: false }), 'anon');
  // A user resolved without an auth cookie cannot happen through the cookie path;
  // treating it as `anon` would hide a real bug, so it is reported as `hit`.
  assert.equal(classifyAuthRender({ hadAuthCookie: false, resolvedUser: true }), 'hit');
});
