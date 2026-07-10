import { Metadata } from 'next';
import MangaDetailClient from './manga-detail-client';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Манга — Weeb-X',
    description: 'Читать мангу онлайн на Weeb-X. Удобный ридер, большая библиотека.',
    alternates: {
      canonical: `https://weeb-x.com/manga/${id}`,
    },
    openGraph: {
      title: 'Манга — Weeb-X',
      description: 'Читать мангу онлайн на Weeb-X. Удобный ридер, большая библиотека.',
      type: "website",
      url: `https://weeb-x.com/manga/${id}`,
      siteName: "Weeb-X",
      locale: "ru_RU",
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "Weeb-X Манга",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: 'Манга — Weeb-X',
      description: 'Читать мангу онлайн на Weeb-X.',
      images: ["/og-image.svg"],
    },
  };
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <MangaDetailClient mangaId={id} />;
}
