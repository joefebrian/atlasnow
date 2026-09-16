import { randomBytes } from "crypto";

/** Generate immutable atlas_location_id. Never reuse after archive. */
export function generateAtlasLocationId(): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return `atl_${stamp}_${rand}`;
}
