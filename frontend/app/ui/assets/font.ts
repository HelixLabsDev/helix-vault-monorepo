import { Geist, Geist_Mono, Michroma } from "next/font/google";

export const fontMichroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-michroma",
});

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
