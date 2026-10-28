import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { saveAutomationSettings } from "@/lib/commerce-automation/settings";
import { routeWorkspaceAutomation } from "@/lib/commerce-automation/engine";
import { ingestCloudWhatsAppPayload } from "@/lib/conversations/cloud-ingest";
import { connectionViewFromMeta, getCloudHqConfig, saveCloudHqConnector } from "@/lib/conversations/cloud-hq";
import { customerInboundBody } from "@/lib/conversations/customer-inbound";

const enabled = Boolean(process.env.YOLA_TEST_DATABASE_URL);
const now = new Date("2026-10-28T08:00:00.000Z");

describe("coexistence connection", { skip: enabled ? false : "YOLA_TEST_DATABASE_URL is not set" }, () => {
  const tenantIds: string[] = [];

  after(async () => {
    if (tenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => undefined);
    }
  });

  async function tenant(name: string) {
    const row = await prisma.tenant.create({
      data: {
        name,
        slug: `b31-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "CLIENT",
        loginEnabled: true,
      },
    });
    tenantIds.push(row.id);
    return row.id;
  }

  it("shows a missing mode as Cloud API and keeps an explicit coexistence mode", async () => {
    assert.equal(connectionViewFromMeta({ phoneNumberId: "1" }, "CONNECTED", null).connectionMode, "CLOUD_API_ONLY");
    const id = await tenant("mode");
    const phone = `b31m-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: "waba-mode",
      accessToken: "token-mode",
      displayPhone: "15550001111",
      verifiedName: "Mode Shop",
      connectionMode: "COEXISTENCE",
    });
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: "waba-mode",
      accessToken: "token-mode-2",
      displayPhone: "15550001111",
      verifiedName: "Mode Shop",
    });
    const row = await prisma.connector.findUniqueOrThrow({
      where: { tenantId_provider: { tenantId: id, provider: "WHATSAPP_CLOUD" } },
    });
    const meta = JSON.parse(row.metaJson || "{}") as { connectionMode?: string };
    assert.equal(meta.connectionMode, "COEXISTENCE");
    assert.equal(row.status, "CONNECTED");
    const cfg = await getCloudHqConfig(id);
    assert.equal(cfg?.accessToken, "token-mode-2");
    assert.equal(await prisma.workspaceAutomation.count({ where: { tenantId: id } }), 0);
  });

  it("blocks a second workspace from taking the number", async () => {
    const owner = await tenant("owner");
    const other = await tenant("other");
    const phone = `b31o-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: owner,
      phoneNumberId: phone,
      wabaId: "waba-owner",
      accessToken: "token-owner",
      connectionMode: "COEXISTENCE",
    });
    await assert.rejects(() =>
      saveCloudHqConnector({
        tenantId: other,
        phoneNumberId: phone,
        wabaId: "waba-other",
        accessToken: "token-other",
        connectionMode: "CLOUD_API_ONLY",
      })
    );
    const still = await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId: phone } });
    assert.equal(still.tenantId, owner);
  });

  it("stores Business App echoes and does not let them trigger automation", async () => {
    const id = await tenant("echo");
    const phone = `b31e-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: `waba-${phone}`,
      accessToken: "token-echo",
      displayPhone: "15550002222",
      connectionMode: "COEXISTENCE",
    });
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
        inboundBody: "Here is the form for this workspace.",
        triggerPhrases: "order menu",
        paymentTriggerPhrases: "",
        paymentMessageText: "",
      },
    });
    assert.equal(saved.ok, true);
    const echoBody = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: `waba-${phone}`,
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                metadata: { phone_number_id: phone, display_phone_number: "15550002222" },
                message_echoes: [
                  {
                    from: "15550002222",
                    to: "628123450099",
                    id: "wamid.ECHO31",
                    timestamp: String(Math.floor(now.getTime() / 1000) - 60),
                    type: "text",
                    text: { body: "Saya bantu" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const echoed = await ingestCloudWhatsAppPayload(echoBody);
    assert.equal(echoed.suppressWamids.length, 0);
    const stored = await prisma.waMessage.findUniqueOrThrow({ where: { externalId: "wacloud:wamid.ECHO31" } });
    assert.equal(stored.fromMe, true);
    assert.equal(stored.source, "business_app");
    const live = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: `waba-${phone}`,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: phone },
                messages: [
                  {
                    from: "628123450099",
                    id: "wamid.LIVE31",
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
    const ingested = await ingestCloudWhatsAppPayload(live);
    assert.deepEqual(ingested.suppressWamids, ["wamid.LIVE31"]);
    const calls: string[] = [];
    const routed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: customerInboundBody(live, ingested.suppressWamids),
      fetchImpl: (async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ messages: [{ id: "out" }] }), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(routed.handled, 0);
    assert.equal(calls.length, 0);
    const bypass = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: live,
      fetchImpl: (async () => new Response(JSON.stringify({ messages: [{ id: "out" }] }), { status: 200 })) as typeof fetch,
    });
    assert.equal(bypass.handled, 0);
    const conversation = await prisma.waConversation.findFirstOrThrow({
      where: { tenantId: id, messages: { some: { externalId: "wacloud:wamid.LIVE31" } } },
    });
    assert.ok(conversation.lastInboundAt);
    assert.equal(conversation.handoffState, "HUMAN_ACTIVE");
  });

  it("does not keep automation off for the service window after handoff expires", async () => {
    const id = await tenant("expiry");
    const phone = `b31x-${Date.now()}`;
    const prior = process.env.WHATSAPP_HANDOFF_MINUTES;
    process.env.WHATSAPP_HANDOFF_MINUTES = "30";
    try {
      await saveCloudHqConnector({
        tenantId: id,
        phoneNumberId: phone,
        wabaId: `waba-${phone}`,
        accessToken: "token-expiry",
        displayPhone: "15550005555",
        connectionMode: "COEXISTENCE",
      });
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
          inboundBody: "Here is the form for this workspace.",
          triggerPhrases: "order menu",
          paymentTriggerPhrases: "",
          paymentMessageText: "",
        },
      });
      assert.equal(saved.ok, true);
      const echoAt = Math.floor(now.getTime() / 1000) - 3 * 60 * 60;
      await ingestCloudWhatsAppPayload({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "smb_message_echoes",
                value: {
                  metadata: { phone_number_id: phone, display_phone_number: "15550005555" },
                  message_echoes: [
                    {
                      from: "15550005555",
                      to: "628123450066",
                      id: "wamid.OLD-ECHO",
                      timestamp: String(echoAt),
                      type: "text",
                      text: { body: "Saya bantu" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      const live = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: phone },
                  messages: [
                    {
                      from: "628123450066",
                      id: "wamid.AFTER-HANDOFF",
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
      const ingested = await ingestCloudWhatsAppPayload(live);
      assert.deepEqual(ingested.suppressWamids, []);
      const calls: string[] = [];
      const routed = await routeWorkspaceAutomation({
        trusted: true,
        now,
        body: live,
        fetchImpl: (async (url: string | URL | Request) => {
          calls.push(String(url));
          return new Response(JSON.stringify({ messages: [{ id: "out" }] }), { status: 200 });
        }) as typeof fetch,
      });
      assert.equal(routed.handled, 1);
      assert.equal(calls.length, 1);
      const message = await prisma.waMessage.findUniqueOrThrow({ where: { externalId: "wacloud:wamid.AFTER-HANDOFF" } });
      assert.equal(message.source, "cloud");
    } finally {
      if (prior === undefined) delete process.env.WHATSAPP_HANDOFF_MINUTES;
      else process.env.WHATSAPP_HANDOFF_MINUTES = prior;
    }
  });

  it("imports history without moving the service window or creating automation", async () => {
    const id = await tenant("history");
    const phone = `b31h-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: `waba-${phone}`,
      accessToken: "token-history",
      displayPhone: "15550003333",
      connectionMode: "COEXISTENCE",
    });
    const body = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: `waba-${phone}`,
          changes: [
            {
              field: "history",
              value: {
                metadata: { display_phone_number: "15550003333", phone_number_id: phone },
                history: [
                  {
                    metadata: { phase: 1, chunk_order: 1, progress: 40 },
                    threads: [
                      {
                        id: "628123450088",
                        messages: [
                          {
                            from: "628123450088",
                            id: "wamid.HIST31",
                            timestamp: "1700000000",
                            type: "text",
                            text: { body: "order menu" },
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
    const ingested = await ingestCloudWhatsAppPayload(body);
    assert.equal(ingested.suppressWamids.length, 0);
    const message = await prisma.waMessage.findUniqueOrThrow({ where: { externalId: "wacloud:wamid.HIST31" } });
    assert.equal(message.source, "history");
    const conversation = await prisma.waConversation.findUniqueOrThrow({ where: { id: message.conversationId } });
    assert.equal(conversation.lastInboundAt, null);
    assert.equal(conversation.handoffState, "");
    const routed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: customerInboundBody(body, []),
      fetchImpl: (async () => new Response("{}", { status: 200 })) as typeof fetch,
    });
    assert.equal(routed.ran, false);
    const row = await prisma.connector.findUniqueOrThrow({
      where: { tenantId_provider: { tenantId: id, provider: "WHATSAPP_CLOUD" } },
    });
    const meta = JSON.parse(row.metaJson || "{}") as { syncStatus?: string };
    assert.equal(meta.syncStatus, "syncing");
  });

  it("updates an existing contact name and does not create a lead from contact sync", async () => {
    const id = await tenant("contacts");
    const phone = `b31c-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: `waba-${phone}`,
      accessToken: "token-contacts",
      connectionMode: "COEXISTENCE",
    });
    const sync = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "smb_app_state_sync",
              value: {
                metadata: { phone_number_id: phone },
                state_sync: [
                  { type: "contact", action: "add", contact: { full_name: "New Lead", phone_number: "628123450077" } },
                ],
              },
            },
          ],
        },
      ],
    };
    await ingestCloudWhatsAppPayload(sync);
    assert.equal(await prisma.waContact.count({ where: { tenantId: id, phone: "628123450077" } }), 0);
    await prisma.waContact.create({
      data: { tenantId: id, identifier: "628123450077", phone: "628123450077", displayName: "Old", identityConfidence: "PHONE_VERIFIED" },
    });
    await ingestCloudWhatsAppPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "smb_app_state_sync",
              value: {
                metadata: { phone_number_id: phone },
                state_sync: [
                  { type: "contact", action: "add", contact: { full_name: "Sari", phone_number: "628123450077" } },
                ],
              },
            },
          ],
        },
      ],
    });
    const contact = await prisma.waContact.findFirstOrThrow({ where: { tenantId: id, phone: "628123450077" } });
    assert.equal(contact.displayName, "Sari");
    assert.equal(await prisma.waContact.count({ where: { tenantId: id } }), 1);
  });

  it("marks partner removal without disconnecting the token", async () => {
    const id = await tenant("account");
    const phone = `b31a-${Date.now()}`;
    await saveCloudHqConnector({
      tenantId: id,
      phoneNumberId: phone,
      wabaId: "waba-account",
      accessToken: "token-account",
      displayPhone: "15550004444",
      connectionMode: "CLOUD_API_ONLY",
    });
    await ingestCloudWhatsAppPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-account",
          changes: [
            {
              field: "account_update",
              value: {
                event: "PARTNER_REMOVED",
                disconnection_info: { reason: "ACCOUNT_DISCONNECTED" },
              },
            },
          ],
        },
      ],
    });
    const row = await prisma.connector.findUniqueOrThrow({
      where: { tenantId_provider: { tenantId: id, provider: "WHATSAPP_CLOUD" } },
    });
    assert.equal(row.status, "CONNECTED");
    assert.match(row.lastError || "", /ACCOUNT_DISCONNECTED/);
    const cfg = await getCloudHqConfig(id);
    assert.equal(cfg?.accessToken, "token-account");
    const meta = JSON.parse(row.metaJson || "{}") as { connectionStatus?: string; automationPaused?: string };
    assert.equal(meta.connectionStatus, "needs_attention");
    assert.equal(meta.automationPaused, "true");
    const phoneRow = await prisma.wabaPhone.findUniqueOrThrow({ where: { phoneNumberId: phone } });
    assert.equal(phoneRow.tenantId, id);
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
        inboundBody: "Here is the form for this workspace.",
        triggerPhrases: "order menu",
        paymentTriggerPhrases: "",
        paymentMessageText: "",
      },
    });
    assert.equal(saved.ok, true);
    const calls: string[] = [];
    const routed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: phone },
                  messages: [
                    {
                      id: "wamid.PAUSED",
                      from: "628123450055",
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
      },
      fetchImpl: (async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ messages: [{ id: "out" }] }), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(routed.handled, 0);
    assert.equal(calls.length, 0);
  });
});
