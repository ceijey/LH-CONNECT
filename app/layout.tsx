import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LH-Connect - Unified Management and Information System for Automating Monthly Dues and Resident Financial Analytics",
  description: "A Unified Management and Information System for Automating Monthly Dues and Resident Financial Analytics",
  icons: {
    icon: "/lhhoa-logo.png",
    shortcut: "/lhhoa-logo.png",
    apple: "/lhhoa-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}