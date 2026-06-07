import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marker — Branding & Creative Studio",
  description:
    "Marker is a bold, playful creative studio. We make brands, websites, and campaigns that refuse to blend in.",
  keywords: [
    "creative studio",
    "branding",
    "design agency",
    "web design",
    "Marker",
  ],
  openGraph: {
    title: "Marker — Branding & Creative Studio",
    description:
      "A bold, playful creative studio making brands that refuse to blend in.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
            --font-sans: 'Inter', system-ui, sans-serif;
          }
        `}</style>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
