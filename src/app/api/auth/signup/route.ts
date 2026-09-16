import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/auth";
import { readLogoFile, saveTenantLogo } from "@/lib/brand-logo";
import { clientIpFrom, takeRateToken } from "@/lib/http-rate-limit";
import { parseSignupRequest, registerWorkspace } from "@/lib/signup";

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limited = takeRateToken(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too_many" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }
  const ct = request.headers.get("content-type") || "";
  let body: unknown;
  let logo: File | null = null;
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      body = {
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name") || undefined,
        phone: form.get("phone") || undefined,
        acceptTerms: form.get("acceptTerms") === "true" || form.get("acceptTerms") === "on",
        method: form.get("method") || "email",
        kind: "brand",
        wantsGroup: form.get("wantsGroup"),
      };
      const file = form.get("logo");
      if (file instanceof File && file.size > 40) logo = file;
    } else {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseSignupRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.value.method !== "email" || !parsed.value.password) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  try {
    const created = await registerWorkspace(parsed.value);
    if (logo) {
      const read = await readLogoFile(logo);
      if (!("error" in read)) {
        try {
          await saveTenantLogo(created.tenantId, read.buf);
        } catch {
          /* signup still succeeds without logo */
        }
      }
    }
    await writeAudit({
      tenantId: created.tenantId,
      actorId: created.userId,
      action: "SIGNUP",
      objectType: "user",
      objectId: created.userId,
      meta: { method: "email", terms: true, pending: true, wantsGroup: parsed.value.wantsGroup },
    });
    return NextResponse.json({ ok: true, pending: true });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "too_many" || (e instanceof Error && e.message === "too_many")) {
      return NextResponse.json({ error: "too_many" }, { status: 429 });
    }
    if (code === "email_taken" || (e instanceof Error && e.message === "email_taken")) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    console.error("[signup]", e);
    return NextResponse.json({ error: "signup_failed" }, { status: 500 });
  }
}
