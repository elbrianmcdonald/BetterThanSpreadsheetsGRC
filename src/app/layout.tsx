import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ToasterProvider } from "@/components/ToasterProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "BetterThanSpreadsheetsGRC",
  description: "Modern GRC platform for compliance, risk management, and audit workflows",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <NextAuthProvider>
          <TRPCReactProvider>
            {children}
            <ToasterProvider />
            <Toaster />
          </TRPCReactProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
