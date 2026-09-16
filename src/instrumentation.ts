export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { attachProcessErrorLog } = await import("@/lib/error-log-process");
  attachProcessErrorLog();
  if (process.env.NODE_ENV === "production") {
    const { startBirthdayH2Scheduler } = await import("@/lib/loyalty/birthday-wa");
    const { startSupportSilenceScheduler } = await import("@/lib/support/scheduler");
    const { startActivityPurgeScheduler } = await import("@/lib/activity-purge");
    startBirthdayH2Scheduler();
    startSupportSilenceScheduler();
    startActivityPurgeScheduler();
  }
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
) {
  const { logAppError } = await import("@/lib/error-log");
  const path = request.path || context.routePath || "unknown";
  if (path.includes("/api/settings/errors")) return;
  await logAppError({
    source: context.routeType === "route" ? "API" : "Halaman",
    title: `Error di ${request.method || "GET"} ${path}`,
    detail: [err?.message, err?.digest ? `digest: ${err.digest}` : "", err?.stack || ""]
      .filter(Boolean)
      .join("\n"),
  });
}
