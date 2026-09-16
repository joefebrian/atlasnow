import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  inspectCardToken,
  memberAppPath,
  memberAppUrl,
  signCardToken,
  cardPageUrl,
} from "@/lib/loyalty/card-token";

export async function loadPublicCard(tokenRaw: string, opts?: { logo?: boolean }) {
  const token = decodeURIComponent(tokenRaw || "");
  const parsed = inspectCardToken(token);
  if (!parsed.ok) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: parsed.claims.tid },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      updatedAt: true,
      ...(opts?.logo ? { logoImage: true, logoMime: true } : {}),
    },
  });
  if (!tenant || tenant.status === "ARCHIVED") return null;
  return { token, claims: parsed.claims, expired: parsed.expired, tenant };
}

export async function loadBrandBySlug(slug: string, opts?: { logo?: boolean }) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      updatedAt: true,
      ...(opts?.logo ? { logoImage: true, logoMime: true } : {}),
    },
  });
  if (!tenant || tenant.status === "ARCHIVED") return null;
  let mark: Buffer | Uint8Array | null = null;
  let markAt = tenant.updatedAt;
  if (opts?.logo) {
    const brand = "logoImage" in tenant ? tenant.logoImage : null;
    if (brand && (brand as Uint8Array).length > 40) {
      mark = brand as Uint8Array;
    } else {
      const program = await prisma.loyaltyProgram.findUnique({
        where: { tenantId: tenant.id },
        select: { stampCardImage: true, updatedAt: true },
      });
      if (program?.stampCardImage && program.stampCardImage.length > 40) {
        mark = program.stampCardImage;
        markAt = program.updatedAt;
      }
    }
  }
  return { ...tenant, markImage: mark, markAt };
}

export async function loadMemberApp(slug: string, memberId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!tenant || tenant.status === "ARCHIVED") return null;
  const member = await prisma.loyaltyMember.findFirst({
    where: { id: memberId, tenantId: tenant.id },
    select: { id: true, phone: true, name: true },
  });
  if (!member) return null;
  return { tenant, member };
}

export async function memberAppUrlFor(tenantId: string, phone: string): Promise<string> {
  const [tenant, member] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
    prisma.loyaltyMember.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
      select: { id: true },
    }),
  ]);
  if (tenant?.slug && member?.id) return memberAppUrl(tenant.slug, member.id);
  return cardPageUrl(signCardToken(tenantId, phone));
}

export function stampCardMetadata(brandName: string, slug: string, memberId: string): Metadata {
  const path = memberAppPath(slug, memberId);
  const icon = `/i/${encodeURIComponent(slug)}`;
  return {
    title: { absolute: brandName },
    applicationName: brandName,
    description: `Kartu stamp ${brandName}`,
    robots: { index: false, follow: false },
    manifest: `${path}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: brandName,
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: `${icon}/180.png`, sizes: "180x180", type: "image/png" }],
      icon: [
        { url: `${icon}/192.png`, sizes: "192x192", type: "image/png" },
        { url: `${icon}/512.png`, sizes: "512x512", type: "image/png" },
      ],
    },
  };
}
