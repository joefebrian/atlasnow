import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeClientsForPortfolio } from "./portfolio";

describe("summarizeClientsForPortfolio", () => {
  const clients = [
    { id: "vilo", name: "Vilo Gelato", slug: "vilo-gelato" },
    { id: "p2p", name: "P2P Labs", slug: "p2p-labs" },
  ];

  it("rolls locations up per client and lists empty brands", () => {
    const rows = summarizeClientsForPortfolio(clients, [
      {
        tenant: { id: "vilo" },
        readiness: "READY",
        phone: "+62 811",
        city: "Jakarta Barat",
      },
      {
        tenant: { id: "vilo" },
        readiness: "PARTIAL",
        phone: null,
        city: "Jakarta Pusat",
      },
    ]);

    assert.equal(rows[0].name, "P2P Labs");
    assert.equal(rows[0].locationCount, 0);
    assert.equal(rows[1].name, "Vilo Gelato");
    assert.equal(rows[1].locationCount, 2);
    assert.equal(rows[1].readyCount, 1);
    assert.equal(rows[1].phoneCount, 1);
    assert.deepEqual(rows[1].cities, ["Jakarta Barat", "Jakarta Pusat"]);
  });
});
