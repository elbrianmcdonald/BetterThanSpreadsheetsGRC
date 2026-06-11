import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

/**
 * Typography for the consulting-grade theme.
 * - Sans = Hanken Grotesk (body, headings, everything).
 * - Mono = IBM Plex Mono (eyebrows, IDs, codes, units, table micro-labels, dates).
 */
export const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});
