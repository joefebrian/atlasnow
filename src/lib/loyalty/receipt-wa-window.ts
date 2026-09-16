import { zonedLocalMidnight } from "./rules";

/** Last Jakarta calendar day we send automatic receipt/stamp WA. After this, stamp still records, no outbound chat. */
export const RECEIPT_WA_REPLY_UNTIL = "2026-09-30";

export function receiptWaReplyAllowed(now = new Date(), timeZone = "Asia/Jakarta"): boolean {
  const cutoff = zonedLocalMidnight(2026, 10, 1, timeZone);
  return now.getTime() < cutoff.getTime();
}
