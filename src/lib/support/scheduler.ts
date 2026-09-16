import { closeSilentThreads } from "./service";

const TICK_MS = 30_000;

export function startSupportSilenceScheduler() {
  const tick = () => {
    void closeSilentThreads().catch(() => undefined);
  };
  setInterval(tick, TICK_MS);
  setTimeout(tick, 20_000);
}
