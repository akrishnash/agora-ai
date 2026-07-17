import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"]
});

export const metadata: Metadata = {
  title: "Agora AI – Interactive Reasoning Engine",
  description:
    "Agora AI convenes specialized expert panels to debate complex questions, map consensus in real-time, and produce structured decision briefs. Search engines organize information. Agora organizes reasoning.",
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
    <html lang="en">
      <body className={inter.variable} suppressHydrationWarning>{children}</body>
    </html>
  );
}
