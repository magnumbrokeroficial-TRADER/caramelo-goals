import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CODIGO.TIPS — Análise Técnica de Gols",
  description: "Sistema de análise técnica para futebol virtual — detecta padrões, trendlines e zonas S/R em séries de gols",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <script dangerouslySetInnerHTML={{__html:`window.__DARKODDS_URL__='${process.env.NEXT_PUBLIC_DARKODDS_URL || ''}'`}} />
<body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
