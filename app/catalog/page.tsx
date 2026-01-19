import { Navbar } from "@/components/navbar"
import { CatalogClient } from "@/components/catalog-client"
import { CatalogFilters } from "@/lib/shikimori"

interface CatalogPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  
  // Извлекаем параметры и приводим их к строкам
  const genre = typeof params.genre === 'string' ? params.genre : undefined
  const sort = typeof params.sort === 'string' ? params.sort : undefined
  const status = typeof params.status === 'string' ? params.status : undefined
  const kind = typeof params.kind === 'string' ? params.kind : undefined
  const year = typeof params.year === 'string' ? params.year : undefined
  const score = typeof params.score === 'string' ? params.score : undefined
  const search = typeof params.search === 'string' ? params.search : undefined

  // Формируем начальные фильтры
  const initialFilters: CatalogFilters = {
    page: 1,
    limit: 24,
    order: sort || 'popularity',
    genre,
    status,
    kind,
    year,
    score,
    search
  }

  // Создаем уникальный ключ, чтобы React пересоздавал компонент при смене фильтров
  // Это гарантирует, что данные обновятся при переходе по ссылкам
  const clientKey = JSON.stringify(initialFilters)

  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-0"> {/* Убрал padding, так как Navbar sticky */}
        <CatalogClient key={clientKey} initialFilters={initialFilters} />
      </div>
    </main>
  )
}