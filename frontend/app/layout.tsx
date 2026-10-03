import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "MFS Intelligence Command Center",
  description: "AI Hackathon 2026 Track 05 project foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}