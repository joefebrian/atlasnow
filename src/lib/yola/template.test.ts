import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchMarketingTemplates, selectApprovedFlowTemplate, templatePayload } from "@/lib/yola/template";

const approved = {
  id: "tmpl_1",
  name: "yola_fixture_only",
  status: "APPROVED",
  language: "id",
  category: "MARKETING",
  components: [{ type: "BUTTONS", buttons: [{ type: "FLOW", text: "Buka", flow_id: "999000111", navigate_screen: "OFFER" }] }],
};

describe("yola template verification", () => {
  it("stays unverified without a Graph result", async () => {
    const previous = process.env.YOLA_WA_ACCESS_TOKEN;
    delete process.env.YOLA_WA_ACCESS_TOKEN;
    const result = await fetchMarketingTemplates(async () => {
      throw new Error("network");
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, "UNVERIFIED");
    if (previous === undefined) delete process.env.YOLA_WA_ACCESS_TOKEN;
    else process.env.YOLA_WA_ACCESS_TOKEN = previous;
  });

  it("accepts one approved marketing flow template and rejects pending or several", () => {
    const one = selectApprovedFlowTemplate([approved], "");
    assert.equal(one.ok, true);
    if (one.ok) {
      assert.equal(one.template.flowId, "999000111");
      assert.equal(one.template.navigateScreen, "OFFER");
      const payload = templatePayload({ to: "+628111111111", template: one.template, flowToken: "yf_token_123456" });
      assert.equal(payload.type, "template");
      assert.equal(payload.template.components[0].sub_type, "flow");
    }
    const pending = selectApprovedFlowTemplate([{ ...approved, status: "PENDING" }], "");
    assert.equal(pending.ok, false);
    const many = selectApprovedFlowTemplate([approved, { ...approved, id: "tmpl_2", name: "other" }], "");
    assert.equal(many.ok, false);
    if (!many.ok) assert.equal(many.reason, "ambiguous");
  });
});
