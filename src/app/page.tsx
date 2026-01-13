import { redirect } from "next/navigation";

// Force dynamic so Vercel never serves a stale static home page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  redirect("/login");
}