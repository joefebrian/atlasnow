import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { SUPPORT_COOKIE, readSupportThreadId, signSupportThreadId, supportCookieSet } from "@/lib/support/cookie";
import { visitorSend } from "@/lib/support/service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const session = await readSession();
  const jar = await cookies();
  const cookieThreadId = await readSupportThreadId(jar.get(SUPPORT_COOKIE)?.value);

  const name =
    (typeof rec.name === "string" ? rec.name : "") || session?.name || session?.email.split("@")[0] || "";
  const email = (typeof rec.email === "string" ? rec.email : "") || session?.email || "";
  const message = typeof rec.body === "string" ? rec.body : "";
  const locale = typeof rec.locale === "string" ? rec.locale : "en";
  const path = typeof rec.path === "string" ? rec.path : "";

  const result = await visitorSend({
    name,
    email,
    body: message,
    locale,
    path,
    session,
    cookieThreadId,
  });
  if (!result.ok) {
    const status = result.error === "closed_hours" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const res = NextResponse.json({ ok: true, thread: result.thread });
  if (result.thread?.id) {
    const token = await signSupportThreadId(result.thread.id);
    const c = supportCookieSet(token);
    res.cookies.set(c.name, c.value, c);
  }
  return res;
}
