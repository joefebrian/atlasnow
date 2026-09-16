import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { branchLocationId, canAccessTenant, canUseLocation } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { listIntakes, submitIntake } from "@/lib/loyalty/service";

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
  const status = new URL(request.url).searchParams.get("status") || undefined;
  const onlyLocation = branchLocationId(scoped.session);
  const intakes = await listIntakes(scoped.tenantId, status || undefined, onlyLocation);
  return NextResponse.json({ intakes });
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const ct = request.headers.get("content-type") || "";
  let locationId = "";
  let phone = "";
  let trxId = "";
  let amount: number | null = null;
  let invoiceRef: string | null = null;
  let photo: { bytes: Buffer; mime: string } | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    locationId = String(form.get("locationId") || "");
    phone = String(form.get("phone") || "");
    trxId = String(form.get("trxId") || "");
    const amountRaw = String(form.get("amount") || "").replace(/[^\d]/g, "");
    amount = amountRaw ? Number(amountRaw) : null;
    invoiceRef = String(form.get("invoiceRef") || "") || null;
    const file = form.get("photo");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const buf = Buffer.from(await file.arrayBuffer());
      photo = { bytes: buf, mime: file.type || "image/jpeg" };
    }
  } else {
    return NextResponse.json({ error: "Foto struk wajib. Kirim dari form kasir." }, { status: 400 });
  }

  locationId = branchLocationId(scoped.session) || locationId;
  if (!canUseLocation(scoped.session, locationId)) {
    return NextResponse.json({ error: "This outlet is not yours." }, { status: 403 });
  }
  const loc = await prisma.location.findFirst({
    where: { id: locationId, tenantId: scoped.tenantId },
  });
  const staff = [loc?.phone, loc?.waOutletPhone].filter(Boolean) as string[];
  const r = await submitIntake({
    tenantId: scoped.tenantId,
    locationId: locationId || "",
    phone,
    trxId,
    amount,
    invoiceRef,
    staffPhones: staff,
    photo,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    autoApproved: r.autoApproved,
    matchStatus: r.matchStatus,
    match: r.match,
    warn: "warn" in r ? r.warn : undefined,
    intake: r.intake,
  });
}
