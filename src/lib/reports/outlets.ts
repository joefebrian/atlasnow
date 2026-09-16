import { prisma } from "@/lib/db";

export type OutletReportRow = {
  id: string;
  name: string;
  city: string;
  kind: string;
  readiness: string;
  mappedGbp: boolean;
  reviewCount: number;
  unrepliedReviews: number;
};

export async function loadOutletReport(tenantId: string): Promise<OutletReportRow[]> {
  const locations = await prisma.location.findMany({
    where: { tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      kind: true,
      readiness: true,
      mappings: {
        where: { sourceType: "GOOGLE_BUSINESS_PROFILE", status: "ACTIVE" },
        select: { id: true },
      },
      reviews: {
        select: { replyComment: true },
      },
    },
  });

  return locations.map((l) => ({
    id: l.id,
    name: l.name,
    city: l.city || "",
    kind: l.kind,
    readiness: l.readiness,
    mappedGbp: l.mappings.length > 0,
    reviewCount: l.reviews.length,
    unrepliedReviews: l.reviews.filter((r) => !r.replyComment?.trim()).length,
  }));
}
