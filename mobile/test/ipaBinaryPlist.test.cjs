const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'verify-store-artifact.mjs');

/**
 * `plutil` is macOS-only. iOS artifacts are only ever produced and verified on a
 * Mac, so on Linux CI these cases have nothing to exercise — the fixture itself
 * cannot even be created. Skipped with a stated reason rather than deleted, so
 * the coverage still runs where it means something.
 */
const PLUTIL = (() => {
  try {
    execFileSync('plutil', ['-help'], { stdio: 'ignore' });
    return false;
  } catch (error) {
    return error.code === 'ENOENT' ? 'plutil is macOS-only; iOS artifacts are verified on macOS' : false;
  }
})();

/**
 * Xcode packages plists into an .ipa in BINARY form (`bplist00`), not XML.
 *
 * Measured 2026-08-30: the archive's `.app` passed the check while the `.ipa`
 * exported from that same archive FAILED, even though `plutil` showed the channel
 * was present. The `.app` branch converts with `plutil` first; the `.ipa` branch
 * read the zip member as text and saw binary noise.
 *
 * A gate that rejects a correct artifact is worse than no gate: the operator
 * learns to pass it with a flag, and the one real failure gets waved through too.
 */
function makeIpa(dir, channel) {
  const appDir = path.join(dir, 'Payload', 'app.app');
  fs.mkdirSync(appDir, { recursive: true });
  const plist = path.join(appDir, 'Expo.plist');
  fs.writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>EXUpdatesRequestHeaders</key>
  <dict><key>expo-channel-name</key><string>${channel}</string></dict>
  <key>EXUpdatesRuntimeVersion</key><string>1.2.3</string>
</dict></plist>`,
  );
  // The step that broke the reader: Xcode stores it binary.
  execFileSync('plutil', ['-convert', 'binary1', plist]);
  const ipa = path.join(dir, 'app.ipa');
  execFileSync('zip', ['-q', '-r', ipa, 'Payload'], { cwd: dir });
  return ipa;
}

function runVerifier(artifact) {
  try {
    return { ok: true, out: execFileSync('node', [SCRIPT, '--artifact', artifact], { encoding: 'utf8' }) };
  } catch (error) {
    return { ok: false, out: `${error.stdout || ''}${error.stderr || ''}` };
  }
}

test('an .ipa whose plist is binary is read, not rejected', { skip: PLUTIL }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipa-ok-'));
  try {
    const result = runVerifier(makeIpa(dir, 'production'));
    assert.equal(result.ok, true, result.out);
    assert.match(result.out, /channel "production"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an .ipa on the wrong channel is still rejected', { skip: PLUTIL }, () => {
  // The fix must not turn the check into a rubber stamp.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipa-bad-'));
  try {
    const result = runVerifier(makeIpa(dir, 'preview'));
    assert.equal(result.ok, false, result.out);
    assert.match(result.out, /preview/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
