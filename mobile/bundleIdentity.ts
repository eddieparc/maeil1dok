/**
 * Bundle identity — the shell's answer to "which code is actually running here?".
 *
 * The OTA reach question (plan task 5 / handoff H1) cannot be answered without
 * this: `eas update` reports that a bundle was published, never that a device
 * applied it. Without an observation surface the rehearsal is circular — you
 * publish, restart the app, and have no way to tell whether anything changed.
 *
 * Two answers are deliberately kept apart:
 *
 *   `embedded`  no OTA has been applied; this is the binary that shipped from
 *               the store. A negative reach verdict.
 *   `unknown`   the update id could not be read at all. NOT a verdict — it means
 *               the measurement failed and must be repeated.
 *
 * Collapsing them into one value makes the reach verdict unfalsifiable, which is
 * precisely the failure mode H1 exists to prevent.
 *
 * Pure by design: `expo-updates` is read at the call site and passed in, so the
 * formatting rules are testable without a device or a native module.
 */

export const EMBEDDED_UPDATE_ID = 'embedded';
export const UNKNOWN_VALUE = 'unknown';

export type RawBundleIdentity = {
  readonly updateId?: unknown;
  readonly runtimeVersion?: unknown;
  readonly channel?: unknown;
  readonly isEmbeddedLaunch?: unknown;
  readonly appVersion?: unknown;
};

export type BundleIdentity = {
  readonly updateId: string;
  readonly runtimeVersion: string;
  readonly channel: string;
  readonly appVersion: string;
  readonly isEmbedded: boolean;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function resolveBundleIdentity(raw: RawBundleIdentity): BundleIdentity {
  const isEmbedded = raw.isEmbeddedLaunch === true;
  const updateId = readString(raw.updateId);

  return {
    updateId: updateId ?? (isEmbedded ? EMBEDDED_UPDATE_ID : UNKNOWN_VALUE),
    runtimeVersion: readString(raw.runtimeVersion) ?? UNKNOWN_VALUE,
    channel: readString(raw.channel) ?? UNKNOWN_VALUE,
    appVersion: readString(raw.appVersion) ?? UNKNOWN_VALUE,
    isEmbedded,
  };
}

/**
 * One greppable line for device logs. The update id is carried verbatim so an
 * operator can diff it against the id `eas update` printed at publish time.
 */
export function formatBundleIdentityLine(identity: BundleIdentity): string {
  return [
    '[BundleIdentity]',
    `updateId=${identity.updateId}`,
    `runtime=${identity.runtimeVersion}`,
    `channel=${identity.channel}`,
    `appVersion=${identity.appVersion}`,
  ].join(' ');
}

/**
 * The on-screen twin of the log line, for devices where log access is blocked.
 * Shortened because it renders in a footer, but kept unambiguous: the first
 * segment of a UUID is enough to tell two published updates apart.
 */
export function formatBundleIdentityLabel(identity: BundleIdentity): string {
  const shortId =
    identity.updateId === EMBEDDED_UPDATE_ID || identity.updateId === UNKNOWN_VALUE
      ? identity.updateId
      : identity.updateId.split('-')[0];

  return `v${identity.runtimeVersion} · ${shortId}`;
}
