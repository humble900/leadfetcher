import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usage & Quotas",
  description:
    "Monitor your workspace usage limits, crawl quotas, and subscription plan details. Track monthly page crawls and API consumption.",
  robots: { index: false, follow: false },
};

export default function UsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
