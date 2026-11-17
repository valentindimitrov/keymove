import { browser } from 'wxt/browser';

// Kept apart from host_marker.ts so the background service worker imports no DOM code.

export const HOST_MARKER_SECRET_KEY = 'hostMarkerSecret';

export function isHostMarkerSecret(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads the installation's secret, creating it on first use. The background creates it
 * at installation before injecting into open tabs; a concurrent first use elsewhere can
 * only leave a host signed with a superseded secret, which is then never reconciled.
 */
export async function ensureHostMarkerSecret(): Promise<string | null> {
  try {
    const read = async () => {
      const value: unknown = (await browser.storage.local.get(HOST_MARKER_SECRET_KEY))[
        HOST_MARKER_SECRET_KEY
      ];
      return isHostMarkerSecret(value) ? value : null;
    };
    const existing = await read();
    if (existing) return existing;
    await browser.storage.local.set({ [HOST_MARKER_SECRET_KEY]: newSecret() });
    return await read();
  } catch {
    // Without storage (an orphan, or a test without it) nothing is signed or reconciled.
    return null;
  }
}
