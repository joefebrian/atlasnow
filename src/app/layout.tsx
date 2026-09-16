import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ErrorCatcher } from "@/components/ErrorCatcher";
import { CookieNotice } from "@/components/legal/CookieNotice";
import { GoogleAnalytics } from "@/components/legal/GoogleAnalytics";
import { getLocale } from "@/lib/i18n/get-locale";
import { homeDescription, homeTitle, OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import "./globals.css";

const nHaas = localFont({
  src: [
    { path: "../fonts/NHaasGroteskTXPro-55Rg.woff", weight: "400", style: "normal" },
    { path: "../fonts/NHaasGroteskTXPro-65Md.woff2", weight: "500", style: "normal" },
    { path: "../fonts/NHaasGroteskTXPro-65Md.woff2", weight: "600", style: "normal" },
    { path: "../fonts/NHaasGroteskTXPro-65Md.woff2", weight: "700", style: "normal" },
    { path: "../fonts/NHaasGroteskTXPro-56It.woff2", weight: "400", style: "italic" },
    { path: "../fonts/NHaasGroteskTXPro-66MdIt.woff2", weight: "500", style: "italic" },
    { path: "../fonts/NHaasGroteskTXPro-66MdIt.woff2", weight: "600", style: "italic" },
    { path: "../fonts/NHaasGroteskTXPro-66MdIt.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8fc",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: homeTitle(),
    template: "%s — AtlasNow",
  },
  description: homeDescription(),
  applicationName: SITE_NAME,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: homeTitle(),
    description: homeDescription(),
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle(),
    description: homeDescription(),
    images: [OG_IMAGE],
  },
  icons: {
    icon: [{ url: "/brand/icon.png", type: "image/png" }],
    apple: "/brand/atlasnow_logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale === "id" ? "id" : "en"}>
      <body className={`${nHaas.variable} min-h-screen antialiased`}>
        <ErrorCatcher />
        {children}
        <CookieNotice />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
