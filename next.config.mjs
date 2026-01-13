import withPWA from "@ducanh2912/next-pwa";

const nextConfig = {
  reactStrictMode: true,
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,

  // ✅ Prevent SW headaches during local dev (recommended)
  disable: process.env.NODE_ENV === "development",

  // Your app already has /~offline from next-pwa logs
  fallbacks: {
    document: "/~offline",
  },

  runtimeCaching: [
    /**
     * ✅ IMPORTANT: Don't cache Supabase calls (auth + database).
     * This prevents "stale auth" and weird offline failures.
     */
    {
      urlPattern: ({ url }) =>
        url.hostname.endsWith(".supabase.co") ||
        url.hostname.endsWith(".supabase.in"),
      handler: "NetworkOnly",
      options: {
        cacheName: "supabase-network-only",
      },
    },

    // Next.js static assets
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },

    // Next/image optimizer
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/_next/image"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-image",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },

    // ✅ App Router "flight" requests (?_rsc=...)
    {
      urlPattern: ({ url }) => url.searchParams.has("_rsc"),
      handler: "NetworkFirst",
      options: {
        cacheName: "next-rsc",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },

    // Documents (pages/navigation)
    {
      urlPattern: ({ request }) => request.destination === "document",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },

    // Favicon (optional, reduces console noise)
    {
      urlPattern: ({ url }) => url.pathname === "/favicon.ico",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "favicon",
        expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})(nextConfig);