import { PrismaClient } from "@prisma/client";

const PRISMA_REV = "commerce-catalog-4";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined; prismaRev?: string };

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Dev HMR can keep an old PrismaClient on globalThis after schema changes
 * (e.g. new IntegrationConfig → integrationConfig.findMany is undefined).
 * Recreate when expected delegates are missing.
 */
function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const ok =
    globalForPrisma.prismaRev === PRISMA_REV &&
    existing &&
    typeof (existing as { integrationConfig?: unknown }).integrationConfig !== "undefined" &&
    typeof (existing as { metricObservation?: unknown }).metricObservation !== "undefined" &&
    typeof (existing as { review?: unknown }).review !== "undefined" &&
    typeof (existing as { sitePageConfig?: unknown }).sitePageConfig !== "undefined" &&
    typeof (existing as { contactMessage?: unknown }).contactMessage !== "undefined" &&
    typeof (existing as { commerceProduct?: unknown }).commerceProduct !== "undefined" &&
    typeof (existing as { commerceConnection?: unknown }).commerceConnection !== "undefined" &&
    typeof (existing as { commerceOAuthNonce?: unknown }).commerceOAuthNonce !== "undefined";
  if (ok) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaRev = PRISMA_REV;
  }
  return client;
}

export const prisma = getPrisma();
