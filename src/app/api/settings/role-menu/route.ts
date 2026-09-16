import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { CLIENT_ROLES, isClientRole } from "@/lib/roles";
import { canEditRoleMenus, loadRoleMenuHrefs, saveRoleMenuHrefs } from "@/lib/role-menu";
import { defaultHrefsForRole, MENU_CHOICES } from "@/lib/nav-access";

async function brandId(session: NonNullable<Awaited<ReturnType<typeof readSession>>>, client: string | null) {
  if (session.isAgencyStaff || session.isPlatformAdmin) {
    if (!client) return { error: "Pick a brand", status: 400 as const };
    if (!(await canAccessTenant(session, client))) return { error: "Not found", status: 404 as const };
    return { tenantId: client };
  }
  if (session.role !== "CLIENT_ADMIN") return { error: "Forbidden", status: 403 as const };
  return { tenantId: session.tenantId };
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditRoleMenus(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const client = new URL(request.url).searchParams.get("client");
  const resolved = await brandId(session, client);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const roles = await Promise.all(
    CLIENT_ROLES.map(async (role) => {
      const saved = await loadRoleMenuHrefs(resolved.tenantId, role);
      return { role, hrefs: saved ?? defaultHrefsForRole(role), isDefault: !saved };
    })
  );
  return NextResponse.json({ tenantId: resolved.tenantId, choices: MENU_CHOICES, roles });
}

export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditRoleMenus(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    client?: string;
    role?: string;
    hrefs?: string[];
  };
  const resolved = await brandId(session, body.client || null);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  if (!body.role || !isClientRole(body.role)) {
    return NextResponse.json({ error: "Pick a role" }, { status: 400 });
  }
  const hrefs = await saveRoleMenuHrefs(resolved.tenantId, body.role, Array.isArray(body.hrefs) ? body.hrefs : []);
  return NextResponse.json({ ok: true, role: body.role, hrefs });
}
