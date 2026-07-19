import type { Metadata } from 'next';
import MangaDetailClient from './manga-detail-client';
import { BreadcrumbStructuredData, StructuredData } from '@/components/seo/structured-data';
import { getMangaDexInfo } from '@/lib/mangadex/api';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const manga = await getMangaDexInfo(id);

  if (!manga) {
    return {
      title: 'Манга не найдена — Weebx',
      description: 'Запрошенная манга не найдена на Weebx.',
      robots: { index: false, follow: false },
    };
  }

  const title = `${manga.title} — читать мангу онлайн | Weebx`;
  const description = manga.description
    ? manga.description.replace(/\s+/g, ' ').slice(0, 160)
    : `Читать мангу «${manga.title}» онлайн бесплатно на Weebx.`;
  const url = `https://weeb-x.com/manga/${id}`;

  return {
    title,
    description,
    keywords: [manga.title, 'читать мангу онлайн', 'манга бесплатно', 'Weebx'],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "Weebx",
      locale: "ru_RU",
      images: manga.image ? [{ url: manga.image, width: 500, height: 750, alt: manga.title }] : [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Weebx — манга" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: manga.image ? [manga.image] : ["https://weeb-x.com/og-image.png"],
    },
  };
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const manga = await getMangaDexInfo(id);
  const mangaTitle = manga?.title || `Манга #${id}`;
  const mangaUrl = `https://weeb-x.com/manga/${id}`;

  return (
    <>
      {manga && (
        <StructuredData
          type="webapp"
          data={{
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: mangaTitle,
            url: mangaUrl,
            description: manga.description,
            image: manga.image,
            genre: manga.tags,
            inLanguage: 'ru-RU',
          }}
        />
      )}
      <BreadcrumbStructuredData
        items={[
          { name: "Главная", url: "https://weeb-x.com" },
          { name: "Манга", url: "https://weeb-x.com/manga" },
          { name: mangaTitle, url: mangaUrl },
        ]}
      />
      <MangaDetailClient mangaId={id} />
    </>
  );
}
