import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCloudWhatsAppWebhook } from "./cloud-parse";
import { cloudSignatureValid } from "./cloud-signature";
import { createHmac } from "node:crypto";

describe("parseCloudWhatsAppWebhook", () => {
  it("reads an inbound text to the HQ number", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "628111000111",
                  phone_number_id: "PNID99",
                },
                contacts: [{ profile: { name: "Budi" }, wa_id: "6281190083695" }],
                messages: [
                  {
                    from: "6281190083695",
                    id: "wamid.ABC",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Status Stamp" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].phoneNumberId, "PNID99");
    assert.equal(r.events[0].waId, "6281190083695");
    assert.equal(r.events[0].profileName, "Budi");
    assert.equal(r.events[0].externalId, "wacloud:wamid.ABC");
    assert.equal(r.events[0].body, "Status Stamp");
    assert.equal(r.events[0].fromMe, false);
    assert.equal(r.events[0].source, "cloud");
    assert.equal(r.events[0].imageMediaId, null);
  });

  it("mirrors WhatsApp Business App sends as fromMe echoes", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                metadata: {
                  display_phone_number: "628111000111",
                  phone_number_id: "PNID99",
                },
                message_echoes: [
                  {
                    from: "628111000111",
                    to: "6281190083695",
                    id: "wamid.ECHO",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Siap, Kak" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].fromMe, true);
    assert.equal(r.events[0].waId, "6281190083695");
    assert.equal(r.events[0].body, "Siap, Kak");
    assert.equal(r.events[0].externalId, "wacloud:wamid.ECHO");
    assert.equal(r.events[0].source, "business_app");
  });

  it("reads an inbound receipt photo caption + media id", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID99" },
                contacts: [{ profile: { name: "Sari" }, wa_id: "62812" }],
                messages: [
                  {
                    from: "62812",
                    id: "wamid.IMG",
                    timestamp: "1700000000",
                    type: "image",
                    image: { id: "MEDIA99", caption: "TRX-9901 Rp 28000" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events[0].imageMediaId, "MEDIA99");
    assert.equal(r.events[0].inboxMediaId, "MEDIA99");
    assert.equal(r.events[0].body, "TRX-9901 Rp 28000");
  });

  it("keeps a voice note id and refuses an exe document", () => {
    const voice = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID99" },
                contacts: [{ wa_id: "62812" }],
                messages: [
                  {
                    from: "62812",
                    id: "wamid.AUD",
                    timestamp: "1700000000",
                    type: "audio",
                    audio: { id: "AUD1" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in voice));
    assert.equal(voice.events[0].inboxMediaId, "AUD1");
    assert.equal(voice.events[0].body, "[audio]");
    const exe = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID99" },
                contacts: [{ wa_id: "62812" }],
                messages: [
                  {
                    from: "62812",
                    id: "wamid.EXE",
                    timestamp: "1700000000",
                    type: "document",
                    document: { id: "DOC1", filename: "setup.exe" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in exe));
    assert.equal(exe.events[0].inboxMediaId, null);
    assert.equal(exe.events[0].body, "[blocked]");
  });

  it("does not turn delivery statuses into inbox events", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID99" },
                statuses: [
                  {
                    id: "wamid.x",
                    status: "delivered",
                    timestamp: "1700000000",
                    recipient_id: "62811",
                    pricing: { category: "marketing", type: "regular" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 0);
    assert.equal(r.statuses.length, 1);
    assert.equal(r.statuses[0].wamid, "wamid.x");
    assert.equal(r.statuses[0].status, "delivered");
    assert.equal(r.statuses[0].pricingCategory, "marketing");
  });

  it("parses failed status with Meta error code", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PNID99" },
                statuses: [
                  {
                    id: "wamid.fail",
                    status: "failed",
                    timestamp: "1700000000",
                    recipient_id: "62811",
                    errors: [{ code: 131049, title: "ecosystem" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.statuses[0].errorCode, 131049);
    assert.equal(r.statuses[0].errorTitle, "ecosystem");
  });

  it("reads history threads without treating them as live customer messages", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "history",
              value: {
                metadata: { display_phone_number: "15551230000", phone_number_id: "PNID99" },
                history: [
                  {
                    metadata: { phase: 0, chunk_order: 1, progress: 100 },
                    threads: [
                      {
                        id: "6281190083695",
                        messages: [
                          {
                            from: "6281190083695",
                            id: "wamid.HIST",
                            timestamp: "1700000000",
                            type: "text",
                            text: { body: "old hello" },
                          },
                          {
                            from: "15551230000",
                            to: "6281190083695",
                            id: "wamid.HISTOUT",
                            timestamp: "1700000001",
                            type: "text",
                            text: { body: "old reply" },
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
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 2);
    assert.equal(r.events[0].source, "history");
    assert.equal(r.events[0].fromMe, false);
    assert.equal(r.events[1].source, "history");
    assert.equal(r.events[1].fromMe, true);
    assert.equal(r.events[1].waId, "6281190083695");
    assert.equal(r.sync[0].syncStatus, "complete");
  });

  it("records a declined history share and skips the threads", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "history",
              value: {
                metadata: { phone_number_id: "PNID99" },
                history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business" }] }],
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 0);
    assert.equal(r.sync[0].syncStatus, "declined");
  });

  it("reads contact sync rows and partner removal without inbox messages", () => {
    const r = parseCloudWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA1",
          changes: [
            {
              field: "smb_app_state_sync",
              value: {
                metadata: { phone_number_id: "PNID99" },
                state_sync: [
                  {
                    type: "contact",
                    action: "add",
                    contact: { full_name: "Sari", phone_number: "6281190083695" },
                  },
                ],
              },
            },
            {
              field: "account_update",
              value: {
                event: "PARTNER_REMOVED",
                phone_number: "15551230000",
                disconnection_info: { reason: "ACCOUNT_DISCONNECTED", initiated_by: "USER" },
              },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 0);
    assert.equal(r.contacts[0].displayName, "Sari");
    assert.equal(r.contacts[0].action, "add");
    assert.equal(r.account[0].event, "PARTNER_REMOVED");
    assert.equal(r.account[0].connectionStatus, "needs_attention");
    assert.equal(r.account[0].reason, "ACCOUNT_DISCONNECTED");
  });
});

describe("cloudSignatureValid", () => {
  it("accepts a matching sha256 HMAC", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const secret = "test-secret";
    const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    assert.equal(cloudSignatureValid(body, `sha256=${hex}`, secret), true);
    assert.equal(cloudSignatureValid(body, `sha256=${hex}`, "other"), false);
    assert.equal(cloudSignatureValid(body, null, secret), false);
  });
});
