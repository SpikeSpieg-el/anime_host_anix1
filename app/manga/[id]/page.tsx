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
    },
    twitter: {
      card: "summary_large_image",
      title: 'Манга — Weeb-X',
      description: 'Читать мангу онлайн на Weeb-X.',
    },
  };
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <MangaDetailClient mangaId={id} />;
}
