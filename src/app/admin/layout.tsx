import Link from "next/link";
import AdminGuard from "./AdminGuard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <Link href="/groups" style={{ textDecoration: "none" }}>
            <button style={btn}>← Back to Groups</button>
          </Link>

          <Link href="/admin" style={{ textDecoration: "none" }}>
            <button style={btn}>Dashboard</button>
          </Link>
          <Link href="/admin/users" style={{ textDecoration: "none" }}>
            <button style={btn}>Users</button>
          </Link>
          <Link href="/admin/groups" style={{ textDecoration: "none" }}>
            <button style={btn}>Groups</button>
          </Link>
          <Link href="/admin/invites" style={{ textDecoration: "none" }}>
            <button style={btn}>Invites</button>
          </Link>
          <Link href="/admin/messages" style={{ textDecoration: "none" }}>
            <button style={btn}>Messages</button>
          </Link>
        </div>

        {children}
      </div>
    </AdminGuard>
  );
}

const btn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.92)",
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
};