"use client";

import { useEffect } from "react";

function report(title: string, detail?: string) {
  void fetch("/api/settings/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ source: "Browser", title, detail }),
  }).catch(() => {});
}

export function ErrorCatcher() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report(event.message || "Error di browser", event.error?.stack || event.filename);
    };
    const onReject = (event: PromiseRejectionEvent) => {
      const r = event.reason;
      report(
        "Promise gagal di browser",
        r instanceof Error ? r.stack || r.message : String(r)
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);

    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      try {
        const res = await orig(input, init);
        if (
          url.includes("/api/") &&
          !url.includes("/api/settings/errors") &&
          res.status >= 500
        ) {
          report(`API error ${res.status}`, `${init?.method || "GET"} ${url}`);
        }
        return res;
      } catch (err) {
        if (!String(url).includes("/api/settings/errors")) {
          report(
            "Gagal menghubungi server",
            `${init?.method || "GET"} ${url}\n${err instanceof Error ? err.message : String(err)}`
          );
        }
        throw err;
      }
    };

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      window.fetch = orig;
    };
  }, []);

  return null;
}
