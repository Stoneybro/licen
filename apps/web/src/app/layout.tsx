import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Provider } from "./provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = "LICEN";
const siteDescription =
  "LICEN is the licensing layer for AI training data, enabling enforceable usage terms and automated royalty settlement.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LICEN — Licensing Layer for AI Training Data",
    template: "%s | LICEN",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "LICEN",
    "AI data licensing",
    "dataset monetization",
    "0G ecosystem",
    "on-chain royalties",
    "training data rights",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName,
    title: "LICEN — Licensing Layer for AI Training Data",
    description: siteDescription,
    images: [
      {
        url: "/licen-image.png",
        alt: "LICEN social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LICEN — Licensing Layer for AI Training Data",
    description: siteDescription,
    images: ["/licen-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/licen.ico",
    shortcut: "/licen.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  );
}
