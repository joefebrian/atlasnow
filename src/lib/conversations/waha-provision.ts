/**
 * Used to auto-start a WEBJS Chromium whenever a location was saved.
 * That spawned dozens of unscanned QR browsers and OOMed production.
 * Connect is explicit now — this is a no-op kept so old imports stay safe.
 */
export async function provisionWahaSessionForLocation(_location: {
  atlasLocationId: string;
  name: string;
  phone?: string | null;
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  return { ok: true, skipped: "explicit_connect_only" };
}
