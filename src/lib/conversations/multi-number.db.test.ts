import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { saveAutomationSettings } from "@/lib/commerce-automation/settings";
import { routeWorkspaceAutomation } from "@/lib/commerce-automation/engine";
import { workspaceChannelReport } from "@/lib/conversations/channel-report";
import { ingestCloudWhatsAppPayload } from "@/lib/conversations/cloud-ingest";
import {
  cloudSendConfig,
  disconnectCloudHq,
  findCloudHqByPhoneNumberId,
  getCloudHqConfig,
  listWorkspaceWhatsAppNumbers,
  saveCloudHqConnector,
} from "@/lib/conversations/cloud-hq";
import { customerInboundBody } from "@/lib/conversations/customer-inbound";
import { listConversations } from "@/lib/conversations/service";
import { ensureWabaPhone } from "@/lib/waba/service-quota";

const enabled = Boolean(process.env.YOLA_TEST_DATABASE_URL);
const now = new Date("2026-10-28T09:00:00.000Z");

function textBody(phoneNumberId: string, wamid: string, from: string, body: string, extra?: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-shared",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: phoneNumberId, display_phone_number: "15550001000" },
              contacts: [{ wa_id: from, profile: { name: "Sari" } }],
              messages: [
                {
                  id: wamid,
                  from,
                  timestamp: String(Math.floor(now.getTime() / 1000)),
                  type: "text",
                  text: { body },
                  ...extra,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("multi-number whatsapp", { skip: enabled ? false : "YOLA_TEST_DATABASE_URL is not set" }, () => {
  const tenantIds: string[] = [];
  const priorYola = process.env.YOLA_WA_PHONE_NUMBER_ID;

  after(async () => {
    if (priorYola === undefined) delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    else process.env.YOLA_WA_PHONE_NUMBER_ID = priorYola;
    if (tenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => undefined);
    }
  });

  async function tenant(name: string) {
    const row = await prisma.tenant.create({
      data: {
        name,
        slug: `b32-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "CLIENT",
        loginEnabled: true,
      },
    });
    tenantIds.push(row.id);
    return row.id;
  }

  async function connect(tenantId: string, phoneNumberId: string, wabaId: string, token: string) {
    await saveCloudHqConnector({
      tenantId,
      phoneNumberId,
      wabaId,
      accessToken: token,
      displayPhone: phoneNumberId.slice(-4),
      connectionMode: "CLOUD_API_ONLY",
    });
  }

  it("keeps two numbers and two WABAs in one workspace", async () => {
    const id = await tenant("multi");
    const phoneA = `b32a-${Date.now()}`;
    const phoneB = `b32b-${Date.now()}`;
    await connect(id, phoneA, "waba-one", "token-a");
    await connect(id, phoneB, "waba-two", "token-b");
    const rows = await prisma.connector.findMany({
      where: { tenantId: id, provider: "WHATSAPP_CLOUD" },
      orderBy: { accountKey: "asc" },
    });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.accountKey).sort(), [phoneA, phoneB].sort());
    const def = await getCloudHqConfig(id);
    assert.equal(def?.phoneNumberId, phoneA);
    assert.equal(def?.accessToken, "token-a");
    const second = await getCloudHqConfig(id, phoneB);
    assert.equal(second?.accessToken, "token-b");
    assert.equal((await findCloudHqByPhoneNumberId(phoneA))?.tenantId, id);
    assert.equal((await findCloudHqByPhoneNumberId(phoneB))?.wabaId, "waba-two");
    await disconnectCloudHq(id, phoneB);
    assert.equal((await getCloudHqConfig(id, phoneA))?.accessToken, "token-a");
    assert.equal(await getCloudHqConfig(id, phoneB), null);
    assert.equal((await getCloudHqConfig(id))?.phoneNumberId, phoneA);
  });

  it("blocks a phone owned by another workspace", async () => {
    const owner = await tenant("owner");
    const other = await tenant("other");
    const phone = `b32o-${Date.now()}`;
    await connect(owner, phone, "waba-owner", "token-owner");
    await assert.rejects(() => connect(other, phone, "waba-other", "token-other"));
    assert.equal((await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId: phone } })).tenantId, owner);
    assert.equal(await prisma.connector.count({ where: { tenantId: other, provider: "WHATSAPP_CLOUD" } }), 0);
  });

  it("keeps one customer on two business numbers and does not merge instagram by name", async () => {
    const id = await tenant("customer");
    const phoneA = `b32c1-${Date.now()}`;
    const phoneB = `b32c2-${Date.now()}`;
    await connect(id, phoneA, "waba-customer", "token-c1");
    await connect(id, phoneB, "waba-customer", "token-c2");
    const from = "628123450321";
    await ingestCloudWhatsAppPayload(textBody(phoneA, "wamid.A1", from, "hello a"));
    await ingestCloudWhatsAppPayload(textBody(phoneB, "wamid.B1", from, "hello b"));
    await ingestCloudWhatsAppPayload(textBody(phoneA, "wamid.A1", from, "hello a"));
    const contacts = await prisma.waContact.findMany({ where: { tenantId: id } });
    assert.equal(contacts.length, 1);
    const chats = await prisma.waConversation.findMany({ where: { tenantId: id }, orderBy: { sessionId: "asc" } });
    assert.equal(chats.length, 2);
    assert.deepEqual(
      chats.map((row) => row.businessPhoneNumberId).sort(),
      [phoneA, phoneB].sort()
    );
    assert.equal(await prisma.waMessage.count({ where: { externalId: "wacloud:wamid.A1" } }), 1);
    await prisma.waContact.create({
      data: {
        tenantId: id,
        identifier: "ig:sari-separate",
        displayName: "Sari",
        identityConfidence: "PLATFORM_ID",
      },
    });
    assert.equal(await prisma.waContact.count({ where: { tenantId: id, displayName: "Sari" } }), 2);
    const listed = await listConversations({ tenantId: id, phoneNumberId: phoneA });
    assert.equal(listed.conversations.length, 1);
    assert.equal(listed.conversations[0]?.businessPhoneNumberId, phoneA);
    const other = await tenant("hidden");
    const hiddenPhone = `b32h-${Date.now()}`;
    await connect(other, hiddenPhone, "waba-hidden", "token-hidden");
    await ingestCloudWhatsAppPayload(textBody(hiddenPhone, "wamid.HIDDEN32", from, "secret"));
    const visibleIds = new Set((await listConversations({ tenantId: id })).conversations.map((row) => row.id));
    const hidden = await listConversations({ tenantId: other });
    assert.equal(hidden.conversations.length, 1);
    assert.equal(visibleIds.has(hidden.conversations[0]?.id || ""), false);
  });

  it("sends and automates as the receiving number only", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    const id = await tenant("send");
    const phoneA = `b32s1-${Date.now()}`;
    const phoneB = `b32s2-${Date.now()}`;
    await connect(id, phoneA, "waba-send", "token-send-a");
    const saved = await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: {
        inboundEnabled: true,
        paymentFollowUpEnabled: false,
        marketingEnabled: false,
        pilotMode: false,
        flowId: "123456789012345",
        flowScreen: "START",
        flowCta: "Open",
        inboundBody: "Here is the form.",
        triggerPhrases: "order menu",
        paymentTriggerPhrases: "payment link",
        paymentMessageText: "Pay",
      },
    });
    assert.equal(saved.ok, true);
    await connect(id, phoneB, "waba-send", "token-send-b");
    const sendA = await cloudSendConfig(id, `cloud:${phoneA}`);
    const sendB = await cloudSendConfig(id, `cloud:${phoneB}`);
    assert.equal(sendA?.accessToken, "token-send-a");
    assert.equal(sendB?.accessToken, "token-send-b");
    assert.equal(await cloudSendConfig(id, "cloud:missing"), null);
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ messages: [{ id: "out" }] }), { status: 200 });
    }) as typeof fetch;
    const onA = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: textBody(phoneA, "wamid.AUTOA", "628123450111", "order menu"),
    });
    const onB = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: textBody(phoneB, "wamid.AUTOB", "628123450111", "order menu"),
    });
    assert.equal(onA.handled, 1);
    assert.equal(onB.handled, 0);
    assert.equal(calls.length, 1);
    assert.match(calls[0] || "", new RegExp(phoneA));
    assert.equal((await prisma.workspaceAutomation.findUniqueOrThrow({ where: { tenantId: id } })).phoneNumberId, phoneA);
  });

  it("ignores echoes, history, and duplicate deliveries", async () => {
    const id = await tenant("quiet");
    const phone = `b32q-${Date.now()}`;
    await connect(id, phone, "waba-quiet", "token-quiet");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: {
        inboundEnabled: true,
        paymentFollowUpEnabled: false,
        marketingEnabled: false,
        pilotMode: false,
        flowId: "123456789012345",
        flowScreen: "START",
        flowCta: "Open",
        inboundBody: "Here is the form.",
        triggerPhrases: "order menu",
        paymentTriggerPhrases: "",
        paymentMessageText: "",
      },
    });
    const echo = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-quiet",
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                metadata: { phone_number_id: phone },
                message_echoes: [
                  {
                    id: "wamid.ECHO32",
                    to: "628123450222",
                    timestamp: String(Math.floor(now.getTime() / 1000)),
                    type: "text",
                    text: { body: "order menu" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await ingestCloudWhatsAppPayload(echo);
    const echoRoute = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: customerInboundBody(echo, []),
      fetchImpl: (async () => new Response("{}", { status: 200 })) as typeof fetch,
    });
    assert.equal(echoRoute.handled, 0);
    const echoChat = await prisma.waConversation.findFirstOrThrow({ where: { tenantId: id, businessPhoneNumberId: phone } });
    assert.equal(echoChat.handoffState, "HUMAN_ACTIVE");
    assert.equal(echoChat.leadStatus, "");
    const history = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-quiet",
          changes: [
            {
              field: "history",
              value: {
                metadata: { phone_number_id: phone, display_phone_number: "15550001000" },
                history: [
                  {
                    metadata: { phase: 1, progress: 10 },
                    threads: [
                      {
                        id: "628123450333",
                        messages: [
                          {
                            from: "628123450333",
                            id: "wamid.HIST32",
                            timestamp: "1700000000",
                            type: "text",
                            text: { body: "old order menu" },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await ingestCloudWhatsAppPayload(history);
    const historical = await prisma.waMessage.findUniqueOrThrow({ where: { externalId: "wacloud:wamid.HIST32" } });
    assert.equal(historical.source, "history");
    const historicalChat = await prisma.waConversation.findUniqueOrThrow({ where: { id: historical.conversationId } });
    assert.equal(historicalChat.lastInboundAt, null);
    assert.equal(historicalChat.leadStatus, "");
    const live = textBody(phone, "wamid.LIVE32", "628123450444", "hello", {
      referral: { source_type: "ad", source_id: "camp-32", ctwa_clid: "clid-32" },
    });
    await ingestCloudWhatsAppPayload(live);
    await ingestCloudWhatsAppPayload(live);
    assert.equal(await prisma.waMessage.count({ where: { externalId: "wacloud:wamid.LIVE32" } }), 1);
    const stored = await prisma.waMessage.findUniqueOrThrow({ where: { externalId: "wacloud:wamid.LIVE32" } });
    assert.match(stored.referralJson, /camp-32/);
  });

  it("shows an owned phone without a connector as not configured", async () => {
    const id = await tenant("owned");
    const phone = `b32n-${Date.now()}`;
    await ensureWabaPhone({ tenantId: id, phoneNumberId: phone, wabaId: "waba-owned", displayPhone: "+1 555-0000" });
    const numbers = await listWorkspaceWhatsAppNumbers(id);
    assert.equal(numbers.length, 1);
    assert.equal(numbers[0]?.health, "not_configured");
    assert.equal(numbers[0]?.phoneNumberId, phone);
    assert.equal(await getCloudHqConfig(id, phone), null);
    assert.equal(await prisma.connector.count({ where: { tenantId: id, provider: "WHATSAPP_CLOUD" } }), 0);
  });

  it("keeps the isolated pilot phone off generic automation", async () => {
    const id = await tenant("pilot");
    const phone = `b32y-${Date.now()}`;
    process.env.YOLA_WA_PHONE_NUMBER_ID = phone;
    await connect(id, phone, "waba-pilot", "token-pilot");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: {
        inboundEnabled: true,
        paymentFollowUpEnabled: false,
        marketingEnabled: false,
        pilotMode: false,
        flowId: "123456789012345",
        flowScreen: "START",
        flowCta: "Open",
        inboundBody: "Here is the form.",
        triggerPhrases: "order menu",
        paymentTriggerPhrases: "",
        paymentMessageText: "",
      },
    });
    const routed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: textBody(phone, "wamid.YOLA32", "628123450555", "order menu"),
      fetchImpl: (async () => {
        throw new Error("must not send");
      }) as typeof fetch,
    });
    assert.equal(routed.handled, 0);
    assert.equal("reason" in routed ? routed.reason : "", "yola_isolated");
  });

  it("excludes simulated payments and does not invent ad attribution", async () => {
    const id = await tenant("report");
    const phone = `b32r-${Date.now()}`;
    await connect(id, phone, "waba-report", "token-report");
    await ingestCloudWhatsAppPayload(textBody(phone, "wamid.REP32", "628123450666", "hello"));
    const customer = await prisma.yolaCustomer.create({
      data: { tenantId: id, waId: "628123450666" },
    });
    const order = await prisma.yolaOrder.create({
      data: {
        tenantId: id,
        humanId: `B32-${Date.now()}`,
        customerId: customer.id,
        waId: "628123450666",
        wamid: `wamid.order.${Date.now()}`,
        flowToken: `flow-${Date.now()}`,
        buyerName: "Sari",
        buyerPhoneE164: "+628123450666",
        visitDate: "2026-11-24",
        visitTime: "10:00",
        amountIdr: 499000,
      },
    });
    const expiresAt = new Date("2026-11-01T00:00:00.000Z");
    await prisma.yolaPaymentSession.create({
      data: {
        tenantId: id,
        orderId: order.id,
        status: "SIMULATED_PAID",
        mode: "sandbox",
        amountIdr: 499000,
        nonceHash: `sim-${Date.now()}`,
        expiresAt,
      },
    });
    await prisma.yolaPaymentSession.create({
      data: {
        tenantId: id,
        orderId: order.id,
        status: "PAID",
        mode: "sandbox",
        amountIdr: 499000,
        nonceHash: `sand-${Date.now()}`,
        expiresAt,
      },
    });
    await prisma.yolaPaymentSession.create({
      data: {
        tenantId: id,
        orderId: order.id,
        status: "PAID",
        mode: "live",
        amountIdr: 499000,
        nonceHash: `live-${Date.now()}`,
        expiresAt,
      },
    });
    const report = await workspaceChannelReport(id);
    assert.equal(report.simulatedPaymentsExcluded, 1);
    assert.equal(report.verifiedPayments, 1);
    assert.equal(report.verifiedRevenueIdr, 499000);
    assert.equal(report.attributedReferrals, 0);
    assert.equal(report.incomingConversations, 1);
  });
});
