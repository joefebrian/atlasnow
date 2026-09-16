import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatContactEmail,
  formatJakartaTime,
  parseContactRequest,
  parseOptionalPage,
  parseOptionalReferrer,
} from "./parse";

describe("parseContactRequest", () => {
  it("accepts a normal contact form", () => {
    const r = parseContactRequest({
      name: "Ada",
      email: " ada@example.com ",
      company: "P2P",
      message: "We want to talk about three shops.",
      locale: "id",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.spam, false);
    assert.equal(r.value.email, "ada@example.com");
    assert.equal(r.value.locale, "id");
    assert.equal(r.value.company, "P2P");
  });

  it("rejects missing name, email, or short message", () => {
    assert.equal(parseContactRequest({ email: "a@b.co", message: "hello there" }).ok, false);
    assert.equal(parseContactRequest({ name: "Ada", message: "hello there" }).ok, false);
    assert.equal(
      parseContactRequest({ name: "Ada", email: "ada@example.com", message: "hi" }).ok,
      false
    );
  });

  it("treats a filled honeypot as spam without failing", () => {
    const r = parseContactRequest({
      name: "Bot",
      email: "bot@example.com",
      message: "Buy this now please",
      website: "https://spam.test",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.spam, true);
  });
});

describe("contact email body", () => {
  it("includes form fields plus IP and browser meta", () => {
    const text = formatContactEmail(
      {
        name: "Ada",
        email: "ada@example.com",
        company: "P2P",
        message: "Three shops in BSD.",
        locale: "id",
        website: "",
      },
      {
        sentAt: "2026-08-26 19:11:00 WIB",
        ip: "1.2.3.4",
        country: "ID",
        userAgent: "Mozilla/5.0",
        acceptLanguage: "id-ID",
        referrer: "https://atlasnow.co/",
        page: "/contact",
      }
    );
    assert.match(text, /Name: Ada/);
    assert.match(text, /Three shops in BSD/);
    assert.match(text, /IP: 1\.2\.3\.4/);
    assert.match(text, /Country: ID/);
    assert.match(text, /Page: \/contact/);
    assert.match(text, /Browser: Mozilla\/5\.0/);
  });

  it("only accepts a site path for page", () => {
    assert.equal(parseOptionalPage("/contact"), "/contact");
    assert.equal(parseOptionalPage("https://evil.test"), null);
    assert.equal(parseOptionalPage("contact"), null);
  });

  it("only accepts http(s) referrers", () => {
    assert.equal(parseOptionalReferrer("https://atlasnow.co/about"), "https://atlasnow.co/about");
    assert.equal(parseOptionalReferrer("javascript:alert(1)"), null);
  });

  it("formats Jakarta time with WIB", () => {
    assert.match(formatJakartaTime(new Date("2026-08-26T12:11:00.000Z")), /WIB$/);
  });
});
