import { prisma } from "@/lib/db";
import type { AtlasFeeConfig } from "@/lib/broadcast/rates";

export async function getAtlasFees(): Promise<AtlasFeeConfig> {
  const row = await prisma.broadcastFeeConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return {
    session: row.sessionIdr,
    marketing: row.marketingIdr,
    utility: row.utilityIdr,
    authentication: row.authenticationIdr,
    marginPct: row.marginPct,
  };
}

export async function saveAtlasFees(fees: AtlasFeeConfig): Promise<AtlasFeeConfig> {
  const row = await prisma.broadcastFeeConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      sessionIdr: fees.session,
      marketingIdr: fees.marketing,
      utilityIdr: fees.utility,
      authenticationIdr: fees.authentication,
      marginPct: fees.marginPct,
    },
    update: {
      sessionIdr: fees.session,
      marketingIdr: fees.marketing,
      utilityIdr: fees.utility,
      authenticationIdr: fees.authentication,
      marginPct: fees.marginPct,
    },
  });
  return {
    session: row.sessionIdr,
    marketing: row.marketingIdr,
    utility: row.utilityIdr,
    authentication: row.authenticationIdr,
    marginPct: row.marginPct,
  };
}

export function parseFeeInput(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}