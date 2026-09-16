import { merchantGoError } from "@/lib/tiktok-go/fulfill";
import type { GoQueryResult } from "@/lib/tiktok-go/fulfill";

/** Sample till payloads. Never sent to TikTok. */
export type GoDemoKind = "ok" | "wrong" | "used" | "time";

const DEMOS: Record<
  GoDemoKind,
  { payload: string; title: string; detail: string; shopOrderId: string; codes: string[] }
> = {
  ok: {
    payload: "TT-DEMO-OK",
    title: "Ngopi berdua",
    detail: "Valid today · 10:00–21:00 · this outlet may redeem.",
    shopOrderId: "demo-order-ok",
    codes: ["DEMO-OK-1"],
  },
  wrong: {
    payload: "TT-DEMO-WRONG",
    title: "Ngopi berdua",
    detail: "This voucher is not for this outlet.",
    shopOrderId: "demo-order-wrong",
    codes: ["DEMO-WRONG-1"],
  },
  used: {
    payload: "TT-DEMO-USED",
    title: "Ngopi berdua",
    detail: "This voucher was already used or refunded.",
    shopOrderId: "demo-order-used",
    codes: ["DEMO-USED-1"],
  },
  time: {
    payload: "TT-DEMO-TIME",
    title: "Lunch set",
    detail: "This voucher is outside its valid time.",
    shopOrderId: "demo-order-time",
    codes: ["DEMO-TIME-1"],
  },
};

export function isGoDemoPayload(raw: string): boolean {
  return /^TT-DEMO-/i.test((raw || "").trim());
}

export function parseGoDemoKind(raw: string): GoDemoKind | null {
  const s = (raw || "").trim().toUpperCase();
  if (s === "TT-DEMO-OK") return "ok";
  if (s === "TT-DEMO-WRONG") return "wrong";
  if (s === "TT-DEMO-USED") return "used";
  if (s === "TT-DEMO-TIME") return "time";
  return null;
}

export function demoCodeHint(raw: string): string {
  const kind = parseGoDemoKind(raw);
  return kind ? DEMOS[kind].payload : "TT-DEMO";
}

export function queryGoDemo(raw: string): GoQueryResult {
  const kind = parseGoDemoKind(raw);
  if (!kind) {
    throw new Error(merchantGoError("-3000110", "Cannot read this TikTok QR."));
  }
  if (kind === "wrong") throw new Error(merchantGoError("-3000111", "x"));
  if (kind === "used") throw new Error(merchantGoError("-3000100", "x"));
  if (kind === "time") throw new Error(merchantGoError("-3000108", "x"));
  const d = DEMOS.ok;
  return {
    shopOrderId: d.shopOrderId,
    codes: d.codes,
    title: d.title,
    detail: d.detail,
  };
}

export const GO_DEMO_CHIPS: { kind: GoDemoKind; payload: string; label: string; labelId: string }[] = [
  { kind: "ok", payload: DEMOS.ok.payload, label: "Valid voucher", labelId: "QR valid" },
  { kind: "wrong", payload: DEMOS.wrong.payload, label: "Wrong outlet", labelId: "Salah cabang" },
  { kind: "used", payload: DEMOS.used.payload, label: "Already used", labelId: "Sudah dipakai" },
  { kind: "time", payload: DEMOS.time.payload, label: "Outside hours", labelId: "Di luar jam" },
];
