import type { Metadata } from "next";
import "./globals.css";

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
  openGraph: {
    title: "Marker Studio® — Creative & Marketing Studio",
    description:
      "We mark the brands that matter. Branding, social, and campaigns from Beit Sahour, Palestine.",
    type: "website",
    locale: "en",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
