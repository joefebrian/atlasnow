import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Disable client workspace login (users remain in DB, cannot sign into this tenant). */
export async function POST(_request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const client = await prisma.tenant.findFirst({ where: { id, type: "CLIENT" } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { loginEnabled: false },
  });

  await writeAudit({
    tenantId: client.id,
    actorId: session.userId,
    action: "CLIENT_LOGIN_DEACTIVATE",
    objectType: "tenant",
    objectId: client.id,
  });

  return NextResponse.json({ client: updated });
}
