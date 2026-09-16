import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { listMembers, registerMember } from "@/lib/loyalty/members";
import { getOrCreateProgram } from "@/lib/loyalty/service";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return { error: NextResponse.json({ error: "Pick a brand first." }, { status: 400 }) };
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const url = new URL(request.url);
  const data = await listMembers({
    tenantId: scoped.tenantId,
    q: url.searchParams.get("q") || undefined,
    locationId: url.searchParams.get("locationId") || undefined,
    status: url.searchParams.get("status") || undefined,
  });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const program = await getOrCreateProgram(scoped.tenantId);
  const r = await registerMember({
    tenantId: scoped.tenantId,
    phone: typeof body.phone === "string" ? body.phone : "",
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    birthDate: typeof body.birthDate === "string" ? body.birthDate : "",
    city: typeof body.city === "string" ? body.city : "",
    province: typeof body.province === "string" ? body.province : "",
    birthdayWaOptIn: body.birthdayWaOptIn === true,
    locationId: typeof body.locationId === "string" ? body.locationId : null,
    source: "STAFF",
    qrScope: program.qrScope,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, member: r.member, created: r.created });
}
