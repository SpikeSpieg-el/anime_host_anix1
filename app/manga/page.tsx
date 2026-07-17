import { Metadata } from 'next';
import MangaClient from './manga-client';

export const metadata: Metadata = {
  title: 'Weebx — Читать мангу онлайн бесплатно',
  description: 'Погрузись в мир манги на Weebx! Читай любимые тайтлы и новинки в удобном ридере. Огромная библиотека жанров от сёнэна до романтики.',
  keywords: [
    "манга",
    "читать мангу",
    "манга онлайн",
    "читать мангу онлайн",
    "манга бесплатно",
    "читать мангу бесплатно",
    "манга онлайн бесплатно",
    "онлайн манга",
    "топ манги",
    "популярная манга",
    "новинки манги",
    "лучшая манга",
    "манга по жанрам",
    "манга жанры",
    "сёнэн",
    "романтика манга",
    "фэнтези манга",
    "исекай манга",
    "повседневность манга",
    "манга ридер",
    "читалка манги",
    "манга все тайтлы",
    "каталог манги",
    "поиск манги",
    "найти мангу",
    "read manga",
    "manga online",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb-x манга",
    "weebx манга",
    "weeb x читать мангу",
    "weebx читать мангу",
    "weeb-x.com манга",
  ],
  alternates: {
    canonical: "https://weeb-x.com/manga",
  },
  openGraph: {
    title: 'Weebx — Читать мангу онлайн бесплатно',
    description: 'Погрузись в мир манги на Weebx! Читай любимые тайтлы и новинки в удобном ридере.',
    type: "website",
    url: "https://weeb-x.com/manga",
    siteName: "Weebx",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: 'Weebx — Читать мангу онлайн бесплатно',
    description: 'Погрузись в мир манги на Weebx! Читай любимые тайтлы и новинки в удобном ридере.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MangaPage() {
  return <MangaClient />;
}
