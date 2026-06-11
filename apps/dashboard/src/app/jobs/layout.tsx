import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crawl Jobs",
  description:
    "Manage and monitor your web crawling jobs. View real-time extraction logs, configure target URLs, and track lead discovery progress.",
  robots: { index: false, follow: false },
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
