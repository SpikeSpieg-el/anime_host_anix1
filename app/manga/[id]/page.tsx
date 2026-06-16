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
    title: 'Манга - Детали',
    description: 'Детали манги',
  };
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <MangaDetailClient mangaId={id} />;
}
