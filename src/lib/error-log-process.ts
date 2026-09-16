import { logAppError } from "@/lib/error-log";

export function attachProcessErrorLog() {
  process.on("uncaughtException", (err) => {
    void logAppError({
      source: "Server",
      title: "Aplikasi sempat crash (uncaught exception).",
      detail: err?.stack || String(err),
    });
  });

  process.on("unhandledRejection", (reason) => {
    const detail =
      reason instanceof Error ? reason.stack || reason.message : String(reason);
    void logAppError({
      source: "Server",
      title: "Proses server gagal (unhandled promise).",
      detail,
    });
  });
}
