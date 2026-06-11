import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your free LeadFetcher account. Start crawling websites, extracting verified emails, and building targeted lead lists in minutes.",
  openGraph: {
    title: "Create Your Free LeadFetcher Account",
    description:
      "Sign up and start extracting verified business contacts from any website. No credit card required.",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
