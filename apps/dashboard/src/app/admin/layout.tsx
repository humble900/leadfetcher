import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Settings",
  description:
    "Manage workspace configuration, team members, subscription plans, and platform administration settings.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
