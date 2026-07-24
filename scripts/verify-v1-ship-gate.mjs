import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const readText = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const requireIncludes = (text, needle, label) => {
  assert.ok(text.includes(needle), `${label} must include ${needle}`);
};

const requirePattern = (text, pattern, label) => {
  assert.match(text, pattern, `${label} must match ${pattern}`);
};

const requireMarkdownTableRows = (text, sectionHeading, expectedRows) => {
  const sectionStart = text.indexOf(sectionHeading);
  assert.notEqual(sectionStart, -1, `${sectionHeading} section is missing`);
  const rest = text.slice(sectionStart);
  const nextSection = rest.search(/\n##\s+/);
  const section = nextSection === -1 ? rest : rest.slice(0, nextSection);

  for (const row of expectedRows) {
    requireIncludes(section, row, `${sectionHeading} table`);
  }
};

const adr = readText('plans/v1/platform-direction-adr.md');
const cutover = readText('.omo/plans/nuxt-to-next-cutover.md');
const webview = readText('.omo/plans/mobile-webview-repoint.md');
const webviewBridge = readText('plans/v1/mobile-webview-repoint.md');
const observability = readText('.omo/plans/observability-baseline.md');
const register = readText('plans/v1/cognitive-complexity-register.md');

requireIncludes(adr, 'adr-id: ADR-001', 'ADR front matter');
requireIncludes(adr, 'Next.js 15 + Supabase + Vercel', 'ADR target stack');
requireIncludes(adr, 'strangler / route-by-route dual-run', 'ADR migration posture');
requireIncludes(adr, 'MySQL remains SoR until per-domain cutover', 'ADR data-of-record');
requireIncludes(adr, 'DNS-level rollback', 'ADR rollback');
requireIncludes(adr, 'MUST NOT: execute any migration/ETL/cutover/deploy', 'ADR safety boundary');

requireIncludes(cutover, 'Preconditions:', 'cutover preconditions');
requireIncludes(cutover, 'platform-direction-adr APPROVED', 'cutover ADR approval precondition');
requireIncludes(cutover, 'plan-b-platform foundation delivered', 'cutover platform foundation precondition');
requireIncludes(cutover, 'no ETL runs, no DNS changes, no deploys', 'cutover execution boundary');
requireMarkdownTableRows(cutover, '## 4. Phases', [
  '| **P0 Freeze & baseline**',
  '| **P1 Seed & verify data**',
  '| **P2 Auth & session**',
  '| **P3 Route-by-route cutover**',
  '| **P4 SoR flip**',
  '| **P5 Decommission-prep**',
]);
requirePattern(cutover, /\|\s*\*\*P[0-5][^|]+\|[^|]+\|[^|]+\|[^|\n]+\|/g, 'cutover rollback rows');
requireIncludes(cutover, 'rollback_plan(p)=REHEARSED-TABLETOP', 'cutover rollback predicate');
requireIncludes(cutover, 'Tabletop scenarios', 'cutover tabletop section');

requireIncludes(webview, 'cutover plan declares the corresponding routes serving-of-record', 'WebView cutover gate');
requireIncludes(webview, 'webview_target', 'WebView config contract');
requireIncludes(webview, 'webview_next_percent', 'WebView percentage contract');
requireIncludes(webview, 'kill-switch', 'WebView kill-switch');
requireIncludes(webview, 'MUST NOT delete or modify legacy WebView entry points', 'WebView non-destructive rule');
requireIncludes(webview, 'Kill-switch drill', 'WebView rollback drill');
requireIncludes(webviewBridge, '.omo/plans/mobile-webview-repoint.md', 'WebView v1 bridge canonical path');
requireIncludes(webviewBridge, 'Do not duplicate execution details', 'WebView v1 bridge non-authoritative rule');

requireIncludes(observability, 'Sentry', 'observability Sentry decision');
requireIncludes(observability, 'send-due-notification-reminders', 'observability reminder task');
requireIncludes(observability, 'dead-man', 'observability dead-man switch');
requireIncludes(observability, 'Every row of the alert-coverage table has a live route', 'observability alert route gate');

for (const modulePath of [
  'backend/config/settings.py',
  'backend/config/observability.py',
  'backend/config/health_views.py',
  'backend/todos/tasks.py',
  'backend/todos/services/push_notifications.py',
  'frontend/sentry.client.config.ts',
  'frontend/server/api/health.get.ts',
  'mobile/App.tsx',
  'mobile/webviewConfig.ts',
  'mobile/test/webviewConfig.test.cjs',
  'mobile/app.json',
  'mobile/package.json',
  'scripts/verify-v1-ship-gate.mjs',
]) {
  requirePattern(
    register,
    new RegExp(`\\| \`${modulePath.replaceAll('/', '\\/')}\` \\|[^\\n]+\\| (?:done|exception) \\|`),
    `cognitive-complexity register row for ${modulePath}`,
  );
}

console.log('v1 ship-gate docs/register probe PASS');
console.log('checked: ADR-001, cutover preconditions/rollback, WebView gates, observability gates, cognitive-complexity register');
console.log('safety: no cutover/deploy/prod DB/secret action invoked');
