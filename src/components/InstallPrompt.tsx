"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone
  // others use display-mode
  // @ts-ignore
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const show = useMemo(() => {
    if (dismissed) return false;
    if (isStandalone()) return false;
    // iOS: no beforeinstallprompt, show instructions
    if (isIOS()) return true;
    // others: only show if browser gave us the event
    return !!deferred;
  }, [deferred, dismissed]);

  useEffect(() => {
    function onBIP(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 50,
        borderRadius: 12,
        padding: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(20,20,28,0.92)",
        color: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Install D3 as an App</div>

      {isIOS() ? (
        <div style={{ opacity: 0.9, fontSize: 13, lineHeight: 1.4 }}>
          On iPhone/iPad: tap <b>Share</b> → <b>Add to Home Screen</b>.
        </div>
      ) : (
        <div style={{ opacity: 0.9, fontSize: 13, lineHeight: 1.4 }}>
          Install for faster loading + offline access.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        {!isIOS() && (
          <button
            onClick={async () => {
              if (!deferred) return;
              await deferred.prompt();
              const choice = await deferred.userChoice;
              if (choice.outcome !== "accepted") setDismissed(true);
              setDeferred(null);
            }}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
            }}
          >
            Install
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "rgba(255,255,255,0.85)",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}