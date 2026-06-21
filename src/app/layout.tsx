import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dear My Routines",
  description: "예상 vs. 실제를 측정해 시간 과소예측을 교정하는 개인용 시간관리 앱.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
