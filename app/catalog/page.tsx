import { Navbar } from "@/components/navbar"
import { CatalogClient } from "@/components/catalog-client"
import { CatalogFilters } from "@/lib/shikimori"

interface CatalogPageProps {
  searchParams: Promise<{ 
    genre?: string; 
    title?: string;
    sort?: string;
  }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { genre, sort } = await searchParams
  
  // Определяем начальные фильтры на основе URL параметров
  const initialFilters: CatalogFilters = {
    page: 1,
    limit: 24,
    order: sort === 'new' ? 'aired_on' : sort === 'popular' ? 'popularity' : 'popularity',
    genre: genre,
  }

  return (
    <>
      <Navbar />
      <CatalogClient initialFilters={initialFilters} />
    </>
  )
}
