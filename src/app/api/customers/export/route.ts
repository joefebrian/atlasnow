import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { listCustomerBook } from "@/lib/customers/book";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = await listCustomerBook({
    tenantId,
    q: url.searchParams.get("q") || undefined,
    status: url.searchParams.get("status") || undefined,
  });
  const header = [
    "phone",
    "name",
    "status",
    "email",
    "birth_date",
    "province",
    "city",
    "source",
    "signup_outlet",
    "activated_outlet",
    "stamps",
    "birthday_wa",
    "chatted",
  ];
  const lines = [
    header.join(","),
    ...data.people.map((m) =>
      [
        csvCell(m.phone),
        csvCell(m.name),
        csvCell(m.status),
        csvCell(m.email),
        csvCell(m.birthDate),
        csvCell(m.province),
        csvCell(m.city),
        csvCell(m.source),
        csvCell(m.signupLocation?.name),
        csvCell(m.activatedLocation?.name),
        csvCell(m.stampCount),
        csvCell(m.birthdayWaOptIn ? "yes" : "no"),
        csvCell(m.chatted ? "yes" : "no"),
      ].join(",")
    ),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atlasnow-customers-${stamp}.csv"`,
    },
  });
}
