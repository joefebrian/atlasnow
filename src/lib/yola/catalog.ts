/** YOLA FUN Gandaria City presale. Server-owned. Client prices are ignored. */

export const PRODUCT = {
  id: "kartu-presale-2x",
  venue: "YOLA FUN Gandaria City",
  name: "Kartu Presale 2× Masuk",
  priceIdr: 499_000,
  currency: "IDR",
  presaleEndsAt: "2026-11-23T23:59:00+07:00",
  visitsBegin: "2026-11-24",
  lastValidity: "2027-03-23",
  entries: 2,
} as const;

export const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00"] as const;

export const DEMO_TICKET_PHRASE = "DEMO TICKET — NOT VALID FOR REAL ENTRY";

export function visitDateOk(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= PRODUCT.visitsBegin && value <= PRODUCT.lastValidity;
}

export function presaleOpen(now: Date) {
  return now.getTime() <= new Date(PRODUCT.presaleEndsAt).getTime();
}
