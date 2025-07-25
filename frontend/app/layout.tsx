import type { Metadata } from "next";
import { geistMono, geistSans, fontMichroma } from "@/app/ui/assets/font";
import "./globals.css";
import { ThemeProvider } from "./ui/theme-wrapper";
import Header from "./ui/header";
import Footer from "./ui/footer";
import { ScrollArea } from "@/app/ui/scroll-area";
import { Toaster } from "./ui/sonner";
import ContextProvider from "./ui/reown-provider";

export const metadata: Metadata = {
  title: "EigenFi - ICP Vault",
  description:
    "The ICP Vault is a decentralized platform that allows users to store their ICP tokens in a secure and accessible manner. With the ICP Vault, users can easily transfer their ICP tokens to other users, enabling seamless and secure transactions.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistMono.variable} ${fontMichroma.variable} antialiased`}
      >
        <ContextProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex flex-col justify-center min-h-screen px-10">
              <Header />
              <ScrollArea className="flex flex-col justify-center h-[82svh] bg-zinc-100 dark:bg-[#01100c] mt-8 items-center rounded-2xl">
                {children}
              </ScrollArea>
              <Footer />

              <Toaster />
            </div>
          </ThemeProvider>
        </ContextProvider>
      </body>
    </html>
  );
}
