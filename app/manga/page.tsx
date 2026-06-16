import { Metadata } from 'next';
import MangaClient from './manga-client';

export const metadata: Metadata = {
  title: 'Манга - Читать мангу онлайн на русском',
  description: 'Читайте мангу онлайн на русском языке. Большая коллекция манги разных жанров.',
};

export default function MangaPage() {
  return <MangaClient />;
}
