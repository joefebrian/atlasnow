import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  summarizeClientsForConversations,
  summarizeClientsForCustomers,
  summarizeClientsForReviews,
} from "./portfolio";

describe("summarizeClientsForConversations", () => {
  it("rolls chats and unreplied per client, including empty brands", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const earlier = new Date("2026-08-18T11:00:00Z");
    const rows = summarizeClientsForConversations(
      [
        { id: "vilo", name: "Vilo Gelato", slug: "vilo" },
        { id: "p2p", name: "P2P Labs", slug: "p2p" },
      ],
      [
        { tenantId: "p2p" },
        { tenantId: "vilo" },
        { tenantId: "vilo" },
      ],
      [
        {
          tenantId: "p2p",
          lastInboundAt: now,
          lastOutboundAt: earlier,
        },
        {
          tenantId: "p2p",
          lastInboundAt: earlier,
          lastOutboundAt: now,
        },
      ]
    );

    assert.equal(rows[0].name, "P2P Labs");
    assert.equal(rows[0].branchCount, 1);
    assert.equal(rows[0].conversationCount, 2);
    assert.equal(rows[0].unrepliedCount, 1);
    assert.equal(rows[1].name, "Vilo Gelato");
    assert.equal(rows[1].branchCount, 2);
    assert.equal(rows[1].conversationCount, 0);
    assert.equal(rows[1].unrepliedCount, 0);
  });
});

describe("summarizeClientsForCustomers", () => {
  it("counts customers and phones per client", () => {
    const rows = summarizeClientsForCustomers(
      [
        { id: "vilo", name: "Vilo Gelato", slug: "vilo" },
        { id: "p2p", name: "P2P Labs", slug: "p2p" },
      ],
      [{ tenantId: "vilo" }, { tenantId: "vilo" }, { tenantId: "p2p" }],
      [
        { tenantId: "vilo", phone: "6281" },
        { tenantId: "vilo", phone: null },
        { tenantId: "p2p", phone: "6013" },
      ]
    );
    assert.equal(rows[0].name, "P2P Labs");
    assert.equal(rows[0].customerCount, 1);
    assert.equal(rows[0].withPhone, 1);
    assert.equal(rows[1].name, "Vilo Gelato");
    assert.equal(rows[1].customerCount, 2);
    assert.equal(rows[1].withPhone, 1);
    assert.equal(rows[1].branchCount, 2);
  });
});

describe("summarizeClientsForReviews", () => {
  it("rolls reviews and unreplied per brand", () => {
    const rows = summarizeClientsForReviews(
      [
        { id: "fnb", name: "F&B Co", slug: "fnb" },
        { id: "clinic", name: "Clinic Co", slug: "clinic" },
      ],
      [{ tenantId: "fnb" }, { tenantId: "fnb" }, { tenantId: "clinic" }],
      [
        { tenantId: "fnb", replied: true },
        { tenantId: "fnb", replied: false },
        { tenantId: "clinic", replied: false },
      ]
    );
    assert.equal(rows[1].name, "F&B Co");
    assert.equal(rows[1].branchCount, 2);
    assert.equal(rows[1].reviewCount, 2);
    assert.equal(rows[1].unrepliedCount, 1);
    assert.equal(rows[0].name, "Clinic Co");
    assert.equal(rows[0].reviewCount, 1);
    assert.equal(rows[0].unrepliedCount, 1);
  });
});
