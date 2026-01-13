"use client";

import { useEffect } from "react";
import { initOfflineDb } from "@/lib/offlineQueue";

export default function OfflineInit() {
  useEffect(() => {
    // ensures d3_offline exists as soon as the app loads
    initOfflineDb().catch(console.error);
  }, []);

  return null;
}