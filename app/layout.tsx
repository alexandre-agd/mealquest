import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MealQuest",
  description: "Planification hebdomadaire des repas du foyer.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MealQuest",
  },
  icons: {
    apple: "/icons/apple-icon.png",
  },
};

export const viewport = {
  themeColor: "#2F6B4F",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La langue du document suit celle du membre connecté : elle conditionne
  // la coupure de ligne et la police système en japonais (C1).
  const locale = await getCurrentLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
