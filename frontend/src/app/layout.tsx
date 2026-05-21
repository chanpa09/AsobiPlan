import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
