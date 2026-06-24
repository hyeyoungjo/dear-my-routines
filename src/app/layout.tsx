import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Self-hosted fonts (all SIL OFL 1.1, commercial use allowed — license copies
 * live next to each file under ./fonts). Each is exposed as a CSS variable;
 * globals.css picks the active one via `[data-font]`. Nanum Gothic is the
 * default body font; Gowun Batang is a serif, and the handwriting fonts (Hi
 * Melody, Nanum Brush Script) ship as single static weights.
 */
const nanumGothic = localFont({
  src: [
    {
      path: "./fonts/nanum-gothic/NanumGothic-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/nanum-gothic/NanumGothic-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/nanum-gothic/NanumGothic-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-nanum-gothic",
  display: "swap",
});

const gowunBatang = localFont({
  src: [
    {
      path: "./fonts/gowun-batang/GowunBatang-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/gowun-batang/GowunBatang-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-gowun-batang",
  display: "swap",
});

const hiMelody = localFont({
  src: "./fonts/hi-melody/HiMelody-Regular.ttf",
  weight: "400",
  variable: "--font-hi-melody",
  display: "swap",
});

const nanumBrushScript = localFont({
  src: "./fonts/nanum-brush-script/NanumBrushScript-Regular.ttf",
  weight: "400",
  variable: "--font-nanum-brush-script",
  display: "swap",
});

const nanumPenScript = localFont({
  src: "./fonts/nanum-pen-script/NanumPenScript-Regular.ttf",
  weight: "400",
  variable: "--font-nanum-pen-script",
  display: "swap",
});

const fontVariables = [
  nanumGothic.variable,
  gowunBatang.variable,
  hiMelody.variable,
  nanumBrushScript.variable,
  nanumPenScript.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Dear My Routines",
  description: "예상 vs. 실제를 측정해 시간 과소예측을 교정하는 개인용 시간관리 앱.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={fontVariables}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
