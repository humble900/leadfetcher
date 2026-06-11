import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leads",
  description:
    "Browse, filter, and export your extracted leads. View verified emails, phone numbers, and business contacts in a searchable data table.",
  robots: { index: false, follow: false },
};

export default function LeadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
