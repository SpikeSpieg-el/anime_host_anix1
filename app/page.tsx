import { Navbar } from "@/components/navbar"
import { AnimeCard } from "@/components/anime-card"
import { getAnimeList, getRecentUpdates, getAnnouncements } from "@/lib/shikimori" // Импортируем новые функции
import { HeroBanner } from "@/components/hero-banner"
import { UserHistory } from "@/components/user-history"
import { UpdatesBanner } from "@/components/updates-banner" // Импортируем баннер

export default async function HomePage() {
  // Запрашиваем ВСЕ данные параллельно
  const [
    ongoingAnime, 
    newAnime, 
    updates, // <-- Новые серии
    announcements // <-- Анонсы
  ] = await Promise.all([
    getAnimeList(12, 'popularity'),
    getAnimeList(12, 'aired_on'),
    getRecentUpdates(3),   // Берем 3 последних обновления
    getAnnouncements(3)    // Берем 3 главных анонса
  ]);

  // Берем первое аниме из популярных для баннера
  const heroAnime = ongoingAnime[0];
  // Убираем его из списка, чтобы не дублировать
  const popularList = ongoingAnime.slice(1);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />

      {/* 1. HERO SECTION (Огромный баннер) */}
      <HeroBanner anime={heroAnime} />

      <div className="container mx-auto px-4 relative z-10 -mt-10">
        
        {/* 2. ИСТОРИЯ И ПОИСК (Клиентский блок) */}
        {/* Поднимаем его визуально, чтобы он был "поверх" баннера или сразу под ним */}
        <UserHistory />

        {/* 2. НОВЫЙ БАННЕР ОБНОВЛЕНИЙ */}
        <div className="mb-12">
            <UpdatesBanner updates={updates} announcements={announcements} />
        </div>

        {/* 4. ПОПУЛЯРНОЕ */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Популярное сейчас</h2>
              <p className="text-zinc-500 text-sm">Выбор зрителей на этой неделе</p>
            </div>
            <a href="/catalog?sort=popular" className="text-orange-500 text-sm font-medium hover:text-orange-400 transition">Показать все</a>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
            {popularList.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 4. Свежие релизы */}
        <section>
          <div className="flex items-end justify-between mb-6">
             <h2 className="text-2xl font-bold text-white border-l-4 border-blue-500 pl-4">Новинки сезона</h2>
             <a href="/catalog?sort=new" className="text-blue-500 text-sm font-medium hover:text-blue-400 transition">Все новинки</a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {newAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}