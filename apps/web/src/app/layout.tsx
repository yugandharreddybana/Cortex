import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cortex.app"),
  title: {
    default: "Cortex — Your brain, perfectly indexed.",
    template: "%s | Cortex",
  },
  description:
    "Cortex is a context-aware research engine and Chrome extension that " +
    "captures, indexes, and resurfaces the knowledge you encounter online.",
  keywords: ["research", "knowledge management", "chrome extension", "AI", "productivity"],
  authors: [{ name: "Cortex" }],
  creator: "Cortex",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cortex.app",
    title: "Cortex — Your brain, perfectly indexed.",
    description: "The context-aware research engine.",
    siteName: "Cortex",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cortex",
    creator: "@cortexapp",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the nonce injected by middleware so Next.js stamps it onto
  // every <script> and <style> tag it emits for this request.
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Propagate nonce to any manually added scripts/styles here */}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}