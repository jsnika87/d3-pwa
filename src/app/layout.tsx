import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OfflineInit from "./OfflineInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "D3 Discipleship",
  description: "Discipleship groups + weekly readings with offline support.",
  manifest: "/manifest.json",

  // Optional but recommended for install behavior / previews
  applicationName: "D3 Discipleship",

  // If you have icons in /public, wire them here (recommended)
  // icons: {
  //   icon: [
  //     { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  //     { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  //   ],
  //   apple: [
  //     { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  //   ],
  // },

  appleWebApp: {
    capable: true,
    title: "D3 Discipleship",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <OfflineInit />
        {children}
      </body>
    </html>
  );
}