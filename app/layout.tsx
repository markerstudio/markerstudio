import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#FF9100",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://marker.ps"),
  title: "Marker Studio® — Creative & Marketing Studio",
  description:
    "Marker is a bilingual creative & marketing studio in Beit Sahour, Palestine. We ship branding, social, and campaigns that move the numbers — not the goalposts.",
  keywords: [
    "Marker Studio",
    "creative studio",
    "marketing studio",
    "branding",
    "social media",
    "Palestine",
    "Beit Sahour",
    "bilingual",
  ],
  icons: { icon: "/assets/logo-favicon.png" },
  manifest: "/manifest.webmanifest",
  // Installs full-screen (no Safari bars) from the iPhone home screen.
  appleWebApp: {
    capable: true,
    title: "Marker Studio",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Marker Studio® — Creative & Marketing Studio",
    description:
      "We mark the brands that matter. Branding, social, and campaigns from Beit Sahour, Palestine.",
    type: "website",
    locale: "en",
  },
};

// Organization + WebSite structured data — helps search engines render a rich
// brand result (name, logo, contact, social) and a sitelinks search box.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://marker.ps/#org",
      name: "Marker Studio®",
      url: "https://marker.ps",
      logo: "https://marker.ps/assets/logo-primary-transparent.png",
      description:
        "Bilingual creative & marketing studio in Beit Sahour, Palestine — branding, social, and campaigns.",
      email: "create@marker.ps",
      telephone: "+970568081408",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Beit Sahour",
        addressCountry: "PS",
      },
      areaServed: "Worldwide",
      knowsLanguage: ["en", "ar"],
    },
    {
      "@type": "WebSite",
      "@id": "https://marker.ps/#website",
      url: "https://marker.ps",
      name: "Marker Studio®",
      publisher: { "@id": "https://marker.ps/#org" },
      inLanguage: ["en", "ar"],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
