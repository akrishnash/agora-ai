import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agora AI – Interactive Reasoning Engine",
  description:
    "Agora AI convenes specialized expert panels to debate complex questions, map the argument graph in real-time, and produce structured decision briefs. Search engines organize information. Agora organizes reasoning.",
  keywords: ["AI debate", "multi-agent reasoning", "argument mapping", "OpenAI", "decision intelligence"],
  openGraph: {
    title: "Agora AI – Interactive Reasoning Engine",
    description: "Multi-agent expert debate platform powered by OpenAI.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
