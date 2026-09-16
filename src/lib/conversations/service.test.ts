import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { ingestWahaPayload } from "./ingest";
import { getConversationThread, listConversations } from "./service";

const PREFIX = `cvsvc-${Date.now()}`;

describe("listConversations / getConversationThread", { concurrency: false }, () => {
  let tenantId = "";
  let locationId = "";
  let actorId = "";
  let conversationId = "";

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
    const actor = await prisma.user.create({
      data: {
        email: `${PREFIX}@test.local`,
        name: "Conv Test Actor",
        passwordHash: "x",
        isActive: true,
      },
    });
    actorId = actor.id;
  });

  after(async () => {
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId }, { tenantId }] },
    });
    await prisma.waMessage.deleteMany({
      where: { conversation: { tenantId } },
    });
    await prisma.waConversation.deleteMany({ where: { tenantId } });
    await prisma.waContact.deleteMany({ where: { tenantId } });
    await prisma.sourceMapping.deleteMany({ where: { locationId } });
    await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.user.delete({ where: { id: actorId } }).catch(() => {});
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

  it("lists an inbound seed as unreplied and audits thread open", async () => {
    const seeded = await ingestWahaPayload(event());
    assert.equal(seeded.ok, true);
    if (!("conversationId" in seeded)) assert.fail("expected conversationId");
    conversationId = seeded.conversationId;

    const list = await listConversations({ locationId });
    assert.equal(list.stats.unreplied, 1);
    assert.equal(list.conversations.length, 1);
    const row = list.conversations[0];
    assert.equal(row.direction, "UNREPLIED");
    assert.equal(row.contact.phone, "628123456789");
    assert.equal(row.id, conversationId);
    assert.equal(row.location.id, locationId);
    assert.equal(row.location.name, "Cabang Test");
    assert.equal(row.preview, "halo");
    assert.equal(row.sessionId, `${PREFIX}-sess`);
    assert.equal(row.provider, "WAHA");
    assert.equal(row.assetLabel, null);
    const igOnly = await listConversations({ locationId, provider: "INSTAGRAM" });
    assert.equal(igOnly.conversations.length, 0);

    const missing = await getConversationThread("does-not-exist", actorId);
    assert.equal(missing, null);

    const thread = await getConversationThread(conversationId, actorId);
    assert.ok(thread);
    assert.equal(thread.conversation.id, conversationId);
    assert.equal(thread.conversation.tenantId, tenantId);
    assert.equal(thread.conversation.direction, "UNREPLIED");
    assert.equal(thread.conversation.contact.phone, "628123456789");
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0].direction, "IN");
    assert.equal(thread.messages[0].body, "halo");
    assert.equal(thread.messages[0].fromMe, false);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "conversation.thread_opened", objectId: conversationId },
    });
    assert.ok(audit);
    assert.equal(audit!.actorId, actorId);
    assert.equal(audit!.tenantId, tenantId);
    assert.equal(audit!.objectType, "WaConversation");
  });

  it("keeps inbound-after-outbound in unreplied filter; q ANDs with search", async () => {
    const phone = "628999000111";
    const t = Math.floor(Date.now() / 1000);
    const r1 = await ingestWahaPayload(
      event({
        id: `${PREFIX}-ioi-in1`,
        from: `${phone}@c.us`,
        fromMe: false,
        body: "ping",
        timestamp: t - 2,
      })
    );
    const r2 = await ingestWahaPayload(
      event({
        id: `${PREFIX}-ioi-out`,
        from: `${phone}@c.us`,
        fromMe: true,
        body: "pong",
        timestamp: t - 1,
      })
    );
    const r3 = await ingestWahaPayload(
      event({
        id: `${PREFIX}-ioi-in2`,
        from: `${phone}@c.us`,
        fromMe: false,
        body: "again",
        timestamp: t,
      })
    );
    assert.equal(r1.ok && r2.ok && r3.ok, true);
    if (!("conversationId" in r1) || !("conversationId" in r3)) {
      assert.fail("expected conversationId");
    }
    assert.equal(r1.conversationId, r3.conversationId);

    const unreplied = await listConversations({ locationId, filter: "unreplied" });
    const row = unreplied.conversations.find((c) => c.contact.phone === phone);
    assert.ok(row);
    assert.equal(row!.id, r3.conversationId);
    assert.equal(row!.direction, "UNREPLIED");
    assert.equal(unreplied.stats.unreplied, unreplied.conversations.length);
    assert.ok(unreplied.stats.unreplied >= 1);

    const hit = await listConversations({
      locationId,
      filter: "unreplied",
      q: phone,
    });
    assert.equal(hit.stats.unreplied, 1);
    assert.equal(hit.conversations.length, 1);
    assert.equal(hit.conversations[0].id, r3.conversationId);
    assert.equal(hit.conversations[0].contact.phone, phone);

    const miss = await listConversations({
      locationId,
      filter: "unreplied",
      q: "nomatch-xyz",
    });
    assert.equal(
      miss.conversations.some((c) => c.id === r3.conversationId),
      false
    );
    assert.equal(miss.stats.unreplied, 0);
  });

  it("surfaces the mapped Facebook Page name as the conversation asset", async () => {
    const pageId = `${PREFIX}-page`;
    await prisma.sourceMapping.create({
      data: {
        locationId,
        sourceType: "FACEBOOK",
        externalId: pageId,
        externalLabel: "Cafe Demo Page",
        status: "ACTIVE",
      },
    });
    const contact = await prisma.waContact.create({
      data: {
        tenantId,
        identifier: `fb:${PREFIX}-psid`,
        identityConfidence: "HIGH",
        displayName: "Review Customer",
      },
    });
    const now = new Date();
    const conv = await prisma.waConversation.create({
      data: {
        tenantId,
        locationId,
        contactId: contact.id,
        provider: "FACEBOOK",
        sessionId: pageId,
        status: "OPEN",
        firstMessageAt: now,
        lastMessageAt: now,
        lastInboundAt: now,
        lastPreview: "hello from messenger",
      },
    });
    const list = await listConversations({ locationId, provider: "FACEBOOK" });
    assert.equal(list.conversations.length, 1);
    assert.equal(list.conversations[0].assetLabel, "Cafe Demo Page");
    assert.equal(list.conversations[0].sessionId, pageId);
    const thread = await getConversationThread(conv.id, actorId);
    assert.ok(thread);
    assert.equal(thread.conversation.assetLabel, "Cafe Demo Page");
  });
});
