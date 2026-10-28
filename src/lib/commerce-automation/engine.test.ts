import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { saveCloudHqConnector } from "@/lib/conversations/cloud-hq";
import { deliverPaymentFollowUp, requestMarketingSend, routeWorkspaceAutomation } from "@/lib/commerce-automation/engine";
import type { AutomationInput } from "@/lib/commerce-automation/match";
import { saveAutomationSettings } from "@/lib/commerce-automation/settings";
import { routeYolaFromWhatsApp } from "@/lib/yola/engine";

const enabled = Boolean(process.env.YOLA_TEST_DATABASE_URL);
const now = new Date("2026-10-28T08:00:00.000Z");

type Call = { url: string; body: { type?: string; interactive?: { type?: string } }; auth: string };

function cloudBody(phoneNumberId: string, wamid: string, from: string, body: string, seconds = Math.floor(now.getTime() / 1000)) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phoneNumberId },
              messages: [{ id: wamid, from, timestamp: String(seconds), type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

function fetcher(calls: Call[], fail = false) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body)) as Call["body"];
    calls.push({ url: String(url), body, auth: headers.get("authorization") || "" });
    if (fail) return new Response(JSON.stringify({ error: { message: "no" } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: `out-${calls.length}` }] }), { status: 200 });
  };
}

describe("workspace automation engine", { skip: enabled ? false : "YOLA_TEST_DATABASE_URL is not set" }, () => {
  const tenantIds: string[] = [];
  const envKeys = ["YOLA_WA_PHONE_NUMBER_ID", "YOLA_FLOW_SEND_ENABLED", "YOLA_PILOT_LINK_SEND_ENABLED", "YOLA_BULK_MARKETING_ENABLED"];
  const prior = new Map(envKeys.map((key) => [key, process.env[key]]));

  after(async () => {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (tenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => undefined);
    }
  });

  async function tenant(name: string) {
    const row = await prisma.tenant.create({
      data: {
        name,
        slug: `b2-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "CLIENT",
        loginEnabled: true,
      },
    });
    tenantIds.push(row.id);
    return row.id;
  }

  async function connect(tenantId: string, phoneNumberId: string, token: string) {
    await saveCloudHqConnector({
      tenantId,
      phoneNumberId,
      wabaId: `waba-${phoneNumberId}`,
      accessToken: token,
      displayPhone: "test",
    });
  }

  function readyPatch(overrides: Partial<AutomationInput> = {}): AutomationInput {
    return {
      inboundEnabled: true,
      paymentFollowUpEnabled: false,
      marketingEnabled: false,
      pilotMode: false,
      flowId: "123456789012345",
      flowScreen: "START",
      flowCta: "Open",
      inboundBody: "Here is the form for this workspace.",
      triggerPhrases: "order menu",
      paymentTriggerPhrases: "payment link",
      paymentMessageText: "Your payment link is ready.",
      ...overrides,
    };
  }

  it("does not send for a workspace with no automation row", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    process.env.YOLA_FLOW_SEND_ENABLED = "true";
    const id = await tenant("p2p-like");
    const phone = `b2p-${Date.now()}`;
    await connect(id, phone, "token-p2p");
    const calls: Call[] = [];
    const routed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl: fetcher(calls) as typeof fetch,
      body: cloudBody(phone, "wamid-p2p", "628123450001", "order menu"),
    });
    assert.equal(routed.handled, 0);
    assert.equal(calls.length, 0);
    assert.equal(await prisma.workspaceAutomationOutbound.count({ where: { tenantId: id } }), 0);
    const yola = await routeYolaFromWhatsApp({ trusted: true, body: cloudBody(phone, "wamid-p2p", "628123450001", "order menu") });
    assert.equal(yola.ran, false);
    delete process.env.YOLA_FLOW_SEND_ENABLED;
  });

  it("sends a flow only when the inbound text matches", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    const id = await tenant("match");
    const phone = `b2m-${Date.now()}`;
    await connect(id, phone, "token-match");
    const saved = await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: readyPatch(),
    });
    assert.equal(saved.ok, true);
    const calls: Call[] = [];
    const fetchImpl = fetcher(calls) as typeof fetch;
    const miss = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-miss", "628123450001", "hello there"),
    });
    assert.equal(miss.handled, 0);
    const hit = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-hit", "628123450001", "I need the order menu"),
    });
    assert.equal(hit.handled, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.body.type, "interactive");
    assert.equal(calls[0]?.body.interactive?.type, "flow");
    assert.equal(calls[0]?.auth.includes("token-match"), true);
    assert.equal(JSON.stringify(calls[0]?.body).includes("template"), false);
    const again = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-hit", "628123450001", "I need the order menu"),
    });
    assert.equal(again.handled, 0);
    assert.equal(calls.length, 1);
    assert.equal(await prisma.workspaceAutomationOutbound.count({ where: { tenantId: id, status: "sent" } }), 1);
    const raced: Call[] = [];
    await Promise.all([
      routeWorkspaceAutomation({
        trusted: true,
        now,
        fetchImpl: fetcher(raced) as typeof fetch,
        body: cloudBody(phone, "wamid-race", "628123450001", "order menu"),
      }),
      routeWorkspaceAutomation({
        trusted: true,
        now,
        fetchImpl: fetcher(raced) as typeof fetch,
        body: cloudBody(phone, "wamid-race", "628123450001", "order menu"),
      }),
    ]);
    assert.equal(raced.length, 1);
  });

  it("keeps a disabled workspace and a pilot allowlist from sending", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    const id = await tenant("off");
    const phone = `b2o-${Date.now()}`;
    await connect(id, phone, "token-off");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: readyPatch({ inboundEnabled: false, pilotMode: true }),
    });
    const calls: Call[] = [];
    await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl: fetcher(calls) as typeof fetch,
      body: cloudBody(phone, "wamid-off", "628123450001", "order menu"),
    });
    assert.equal(calls.length, 0);
    const pilot = await tenant("pilot");
    const pilotPhone = `b2i-${Date.now()}`;
    await connect(pilot, pilotPhone, "token-pilot");
    await saveAutomationSettings({
      tenantId: pilot,
      actorUserId: "actor-test",
      patch: readyPatch({ pilotMode: true }),
      allowlist: [],
    });
    await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl: fetcher(calls) as typeof fetch,
      body: cloudBody(pilotPhone, "wamid-pilot", "628123450009", "order menu"),
    });
    assert.equal(calls.length, 0);
  });

  it("rejects cross-tenant routing and leaves the YOLA phone untouched", async () => {
    const owner = await tenant("owner");
    const other = await tenant("other");
    const yolaTenant = await tenant("yola");
    const phone = `b2x-${Date.now()}`;
    const yolaPhone = `b2y-${Date.now()}`;
    process.env.YOLA_WA_PHONE_NUMBER_ID = yolaPhone;
    process.env.YOLA_FLOW_SEND_ENABLED = "false";
    process.env.YOLA_PILOT_LINK_SEND_ENABLED = "false";
    await connect(owner, phone, "token-owner");
    await connect(yolaTenant, yolaPhone, "token-yola");
    await prisma.connector.create({
      data: {
        tenantId: other,
        provider: "WHATSAPP_CLOUD",
        status: "CONNECTED",
        accessTokenEnc: "v1:not-used",
        metaJson: JSON.stringify({ phoneNumberId: phone, wabaId: "stolen" }),
      },
    });
    const saved = await saveAutomationSettings({
      tenantId: owner,
      actorUserId: "actor-test",
      patch: readyPatch(),
    });
    assert.equal(saved.ok, true);
    const yolaSaved = await saveAutomationSettings({
      tenantId: yolaTenant,
      actorUserId: "actor-test",
      patch: readyPatch({ inboundEnabled: true }),
    });
    assert.equal(yolaSaved.ok, false);
    const calls: Call[] = [];
    const fetchImpl = fetcher(calls) as typeof fetch;
    const crossed = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-cross", "628123450001", "order menu"),
    });
    assert.equal(crossed.handled, 0);
    const isolated = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(yolaPhone, "wamid-yola", "628123450001", "order menu"),
    });
    assert.equal(isolated.reason, "yola_isolated");
    assert.equal(calls.length, 0);
    assert.equal(calls.some((call) => call.auth.includes("token-yola") || call.auth.includes("stolen")), false);
    const payment = await deliverPaymentFollowUp({
      tenantId: other,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-cross",
      lastInboundAt: now,
      now,
      fetchImpl,
    });
    assert.equal(payment.reason, "cross_tenant");
    assert.equal(calls.length, 0);
  });

  it("holds payment follow-up outside the window and never sends a template", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    const id = await tenant("pay");
    const phone = `b2pay-${Date.now()}`;
    await connect(id, phone, "token-pay");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: readyPatch({ inboundEnabled: false, paymentFollowUpEnabled: true, pilotMode: false }),
    });
    const calls: Call[] = [];
    const fetchImpl = fetcher(calls) as typeof fetch;
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const held = await deliverPaymentFollowUp({
      tenantId: id,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-1",
      lastInboundAt: old,
      now,
      fetchImpl,
    });
    assert.equal(held.status, "held");
    assert.equal(calls.length, 0);
    const row = await prisma.workspaceAutomationOutbound.findFirstOrThrow({ where: { tenantId: id } });
    assert.equal(row.detail.includes("template"), false);
    assert.equal(row.purpose, "payment_followup");
    const sent = await deliverPaymentFollowUp({
      tenantId: id,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-1",
      lastInboundAt: now,
      now,
      fetchImpl,
    });
    assert.equal(sent.status, "sent");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.body.type, "text");
    assert.equal(JSON.stringify(calls[0]?.body).includes("template"), false);
    assert.equal(JSON.stringify(calls[0]?.body).includes("yolafun_presale_offer"), false);
    const replay = await deliverPaymentFollowUp({
      tenantId: id,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-1",
      lastInboundAt: now,
      now,
      fetchImpl,
    });
    assert.equal(replay.reason, "duplicate");
    assert.equal(calls.length, 1);
    const keyword = await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-pay-keyword", "628123450001", "please send the payment link"),
    });
    assert.equal(keyword.handled, 1);
    assert.equal(calls.at(-1)?.body.type, "text");
    assert.equal(JSON.stringify(calls.at(-1)?.body).includes("template"), false);
    const blocked = await deliverPaymentFollowUp({
      tenantId: id,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-2",
      lastInboundAt: now,
      now,
      fetchImpl,
    });
    assert.equal(blocked.status, "sent");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: readyPatch({ inboundEnabled: false, paymentFollowUpEnabled: false, pilotMode: false }),
    });
    const refused = await deliverPaymentFollowUp({
      tenantId: id,
      phoneNumberId: phone,
      toDigits: "628123450001",
      orderRef: "order-3",
      lastInboundAt: now,
      now,
      fetchImpl,
    });
    assert.equal(refused.reason, "payment_disabled");
    assert.equal(calls.length, 3);
  });

  it("does not activate marketing without a separate authorization and does not send it", async () => {
    delete process.env.YOLA_WA_PHONE_NUMBER_ID;
    const id = await tenant("market");
    const phone = `b2k-${Date.now()}`;
    await connect(id, phone, "token-market");
    const calls: Call[] = [];
    const fetchImpl = fetcher(calls) as typeof fetch;
    const missing = await requestMarketingSend({ tenantId: id, toDigits: "628123450001", fetchImpl });
    assert.equal(missing.reason, "marketing_disabled");
    await saveAutomationSettings({
      tenantId: id,
      actorUserId: "actor-test",
      patch: readyPatch({ inboundEnabled: false, marketingEnabled: true, pilotMode: true }),
    });
    const unauthorized = await requestMarketingSend({ tenantId: id, toDigits: "628123450001", fetchImpl });
    assert.equal(unauthorized.reason, "marketing_not_authorized");
    await prisma.workspaceAutomation.update({
      where: { tenantId: id },
      data: { marketingAuthorizedAt: now },
    });
    const still = await requestMarketingSend({ tenantId: id, toDigits: "628123450001", fetchImpl });
    assert.equal(still.sent, false);
    assert.equal(still.reason, "marketing_send_not_activated");
    await routeWorkspaceAutomation({
      trusted: true,
      now,
      fetchImpl,
      body: cloudBody(phone, "wamid-market", "628123450001", "please send a promo"),
    });
    assert.equal(calls.length, 0);
    assert.equal(await prisma.workspaceAutomationOutbound.count({ where: { tenantId: id, purpose: "marketing" } }), 0);
    const audits = await prisma.workspaceAutomationAudit.findMany({ where: { tenantId: id } });
    const joined = audits.map((item) => item.summary).join(" ");
    assert.equal(joined.includes("628123450001"), false);
    assert.equal(joined.includes("token-market"), false);
  });
});
