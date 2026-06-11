import "@/styles/globals.css";

import { type Metadata } from "next";

import { sans, mono } from "./fonts";
import { TRPCReactProvider } from "@/trpc/react";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ToasterProvider } from "@/components/ToasterProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "BetterThanSpreadsheetsGRC",
  description: "Modern GRC platform for compliance, risk management, and audit workflows",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
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
