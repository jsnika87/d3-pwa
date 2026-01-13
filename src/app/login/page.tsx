"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  async function signInWithMagicLink() {
    setStatus("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setStatus(error.message);
    else setStatus("Check your email for the sign-in link.");
  }

  async function signInWithGoogle() {
    setStatus("Redirecting to Google...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setStatus(error.message);
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>D3 Discipleship</h1>

      <div style={{ marginTop: 16 }}>
        <button onClick={signInWithGoogle} style={{ width: "100%", padding: 12 }}>
          Continue with Google
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <label>Email (magic link)</label>
      <input
        style={{ width: "100%", padding: 10, marginTop: 6 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        type="email"
      />

      <button
        onClick={signInWithMagicLink}
        style={{ width: "100%", padding: 12, marginTop: 12 }}
        disabled={!email}
      >
        Email me a sign-in link
      </button>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}