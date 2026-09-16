"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/settings/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        source: "Halaman",
        title: "Layar aplikasi error.",
        detail: [error.message, error.digest, error.stack].filter(Boolean).join("\n"),
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Ada yang error di halaman ini</h1>
      <p className="mt-2 text-sm text-slate-500">
        Sudah tercatat di Settings → Error log. Kirim ke Grok kalau perlu dibantu.
      </p>
      <button type="button" className="an-btn-primary mt-6" onClick={() => reset()}>
        Coba lagi
      </button>
    </div>
  );
}
