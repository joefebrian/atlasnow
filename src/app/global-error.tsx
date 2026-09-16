"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 18 }}>Aplikasi error</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          {error.message || "Unknown error"}
        </p>
        <button type="button" onClick={() => reset()} style={{ marginTop: 16 }}>
          Reload
        </button>
      </body>
    </html>
  );
}
