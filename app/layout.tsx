import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en" className={`font-sans ${geist.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}