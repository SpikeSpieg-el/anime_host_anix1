import { Metadata } from 'next';
import MangaDetailClient from './manga-detail-client';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Манга — Weebx',
    description: 'Читать мангу онлайн на Weebx. Удобный ридер, большая библиотека.',
    alternates: {
      canonical: `https://weeb-x.com/manga/${id}`,
    },
    openGraph: {
      title: 'Манга — Weebx',
      description: 'Читать мангу онлайн на Weebx. Удобный ридер, большая библиотека.',
      type: "website",
      url: `https://weeb-x.com/manga/${id}`,
      siteName: "Weebx",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title: 'Манга — Weebx',
      description: 'Читать мангу онлайн на Weebx.',
    },
  };
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Главная", url: "https://weeb-x.com" },
          { name: "Манга", url: "https://weeb-x.com/manga" },
          { name: `Манга #${id}`, url: `https://weeb-x.com/manga/${id}` },
        ]}
      />
      <MangaDetailClient mangaId={id} />
    </>
  );
}
