import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { readInbound } from "@/lib/yola/inbound";
import {
  applyPaymentEvent,
  handleYolaEvent,
  listYolaDesk,
  recordMarketingOptIn,
  redeemTicket,
  routeYolaFromWhatsApp,
} from "@/lib/yola/engine";

const phone = "900000000000001";
const now = new Date("2026-10-27T02:00:00.000Z");
const enabled = Boolean(process.env.YOLA_TEST_DATABASE_URL);

function textBody(wamid: string, from: string, body: string, timestamp: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phone },
              messages: [{ id: wamid, from, timestamp, type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

function nfmBody(wamid: string, from: string, response: Record<string, string>) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phone },
              messages: [
                {
                  id: wamid,
                  from,
                  timestamp: String(Math.floor(now.getTime() / 1000)),
                  type: "interactive",
                  interactive: { type: "nfm_reply", nfm_reply: { response_json: JSON.stringify(response) } },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("yola postgres engine", { skip: enabled ? false : "YOLA_TEST_DATABASE_URL is not set" }, () => {
  let tenantId = "";

  before(async () => {
    process.env.YOLA_WA_PHONE_NUMBER_ID = phone;
    delete process.env.YOLA_FLOW_SEND_ENABLED;
    delete process.env.YOLA_LIVE_PAYMENTS_ENABLED;
    delete process.env.YOLA_TICKET_LIVE_ISSUANCE_ENABLED;
    const tenant = await prisma.tenant.create({
      data: { name: "Yola Test", slug: `yola-test-${Date.now()}`, type: "CLIENT", loginEnabled: true },
    });
    tenantId = tenant.id;
    await prisma.wabaPhone.create({
      data: { tenantId, phoneNumberId: phone, wabaId: "waba-test", displayPhone: "+1 555 000 0001" },
    });
  });

  after(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("invites once, ignores unrelated traffic, and creates one order", async () => {
    const stamp = String(Math.floor(now.getTime() / 1000));
    const first = readInbound(textBody("wamid.TEXT.1", "628111111111", "yola fun", stamp))[0];
    const invited = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: first, now });
    assert.equal(invited.action, "flow_invited");
    assert.ok(invited.flowToken);
    const second = readInbound(textBody("wamid.TEXT.2", "628111111111", "beli tiket yola", stamp))[0];
    const again = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: second, now });
    assert.equal(again.duplicate, true);
    assert.equal(again.flowToken, invited.flowToken);
    const other = readInbound({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "999" }, messages: [{ id: "wamid.OTHER", from: "628111111111", timestamp: stamp, type: "text", text: { body: "yola fun" } }] } }] }],
    })[0];
    const ignored = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: other, now });
    assert.equal(ignored.reason, "phone_number_not_yola");
    const sessions = await prisma.yolaFlowSession.count({ where: { tenantId } });
    assert.equal(sessions, 1);

    const naked = readInbound(nfmBody("wamid.NAKED", "628111111111", {
      buyer_name: "Sari",
      buyer_phone: "08111111111",
      visit_date: "2026-12-01",
      visit_time: "10:00",
      flow_token: "not-a-real-token-123",
    }))[0];
    const rejected = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: naked, now });
    assert.equal(rejected.reason, "unknown_flow_token");

    const badDate = readInbound(nfmBody("wamid.DATE", "628111111111", {
      buyer_name: "Sari",
      buyer_phone: "08111111111",
      visit_date: "2026-11-01",
      visit_time: "10:00",
      flow_token: invited.flowToken || "",
    }))[0];
    const dated = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: badDate, now });
    assert.equal(dated.reason, "visit_date");

    const submit = readInbound(nfmBody("wamid.NFM.1", "628111111111", {
      buyer_name: "Sari",
      buyer_phone: "08111111111",
      visit_date: "2026-12-01",
      visit_time: "10:00",
      flow_token: invited.flowToken || "",
    }))[0];
    const created = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: submit, now });
    assert.equal(created.action, "order_created");
    assert.equal(created.orderId, "YOLA-20261027-000001");
    const order = await prisma.yolaOrder.findFirstOrThrow({ where: { tenantId, humanId: created.orderId } });
    assert.equal(order.amountIdr, 499000);
    assert.equal(order.status, "PENDING_PAYMENT");
    assert.equal(order.phoneMismatch, false);
    const replay = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: submit, now });
    assert.equal(replay.duplicate, true);
    const later = readInbound(nfmBody("wamid.NFM.2", "628111111111", {
      buyer_name: "Sari",
      buyer_phone: "08111111111",
      visit_date: "2026-12-01",
      visit_time: "10:00",
      flow_token: invited.flowToken || "",
    }))[0];
    const duplicateToken = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: later, now });
    assert.equal(duplicateToken.duplicate, true);
    assert.equal(await prisma.yolaOrder.count({ where: { tenantId } }), 1);

    const paid = await applyPaymentEvent({
      tenantId,
      humanId: created.orderId || "",
      eventId: "mock-1",
      provider: "sandbox",
      outcome: "PAID",
      amountIdr: 499000,
      currency: "IDR",
      nonce: created.paymentNonce,
      now,
    });
    assert.equal(paid.action, "ticket_issued");
    const againPaid = await applyPaymentEvent({
      tenantId,
      humanId: created.orderId || "",
      eventId: "mock-1",
      provider: "sandbox",
      outcome: "PAID",
      amountIdr: 499000,
      currency: "IDR",
      nonce: created.paymentNonce,
      now,
    });
    assert.equal(againPaid.duplicate, true);
    const ticket = await prisma.yolaTicket.findFirstOrThrow({ where: { tenantId } });
    assert.equal(ticket.issuanceMode, "TEST");
    assert.equal(ticket.remaining, 2);
    const scan1 = await redeemTicket({ tenantId, token: paid.ticketToken || "", key: "scan-1", now: new Date("2026-12-01T03:00:00.000Z"), visitDate: "2026-12-01" });
    assert.equal(scan1.remaining, 1);
    const scanSame = await redeemTicket({ tenantId, token: paid.ticketToken || "", key: "scan-1", now: new Date("2026-12-01T03:00:00.000Z"), visitDate: "2026-12-01" });
    assert.equal(scanSame.duplicate, true);
    assert.equal(scanSame.remaining, 1);
    const scan2 = await redeemTicket({ tenantId, token: paid.ticketToken || "", key: "scan-2", now: new Date("2026-12-01T05:00:00.000Z"), visitDate: "2026-12-01" });
    assert.equal(scan2.remaining, 0);
    const scan3 = await redeemTicket({ tenantId, token: paid.ticketToken || "", key: "scan-3", now: new Date("2026-12-01T06:00:00.000Z"), visitDate: "2026-12-01" });
    assert.equal(scan3.reason, "no_entries_left");

    const desk = await listYolaDesk(tenantId);
    assert.equal(desk.templateStatus, "UNVERIFIED");
    assert.equal(desk.sendEnabled, false);
    assert.equal(JSON.stringify(desk).includes("628111111111"), false);
    assert.equal(desk.orders.length, 1);
  });

  it("stores one order per published Flow slot and ignores a webhook replay", async () => {
    const slots = [
      ["SLOT_1000", "10:00", "62815551000"],
      ["SLOT_1200", "12:00", "62815551200"],
      ["SLOT_1400", "14:00", "62815551400"],
      ["SLOT_1600", "16:00", "62815551600"],
    ] as const;
    const stamp = String(Math.floor(now.getTime() / 1000));
    for (const [slot, clock, from] of slots) {
      const invited = await routeYolaFromWhatsApp({
        trusted: true,
        body: textBody(`wamid.SLOT.INVITE.${slot}`, from, "yola fun", stamp),
        now,
      });
      assert.equal(invited.ran, true);
      if (!invited.ran) return;
      assert.equal(invited.results[0]?.action, "flow_invited");
      const session = await prisma.yolaFlowSession.findFirstOrThrow({
        where: { tenantId, waId: from, status: "invited" },
      });
      const body = nfmBody(`wamid.SLOT.NFM.${slot}`, from, {
        buyer_name: "Sari",
        buyer_phone: "081234567890",
        visit_date: "2026-12-01",
        visit_time: slot,
        flow_token: session.flowToken,
      });
      const created = await routeYolaFromWhatsApp({ trusted: true, body, now });
      assert.equal(created.ran, true);
      if (!created.ran) return;
      assert.equal(created.results[0]?.action, "order_created");
      assert.equal(created.results[0]?.duplicate, false);
      const order = await prisma.yolaOrder.findFirstOrThrow({ where: { tenantId, flowToken: session.flowToken } });
      assert.equal(order.visitTime, clock);
      assert.equal(order.visitDate, "2026-12-01");
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.equal(order.amountIdr, 499000);
      const replay = await routeYolaFromWhatsApp({ trusted: true, body, now });
      assert.equal(replay.ran, true);
      if (!replay.ran) return;
      assert.equal(replay.results[0]?.duplicate, true);
      assert.equal(replay.results[0]?.orderId, order.humanId);
      assert.equal(await prisma.yolaOrder.count({ where: { tenantId, flowToken: session.flowToken } }), 1);
    }
    const badFrom = "62815551800";
    await routeYolaFromWhatsApp({
      trusted: true,
      body: textBody("wamid.SLOT.INVITE.BAD", badFrom, "yola fun", stamp),
      now,
    });
    const badSession = await prisma.yolaFlowSession.findFirstOrThrow({
      where: { tenantId, waId: badFrom, status: "invited" },
    });
    const before = await prisma.yolaOrder.count({ where: { tenantId } });
    const rejected = await routeYolaFromWhatsApp({
      trusted: true,
      body: nfmBody("wamid.SLOT.NFM.BAD", badFrom, {
        buyer_name: "Sari",
        buyer_phone: "081234567890",
        visit_date: "2026-12-01",
        visit_time: "SLOT_1800",
        flow_token: badSession.flowToken,
      }),
      now,
    });
    assert.equal(rejected.ran, true);
    if (!rejected.ran) return;
    assert.equal(rejected.results[0]?.reason, "visit_time");
    assert.equal(await prisma.yolaOrder.count({ where: { tenantId } }), before);
  });

  it("does not route an unsigned or unmatched webhook into an order", async () => {
    const blocked = await routeYolaFromWhatsApp({ trusted: false, body: textBody("wamid.NO", "628111111111", "yola fun", "1"), now });
    assert.equal(blocked.ran, false);
    if (!blocked.ran) assert.equal(blocked.reason, "signature_required");
    const otherPhone = await routeYolaFromWhatsApp({
      trusted: true,
      body: textBody("wamid.ELSE", "628111111111", "yola fun", String(Math.floor(now.getTime() / 1000))).entry
        ? {
            entry: [{ changes: [{ value: { metadata: { phone_number_id: "111" }, messages: [{ id: "wamid.ELSE", from: "628999", timestamp: "1", type: "text", text: { body: "yola fun" } }] } }] }],
          }
        : {},
      now,
    });
    assert.equal(otherPhone.ran, false);
  });

  it("suppresses an outside-window message when the template is unverified", async () => {
    const stale = readInbound(textBody("wamid.OLD", "628333333333", "yola", "100"))[0];
    const result = await handleYolaEvent({ tenantId, phoneNumberId: phone, event: stale, now });
    assert.equal(result.action, "suppressed_outside_window");
    const held = await prisma.yolaOutboundMessage.count({ where: { tenantId, waId: "628333333333" } });
    assert.equal(held, 0);
    await recordMarketingOptIn(tenantId, "628333333333", "test");
    const still = await handleYolaEvent({
      tenantId,
      phoneNumberId: phone,
      event: readInbound(textBody("wamid.OLD2", "628333333333", "yola", "100"))[0],
      now,
    });
    assert.equal(still.action, "suppressed_outside_window");
  });
});
