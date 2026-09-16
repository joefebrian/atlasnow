import { isPlatformAdmin } from "@/lib/roles";

export const P2P_AGENCY_SLUG = "p2p-labs";

export type WorkspaceMode = "platform" | "agency" | "brand";

export type TenancySession = {
  tenantId: string;
  tenantType: "AGENCY" | "CLIENT";
  role: string;
  isAgencyStaff: boolean;
  isPlatformAdmin: boolean;
  mode: WorkspaceMode;
  agencyId?: string | null;
};

export function isPlatformMode(session: Pick<TenancySession, "isPlatformAdmin" | "mode">): boolean {
  return session.isPlatformAdmin === true && session.mode === "platform";
}

export function isAgencyWorkspace(session: Pick<TenancySession, "mode" | "tenantType">): boolean {
  return session.mode === "agency" && session.tenantType === "AGENCY";
}

export function isBrandWorkspace(session: Pick<TenancySession, "mode" | "tenantType">): boolean {
  return session.mode === "brand" || session.tenantType === "CLIENT";
}

export function isStandaloneBrandSession(session: TenancySession): boolean {
  return session.tenantType === "CLIENT" && !session.agencyId;
}

/** Prisma `where` for CLIENT rows this session may treat as “our brands”. */
export function brandWhereForSession(session: TenancySession): {
  type: "CLIENT";
  status: { not: "ARCHIVED" };
  agencyId?: string | null;
  id?: string;
} {
  if (isPlatformMode(session)) {
    return { type: "CLIENT", status: { not: "ARCHIVED" }, agencyId: null };
  }
  if (isAgencyWorkspace(session)) {
    return { type: "CLIENT", status: { not: "ARCHIVED" }, agencyId: session.tenantId };
  }
  return { type: "CLIENT", status: { not: "ARCHIVED" }, id: session.tenantId };
}

export function canManageClient(
  session: TenancySession,
  client: { id: string; type: string; agencyId: string | null }
): boolean {
  if (client.type !== "CLIENT") return false;
  if (isPlatformMode(session)) return client.agencyId === null;
  if (isAgencyWorkspace(session)) return client.agencyId === session.tenantId;
  return session.tenantId === client.id;
}

export function canEnterAgency(
  session: TenancySession,
  agency: { id: string; type: string }
): boolean {
  if (agency.type !== "AGENCY") return false;
  if (isPlatformAdmin(session.role)) return true;
  return session.tenantId === agency.id && session.tenantType === "AGENCY";
}

export function defaultHomePath(session: TenancySession): string {
  if (isPlatformMode(session)) return "/agencies";
  if (isAgencyWorkspace(session)) return "/clients";
  if (session.role === "BRANCH") return "/loyalty";
  return "/control-tower";
}

export function platformPathAllowed(pathname: string): boolean {
  if (pathname === "/agencies" || pathname.startsWith("/agencies/")) return true;
  if (pathname === "/support" || pathname.startsWith("/support/")) return true;
  if (pathname === "/billing" || pathname.startsWith("/billing/")) return true;
  if (pathname === "/activity" || pathname.startsWith("/activity/")) return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;
  if (pathname === "/deck_pitch" || pathname.startsWith("/deck_pitch/")) return true;
  if (pathname === "/deck_train" || pathname.startsWith("/deck_train/")) return true;
  // Standalone brand record Super Admin opened from platform follow-up
  if (pathname.startsWith("/clients/") && pathname !== "/clients/new" && !pathname.startsWith("/clients/follow-up")) {
    return true;
  }
  return false;
}
