/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SideNavBar from "@/components/layout/SideNavBar";
import TopNavBar from "@/components/layout/TopNavBar";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "AsobiPlan - 유모차 나들이 지도",
  description: "도쿄 고토구 내 유모차 이동에 최적화된 주말 가족 나들이 지도",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${plusJakartaSans.variable} font-sans bg-background text-on-background min-h-screen flex flex-col md:flex-row overflow-hidden`}>
        <SideNavBar />
        <main className="ml-0 md:ml-56 flex-1 h-screen flex flex-col relative w-full overflow-y-auto md:overflow-hidden hide-scrollbar">
          <TopNavBar />
          {children}
        </main>
      </body>
    </html>
  );
}
