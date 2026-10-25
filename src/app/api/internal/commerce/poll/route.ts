import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runCommercePollTick } from "@/lib/commerce/poll-scheduler";

function authorized(request: Request) {
  const secret = process.env.COMMERCE_POLL_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Secured entry for a future scheduler. Nothing in this app calls it on a timer.
 * COMMERCE_CATALOG_POLL_ENABLED must be "true" or the tick does not call Meta.
 */
export async function POST(request: Request) {
  if (!process.env.COMMERCE_POLL_SECRET) {
    return NextResponse.json({ error: "Poll worker is not configured" }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown = {};
  if (request.headers.get("content-length") !== "0") {
    try {
      json = await request.json();
    } catch {
      json = {};
    }
  }
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  if ("token" in body || "secret" in body || "apiKey" in body || "accessToken" in body || "publicUrl" in body) {
    return NextResponse.json({ error: "Credentials are not accepted" }, { status: 400 });
  }
  const tick = await runCommercePollTick();
  return NextResponse.json(tick);
}
