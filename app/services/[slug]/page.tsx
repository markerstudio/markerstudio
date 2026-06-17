import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ServiceWalkthrough from "@/components/ServiceWalkthrough";
import { SERVICE_SLUGS, getService } from "@/lib/services";

export function generateStaticParams() {
  return SERVICE_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const service = getService(params.slug);
  if (!service) return { title: "Services — Marker Studio®" };
  return {
    title: `${service.name.en} — Marker Studio®`,
    description: service.intro.en,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: `${service.name.en} — Marker Studio®`,
      description: service.tagline.en,
      type: "article",
      url: `/services/${service.slug}`,
    },
  };
}

export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = getService(params.slug);
  if (!service) notFound();

  // Service + breadcrumb structured data for the walkthrough page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: service.name.en,
        description: service.intro.en,
        url: `https://marker.ps/services/${service.slug}`,
        provider: { "@type": "Organization", name: "Marker Studio®", url: "https://marker.ps" },
        availableLanguage: ["en", "ar"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Services", item: "https://marker.ps/#services" },
          { "@type": "ListItem", position: 2, name: service.name.en, item: `https://marker.ps/services/${service.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServiceWalkthrough service={service} />
    </>
  );
}
