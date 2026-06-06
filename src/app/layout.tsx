import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "./components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Latuns ERP",
  description: "Enterprise Resource Planning for Quotations, Finances & Inventory Management.",
  applicationName: "Latuns ERP",
  authors: [{ name: "Latuns Admin" }],
  generator: "Next.js",
  keywords: ["ERP", "Quotations", "Inventory", "Latuns"],
  referrer: "origin",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
