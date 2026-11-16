/**
 * In-app update check (sideloaded APKs, no Play Store): the website's /api/app-version says which
 * version is current and where to download it; the app compares that with its own version
 * (app.json expo.version, baked into each build). Free of React / React Native imports so it can be
 * unit-tested under plain vitest (same reason as pin.logic.ts).
 */

export const DEFAULT_DOWNLOAD_URL = 'https://qumanity.in/app';

/** "1.0.10" → [1, 0, 10]; anything that isn't digits counts as 0 (so "1.0.1-beta" → [1, 0, 1]). */
function parts(v: string): number[] {
  return v
    .trim()
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
}

/**
 * True only when `latest` is strictly newer than `current`, compared number by number
 * ("1.0.10" is newer than "1.0.9"). A build newer than the website's figure (e.g. one built
 * before the website is bumped) or a missing/blank version never shows the banner.
 */
export function isNewer(latest: string | null | undefined, current: string | null | undefined): boolean {
  if (!latest?.trim() || !current?.trim()) return false;
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Only ever open an https link from the response; anything else falls back to the known page. */
export function safeDownloadUrl(url: unknown): string {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url.trim()) ? url.trim() : DEFAULT_DOWNLOAD_URL;
}
