import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://dashboard-production-95ec.up.railway.app";
const SITE_NAME = "LeadFetcher";
const SITE_TITLE = "LeadFetcher — AI-Powered Lead Extraction Platform";
const SITE_DESCRIPTION =
  "Extract verified emails, phone numbers, and business contacts from any website. LeadFetcher is the multi-tenant AI crawling platform built for sales teams, agencies, and growth marketers.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030303" },
    { media: "(prefers-color-scheme: light)", color: "#f97316" },
  ],
};

export const metadata: Metadata = {
  // — Core Meta —
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "lead extraction",
    "email scraper",
    "web crawler",
    "AI lead generation",
    "verified contacts",
    "email finder",
    "sales prospecting",
    "B2B leads",
    "web scraping platform",
    "contact discovery",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  // — Canonical & Alternate —
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },

  // — Robots —
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // — Icons & Manifest —
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",

  // — Open Graph (Facebook, LinkedIn, iMessage, Slack, Discord) —
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadFetcher — AI-Powered Lead Extraction Platform",
        type: "image/png",
      },
    ],
  },

  // — Twitter Card —
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@leadfetcher",
  },

  // — Other —
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

