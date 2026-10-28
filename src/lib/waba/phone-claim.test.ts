import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { saveCloudHqConnector } from "@/lib/conversations/cloud-hq";
import { readWorkspaceAutomation } from "@/lib/commerce-automation/policy";
import { ensureWabaPhone, isPhoneOwnershipError } from "@/lib/waba/service-quota";

const enabled = Boolean(process.env.YOLA_TEST_DATABASE_URL);

describe("waba phone ownership", { skip: enabled ? false : "YOLA_TEST_DATABASE_URL is not set" }, () => {
  const tenantIds: string[] = [];

  after(async () => {
    if (tenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => undefined);
    }
  });

  async function tenant(name: string) {
    const row = await prisma.tenant.create({
      data: { name, slug: `claim-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "CLIENT", loginEnabled: true },
    });
    tenantIds.push(row.id);
    return row.id;
  }

  it("keeps the first workspace as owner and rejects a second claim", async () => {
    const owner = await tenant("owner");
    const other = await tenant("other");
    const phoneNumberId = `claim-${Date.now()}`;
    const first = await ensureWabaPhone({ tenantId: owner, phoneNumberId, displayPhone: "first" });
    assert.equal(first?.tenantId, owner);
    await assert.rejects(
      () => ensureWabaPhone({ tenantId: other, phoneNumberId, displayPhone: "stolen" }),
      (err) => isPhoneOwnershipError(err)
    );
    const still = await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId } });
    assert.equal(still.tenantId, owner);
    assert.equal(still.displayPhone, "first");
    const refreshed = await ensureWabaPhone({ tenantId: owner, phoneNumberId, displayPhone: "kept" });
    assert.equal(refreshed?.tenantId, owner);
    assert.equal(refreshed?.displayPhone, "kept");

    await saveCloudHqConnector({
      tenantId: owner,
      phoneNumberId,
      wabaId: "waba-owner",
      accessToken: "owner-token",
      displayPhone: "kept",
    });
    await assert.rejects(
      () => saveCloudHqConnector({
        tenantId: other,
        phoneNumberId,
        wabaId: "waba-other",
        accessToken: "other-token",
        displayPhone: "stolen",
      }),
      (err) => isPhoneOwnershipError(err)
    );
    const connectors = await prisma.connector.findMany({
      where: { provider: "WHATSAPP_CLOUD", tenantId: { in: [owner, other] } },
    });
    assert.equal(connectors.length, 1);
    assert.equal(connectors[0]?.tenantId, owner);
    assert.equal(await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId } }).then((row) => row.tenantId), owner);
  });

  it("lets only one workspace win a concurrent claim", async () => {
    const left = await tenant("left");
    const right = await tenant("right");
    const phoneNumberId = `race-${Date.now()}`;
    const results = await Promise.allSettled([
      ensureWabaPhone({ tenantId: left, phoneNumberId }),
      ensureWabaPhone({ tenantId: right, phoneNumberId }),
      ensureWabaPhone({ tenantId: left, phoneNumberId }),
      ensureWabaPhone({ tenantId: right, phoneNumberId }),
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    assert.ok(fulfilled.length >= 1);
    assert.ok(rejected.length >= 1);
    for (const row of rejected) {
      if (row.status === "rejected") assert.equal(isPhoneOwnershipError(row.reason), true);
    }
    const stored = await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId } });
    assert.ok(stored.tenantId === left || stored.tenantId === right);
    const loser = stored.tenantId === left ? right : left;
    await assert.rejects(
      () => ensureWabaPhone({ tenantId: loser, phoneNumberId }),
      (err) => isPhoneOwnershipError(err)
    );
    assert.equal((await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId } })).tenantId, stored.tenantId);
  });

  it("reads a missing automation row as disabled", async () => {
    const id = await tenant("quiet");
    const state = await readWorkspaceAutomation(id);
    assert.equal(state.configured, false);
    assert.equal(state.inboundEnabled, false);
    assert.equal(state.paymentFollowUpEnabled, false);
    assert.equal(state.marketingEnabled, false);
  });
});
