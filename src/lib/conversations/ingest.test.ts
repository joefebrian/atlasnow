import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { ingestWahaPayload } from "./ingest";

const PREFIX = `cvtest-${Date.now()}`;

describe("ingestWahaPayload", { concurrency: false }, () => {
  let tenantId = "";
  let locationId = "";

  before(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: PREFIX, slug: PREFIX, type: "CLIENT", status: "ACTIVE" },
    });
    tenantId = tenant.id;
    const loc = await prisma.location.create({
      data: {
        tenantId,
        atlasLocationId: `atl_${PREFIX}`,
        name: "Cabang Test",
        status: "ACTIVE",
      },
    });
    locationId = loc.id;
    await prisma.sourceMapping.create({
      data: {
        locationId,
        sourceType: "WAHA",
        externalId: `${PREFIX}-sess`,
        status: "ACTIVE",
      },
    });
    await prisma.integrationConfig.upsert({
      where: { provider: "waha" },
      create: { provider: "waha", mode: "LIVE", enabled: true, publicJson: "{}" },
      update: { mode: "LIVE", enabled: true },
    });
  });

  after(async () => {
    await prisma.waMessage.deleteMany({
      where: { conversation: { sessionId: `${PREFIX}-sess` } },
    });
    await prisma.waConversation.deleteMany({ where: { sessionId: `${PREFIX}-sess` } });
    await prisma.waContact.deleteMany({ where: { tenantId } });
    await prisma.sourceMapping.deleteMany({ where: { locationId } });
    await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.integrationConfig
      .update({
        where: { provider: "waha" },
        data: { mode: "LIVE", enabled: true },
      })
      .catch(() => {});
  });

  function event(over: Record<string, unknown> = {}) {
    return {
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-m1`,
        from: "628123456789@c.us",
        fromMe: false,
        body: "halo",
        timestamp: Math.floor(Date.now() / 1000),
        ...over,
      },
    };
  }

  it("dedupes the same externalId", async () => {
    const a = await ingestWahaPayload(event());
    const b = await ingestWahaPayload(event());
    assert.equal(a.ok, true);
    assert.equal("duplicate" in b && b.duplicate, true);
    const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-m1` } });
    assert.equal(n, 1);
  });

  it("returns duplicate when externalId is pre-inserted (P2002 path)", async () => {
    const contact = await prisma.waContact.create({
      data: {
        tenantId,
        identifier: `${PREFIX}-pre`,
        identityConfidence: "UNKNOWN",
      },
    });
    const conv = await prisma.waConversation.create({
      data: {
        tenantId,
        locationId,
        contactId: contact.id,
        provider: "WAHA",
        sessionId: `${PREFIX}-sess`,
        status: "OPEN",
        firstMessageAt: new Date(),
        lastMessageAt: new Date(),
      },
    });
    await prisma.waMessage.create({
      data: {
        conversationId: conv.id,
        externalId: `${PREFIX}-p2002`,
        direction: "IN",
        sentAt: new Date(),
        body: "pre",
        fromMe: false,
      },
    });
    const r = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-p2002`,
        from: "628123456789@c.us",
        fromMe: false,
        body: "halo",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    assert.equal(r.ok, true);
    assert.equal("duplicate" in r && r.duplicate, true);
    if ("conversationId" in r) {
      assert.equal(r.conversationId, conv.id);
    }
    const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-p2002` } });
    assert.equal(n, 1);
  });

  it("does not throw when identifier update hits unique (P2002)", async () => {
    await prisma.waContact.create({
      data: {
        tenantId,
        identifier: "9991@lid",
        lid: "9991",
        identityConfidence: "OPAQUE_LID",
      },
    });
    await prisma.waContact.create({
      data: {
        tenantId,
        identifier: "628333444555",
        phone: "628333444555",
        identityConfidence: "PHONE_VERIFIED",
      },
    });
    const r = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-ident-p2002`,
        from: "628333444555@c.us",
        fromMe: false,
        body: "collide",
        timestamp: Math.floor(Date.now() / 1000),
        _data: { id: { remote: "9991@lid" } },
      },
    });
    assert.equal(r.ok, true);
    assert.ok("conversationId" in r);
    const n = await prisma.waMessage.count({
      where: { externalId: `${PREFIX}-ident-p2002` },
    });
    assert.equal(n, 1);
  });

  it("does not invent a phone from @g.us", async () => {
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-group`,
        from: "120363042000000111@g.us",
        fromMe: false,
        body: "group",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    const c = await prisma.waContact.findFirst({
      where: { tenantId, identifier: "120363042000000111@g.us" },
    });
    assert.ok(c);
    assert.equal(c!.phone, null);
    assert.equal(c!.identityConfidence, "UNKNOWN");
  });

  it("opens a new conversation after 24h", async () => {
    const old = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-old`,
        from: "628111111111@c.us",
        fromMe: false,
        body: "old",
        timestamp: Math.floor((Date.now() - 25 * 3600 * 1000) / 1000),
      },
    });
    const neu = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-new`,
        from: "628111111111@c.us",
        fromMe: false,
        body: "new",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    assert.equal(old.ok, true);
    assert.equal(neu.ok, true);
    if (!("conversationId" in old) || !("conversationId" in neu)) {
      assert.fail("expected conversation ids");
    }
    assert.notEqual(old.conversationId, neu.conversationId);
  });

  it("does not invent a phone from @lid", async () => {
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-lid`,
        from: "555@lid",
        fromMe: false,
        body: "x",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    const c = await prisma.waContact.findFirst({
      where: { tenantId, lid: "555" },
    });
    assert.ok(c);
    assert.equal(c!.phone, null);
    assert.equal(c!.identityConfidence, "OPAQUE_LID");
  });

  it("updates the same contact when a later event has a phone", async () => {
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-up1`,
        from: "777@lid",
        fromMe: false,
        body: "a",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-up2`,
        from: "628222333444@c.us",
        fromMe: false,
        body: "b",
        timestamp: Math.floor(Date.now() / 1000),
        _data: { id: { remote: "777@lid" } },
      },
    });
    // Implementer: if the second event cannot link by lid, document lookup:
    // find by lid from peer or by phone. For this test, send extra lid via from=lid
    // first then a third event is not required if ingest also matches last OPEN
    // contact on session — do NOT do that. Lookup: phone, then lid.
    const byLid = await prisma.waContact.findFirst({
      where: { tenantId, lid: "777" },
    });
    assert.ok(byLid);
    assert.equal(byLid!.phone, "628222333444");
    assert.equal(byLid!.identityConfidence, "PHONE_VERIFIED");
  });

  it("ignores unmapped session", async () => {
    const r = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-nope`,
      payload: {
        id: `${PREFIX}-unmap`,
        from: "628000000000@c.us",
        fromMe: false,
        body: "x",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    assert.equal(r.ok, true);
    assert.equal("ignored" in r && r.ignored, "unmapped_session");
    const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-unmap` } });
    assert.equal(n, 0);
  });

  it("ignores when kill switch is OFF", async () => {
    await prisma.integrationConfig.update({
      where: { provider: "waha" },
      data: { mode: "OFF" },
    });
    try {
      const r = await ingestWahaPayload({
        event: "message",
        session: `${PREFIX}-sess`,
        payload: {
          id: `${PREFIX}-kill`,
          from: "628000000001@c.us",
          fromMe: false,
          body: "blocked",
          timestamp: Math.floor(Date.now() / 1000),
        },
      });
      assert.equal(r.ok, true);
      assert.equal("ignored" in r && r.ignored, "kill_switch");
      const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-kill` } });
      assert.equal(n, 0);
    } finally {
      await prisma.integrationConfig.update({
        where: { provider: "waha" },
        data: { mode: "LIVE", enabled: true },
      });
    }
  });
});
