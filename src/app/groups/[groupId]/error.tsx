"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: 16, color: "rgba(255,255,255,0.92)" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
        Something went wrong
      </div>

      <div style={{ opacity: 0.9, marginBottom: 12, whiteSpace: "pre-wrap" }}>
        {String(error?.message ?? error)}
      </div>

      <button
        onClick={() => reset()}
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.92)",
          borderRadius: 10,
          padding: "8px 10px",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}