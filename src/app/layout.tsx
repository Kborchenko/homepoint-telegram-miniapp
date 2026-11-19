import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Свой угол — Академия координатора",
  description: "Первичное тестирование и обучение кандидатов Свой угол",
  applicationName: "Свой угол Academy",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f3efe5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />{children}</body></html>;
}

