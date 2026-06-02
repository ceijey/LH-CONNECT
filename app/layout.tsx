import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

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
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}