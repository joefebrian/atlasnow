import { NextResponse } from "next/server";
import { authenticateUserDetailed, setSessionCookie, writeAudit } from "@/lib/auth";
import { clientIpFrom, takeRateToken } from "@/lib/http-rate-limit";
import { defaultHomePath } from "@/lib/tenancy";

export async function POST(request: Request) {
  try {
    const ip = clientIpFrom(request);
    const limited = takeRateToken(`login:${ip}`, 8, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "too_many" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
      );
    }
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() || "";
    const password = body.password || "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib" }, { status: 400 });
    }

    const result = await authenticateUserDetailed(email, password);
    if (!result.ok) {
      const status = result.error === "pending" ? 403 : 401;
      return NextResponse.json({ error: result.error }, { status });
    }

    const session = result.session;
    await setSessionCookie(session);
    await writeAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "LOGIN",
      objectType: "user",
      objectId: session.userId,
    });

    return NextResponse.json({
      ok: true,
      home: defaultHomePath(session),
      user: {
        email: session.email,
        name: session.name,
        role: session.role,
        tenant: session.tenantName,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login gagal" }, { status: 500 });
  }
}
