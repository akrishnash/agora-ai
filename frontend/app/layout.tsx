import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora AI",
  description: "An AI reasoning arena where expert agents debate complex questions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
