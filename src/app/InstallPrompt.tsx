"use client";

import { useEffect, useMemo, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;

  // iOS Safari
  const iosStandalone = (window.navigator as any).standalone === true;

  // Other browsers
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;

  return iosStandalone || displayModeStandalone;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const ios = useMemo(() => isIOS(), []);
  const standalone = useMemo(() => isInStandaloneMode(), []);

  // persist dismissal for a bit so it doesn't nag constantly
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pwa_install_prompt_dismissed_at");
      if (!raw) return;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return;

      // hide for 7 days
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - ts < sevenDays) setDismissed(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      // Chrome/Edge will fire this when install is available
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // hide if already installed or user dismissed
  if (standalone || dismissed) return null;

  // Show prompt if:
  // - Android/desktop: we have deferredPrompt
  // - iOS: show A2HS instructions (Safari only)
  const shouldShowAndroidDesktop = !!deferredPrompt;
  const shouldShowIOS = ios; // iOS doesn't have beforeinstallprompt

  if (!shouldShowAndroidDesktop && !shouldShowIOS) return null;

  const surface: React.CSSProperties = {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9999,
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(10,10,14,0.92)",
    color: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    maxWidth: 720,
    margin: "0 auto",
  };

  const row: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const smallBtn: React.CSSProperties = {
    ...btn,
    padding: "8px 10px",
    opacity: 0.9,
  };

  function dismiss() {
    try {
      localStorage.setItem("pwa_install_prompt_dismissed_at", String(Date.now()));
    } catch {}
    setDismissed(true);
  }

  async function installNow() {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    } finally {
      setDeferredPrompt(null);
      dismiss();
    }
  }

  return (
    <div style={surface}>
      <div style={row}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800 }}>Install D3</div>

          {shouldShowAndroidDesktop && (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Install the app for a faster, full-screen experience (works offline too).
            </div>
          )}

          {shouldShowIOS && !shouldShowAndroidDesktop && (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              To install on iPhone/iPad: tap <b>Share</b> → <b>Add to Home Screen</b>.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {shouldShowAndroidDesktop && (
            <button style={btn} onClick={installNow}>
              Install
            </button>
          )}

          <button style={smallBtn} onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}