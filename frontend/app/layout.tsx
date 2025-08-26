import type { Metadata } from "next";
import { geistMono, geistSans } from "@/app/ui/assets/font";
import "./globals.css";
import { ThemeProvider } from "./ui/theme-wrapper";
import Header from "./ui/header";
import Footer from "./ui/footer";
import { Toaster } from "./ui/sonner";
import ContextProvider from "./ui/reown-provider";

export const metadata: Metadata = {
  title: "Helix - hICP Vault",
  description:
    "Helix Vault is a modular liquid staking and cross-chain restaking infrastructure on ICP. It allows users to stake hICP and mint hstICP on Ethereum, with trustless 1:1 redemption, on-chain governance, and shared ownership control.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistMono.variable} antialiased font-sans`}
      >
        <ContextProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex flex-col justify-center min-h-screen max-w-5xl mx-auto overflow-hidden">
              <Header />
              <main className="px-10 mt-32 mb-24 bg-zinc-50 dark:bg-[#01100c] ">
                {children}
              </main>
              <Footer />
              <Toaster />
            </div>
          </ThemeProvider>
        </ContextProvider>
      </body>
    </html>
  );
}
