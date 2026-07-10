import { Metadata } from 'next';
import MangaClient from './manga-client';

export const metadata: Metadata = {
  title: 'Weeb-x — Читать мангу онлайн бесплатно',
  description: 'Погрузись в мир манги на Weeb-x! Читай любимые тайтлы и новинки в удобном ридере. Огромная библиотека жанров от сёнэна до романтики.',
  keywords: [
    "манга",
    "читать мангу",
    "читаем мангу",
    "манга яой",
    "манга яойя",
    "манга онлайн",
    "манга бесплатно",
    "читать мангу онлайн",
    "новинки манги",
    "топ манги",
  ],
  alternates: {
    canonical: "https://weeb-x.com/manga",
  },
  openGraph: {
    title: 'Weeb-x — Читать мангу онлайн бесплатно',
    description: 'Погрузись в мир манги на Weeb-x! Читай любимые тайтлы и новинки в удобном ридере.',
    type: "website",
    url: "https://weeb-x.com/manga",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Weeb-x Манга",
      },
    ],
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: 'Weeb-x — Читать мангу онлайн бесплатно',
    description: 'Погрузись в мир манги на Weeb-x! Читай любимые тайтлы и новинки в удобном ридере.',
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MangaPage() {
  return <MangaClient />;
}
