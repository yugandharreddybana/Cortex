import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

// ─── Inter variable font — full weight + optical-size axes ───────────────────
const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
  display:  "swap",
  axes:     ["opsz"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL("https://cortex.app"),
  title: {
    default:  "Cortex — Your brain, perfectly indexed.",
    template: "%s | Cortex",
  },
  description:
    "Cortex is a context-aware research engine and Chrome extension that " +
    "captures, indexes, and resurfaces the knowledge you encounter online.",
  keywords: ["research", "knowledge management", "chrome extension", "AI", "productivity"],
  authors:  [{ name: "Cortex" }],
  creator:  "Cortex",
  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         "https://cortex.app",
    title:       "Cortex — Your brain, perfectly indexed.",
    description: "The context-aware research engine.",
    siteName:    "Cortex",
  },
  twitter: {
    card:    "summary_large_image",
    title:   "Cortex",
    creator: "@cortexapp",
  },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor:   "#0A0A0A",
  colorScheme:  "dark",
  width:        "device-width",
  initialScale: 1,
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-bg text-primary antialiased overflow-x-hidden font-sans"
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
