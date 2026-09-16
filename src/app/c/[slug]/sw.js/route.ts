import { NextResponse } from "next/server";
import { loadBrandBySlug } from "@/lib/loyalty/card-public";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { slug: slugRaw } = await ctx.params;
  const slug = decodeURIComponent(slugRaw);
  const tenant = await loadBrandBySlug(slug);
  if (!tenant) return new NextResponse(null, { status: 404 });
  const safe = tenant.slug.replace(/[^a-z0-9-]/gi, "");
  const script = `/* ${safe} stamp card */
const CACHE = "atlas-c-${safe}-v1";
const PREFIX = "/c/${safe}/";
const ICON = "/i/${safe}/";
self.addEventListener("install", (event) => { self.skipWaiting(); event.waitUntil(Promise.resolve()); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (!(path.startsWith(PREFIX) || path.startsWith(ICON) || path.startsWith("/api/card/"))) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});
`;
  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": `/c/${safe}/`,
      "Cache-Control": "no-cache",
    },
  });
}
