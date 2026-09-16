import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { getCustomerBookDetail, listCustomerBook } from "@/lib/customers/book";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return { error: NextResponse.json({ error: "Pick a brand first." }, { status: 400 }) };
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { tenantId, url };
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const phone = scoped.url.searchParams.get("phone") || "";
  if (phone) {
    const person = await getCustomerBookDetail(scoped.tenantId, phone);
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ person });
  }
  const data = await listCustomerBook({
    tenantId: scoped.tenantId,
    q: scoped.url.searchParams.get("q") || undefined,
    status: scoped.url.searchParams.get("status") || undefined,
  });
  return NextResponse.json(data);
}
