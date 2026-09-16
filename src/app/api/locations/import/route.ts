import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { parseLocationCsv } from "@/lib/locations/csv";
import { freeOutletCapReached, LocationCapError } from "@/lib/locations/plan";
import { createLocation, updateLocation } from "@/lib/locations/service";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  csv: z.string().min(1),
  /** dry-run only validates + reports; commit writes */
  mode: z.enum(["dry-run", "commit"]).default("dry-run"),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tenantId, csv, mode } = parsed.data;
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden tenant" }, { status: 403 });
  }

  const { rows, issues } = parseLocationCsv(csv);
  const report: {
    row: number;
    action: "create" | "update" | "skip" | "error";
    name: string;
    code?: string;
    message?: string;
    locationId?: string;
  }[] = [];

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  let storeCount = await prisma.location.count({
    where: {
      tenantId,
      status: { not: "ARCHIVED" },
      kind: { not: "HQ" },
    },
  });

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header + 1-index
    try {
      if (r.code) {
        const existing = await prisma.location.findFirst({
          where: { tenantId, code: r.code },
        });
        if (existing) {
          if (mode === "commit") {
            const updated = await updateLocation(existing.id, {
              name: r.name,
              addressLine1: r.addressLine1,
              addressLine2: r.addressLine2,
              city: r.city,
              region: r.region,
              postalCode: r.postalCode,
              country: r.country,
              phone: r.phone,
              website: r.website,
              timezone: r.timezone,
              notes: r.notes,
            });
            report.push({
              row: rowNum,
              action: "update",
              name: r.name,
              code: r.code,
              locationId: updated?.id,
              message: `Updated existing code ${r.code}`,
            });
          } else {
            report.push({
              row: rowNum,
              action: "update",
              name: r.name,
              code: r.code,
              message: `Would update existing code ${r.code}`,
            });
          }
          continue;
        }
      }

      if (freeOutletCapReached(tenant?.plan, storeCount)) {
        throw new LocationCapError();
      }
      if (mode === "commit") {
        const created = await createLocation({
          tenantId,
          name: r.name,
          code: r.code,
          addressLine1: r.addressLine1,
          addressLine2: r.addressLine2,
          city: r.city,
          region: r.region,
          postalCode: r.postalCode,
          country: r.country,
          phone: r.phone,
          website: r.website,
          timezone: r.timezone,
          notes: r.notes,
        });
        storeCount += 1;
        report.push({
          row: rowNum,
          action: "create",
          name: r.name,
          code: r.code,
          locationId: created.id,
          message: `Created ${created.atlasLocationId}`,
        });
      } else {
        storeCount += 1;
        report.push({
          row: rowNum,
          action: "create",
          name: r.name,
          code: r.code,
          message: "Would create new location",
        });
      }
    } catch (e) {
      report.push({
        row: rowNum,
        action: "error",
        name: r.name,
        code: r.code,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  if (mode === "commit") {
    await writeAudit({
      tenantId,
      actorId: session.userId,
      action: "LOCATION_CSV_IMPORT",
      objectType: "tenant",
      objectId: tenantId,
      meta: {
        created: report.filter((r) => r.action === "create").length,
        updated: report.filter((r) => r.action === "update").length,
        errors: report.filter((r) => r.action === "error").length,
      },
    });
  }

  return NextResponse.json({
    mode,
    parseIssues: issues,
    report,
    summary: {
      rows: rows.length,
      create: report.filter((r) => r.action === "create").length,
      update: report.filter((r) => r.action === "update").length,
      error: report.filter((r) => r.action === "error").length + issues.length,
    },
  });
}
