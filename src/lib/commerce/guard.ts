import { NextResponse } from "next/server";
import { readSession, type SessionPayload } from "@/lib/auth";
import { canReadCommerce, canWriteCommerce } from "@/lib/commerce/access";
import { canAccessTenant } from "@/lib/locations/access";

export async function guardCommerce(opts: {
  write: boolean;
  tenantId: string | null;
}): Promise<{ ok: true; session: SessionPayload; tenantId: string } | { ok: false; response: NextResponse }> {
  const session = await readSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const allowed = opts.write ? canWriteCommerce(session) : canReadCommerce(session);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const tenantId = session.isAgencyStaff ? opts.tenantId : session.tenantId;
  if (!tenantId) {
    return { ok: false, response: NextResponse.json({ error: "Pick a brand" }, { status: 400 }) };
  }
  if (!session.isAgencyStaff && opts.tenantId && opts.tenantId !== session.tenantId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden tenant" }, { status: 403 }) };
  }
  if (!(await canAccessTenant(session, tenantId))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden tenant" }, { status: 403 }) };
  }
  return { ok: true, session, tenantId };
}
