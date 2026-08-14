# Conversations WAHA Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agency staff see every WhatsApp thread from mapped branch WAHA sessions on `/conversations` (monitor-only), with customer phone stored and shown whenever WAHA sent one.

**Architecture:** Public webhook parses WAHA `message` / `message.any`, gates on ACTIVE `SourceMapping(sourceType=WAHA)`, upserts `WaContact` / `WaConversation` / `WaMessage`. Inbox lists conversations and opens a read-only thread. No send path.

**Tech Stack:** Next.js 16 App Router, Prisma 5 + SQLite, `tsx --test` (Node test runner), existing `formatDateTime`, `readSession`, `resolveIntegrationValues("waha")`.

## Global Constraints

- Monitor-only: no POST send, no composer, no draft.
- Never invent a phone from `@lid`. Persist `WaContact.phone` whenever WAHA provides digits; UI always prefers `phone`.
- Ingest only ACTIVE `SourceMapping` where `sourceType = "WAHA"` and `externalId` equals the WAHA session name (case-sensitive).
- Agency staff only on list/thread APIs. Client users keep `ModulePlaceholder`.
- Dates via `formatDateTime(..., locale)` (`Asia/Jakarta`).
- `provider` column default `"WAHA"` (string allows `META_CLOUD` later).
- Webhook never 5xx for business misses (unmapped, kill switch, unknown event, duplicate).
- 24h conversation window hardcoded (`24 * 60 * 60 * 1000`).
- Out of scope: taxonomy, SLA clocks, Meta Cloud, retention purge, session health, pull/sync.

## File map

| File | Responsibility |
|---|---|
| `src/lib/conversations/identity.ts` | Parse peer id → phone/lid/confidence; merge later phone onto same contact |
| `src/lib/conversations/parse.ts` | Normalize WAHA webhook JSON → `ParsedWahaEvent` |
| `src/lib/conversations/window.ts` | 24h “new conversation?” predicate + preview truncate |
| `src/lib/conversations/ingest.ts` | Mapping gate, contact upsert, conversation split, message dedupe |
| `src/lib/conversations/service.ts` | List/get for agency inbox + audit |
| `src/lib/conversations/waha-config.ts` | Kill switch + API key from Settings `waha` integration |
| `src/app/api/webhooks/waha/route.ts` | Public POST |
| `src/app/api/conversations/route.ts` | GET list |
| `src/app/api/conversations/[id]/route.ts` | GET thread + audit |
| `src/components/conversations/ConversationsInbox.tsx` | Inbox UI |
| `prisma/schema.prisma` | `WaContact`, `WaConversation`, `WaMessage` + Location/Tenant relations |
| `src/app/(app)/conversations/page.tsx` | Agency inbox vs client placeholder |
| `src/lib/i18n/messages.ts` | EN/ID chrome strings |

Middleware already excludes all `/api/*` (`matcher` has `(?!api|…)`). Do **not** change `src/middleware.ts`.

---

### Task 1: Identity, parse, 24h window (pure)

**Files:**
- Create: `src/lib/conversations/identity.ts`
- Create: `src/lib/conversations/identity.test.ts`
- Create: `src/lib/conversations/parse.ts`
- Create: `src/lib/conversations/parse.test.ts`
- Create: `src/lib/conversations/window.ts`
- Create: `src/lib/conversations/window.test.ts`
- Modify: `package.json` — add `"test": "tsx --test \"src/**/*.test.ts\""` if missing

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export type IdentityConfidence = "PHONE_VERIFIED" | "LID_RESOLVED" | "OPAQUE_LID" | "UNKNOWN"`
  - `export type ResolvedIdentity = { identifier: string; phone: string | null; lid: string | null; confidence: IdentityConfidence }`
  - `export function resolveIdentity(peerRaw: string, extraPhone?: string | null): ResolvedIdentity`
  - `export function mergeIdentity(existing: ResolvedIdentity, incoming: ResolvedIdentity): ResolvedIdentity`
  - `export type ParsedWahaEvent = { event: string; session: string; externalId: string; fromMe: boolean; body: string; sentAt: Date; peerRaw: string; extraPhone: string | null; displayName: string | null }`
  - `export function parseWahaEvent(input: unknown): ParsedWahaEvent | { error: string }`
  - `export const CONVERSATION_GAP_MS = 24 * 60 * 60 * 1000`
  - `export function shouldStartNewConversation(lastMessageAt: Date | null, now: Date): boolean`
  - `export function previewBody(body: string, max = 160): string`

- [ ] **Step 1: Write failing identity tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeIdentity, resolveIdentity } from "./identity";

describe("resolveIdentity", () => {
  it("stores digits from @c.us as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628123456789@c.us");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
    assert.equal(r.identifier, "628123456789");
    assert.equal(r.lid, null);
  });

  it("stores digits from @s.whatsapp.net as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628123456789@s.whatsapp.net");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
  });

  it("does not invent a phone from @lid only", () => {
    const r = resolveIdentity("123456789012345@lid");
    assert.equal(r.phone, null);
    assert.equal(r.lid, "123456789012345");
    assert.equal(r.confidence, "OPAQUE_LID");
    assert.equal(r.identifier, "123456789012345@lid");
  });

  it("uses extraPhone with lid as LID_RESOLVED", () => {
    const r = resolveIdentity("123456789012345@lid", "628111222333");
    assert.equal(r.phone, "628111222333");
    assert.equal(r.lid, "123456789012345");
    assert.equal(r.confidence, "LID_RESOLVED");
    assert.equal(r.identifier, "628111222333");
  });

  it("treats bare numeric peer as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628999888777");
    assert.equal(r.phone, "628999888777");
    assert.equal(r.confidence, "PHONE_VERIFIED");
  });

  it("returns UNKNOWN for empty peer", () => {
    const r = resolveIdentity("");
    assert.equal(r.phone, null);
    assert.equal(r.confidence, "UNKNOWN");
    assert.equal(r.identifier, "unknown");
  });
});

describe("mergeIdentity", () => {
  it("upgrades lid-only contact when a later event has a phone", () => {
    const first = resolveIdentity("999@lid");
    const second = resolveIdentity("628123456789@c.us");
    const merged = mergeIdentity(first, second);
    assert.equal(merged.phone, "628123456789");
    assert.equal(merged.confidence, "PHONE_VERIFIED");
    assert.equal(merged.lid, "999");
  });
});
```

- [ ] **Step 2: Run identity tests — expect FAIL (module missing)**

Run: `cd "/Users/joefebrian/Downloads/Working Desk/Atlas Technology/atlasnow" && npx tsx --test src/lib/conversations/identity.test.ts`

Expected: `Cannot find module './identity'`

- [ ] **Step 3: Implement identity.ts**

```ts
export type IdentityConfidence =
  | "PHONE_VERIFIED"
  | "LID_RESOLVED"
  | "OPAQUE_LID"
  | "UNKNOWN";

export type ResolvedIdentity = {
  identifier: string;
  phone: string | null;
  lid: string | null;
  confidence: IdentityConfidence;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function resolveIdentity(
  peerRaw: string,
  extraPhone?: string | null
): ResolvedIdentity {
  const raw = (peerRaw || "").trim();
  const extra = extraPhone ? digitsOnly(extraPhone) : "";
  const extraOk = extra.length >= 8;

  const lidMatch = raw.match(/^([^@]+)@lid$/i);
  if (lidMatch) {
    const lid = lidMatch[1];
    if (extraOk) {
      return {
        identifier: extra,
        phone: extra,
        lid,
        confidence: "LID_RESOLVED",
      };
    }
    return {
      identifier: `${lid}@lid`,
      phone: null,
      lid,
      confidence: "OPAQUE_LID",
    };
  }

  const user = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
  const phone = digitsOnly(user);
  if (phone.length >= 8) {
    return {
      identifier: phone,
      phone,
      lid: null,
      confidence: "PHONE_VERIFIED",
    };
  }

  if (extraOk) {
    return {
      identifier: extra,
      phone: extra,
      lid: null,
      confidence: "PHONE_VERIFIED",
    };
  }

  if (!raw) {
    return { identifier: "unknown", phone: null, lid: null, confidence: "UNKNOWN" };
  }
  return { identifier: raw, phone: null, lid: null, confidence: "UNKNOWN" };
}

export function mergeIdentity(
  existing: ResolvedIdentity,
  incoming: ResolvedIdentity
): ResolvedIdentity {
  const phone = incoming.phone ?? existing.phone;
  const lid = existing.lid ?? incoming.lid;
  let confidence = existing.confidence;
  if (incoming.phone) {
    confidence =
      incoming.confidence === "PHONE_VERIFIED" ? "PHONE_VERIFIED" : "LID_RESOLVED";
  }
  return {
    identifier: phone || existing.identifier,
    phone,
    lid,
    confidence,
  };
}
```

- [ ] **Step 4: Re-run identity tests — expect PASS**

Run: `npx tsx --test src/lib/conversations/identity.test.ts`

- [ ] **Step 5: Write failing parse + window tests**

`parse.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWahaEvent } from "./parse";

describe("parseWahaEvent", () => {
  it("reads nested payload.id.id and session", () => {
    const r = parseWahaEvent({
      event: "message",
      session: "toko-a",
      payload: {
        id: { id: "wamid.ABC" },
        from: "628123456789@c.us",
        fromMe: false,
        body: "halo",
        timestamp: 1776230616,
      },
    });
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.session, "toko-a");
    assert.equal(r.externalId, "wamid.ABC");
    assert.equal(r.peerRaw, "628123456789@c.us");
    assert.equal(r.fromMe, false);
    assert.equal(r.body, "halo");
    assert.equal(r.sentAt.toISOString(), "2026-04-15T04:03:36.000Z");
  });

  it("accepts type + string payload.id + _data.remote", () => {
    const r = parseWahaEvent({
      type: "message.any",
      session: "hq",
      payload: {
        id: "msgid-1",
        fromMe: true,
        body: "",
        timestamp: 1776230616,
        _data: { id: { remote: "111@lid" } },
      },
    });
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.event, "message.any");
    assert.equal(r.externalId, "msgid-1");
    assert.equal(r.peerRaw, "111@lid");
    assert.equal(r.fromMe, true);
    assert.equal(r.body, "");
  });

  it("returns error when session or id missing", () => {
    const r = parseWahaEvent({ event: "message", payload: {} });
    assert.ok("error" in r);
  });

  it("returns error for non-object", () => {
    const r = parseWahaEvent(null);
    assert.ok("error" in r);
  });
});
```

If timestamp `1776230616` is awkward, assert `r.sentAt.getTime() === 1776230616 * 1000` instead of ISO.

`window.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATION_GAP_MS,
  previewBody,
  shouldStartNewConversation,
} from "./window";

describe("shouldStartNewConversation", () => {
  const now = new Date("2026-08-15T10:00:00.000Z");

  it("starts when there is no prior message", () => {
    assert.equal(shouldStartNewConversation(null, now), true);
  });

  it("continues when gap is under 24h", () => {
    const last = new Date(now.getTime() - CONVERSATION_GAP_MS + 1000);
    assert.equal(shouldStartNewConversation(last, now), false);
  });

  it("starts when gap is 24h or more", () => {
    const last = new Date(now.getTime() - CONVERSATION_GAP_MS);
    assert.equal(shouldStartNewConversation(last, now), true);
  });
});

describe("previewBody", () => {
  it("truncates to 160 chars", () => {
    const s = "x".repeat(200);
    assert.equal(previewBody(s).length, 160);
  });
});
```

- [ ] **Step 6: Implement parse.ts and window.ts**

```ts
// parse.ts
export type ParsedWahaEvent = {
  event: string;
  session: string;
  externalId: string;
  fromMe: boolean;
  body: string;
  sentAt: Date;
  peerRaw: string;
  extraPhone: string | null;
  displayName: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function messageId(payload: Record<string, unknown>): string {
  const id = payload.id;
  if (typeof id === "string" && id) return id;
  const nested = asRecord(id);
  if (nested && typeof nested.id === "string" && nested.id) return nested.id;
  return "";
}

function peerRaw(payload: Record<string, unknown>): string {
  const from = str(payload.from);
  if (from) return from;
  const data = asRecord(payload._data);
  const dataId = data ? asRecord(data.id) : null;
  return dataId ? str(dataId.remote) : "";
}

function extraPhone(payload: Record<string, unknown>): string | null {
  const author = str(payload.author);
  if (/\d{8,}/.test(author) && !author.includes("@lid")) return author;
  return null;
}

export function parseWahaEvent(
  input: unknown
): ParsedWahaEvent | { error: string } {
  const root = asRecord(input);
  if (!root) return { error: "invalid_json" };
  const payload = asRecord(root.payload) ?? {};
  const event = str(root.event || root.type) || "message";
  const session = str(root.session);
  const externalId = messageId(payload);
  if (!session || !externalId) return { error: "missing_session_or_id" };
  const tsRaw = payload.timestamp;
  const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
  const sentAt = Number.isFinite(tsNum)
    ? new Date(tsNum > 1e12 ? tsNum : tsNum * 1000)
    : new Date();
  return {
    event,
    session,
    externalId,
    fromMe: Boolean(payload.fromMe),
    body: str(payload.body),
    sentAt,
    peerRaw: peerRaw(payload) || str(payload.to),
    extraPhone: extraPhone(payload),
    displayName: str(payload.pushName || payload.notifyName) || null,
  };
}
```

```ts
// window.ts
export const CONVERSATION_GAP_MS = 24 * 60 * 60 * 1000;

export function shouldStartNewConversation(
  lastMessageAt: Date | null,
  now: Date
): boolean {
  if (!lastMessageAt) return true;
  return now.getTime() - lastMessageAt.getTime() >= CONVERSATION_GAP_MS;
}

export function previewBody(body: string, max = 160): string {
  const t = (body || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max);
}
```

- [ ] **Step 7: Run all three test files — expect PASS**

Run: `npx tsx --test src/lib/conversations/identity.test.ts src/lib/conversations/parse.test.ts src/lib/conversations/window.test.ts`

- [ ] **Step 8: Add npm test script if missing, commit**

```bash
git add package.json src/lib/conversations/identity.ts src/lib/conversations/identity.test.ts src/lib/conversations/parse.ts src/lib/conversations/parse.test.ts src/lib/conversations/window.ts src/lib/conversations/window.test.ts
git commit -m "feat(conversations): add WAHA identity, parse, and 24h window helpers"
```

---

### Task 2: Prisma models

**Files:**
- Modify: `prisma/schema.prisma` — add models + relations on `Tenant` and `Location`
- Create: Prisma migration via `npx prisma migrate dev --name waha_conversations`

**Interfaces:**
- Consumes: none
- Produces: Prisma models `WaContact`, `WaConversation`, `WaMessage`

- [ ] **Step 1: Add models to schema.prisma**

On `Tenant` add:

```
waContacts      WaContact[]
waConversations WaConversation[]
```

On `Location` add:

```
waConversations WaConversation[]
```

Append:

```prisma
model WaContact {
  id                  String   @id @default(cuid())
  tenantId            String
  identifier          String
  displayName         String?
  identityConfidence  String
  phone               String?
  lid                 String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  tenant        Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations WaConversation[]

  @@unique([tenantId, identifier])
  @@index([tenantId, phone])
  @@index([tenantId, lid])
}

model WaConversation {
  id              String    @id @default(cuid())
  tenantId        String
  locationId      String
  contactId       String
  provider        String    @default("WAHA")
  sessionId       String
  status          String    @default("OPEN")
  firstMessageAt  DateTime
  lastMessageAt   DateTime
  lastInboundAt   DateTime?
  lastOutboundAt  DateTime?
  lastPreview     String    @default("")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tenant   Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  location Location    @relation(fields: [locationId], references: [id], onDelete: Cascade)
  contact  WaContact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  messages WaMessage[]

  @@index([tenantId, lastMessageAt])
  @@index([locationId, lastMessageAt])
  @@index([contactId, sessionId, status])
}

model WaMessage {
  id             String   @id @default(cuid())
  conversationId String
  externalId     String   @unique
  direction      String
  sentAt         DateTime
  body           String   @default("")
  fromMe         Boolean  @default(false)
  rawJson        String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  conversation WaConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, sentAt])
}
```

- [ ] **Step 2: Migrate + generate**

Run: `npx prisma migrate dev --name waha_conversations`

Expected: migration applied, client generated, no error.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(conversations): add WaContact WaConversation WaMessage tables"
```

---

### Task 3: Ingest (mapping, dedupe, 24h, kill switch)

**Files:**
- Create: `src/lib/conversations/waha-config.ts`
- Create: `src/lib/conversations/ingest.ts`
- Create: `src/lib/conversations/ingest.test.ts`

**Interfaces:**
- Consumes: `parseWahaEvent`, `resolveIdentity`, `mergeIdentity`, `shouldStartNewConversation`, `previewBody`, `prisma`, `resolveIntegrationValues`
- Produces:
  - `export type IngestResult = { ok: true; conversationId: string; duplicate?: boolean } | { ok: true; ignored: true | "unmapped_session" | "kill_switch" | "skipped_event" } | { ok: false; error: string }`
  - `export async function ingestWahaPayload(input: unknown): Promise<IngestResult>`
  - `export async function isWahaIngestEnabled(): Promise<boolean>`

- [ ] **Step 1: Write failing ingest tests** (use unique fixture prefix `cvtest-` and delete in `after`)

```ts
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { ingestWahaPayload } from "./ingest";

const PREFIX = `cvtest-${Date.now()}`;

describe("ingestWahaPayload", () => {
  let tenantId = "";
  let locationId = "";

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
  });

  after(async () => {
    await prisma.waMessage.deleteMany({
      where: { conversation: { sessionId: `${PREFIX}-sess` } },
    });
    await prisma.waConversation.deleteMany({ where: { sessionId: `${PREFIX}-sess` } });
    await prisma.waContact.deleteMany({ where: { tenantId } });
    await prisma.sourceMapping.deleteMany({ where: { locationId } });
    await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
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

  it("dedupes the same externalId", async () => {
    const a = await ingestWahaPayload(event());
    const b = await ingestWahaPayload(event());
    assert.equal(a.ok, true);
    assert.equal("duplicate" in b && b.duplicate, true);
    const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-m1` } });
    assert.equal(n, 1);
  });

  it("opens a new conversation after 24h", async () => {
    const old = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-old`,
        from: "628111111111@c.us",
        fromMe: false,
        body: "old",
        timestamp: Math.floor((Date.now() - 25 * 3600 * 1000) / 1000),
      },
    });
    const neu = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-new`,
        from: "628111111111@c.us",
        fromMe: false,
        body: "new",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    assert.equal(old.ok, true);
    assert.equal(neu.ok, true);
    if (!("conversationId" in old) || !("conversationId" in neu)) {
      assert.fail("expected conversation ids");
    }
    assert.notEqual(old.conversationId, neu.conversationId);
  });

  it("does not invent a phone from @lid", async () => {
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-lid`,
        from: "555@lid",
        fromMe: false,
        body: "x",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    const c = await prisma.waContact.findFirst({
      where: { tenantId, lid: "555" },
    });
    assert.ok(c);
    assert.equal(c!.phone, null);
    assert.equal(c!.identityConfidence, "OPAQUE_LID");
  });

  it("updates the same contact when a later event has a phone", async () => {
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-up1`,
        from: "777@lid",
        fromMe: false,
        body: "a",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-sess`,
      payload: {
        id: `${PREFIX}-up2`,
        from: "628222333444@c.us",
        fromMe: false,
        body: "b",
        timestamp: Math.floor(Date.now() / 1000),
        _data: { id: { remote: "777@lid" } },
      },
    });
    // Implementer: if the second event cannot link by lid, document lookup:
    // find by lid from peer or by phone. For this test, send extra lid via from=lid
    // first then a third event is not required if ingest also matches last OPEN
    // contact on session — do NOT do that. Lookup: phone, then lid.
    const byLid = await prisma.waContact.findFirst({
      where: { tenantId, lid: "777" },
    });
    assert.ok(byLid);
    assert.equal(byLid!.phone, "628222333444");
    assert.equal(byLid!.identityConfidence, "PHONE_VERIFIED");
  });

  it("ignores unmapped session", async () => {
    const r = await ingestWahaPayload({
      event: "message",
      session: `${PREFIX}-nope`,
      payload: {
        id: `${PREFIX}-unmap`,
        from: "628000000000@c.us",
        fromMe: false,
        body: "x",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
    assert.equal(r.ok, true);
    assert.equal("ignored" in r && r.ignored, "unmapped_session");
    const n = await prisma.waMessage.count({ where: { externalId: `${PREFIX}-unmap` } });
    assert.equal(n, 0);
  });
});
```

**Contact upgrade test (replace the weak “updates same contact” test with this exact event pair):**

First event `from: "777@lid"`. Second event `from: "628222333444@c.us"` AND `payload._data.id.remote = "777@lid"` so ingest can find the existing row by `lid`.

- [ ] **Step 2: Run ingest tests — expect FAIL (ingest missing)**

Run: `npx tsx --test src/lib/conversations/ingest.test.ts`

- [ ] **Step 3: Implement waha-config.ts + ingest.ts**

```ts
// waha-config.ts
import { resolveIntegrationValues } from "@/lib/integrations/service";

export async function isWahaIngestEnabled(): Promise<boolean> {
  const v = await resolveIntegrationValues("waha");
  if (!v.enabled) return false;
  if (v.mode === "OFF") return false;
  return true;
}

export async function getWahaWebhookKey(): Promise<string> {
  const v = await resolveIntegrationValues("waha");
  return (v.secrets.apiKey || "").trim();
}
```

```ts
// ingest.ts
import { prisma } from "@/lib/db";
import { mergeIdentity, resolveIdentity } from "./identity";
import { parseWahaEvent } from "./parse";
import { previewBody, shouldStartNewConversation } from "./window";
import { isWahaIngestEnabled } from "./waha-config";

export type IngestResult =
  | { ok: true; conversationId: string; duplicate?: boolean }
  | { ok: true; ignored: true | "unmapped_session" | "kill_switch" | "skipped_event" }
  | { ok: false; error: string };

export async function ingestWahaPayload(input: unknown): Promise<IngestResult> {
  if (!(await isWahaIngestEnabled())) {
    return { ok: true, ignored: "kill_switch" };
  }
  const parsed = parseWahaEvent(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const ev = parsed.event.toLowerCase();
  if (ev !== "message" && ev !== "message.any") {
    return { ok: true, ignored: "skipped_event" };
  }

  const existingMsg = await prisma.waMessage.findUnique({
    where: { externalId: parsed.externalId },
    select: { conversationId: true },
  });
  if (existingMsg) {
    return { ok: true, conversationId: existingMsg.conversationId, duplicate: true };
  }

  const mapping = await prisma.sourceMapping.findFirst({
    where: {
      sourceType: "WAHA",
      externalId: parsed.session,
      status: "ACTIVE",
    },
    include: { location: { select: { id: true, tenantId: true } } },
  });
  if (!mapping) return { ok: true, ignored: "unmapped_session" };

  const tenantId = mapping.location.tenantId;
  const locationId = mapping.location.id;
  const incoming = resolveIdentity(parsed.peerRaw, parsed.extraPhone);

  const found =
    (incoming.lid
      ? await prisma.waContact.findFirst({
          where: { tenantId, lid: incoming.lid },
        })
      : null) ||
    (incoming.phone
      ? await prisma.waContact.findFirst({
          where: { tenantId, phone: incoming.phone },
        })
      : null) ||
    (await prisma.waContact.findUnique({
      where: { tenantId_identifier: { tenantId, identifier: incoming.identifier } },
    }));

  const merged = found
    ? mergeIdentity(
        {
          identifier: found.identifier,
          phone: found.phone,
          lid: found.lid,
          confidence: found.identityConfidence as
            | "PHONE_VERIFIED"
            | "LID_RESOLVED"
            | "OPAQUE_LID"
            | "UNKNOWN",
        },
        incoming
      )
    : incoming;

  const contact = found
    ? await prisma.waContact.update({
        where: { id: found.id },
        data: {
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName || found.displayName,
        },
      })
    : await prisma.waContact.create({
        data: {
          tenantId,
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName,
        },
      });

  const open = await prisma.waConversation.findFirst({
    where: {
      contactId: contact.id,
      sessionId: parsed.session,
      locationId,
      status: "OPEN",
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const startNew = shouldStartNewConversation(open?.lastMessageAt ?? null, parsed.sentAt);
  const conversation =
    open && !startNew
      ? open
      : await prisma.waConversation.create({
          data: {
            tenantId,
            locationId,
            contactId: contact.id,
            provider: "WAHA",
            sessionId: parsed.session,
            status: "OPEN",
            firstMessageAt: parsed.sentAt,
            lastMessageAt: parsed.sentAt,
          },
        });

  const direction = parsed.fromMe ? "OUT" : "IN";
  const raw = JSON.stringify(input);
  await prisma.waMessage.create({
    data: {
      conversationId: conversation.id,
      externalId: parsed.externalId,
      direction,
      sentAt: parsed.sentAt,
      body: parsed.body,
      fromMe: parsed.fromMe,
      rawJson: raw.length > 4000 ? raw.slice(0, 4000) : raw,
    },
  });

  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: parsed.sentAt,
      lastPreview: previewBody(parsed.body),
      lastInboundAt: direction === "IN" ? parsed.sentAt : open?.lastInboundAt,
      lastOutboundAt: direction === "OUT" ? parsed.sentAt : open?.lastOutboundAt,
    },
  });

  return { ok: true, conversationId: conversation.id };
}
```

When creating a brand-new conversation, `open` is null — set `lastInboundAt` / `lastOutboundAt` from this message only (`direction === "IN" ? parsed.sentAt : null`).

- [ ] **Step 4: Run ingest tests — expect PASS**

Run: `npx tsx --test src/lib/conversations/ingest.test.ts`

Also add a test (same file) that sets `integrationConfig.mode = "OFF"` then ingest → `ignored: "kill_switch"` and zero new messages. Restore mode to `LIVE` in that test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversations/waha-config.ts src/lib/conversations/ingest.ts src/lib/conversations/ingest.test.ts
git commit -m "feat(conversations): ingest mapped WAHA messages with dedupe and 24h split"
```

---

### Task 4: Webhook route

**Files:**
- Create: `src/app/api/webhooks/waha/route.ts`
- Create: `src/lib/conversations/webhook-auth.ts`
- Create: `src/lib/conversations/webhook-auth.test.ts`

**Interfaces:**
- Consumes: `getWahaWebhookKey`, `ingestWahaPayload`
- Produces: `export function apiKeyMatches(provided: string | null, expected: string): boolean`

- [ ] **Step 1: Failing auth test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiKeyMatches } from "./webhook-auth";

describe("apiKeyMatches", () => {
  it("rejects empty expected or provided", () => {
    assert.equal(apiKeyMatches("abc", ""), false);
    assert.equal(apiKeyMatches(null, "abc"), false);
  });
  it("accepts exact match", () => {
    assert.equal(apiKeyMatches("secret", "secret"), true);
  });
  it("rejects mismatch", () => {
    assert.equal(apiKeyMatches("nope", "secret"), false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement webhook-auth.ts + route.ts**

```ts
import { timingSafeEqual } from "node:crypto";

export function apiKeyMatches(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

```ts
import { NextResponse } from "next/server";
import { ingestWahaPayload } from "@/lib/conversations/ingest";
import { getWahaWebhookKey } from "@/lib/conversations/waha-config";
import { apiKeyMatches } from "@/lib/conversations/webhook-auth";

export async function POST(request: Request) {
  const expected = await getWahaWebhookKey();
  const provided = request.headers.get("x-api-key");
  if (!apiKeyMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = await ingestWahaPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if ("ignored" in result) {
    if (result.ignored === "kill_switch" || result.ignored === true) {
      return NextResponse.json({ ignored: true });
    }
    return NextResponse.json({ ignored: result.ignored });
  }
  if (result.duplicate) {
    return NextResponse.json({ duplicate: true, conversationId: result.conversationId });
  }
  return NextResponse.json({ ok: true, conversationId: result.conversationId });
}
```

Confirm: `src/middleware.ts` matcher already skips `api`. No edit.

- [ ] **Step 4: Run auth tests PASS**

Run: `npx tsx --test src/lib/conversations/webhook-auth.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversations/webhook-auth.ts src/lib/conversations/webhook-auth.test.ts src/app/api/webhooks/waha/route.ts
git commit -m "feat(conversations): add public WAHA webhook with API key auth"
```

---

### Task 5: List/get service + audit

**Files:**
- Create: `src/lib/conversations/service.ts`
- Create: `src/lib/conversations/service.test.ts`

**Interfaces:**
- Consumes: prisma, `AuditEvent`
- Produces:
  - `export type ConversationListItem` (id, lastMessageAt ISO, contact `{ displayName, phone, lid, confidence }`, preview, location `{ id, name }`, direction: `"IN" | "OUT" | "UNREPLIED"`, sessionId)
  - `export async function listConversations(opts: { q?: string; filter?: "all" | "unreplied"; locationId?: string }): Promise<{ conversations: ConversationListItem[]; stats: { total: number; unreplied: number; open: number } }>`
  - `export async function getConversationThread(id: string, actorUserId: string): Promise<null | { conversation: ConversationListItem & { tenantId: string }; messages: Array<{ id: string; direction: string; body: string; sentAt: string; fromMe: boolean }> }>`

Unreplied predicate (also used in SQL where): `lastInboundAt != null AND (lastOutboundAt == null OR lastInboundAt > lastOutboundAt)`.

Direction hint: unreplied → `UNREPLIED`; else if `lastOutboundAt >= lastInboundAt` (or no inbound) → `OUT`; else `IN`.

- [ ] **Step 1: Write failing service test** using the same fixture style as ingest (or call `ingestWahaPayload` to seed one IN message). Assert list `stats.unreplied === 1`, `direction === "UNREPLIED"`, `contact.phone === "628123456789"`. Then `getConversationThread` writes `AuditEvent` with `action === "conversation.thread_opened"`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement service.ts**

`listConversations`: `findMany` where `status = OPEN`, optional `locationId`, `q` OR on `contact.phone`, `contact.lid`, `contact.displayName`, `contact.identifier`, `lastPreview`. Order `lastMessageAt desc`. `take: 200`. Agency sees all tenants (no extra filter) — matches Reviews agency path over all client locations. Include `location.name`, `contact`.

`getConversationThread`: find by id, include messages `orderBy: { sentAt: "asc" }`. If missing return null. Then `prisma.auditEvent.create({ data: { tenantId, actorId: actorUserId, action: "conversation.thread_opened", objectType: "WaConversation", objectId: id, metaJson: JSON.stringify({ conversationId: id }) } })`.

- [ ] **Step 4: Run service tests PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversations/service.ts src/lib/conversations/service.test.ts
git commit -m "feat(conversations): list and thread queries with open-thread audit"
```

---

### Task 6: Authenticated API routes

**Files:**
- Create: `src/app/api/conversations/route.ts`
- Create: `src/app/api/conversations/[id]/route.ts`

**Interfaces:**
- Consumes: `readSession`, `listConversations`, `getConversationThread`
- Produces: HTTP JSON as spec

- [ ] **Step 1: Implement GET list**

```ts
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listConversations } from "@/lib/conversations/service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const filter = url.searchParams.get("filter") === "unreplied" ? "unreplied" : "all";
  const locationId = url.searchParams.get("locationId") || undefined;
  const data = await listConversations({ q, filter, locationId });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Implement GET thread**

```ts
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getConversationThread } from "@/lib/conversations/service";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const data = await getConversationThread(id, session.userId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
```

No POST handlers.

- [ ] **Step 3: `npx tsc --noEmit` — expect exit 0**

- [ ] **Step 4: Commit**

```bash
git add src/app/api/conversations/route.ts src/app/api/conversations/[id]/route.ts
git commit -m "feat(conversations): add agency list and thread API routes"
```

---

### Task 7: Inbox UI + page + i18n

**Files:**
- Create: `src/components/conversations/ConversationsInbox.tsx`
- Modify: `src/app/(app)/conversations/page.tsx`
- Modify: `src/lib/i18n/messages.ts` — add `conversations` key on `Messages`, `en`, and `id`

**Interfaces:**
- Consumes: `GET /api/conversations`, `GET /api/conversations/:id`, `formatDateTime`, `Locale`, UI primitives from `@/components/ui` (`PageHeader`, `SearchField`, `TableShell`, `Toolbar`)
- Produces: agency inbox; client still `ModulePlaceholder`

- [ ] **Step 1: Add i18n keys**

On `Messages`:

```ts
conversations: {
  eyebrow: string;
  badge: string;
  title: string;
  description: string;
  unreplied: string;
  search: string;
  filterAll: string;
  filterUnreplied: string;
  allLocations: string;
  colLast: string;
  colContact: string;
  colPreview: string;
  colBranch: string;
  colDirection: string;
  view: string;
  emptyNoMap: string;
  emptyWait: string;
  accountResponder: string;
  agencyOnly: string;
  sourceHint: string;
};
```

EN:

```ts
conversations: {
  eyebrow: "Demand",
  badge: "WAHA live · monitor-only",
  title: "Conversations",
  description: "WhatsApp threads from mapped branch numbers. Monitor only — no send.",
  unreplied: "unreplied",
  search: "Search phone, lid, or text…",
  filterAll: "All",
  filterUnreplied: "Unreplied",
  allLocations: "All branches",
  colLast: "Last",
  colContact: "Contact",
  colPreview: "Preview",
  colBranch: "Branch",
  colDirection: "Dir",
  view: "View",
  emptyNoMap: "Map a WAHA session on Location 360 → Sources.",
  emptyWait: "Waiting for webhook messages.",
  accountResponder: "Account responder",
  agencyOnly: "Agency staff monitor WhatsApp conversations.",
  sourceHint: "Source: WAHA. Session must be mapped to a location. Phone shown when WhatsApp sent it; @lid is never turned into a fake number.",
},
```

ID: same keys, Indonesian copy (Percakapan, Hanya monitor, Belum dibalas, Cabang, Menunggu webhook, Map session WAHA di Location 360 → Sources).

- [ ] **Step 2: Build ConversationsInbox**

Client component. Props: `{ locale: Locale }`.

State: conversations, stats, locations (derive unique from rows + optional extra fetch not required in slice 1 — location filter uses ids present in the current unfiltered set **or** load locations that have WAHA mappings via the list without locationId then filter client-side). Prefer server filter: keep `locationId` query param.

Load: `GET /api/conversations?q=&filter=&locationId=` on change.

Table columns per spec. Contact: `contact.phone || contact.lid || contact.displayName`. Badge `contact.confidence`. Last: `formatDateTime(lastMessageAt, locale)`.

Slide-over on View: `GET /api/conversations/:id`, messages oldest-first, IN left (`justify-start` bubble slate), OUT right (indigo). If `fromMe`, footer `t.accountResponder`. No textarea.

Empty: if `stats.total === 0` and no `locationId`/`q`: show `emptyWait`. If the API also returns `mappingCount`, use it — **add** `mappingCount` to `listConversations` by `prisma.sourceMapping.count({ where: { sourceType: "WAHA", status: "ACTIVE" } })` and include in list JSON `stats.mappings`. Empty no map when `stats.mappings === 0`; else `emptyWait`.

Do this mapping count in `listConversations` during this task (one extra prisma count). Update `stats` type to `{ total, unreplied, open, mappings }`.

- [ ] **Step 3: Wire page.tsx**

```tsx
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { ConversationsInbox } from "@/components/conversations/ConversationsInbox";

export default async function ConversationsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale);

  if (!session.isAgencyStaff) {
    return (
      <ModulePlaceholder
        title={t.conversations.title}
        description={t.conversations.agencyOnly}
        fase="E3 · S9"
        bullets={[t.conversations.agencyOnly]}
      />
    );
  }

  return <ConversationsInbox locale={locale} />;
}
```

- [ ] **Step 4: `npx tsc --noEmit` and `npx tsx --test src/lib/conversations/*.test.ts`**

Expected: all pass, tsc exit 0.

- [ ] **Step 5: Manual check (dev server already on :3000)**

1. Log in `admin@p2plabs.local`.
2. Open `/conversations` — inbox, not placeholder.
3. Map a WAHA session on a location (Location 360 → Sources → WAHA, `externalId` = session name).
4. `curl -s -X POST http://localhost:3000/api/webhooks/waha -H 'content-type: application/json' -H "X-Api-Key: $KEY" -d '{"event":"message","session":"SESSION","payload":{"id":"manual-1","from":"628123456789@c.us","fromMe":false,"body":"tes","timestamp":1776230616}}'`
5. Refresh inbox: row shows `628123456789`, preview `tes`, View opens thread.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversations/ConversationsInbox.tsx src/app/\(app\)/conversations/page.tsx src/lib/i18n/messages.ts src/lib/conversations/service.ts
git commit -m "feat(conversations): agency monitor inbox for mapped WAHA threads"
```

---

## Spec coverage

| Spec item | Task |
|---|---|
| WAHA live webhook | 4 |
| Monitor-only | 6–7 (no POST/composer) |
| Preview + thread | 7 |
| Mapped sessions only | 3 |
| Agency vs client | 6–7 |
| `formatDateTime` | 7 |
| Phone first-class / no fake lid | 1, 3 |
| Later event upgrades phone | 1, 3 |
| 24h new conversation | 1, 3 |
| Dedupe externalId | 3 |
| Kill switch | 3, 4 |
| Unmapped 200 ignore | 3, 4 |
| Audit on open | 5 |
| Tests 1–5 + 3b | 1, 3 |

## Placeholder scan

None remaining. `mergeIdentity` final implementation is the short version in Task 1. Ingest contact upgrade uses lid lookup then phone lookup.

## Type consistency

`IngestResult`, `ParsedWahaEvent`, `ResolvedIdentity`, `ConversationListItem`, `stats.mappings` are named the same in Tasks 1, 3, 5, 6, 7.
