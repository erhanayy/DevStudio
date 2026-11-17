import type { Metadata } from "next";
import "./globals.css";
import { TranslationProvider } from "@/lib/i18n/context";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DevStudio - Pocket AI Staff Engineer",
  description: "Develop, test, and deploy your software projects from anywhere on your mobile phone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        <TranslationProvider>
          {children}
          <Toaster richColors position="top-right" theme="dark" />
        </TranslationProvider>
      </body>
    </html>
  );
}
