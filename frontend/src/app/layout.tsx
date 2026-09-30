import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import type { CategoryNode } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { AppInit } from "@/components/layout/AppInit";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/ui/Toaster";
import { NavProgress } from "@/components/layout/NavProgress";

// Figma tec.tj набран в Roboto (300/400/500/600/700/800) — variable font покрывает все начертания
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  weight: "variable",
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
  themeColor: "#ffcc33",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 120), []);
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={`${roboto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <AppInit />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
