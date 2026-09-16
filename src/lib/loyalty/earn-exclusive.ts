/** Stamp, points, and top spender are exclusive on Save. Birthday is independent. */

export const EARN_EXCLUSIVE_ERROR_EN =
  "Pick only one earn program: stamp, points, or top spender. Birthday can stay on.";

export const EARN_EXCLUSIVE_ERROR_ID =
  "Pilih satu program dari struk: stamp, poin, atau pelanggan teratas. Ultah boleh tetap nyala.";

export class EarnExclusiveError extends Error {
  readonly code = "earn_exclusive" as const;
  constructor(message: string = EARN_EXCLUSIVE_ERROR_EN) {
    super(message);
    this.name = "EarnExclusiveError";
  }
}

export type EarnFlags = {
  stampEnabled?: boolean | null;
  pointEnabled?: boolean | null;
  spenderEnabled?: boolean | null;
};

export function countEarnPrograms(flags: EarnFlags): number {
  return [flags.stampEnabled, flags.pointEnabled, flags.spenderEnabled].filter(Boolean).length;
}

export function assertEarnExclusive(flags: EarnFlags): void {
  if (countEarnPrograms(flags) > 1) throw new EarnExclusiveError();
}

export function earnExclusiveMessage(locale: "en" | "id"): string {
  return locale === "id" ? EARN_EXCLUSIVE_ERROR_ID : EARN_EXCLUSIVE_ERROR_EN;
}
