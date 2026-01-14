import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OfflineInit from "./OfflineInit";
import InstallPrompt from "@/components/InstallPrompt";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "D3 Discipleship",
  description: "D3 Discipleship PWA",
  manifest: "/manifest.json",
  themeColor: "#0b0b0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <OfflineInit />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}