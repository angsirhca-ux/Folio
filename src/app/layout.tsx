import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Crimson_Pro } from "next/font/google";
import { BookProvider } from "@/providers/BookProvider";
import { ServiceWorkerRegister } from "@/components/Pwa/ServiceWorkerRegister";
import "./globals.css";

const adobeGaramond = localFont({
  src: [
    {
      path: "../fonts/AGaramondPro-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/AGaramondPro-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../fonts/AGaramondPro-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/AGaramondPro-BoldItalic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-adobe-garamond",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const crimson = Crimson_Pro({
  subsets: ["latin", "latin-ext"],
  variable: "--font-crimson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Folio — A place for writing",
  description:
    "A premium writing application that feels like writing inside a beautifully printed novel.",
  applicationName: "Folio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Folio",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F3EA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="classic"
      className={`${adobeGaramond.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <BookProvider>
          {children}
          <ServiceWorkerRegister />
        </BookProvider>
      </body>
    </html>
  );
}
