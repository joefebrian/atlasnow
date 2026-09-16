import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandWhereForSession,
  canEnterAgency,
  canManageClient,
  defaultHomePath,
  isPlatformMode,
  platformPathAllowed,
  type TenancySession,
} from "./tenancy";

function sess(partial: Partial<TenancySession>): TenancySession {
  return {
    tenantId: "t1",
    tenantType: "AGENCY",
    role: "AGENCY_ADMIN",
    isAgencyStaff: true,
    isPlatformAdmin: false,
    mode: "agency",
    agencyId: null,
    ...partial,
  };
}

describe("tenancy scope", () => {
  it("agency workspace only lists brands parented to that agency", () => {
    const s = sess({ tenantId: "ag1" });
    assert.deepEqual(brandWhereForSession(s), {
      type: "CLIENT",
      status: { not: "ARCHIVED" },
      agencyId: "ag1",
    });
    assert.equal(canManageClient(s, { id: "b1", type: "CLIENT", agencyId: "ag1" }), true);
    assert.equal(canManageClient(s, { id: "b2", type: "CLIENT", agencyId: "ag2" }), false);
    assert.equal(canManageClient(s, { id: "b3", type: "CLIENT", agencyId: null }), false);
    assert.equal(defaultHomePath(s), "/clients");
  });

  it("platform mode lists standalone brands only, not another agency’s merks", () => {
    const s = sess({
      role: "SUPER_ADMIN",
      isPlatformAdmin: true,
      isAgencyStaff: false,
      mode: "platform",
      tenantId: "p2p",
    });
    assert.equal(isPlatformMode(s), true);
    assert.deepEqual(brandWhereForSession(s), {
      type: "CLIENT",
      status: { not: "ARCHIVED" },
      agencyId: null,
    });
    assert.equal(canManageClient(s, { id: "solo", type: "CLIENT", agencyId: null }), true);
    assert.equal(canManageClient(s, { id: "p2p-brand", type: "CLIENT", agencyId: "p2p" }), false);
    assert.equal(canEnterAgency(s, { id: "ag1", type: "AGENCY" }), true);
    assert.equal(defaultHomePath(s), "/agencies");
    assert.equal(platformPathAllowed("/clients"), false);
    assert.equal(platformPathAllowed("/clients/abc"), true);
    assert.equal(platformPathAllowed("/agencies/follow-up"), true);
    assert.equal(platformPathAllowed("/support"), true);
    assert.equal(platformPathAllowed("/billing"), true);
    assert.equal(platformPathAllowed("/deck_train"), true);
    assert.equal(platformPathAllowed("/deck_pitch"), true);
  });

  it("brand user only manages self", () => {
    const s = sess({
      tenantId: "brand1",
      tenantType: "CLIENT",
      role: "CLIENT_ADMIN",
      isAgencyStaff: false,
      mode: "brand",
      agencyId: null,
    });
    assert.equal(canManageClient(s, { id: "brand1", type: "CLIENT", agencyId: null }), true);
    assert.equal(canManageClient(s, { id: "other", type: "CLIENT", agencyId: null }), false);
    assert.equal(defaultHomePath(s), "/control-tower");
  });

  it("sends a branch cashier to Loyalty", () => {
    const s = sess({
      tenantId: "brand1",
      tenantType: "CLIENT",
      role: "BRANCH",
      isAgencyStaff: false,
      mode: "brand",
    });
    assert.equal(defaultHomePath(s), "/loyalty");
  });
});
