/**
 * Persistence ports for conversational commerce.
 * In-memory adapters live in memory-store.ts. No database adapter is authorized.
 */

import type { Actor } from "./auth";
import type { PaymentEffect, PaymentLedger, VerifiedPaymentEvent } from "./payment";
import type { ApprovalEvidence, MerchantEligibility, OfferingCategory } from "./policy";
import type {
  AttributionChannel,
  AttributionConfidence,
  AttributionTouchpoint,
  Booking,
  BookingProviderMode,
  BookingState,
  CommerceIntent,
  CommerceTransaction,
  CustomerExperience,
  EvidenceLevel,
  IntentType,
  PaymentProviderMode,
  PaymentState,
  TransactionEvent,
  TransactionState,
} from "./types";

export const PORT_CODES = [
  "NOT_FOUND",
  "CROSS_TENANT",
  "LOCATION_FORBIDDEN",
  "FORBIDDEN",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "DUPLICATE",
  "SLOT_CONFLICT",
  "REFERENCE_CONFLICT",
  "ATTEMPT_CONFLICT",
  "SCOPE_MISMATCH",
  "RECONCILIATION_REQUIRED",
  "POLICY_DENIED",
  "POLICY_UNSET",
  "TERMINAL",
  "INVALID",
  "SECRET_REJECTED",
  "UNUSABLE_CONNECTION",
  "MISMATCH",
] as const;
export type PortCode = (typeof PORT_CODES)[number];

export type PortFailure = { ok: false; code: PortCode; message: string };
export type PortSuccess<T> = { ok: true; replay: boolean; value: T };
export type PortResult<T> = PortSuccess<T> | PortFailure;

export type HoldExpiryOwner = "PROVIDER" | "NATIVE_POLICY" | "NONE";
export type ConnectionKind = "BOOKING" | "PAYMENT";
export type ConnectionStatus = "ACTIVE" | "DISABLED" | "REVOKED";
export type ConnectionHealth = "UNKNOWN" | "HEALTHY" | "DEGRADED" | "UNREACHABLE";
export type CredentialPurpose = "API" | "WEBHOOK";
export type CredentialStatus = "ACTIVE" | "ROTATING" | "REVOKED";
export type IdempotencyScope = "RESERVE" | "PAYMENT";
export type IdempotencyStatus = "IN_PROGRESS" | "COMPLETED" | "PENDING_RESOLUTION";
export type WebhookStatus = "RECEIVED" | "APPLIED" | "REJECTED";
export type ExternalOwner = "BOOKING" | "PAYMENT" | "CHECKOUT";

/** Provider-specific rule for when an empty lookup may allow another create. Null means never. */
export type ConnectionCapabilities = {
  providerId: string;
  supportsHold: boolean;
  /** Mock providers are the only usable connections in this milestone. */
  mock: boolean;
  guaranteesIdempotency: boolean;
  absenceConsistencyRequirement: string | null;
  holdExpiryOwner: HoldExpiryOwner;
  /** True only when this connection's provider may issue the booking reference. */
  issuesAuthoritativeReference: boolean;
};

export type StoredIntent = CommerceIntent & { version: number };

export type StoredTransaction = CommerceTransaction & { version: number };

export type StoredBooking = Booking & {
  version: number;
  holdExpiresAt: string | null;
  holdExpiryOwner: HoldExpiryOwner;
  nativeExpiryPolicyId: string | null;
  pendingSlotKey: string | null;
};

export type StoredConnection = {
  connectionId: string;
  tenantId: string;
  locationId: string | null;
  providerId: string;
  kind: ConnectionKind;
  mode: BookingProviderMode | PaymentProviderMode;
  capabilities: ConnectionCapabilities;
  status: ConnectionStatus;
  health: ConnectionHealth;
  lastCheckedAt: string | null;
  credentialRef: string | null;
  webhookSecretRef: string | null;
  version: number;
};

/** Reference only. The secret bytes are not a field on this record. */
export type StoredCredential = {
  credentialRef: string;
  tenantId: string;
  connectionId: string;
  purpose: CredentialPurpose;
  keyVersion: number;
  status: CredentialStatus;
  rotatedFromRef: string | null;
  revokedAt: string | null;
};

export type StoredExternalRef = {
  tenantId: string;
  locationId: string | null;
  owner: ExternalOwner;
  ownerRef: string;
  providerId: string;
  externalId: string;
};

export type StoredAttempt = {
  attemptRef: string;
  tenantId: string;
  locationId: string | null;
  transactionRef: string;
  providerId: string;
  providerMode: PaymentProviderMode;
  expectedAmountIdr: number;
  currency: "IDR";
  version: number;
};

export type StoredLedger = {
  tenantId: string;
  attemptRef: string;
  providerId: string;
  transactionRef: string;
  version: number;
  ledger: PaymentLedger;
};

export type StoredLedgerEvent = {
  tenantId: string;
  attemptRef: string;
  eventId: string;
  type: string;
  amountIdr: number;
  providerReference: string;
  occurredAt: string;
  sequence: number | null;
};

export type StoredIdempotency = {
  tenantId: string;
  scope: IdempotencyScope;
  idempotencyKey: string;
  requestHash: string;
  status: IdempotencyStatus;
  transactionRef: string | null;
  version: number;
};

export type StoredInflight = {
  tenantId: string;
  locationId: string;
  providerId: string;
  idempotencyKey: string;
  requestHash: string;
  slotKey: string;
  transactionRef: string;
  absenceVerified: boolean;
  version: number;
};

export type StoredWebhook = {
  /** `connectionId:eventId`. Not global across merchants that share a vendor. */
  dedupeKey: string;
  connectionId: string;
  providerId: string;
  eventId: string;
  tenantId: string;
  eventType: string;
  status: WebhookStatus;
  version: number;
};

export type StoredEvent = TransactionEvent & { version: number };

export type StoredTouchpoint = AttributionTouchpoint & {
  touchpointId: string;
  intentRef: string | null;
  bookingRef: string | null;
  attemptRef: string | null;
  erasedAt: string | null;
  erasureReason: string | null;
  version: number;
};

/** Channel totals. No transaction, booking, or customer key. */
export type StoredAggregate = {
  aggregateId: string;
  tenantId: string;
  locationId: string | null;
  channel: "GOOGLE_SEARCH" | "GOOGLE_MAPS";
  count: number;
  version: number;
};

export type PolicyScope = {
  offeringCategory: OfferingCategory;
  experience: CustomerExperience;
};

/** One approval covers one merchant, one offering category, and one commerce surface. */
export type StoredPolicyEvidence = {
  tenantId: string;
  offeringCategory: OfferingCategory;
  experience: CustomerExperience;
  source: "META_COMMERCE_POLICY";
  status: "VERIFIED" | "UNVERIFIED";
  reference: string;
  /** Set only when an authorized process attestation matched. A caller enum leaves this null. */
  validatedBy: string | null;
  version: number;
};

export type PersistenceSnapshot = {
  version: 1;
  intents: StoredIntent[];
  transactions: StoredTransaction[];
  bookings: StoredBooking[];
  connections: StoredConnection[];
  credentials: StoredCredential[];
  externalRefs: StoredExternalRef[];
  attempts: StoredAttempt[];
  ledgers: StoredLedger[];
  ledgerEvents: StoredLedgerEvent[];
  idempotency: StoredIdempotency[];
  inflight: StoredInflight[];
  webhooks: StoredWebhook[];
  events: StoredEvent[];
  touchpoints: StoredTouchpoint[];
  aggregates: StoredAggregate[];
  policyEvidence: StoredPolicyEvidence[];
};

export type EvidenceSubmission =
  | { kind: "CALLER_ENUM"; status: "VERIFIED" | "UNVERIFIED"; reference: string }
  | {
      kind: "AUTHORIZED_PROCESS";
      processId: string;
      reference: string;
      outcome: "VERIFIED" | "UNVERIFIED";
      attestation: string;
    };

export type AbsenceClaim = {
  providerId: string;
  locationId: string;
  requirementId: string;
  satisfied: boolean;
  observedEmpty: boolean;
};

export type ReservationDraft = {
  actor: Actor;
  tenantId: string;
  locationId: string;
  providerId: string;
  offeringId: string;
  startsAt: string;
  idempotencyKey: string;
  requestHash: string;
  experience: CustomerExperience;
  category: OfferingCategory;
  merchantEligibility: MerchantEligibility;
  intentRef: string | null;
  bookingRef: string;
  transactionRef: string;
  providerMode: BookingProviderMode;
  providerReference: string | null;
  referenceAuthoritative: boolean;
  holdExpiresAt: string | null;
  nativeExpiryPolicyId: string | null;
  availabilityFreshUntil: string | null;
  nowIso: string;
  /** Ignored. Transactional approval is the stored evidence row. */
  callerEvidence?: ApprovalEvidence;
};

export type ConcurrentConflict = { code: PortCode; key: string };

export interface IntentRepository {
  save(actor: Actor, intent: CommerceIntent): PortResult<StoredIntent>;
  read(actor: Actor, tenantId: string, intentRef: string): PortResult<StoredIntent>;
}

export interface TransactionRepository {
  read(actor: Actor, tenantId: string, transactionRef: string): PortResult<StoredTransaction>;
  compareAndSwap(
    actor: Actor,
    input: { tenantId: string; transactionRef: string; expectedVersion: number; state?: TransactionState },
  ): PortResult<StoredTransaction>;
}

export interface BookingRepository {
  read(actor: Actor, tenantId: string, bookingRef: string): PortResult<StoredBooking>;
  list(actor: Actor, tenantId: string, locationId: string | null): PortResult<StoredBooking[]>;
  openReservation(draft: ReservationDraft): PortResult<{ transaction: StoredTransaction; booking: StoredBooking }>;
  transition(
    actor: Actor,
    input: { tenantId: string; bookingRef: string; expectedVersion: number; to: BookingState; nowIso: string },
  ): PortResult<StoredBooking>;
  requestReschedule(
    actor: Actor,
    input: { tenantId: string; bookingRef: string; expectedVersion: number; nextSlotKey: string },
  ): PortResult<StoredBooking>;
  commitReschedule(
    actor: Actor,
    input: { tenantId: string; bookingRef: string; expectedVersion: number },
  ): PortResult<StoredBooking>;
  expireDue(actor: Actor, tenantId: string, locationId: string, nowIso: string): PortResult<{ expired: number; leftUnset: number }>;
  findByExternalRef(actor: Actor, tenantId: string, providerId: string, externalId: string): PortResult<StoredBooking>;
}

export interface ConnectionRepository {
  register(
    actor: Actor,
    input: {
      tenantId: string;
      locationId: string | null;
      providerId: string;
      kind: ConnectionKind;
      mode: BookingProviderMode | PaymentProviderMode;
      capabilities: ConnectionCapabilities;
    },
  ): PortResult<StoredConnection>;
  resolve(actor: Actor, tenantId: string, locationId: string | null, providerId: string, kind: ConnectionKind): PortResult<StoredConnection>;
  registerCredential(
    actor: Actor,
    input: {
      tenantId: string;
      connectionId: string;
      purpose: CredentialPurpose;
      credentialRef: string;
      plaintext?: string;
      ciphertext?: string;
    },
  ): PortResult<StoredCredential>;
  rotateCredential(
    actor: Actor,
    input: { tenantId: string; connectionId: string; purpose: CredentialPurpose; credentialRef: string; plaintext?: string },
  ): PortResult<StoredCredential>;
  revokeCredential(actor: Actor, tenantId: string, credentialRef: string, revokedAt: string): PortResult<StoredCredential>;
  reportHealth(
    actor: Actor,
    input: { tenantId: string; connectionId: string; expectedVersion: number; health: ConnectionHealth; at: string },
  ): PortResult<StoredConnection>;
}

export interface PaymentRepository {
  openAttempt(
    actor: Actor,
    input: {
      tenantId: string;
      locationId: string | null;
      transactionRef: string;
      attemptRef: string;
      providerId: string;
      providerMode: PaymentProviderMode;
      expectedAmountIdr: number;
    },
  ): PortResult<StoredAttempt>;
  applyEvent(actor: Actor, event: VerifiedPaymentEvent): PortResult<{ ledger: PaymentLedger; effect: PaymentEffect; netRevenueIdr: number }>;
  reconcileTerminal(
    actor: Actor,
    input: {
      tenantId: string;
      attemptRef: string;
      to: "EXPIRED" | "FAILED";
      providerId: string;
      requirementId: string;
      satisfied: boolean;
      authoritativeRead: boolean;
    },
  ): PortResult<{ ledger: PaymentLedger; netRevenueIdr: number }>;
  net(actor: Actor, tenantId: string, transactionRef: string): PortResult<{ status: PaymentState; verifiedPaid: boolean; netRevenueIdr: number; refundedIdr: number; chargebackIdr: number }>;
}

export interface IdempotencyRepository {
  read(actor: Actor, tenantId: string, scope: IdempotencyScope, idempotencyKey: string): PortResult<StoredIdempotency>;
  recordTimeout(
    actor: Actor,
    input: {
      tenantId: string;
      locationId: string;
      providerId: string;
      idempotencyKey: string;
      requestHash: string;
      slotKey: string;
      transactionRef: string;
    },
  ): PortResult<StoredInflight>;
  noteAbsence(actor: Actor, tenantId: string, idempotencyKey: string, claim: AbsenceClaim): PortResult<StoredInflight>;
}

export interface WebhookRepository {
  accept(
    actor: Actor,
    input: { tenantId: string; connectionId: string; eventId: string; eventType: string },
  ): PortResult<StoredWebhook>;
  markApplied(actor: Actor, tenantId: string, dedupeKey: string): PortResult<StoredWebhook>;
}

export interface EventRepository {
  append(actor: Actor, event: TransactionEvent): PortResult<StoredEvent>;
  list(actor: Actor, tenantId: string, transactionRef: string): PortResult<StoredEvent[]>;
}

export interface AttributionRepository {
  saveTouchpoint(
    actor: Actor,
    input: {
      tenantId: string;
      locationId: string | null;
      transactionRef: string | null;
      intentRef: string | null;
      bookingRef: string | null;
      attemptRef: string | null;
      ctwaClid?: string | null;
      gclid?: string | null;
      gbraid?: string | null;
      wbraid?: string | null;
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      qrCampaignId?: string | null;
      directWhatsApp?: boolean;
      gscClicks?: number | null;
      gbpViews?: number | null;
    },
  ): PortResult<StoredTouchpoint>;
  saveAggregate(
    actor: Actor,
    input: { tenantId: string; locationId: string | null; channel: "GOOGLE_SEARCH" | "GOOGLE_MAPS"; count: number },
  ): PortResult<StoredAggregate>;
  eraseIdentifiers(actor: Actor, tenantId: string, touchpointId: string, reason: string, erasedAt: string): PortResult<StoredTouchpoint>;
  readClass(
    actor: Actor,
    tenantId: string,
    transactionRef: string,
  ): PortResult<{ level: EvidenceLevel; countsAsRevenue: boolean; channel: AttributionChannel | null; confidence: AttributionConfidence | null }>;
}

export interface PolicyRepository {
  submit(actor: Actor, tenantId: string, scope: PolicyScope, submission: EvidenceSubmission): PortResult<StoredPolicyEvidence>;
  read(actor: Actor, tenantId: string, scope: PolicyScope): PortResult<StoredPolicyEvidence>;
}

export interface CommercePersistence {
  intents: IntentRepository;
  transactions: TransactionRepository;
  bookings: BookingRepository;
  connections: ConnectionRepository;
  payments: PaymentRepository;
  idempotency: IdempotencyRepository;
  webhooks: WebhookRepository;
  events: EventRepository;
  attribution: AttributionRepository;
  policy: PolicyRepository;
  runAtomic<T>(work: (ports: CommercePersistence) => PortResult<T>): PortResult<T>;
  exportSnapshot(): PersistenceSnapshot;
}
