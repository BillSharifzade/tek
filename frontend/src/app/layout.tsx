import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import type { CategoryNode } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { AppInit } from "@/components/layout/AppInit";
import { TopBar } from "@/components/layout/TopBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ТЭК — Точикэлектрокомплект: интернет-магазин электротехники",
    template: "%s — ТЭК",
  },
  description:
    "Кабели, кабеленесущие системы, светотехника, генераторы, щитовое оборудование. Доставка по Таджикистану за 48 часов. Персональные цены и кешбэк для электриков и закупщиков.",
  metadataBase: new URL("http://127.0.0.1:3010"),
};

export const viewport: Viewport = {
  themeColor: "#f4c241",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 120), []);
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <AppInit />
        <TopBar />
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
