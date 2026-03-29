"use client"

import { useState, useRef, MouseEvent, useCallback, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Sparkles, Star, Heart, Loader2, X, ZoomIn, ExternalLink, RefreshCcw, Trash, Crown, Package, Coins, Search } from "lucide-react"
import { rollAnimeCharacter, rollFromAnimePack, searchGachaPacks, createCustomGachaPack } from "./actions"
import { ANIME_PACKS, AnimePack, CustomAnimePack, createCustomPack } from "@/lib/gacha-packs"
import { useCoins } from "@/hooks/use-coins"
import { GachaLoading } from "@/components/gacha-loading" 

export type Rarity = 
  | "trash" | "common" | "uncommon" | "rare" | "super_rare" | "epic" 
  | "mythic" | "legendary" | "ancient" | "divine" | "transcendent" | "omnipotent"

export interface CardStats {
  hp: number
  atk: number
  def: number
  spd: number
  luck: number
}

export interface Card {
  id: number
  uniqueId: string
  serialId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  originalUrl: string
  fallbackUrls?: string[] 
  score: number
  shikiId: number
  characterId: number
  stats: CardStats
  isMainCharacter?: boolean
  packId?: string
  packName?: string
  isArtBlacklisted?: boolean
}

function generateCardUniqueId(characterId: number, packId?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const packPrefix = packId ? `pack-${packId}` : 'random';
  return `${packPrefix}-${characterId}-${timestamp}-${random}`;
}

const rarityConfig: Record<Rarity, { color: string; bg: string; label: string; glow: string; fx: string; rgb: string }> = {
  trash: { color: "from-stone-500 to-stone-700", bg: "bg-stone-950", label: "Мусор", glow: "shadow-stone-500/10", fx: "bg-gradient-to-br from-stone-400/10 to-transparent", rgb: "120, 113, 108" },
  common: { color: "from-slate-400 to-slate-500", bg: "bg-slate-900", label: "Обычная", glow: "shadow-slate-400/20", fx: "bg-gradient-to-br from-white/10 to-transparent", rgb: "148, 163, 184" },
  uncommon: { color: "from-emerald-400 to-teal-500", bg: "bg-emerald-950", label: "Необычная", glow: "shadow-emerald-500/20", fx: "bg-gradient-to-br from-emerald-400/20 to-transparent", rgb: "52, 211, 153" },
  rare: { color: "from-blue-400 to-cyan-500", bg: "bg-cyan-950", label: "Редкая", glow: "shadow-blue-500/30", fx: "bg-gradient-to-br from-blue-400/20 to-transparent", rgb: "34, 211, 238" },
  super_rare: { color: "from-indigo-400 to-blue-600", bg: "bg-indigo-950", label: "Супер Редкая", glow: "shadow-indigo-500/40", fx: "bg-gradient-to-br from-indigo-400/30 to-transparent", rgb: "129, 140, 248" },
  epic: { color: "from-purple-500 to-pink-500", bg: "bg-purple-950", label: "Эпическая", glow: "shadow-purple-500/50", fx: "bg-gradient-to-br from-purple-400/30 to-transparent", rgb: "192, 132, 252" },
  mythic: { color: "from-fuchsia-400 to-rose-500", bg: "bg-fuchsia-950", label: "Мифическая", glow: "shadow-fuchsia-500/50", fx: "bg-gradient-to-br from-fuchsia-400/40 to-transparent", rgb: "232, 121, 249" },
  legendary: { color: "from-pink-400 to-rose-600", bg: "bg-pink-950", label: "Легендарная", glow: "shadow-pink-500/60", fx: "bg-gradient-to-tr from-pink-300/40 via-transparent to-rose-300/40", rgb: "244, 114, 182" },
  ancient: { color: "from-amber-400 to-orange-500", bg: "bg-amber-950", label: "Древняя", glow: "shadow-amber-500/70", fx: "bg-gradient-to-tr from-amber-300/50 via-transparent to-yellow-300/40", rgb: "251, 191, 36" },
  divine: { color: "from-orange-400 to-red-500", bg: "bg-orange-950", label: "Божественная", glow: "shadow-orange-500/80", fx: "bg-gradient-to-tr from-orange-400/50 via-transparent to-red-400/40", rgb: "251, 146, 60" },
  transcendent: { color: "from-red-500 to-rose-700", bg: "bg-red-950", label: "Трансцендентная", glow: "shadow-red-500/90", fx: "bg-gradient-to-tr from-red-400/60 via-transparent to-rose-400/50", rgb: "248, 113, 113" },
  omnipotent: { color: "from-white via-yellow-200 to-amber-500", bg: "bg-zinc-900", label: "Всемогущая", glow: "shadow-white/100", fx: "bg-gradient-to-tr from-white/60 via-yellow-200/40 to-white/60", rgb: "255, 255, 255" },
}

const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="w-full space-y-1">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
      <div 
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1000`} 
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
)

const statLabels = {
  hp: "Очки Здоровья",
  atk: "Сила Атаки",
  def: "Защита",
  spd: "Скорость",
  luck: "Удача"
} as const

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, card: Card, isCollection: boolean = false) => {
  const target = e.target as HTMLImageElement;
  
  // Если не загрузился imageUrl (фан-арт), пробуем originalUrl (Шикимори)
  if (!target.dataset.triedOriginal && card.originalUrl) {
    target.dataset.triedOriginal = "true";
    // Очищаем URL от параметров (все что после ?) - это часто решает проблему 403 на Шикимори
    const cleanUrl = card.originalUrl.split('?')[0];
    target.src = cleanUrl;
    return;
  }

  // Если официальный арт тоже не алё, пробуем зеркала
  if (!target.dataset.triedMirror) {
    target.dataset.triedMirror = "true";
    // Прямая ссылка на статику Шикимори без параметров
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.jpg`;
    return;
  }

  // Continue with existing fallback logic...
  if (!target.dataset.triedShikiPng) {
    console.log(`[${card.name}] Попытка Shikimori PNG`);
    target.dataset.triedShikiPng = "true";
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.png`;
  } else if (!target.dataset.triedShikiWebp) {
    console.log(`[${card.name}] Попытка Shikimori WebP`);
    target.dataset.triedShikiWebp = "true";
    target.src = `https://shikimori.one/system/characters/webp/original/${card.characterId}.webp`;
  } else if (!target.dataset.triedJikan) {
    console.log(`[${card.name}] Попытка Jikan API (MyAnimeList)`);
    target.dataset.triedJikan = "true";
    fetch(`https://api.jikan.moe/v4/characters/${card.characterId}/pictures`)
      .then(res => res.json())
      .then(data => {
        if (data?.data && data.data.length > 0) {
          const pic = data.data.find((p: any) => p.jpg?.image_url) || data.data[0];
          target.src = pic.jpg?.image_url || pic.webp?.image_url;
        } else {
          // Вызываем следующую ошибку для перехода к заглушке
          target.src = 'https://picsum.photos/seed/force-error/1/1';
        }
      })
      .catch(() => {
        target.src = 'https://picsum.photos/seed/force-error/1/1';
      });
  } else if (!target.dataset.triedPlaceholder) {
    console.log(`[${card.name}] Все попытки исчерпаны, используем картинку-заглушку`);
    target.dataset.triedPlaceholder = "true";
    const seed = card.anime.replace(/[^a-z0-9]/gi, '') + card.characterId;
    target.src = `https://picsum.photos/seed/anime-${seed}/${isCollection ? '200/300' : '400/600'}.jpg`;
  } else {
    console.log(`[${card.name}] Картинка-заглушка не загрузилась, показываем UI-заглушку`);
    target.style.display = 'none';
    const containerClass = isCollection ? 'collection-placeholder' : 'image-placeholder';
    const placeholder = target.parentElement?.querySelector(`.${containerClass}`);
    if (!placeholder) {
      const div = document.createElement('div');
      div.className = `${containerClass} absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white p-2`;
      if (isCollection) {
        div.innerHTML = `
          <div class="text-2xl">🎌</div>
          <div class="text-xs font-bold text-center mt-1 truncate w-full px-1">${card.name}</div>
        `;
      } else {
        div.innerHTML = `
          <div class="text-4xl mb-2">🎌</div>
          <div class="text-sm font-bold text-center mb-1 px-4">${card.name}</div>
          <div class="text-xs text-slate-400 text-center px-4">${card.anime}</div>
          <div class="text-xs text-slate-500 mt-2">Арт недоступен</div>
        `;
      }
      target.parentElement?.appendChild(div);
    }
  }
};

const PackCard = ({ pack, onSelect, userCoins }: { pack: AnimePack; onSelect: (pack: AnimePack) => void; userCoins: number }) => (
  <div 
    onClick={() => onSelect(pack)}
    className={`relative group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br ${pack.color} p-6 transition-all hover:scale-105 hover:border-white/30 ${userCoins < pack.price ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
    
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <Package className="w-8 h-8 text-white/80" />
        <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">{pack.price}</span>
        </div>
      </div>
      
      <h3 className="text-xl font-black text-white mb-2">{pack.name}</h3>
      <p className="text-sm text-white/70 mb-4 line-clamp-2">{pack.description}</p>
      
      {pack.guaranteedRarity && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">
          <Star className="w-3 h-3 text-yellow-400" />
          <span className="text-xs font-bold text-white">
            Гарантированно {rarityConfig[pack.guaranteedRarity as Rarity].label}
          </span>
        </div>
      )}
      
      {userCoins < pack.price && (
        <div className="mt-3 text-xs text-red-400 font-bold">Недостаточно монет</div>
      )}
    </div>
  </div>
)

const InteractiveCard = ({ card, forceFlipped = false }: { card: Card, forceFlipped?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsFlipped(forceFlipped)
  }, [forceFlipped])

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setRotation({ 
        x: ((y - centerY) / centerY) * -12,
        y: ((x - centerX) / centerX) * 12 
      })
      setIsHovered(true)
    })
  },[])

  const handleMouseLeave = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
    })
  },[])

  const highlightX = -rotation.y * 1.2; 
  const highlightY = rotation.x * 1.2;

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsFlipped(!isFlipped)}
      className="relative w-80 h-[480px] transition-transform duration-500 ease-out cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y + (isFlipped ? 180 : 0)}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* FRONT SIDE - АКЦЕНТ НА АРТ */}
      <div 
        className={`absolute inset-0 rounded-[2.5rem] overflow-hidden ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow} border-2 border-white/10`}
        style={{ backfaceVisibility: "hidden" }}
      >
        {/* Само изображение персонажа - теперь занимает всё пространство без искажений */}
        <img 
          src={card.imageUrl} 
          alt={card.name}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, card, false)}
        />
        
        {/* Тонкий виньеточный градиент вместо глухого черного низа */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
        
        {/* Эффекты редкости (блики/FX) - ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ */}
        <div className={`absolute inset-0 mix-blend-overlay opacity-40 pointer-events-none ${rarityConfig[card.rarity].fx}`} />

        {/* Интерактивный блик при движении - ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-[2rem]"
          style={{
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease-out',
            boxShadow: `
              inset ${highlightX}px ${highlightY}px 20px rgba(${rarityConfig[card.rarity].rgb}, 0.4), 
              inset ${highlightX * 0.3}px ${highlightY * 0.3}px 4px rgba(${rarityConfig[card.rarity].rgb}, 0.8)
            `
          }}
        />

        {/* UI элементы - Сделаны максимально компактными и "парящими" */}
        
        {/* Верхняя панель: Редкость и Рейтинг */}
        <div className="absolute top-5 inset-x-5 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-2">
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter backdrop-blur-md bg-black/40 border border-white/20 text-white shadow-xl`}>
              <span className={`bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
                {rarityConfig[card.rarity].label}
              </span>
            </div>
            {card.isMainCharacter && (
              <div className="w-fit flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-yellow-400 text-black shadow-lg">
                <Crown className="w-3 h-3" />
                Главный герой
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-xl">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[11px] font-black text-white">{card.score.toFixed(1)}</span>
          </div>
        </div>

        {/* Нижняя панель: Информация в "стеклянном" блоке */}
        <div className="absolute bottom-5 inset-x-5 pointer-events-none">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
            {/* Тонкая полоска редкости сбоку */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${rarityConfig[card.rarity].color}`} />
            
            {/* Индикатор заблокированного арта */}
            {card.isArtBlacklisted && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3 text-red-400" />
                <span className="text-[8px] font-bold text-red-400 uppercase">Арт отклонен</span>
              </div>
            )}
            
            <h3 className="text-xl font-black text-white uppercase leading-none drop-shadow-lg truncate mb-1">
              {card.name}
            </h3>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider truncate">
              {card.anime}
            </p>
            
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
              <span className="text-[8px] font-mono text-white/30 tracking-tighter">ШИКИ-{card.shikiId}</span>
              {card.packName && (
                <span className="text-[8px] font-bold text-indigo-400/80 uppercase">{card.packName}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BACK SIDE (STATS) - ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ (как в вашем примере) */}
      <div 
        className={`absolute inset-0 rounded-[2.5rem] p-8 flex flex-col justify-between border-4 ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`}
        style={{ 
          backfaceVisibility: "hidden", 
          transform: "rotateY(180deg)",
          borderColor: `rgba(${rarityConfig[card.rarity].rgb}, 0.5)`
        }}
      >
        <div className={`absolute inset-0 opacity-10 ${rarityConfig[card.rarity].fx}`} />
        
        <div className="relative z-10 space-y-4">
          <div className="text-center pb-4 border-b border-white/10">
            <p className={`text-[10px] font-black uppercase tracking-tighter bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
              Характеристики Персонажа
            </p>
            <h4 className="text-xl font-black text-white uppercase truncate">{card.name}</h4>
          </div>

          <div className="space-y-5 pt-4">
            <StatBar label={statLabels.hp} value={card.stats.hp} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.atk} value={card.stats.atk} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.def} value={card.stats.def} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.spd} value={card.stats.spd} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.luck} value={card.stats.luck} color={rarityConfig[card.rarity].color} />
          </div>
        </div>

        <div className="relative z-10 text-center space-y-2">
           <div className="w-16 h-16 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5">
              <RefreshCcw className="w-8 h-8 text-white/20" />
           </div>
           <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-balance leading-tight">Нажмите чтобы перевернуть</p>
        </div>
      </div>
    </div>
  )
}

export default function GachaPage() {
  const[isRolling, setIsRolling] = useState(false)
  const [isPackLoading, setIsPackLoading] = useState(false)
  const[isCustomPackLoading, setIsCustomPackLoading] = useState(false)
  const[revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [showCard, setShowCard] = useState(false)
  const[viewedCard, setViewedCard] = useState<Card | null>(null)
  const[usedCharacterIds, setUsedCharacterIds] = useState<Set<number>>(new Set())
  const { coins: userCoins, spendCoins } = useCoins()
  const [selectedPack, setSelectedPack] = useState<AnimePack | CustomAnimePack | null>(null)
  const [showPacks, setShowPacks] = useState(false)
  const [packSearchQuery, setPackSearchQuery] = useState("")
  const[searchResults, setSearchResults] = useState<AnimePack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showCustomPackCreator, setShowCustomPackCreator] = useState(false)
  const [customPackQuery, setCustomPackQuery] = useState("")
  const[isCreatingCustomPack, setIsCreatingCustomPack] = useState(false)
  const [createdCustomPack, setCreatedCustomPack] = useState<CustomAnimePack | null>(null)
  const [customPackSearchResults, setCustomPackSearchResults] = useState<Array<{
    id: number
    name: string
    russian: string | null
    score: number | null
    imageUrl: string
  }>>([])
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<Set<number>>(new Set())
  const [blacklistedUrls, setBlacklistedUrls] = useState<string[]>([])
  const [showArtWarning, setShowArtWarning] = useState(false)

  useEffect(() => {
    const ids = new Set(collectedCards.map(card => card.characterId));
    setUsedCharacterIds(ids);
  }, [collectedCards]);

  useEffect(() => {
    if (packSearchQuery.trim().length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounce = setTimeout(async () => {
      try {
        const results = await searchGachaPacks(packSearchQuery.trim());
        setSearchResults(results);
      } catch (error) {
        console.error("Pack search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(debounce);
  }, [packSearchQuery]);

  const handleRoll = async () => {
    if (isRolling) return
    setIsRolling(true)
    setRevealedCard(null)
    setShowCard(false)

    try {
      let result;
      // Передаем текущий список забаненных картинок на сервер
      const ignored = blacklistedUrls;

      if (selectedPack) {
        if (userCoins < selectedPack.price) {
          alert("Недостаточно монет!");
          setIsRolling(false);
          return;
        }

        console.log("Rolling from pack:", selectedPack.id);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        result = await rollFromAnimePack(selectedPack, Array.from(usedCharacterIds), ignored);
        console.log("Pack roll result:", result);

        if (result) {
          await spendCoins(selectedPack.price);
        }
      } else {
        console.log("Rolling random character");
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await rollAnimeCharacter(Array.from(usedCharacterIds), ignored);
        console.log("Random roll result:", result);
      }
      
      if (!result) {
        console.error("No result from roll function");
        throw new Error("Не удалось получить персонажа. Попробуйте снова!");
      }

      const newCard: Card = {
        id: Date.now(),
        uniqueId: generateCardUniqueId(result.characterId, (result as any).packId),
        serialId: result.shikiId.toString(),
        name: result.characterName,
        anime: result.animeName,
        rarity: result.rarity as Rarity,
        imageUrl: result.imageUrl || '',
        originalUrl: result.originalUrl || '',
        score: result.score,
        shikiId: result.shikiId,
        characterId: result.characterId,
        stats: result.stats,
        isMainCharacter: result.isMainCharacter || false,
        packId: (result as any).packId,
        packName: (result as any).packName,
        isArtBlacklisted: blacklistedUrls.includes(result.imageUrl || '')
      }

      setRevealedCard(newCard)
      setShowCard(true)
    } catch (error) {
      console.error("Gacha error:", error)
      alert(`Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}. Попробуйте снова!`)
    } finally {
      setIsRolling(false)
    }
  }

  const handlePackSelect = async (pack: AnimePack) => {
    if (userCoins >= pack.price) {
      setIsPackLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSelectedPack(pack);
      setShowPacks(false);
      setIsPackLoading(false);
    }
  }

  const handleRandomRoll = () => {
    setSelectedPack(null);
    setShowPacks(false);
  }

  const handleCreateCustomPack = async () => {
    if (!customPackQuery.trim() || isCreatingCustomPack) return;
    
    setIsCreatingCustomPack(true);
    setCreatedCustomPack(null);
    setSelectedAnimeIds(new Set()); 
    
    try {
      const result = await createCustomGachaPack(customPackQuery.trim());
      
      if (result) {
        setCustomPackSearchResults(result.foundAnime);
      } else {
        alert("Аниме по запросу не найдено. Попробуйте другое название.");
      }
    } catch (error) {
      console.error("Custom pack creation error:", error);
      alert("Ошибка при создании пака. Попробуйте снова.");
    } finally {
      setIsCreatingCustomPack(false);
    }
  }

  const toggleAnimeSelection = (animeId: number) => {
    setSelectedAnimeIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(animeId)) {
        newSet.delete(animeId)
      } else {
        newSet.add(animeId)
      }
      return newSet
    })
  }

  const selectAllAnime = () => {
    setSelectedAnimeIds(new Set(customPackSearchResults.map(anime => anime.id)))
  }

  const deselectAllAnime = () => {
    setSelectedAnimeIds(new Set())
  }

  const handleCreateCustomPackFromSelected = async () => {
    if (selectedAnimeIds.size === 0) {
      alert("Выберите хотя бы одно аниме для создания пака")
      return
    }

    setIsCreatingCustomPack(true)
    setCreatedCustomPack(null)
    
    try {
      const selectedAnime = customPackSearchResults.filter(anime => selectedAnimeIds.has(anime.id))
      
      const animeResults = selectedAnime.map(anime => ({
        id: anime.id,
        name: anime.name,
        russian: anime.russian,
        score: anime.score,
        kind: 'tv', 
        episodes: 0, 
        status: 'released', 
        image: {
          original: anime.imageUrl
        }
      }))
      
      const customPack = createCustomPack(customPackQuery.trim(), animeResults)
      
      setCreatedCustomPack(customPack)
      setCustomPackSearchResults(selectedAnime) 
    } catch (error) {
      console.error("Custom pack creation error:", error)
      alert("Ошибка при создании пака. Попробуйте снова.")
    } finally {
      setIsCreatingCustomPack(false)
    }
  }

  const handleSelectCustomPack = async (pack: CustomAnimePack) => {
    if (userCoins >= pack.price) {
      setIsCustomPackLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSelectedPack(pack);
      setShowCustomPackCreator(false);
      setCreatedCustomPack(null);
      setCustomPackQuery("");
      setIsCustomPackLoading(false);
    }
  }

  const unblacklistArt = (card: Card) => {
    setBlacklistedUrls(prev => prev.filter(url => url !== card.imageUrl));
    setCollectedCards(prev => prev.map(c => 
      c.uniqueId === card.uniqueId ? { ...c, isArtBlacklisted: false } : c
    ));
  }

  const removeCard = (cardToRemove: Card) => {
    setCollectedCards(prev => prev.filter(card => card.id !== cardToRemove.id))
    setViewedCard(null)
    
    const isCardStillInCollection = collectedCards.some(card => card.id !== cardToRemove.id && card.characterId === cardToRemove.characterId)
    if (!isCardStillInCollection) {
      setUsedCharacterIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(cardToRemove.characterId)
        return newSet
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-pink-500/30 font-sans">
      <Navbar />

      {/* Pack Selection Modal */}
      {showPacks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[180vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-white">Выберите Набор</h2>
              <button
                onClick={() => setShowPacks(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск набора по названию..."
                value={packSearchQuery}
                onChange={(e) => setPackSearchQuery(e.target.value)}
                className="w-full h-10 rounded-xl bg-slate-800/50 border border-slate-700 pl-10 pr-10 text-sm text-white focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
              {packSearchQuery && (
                <button
                  onClick={() => setPackSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {isSearching && (
                <div className="col-span-full flex items-center justify-center py-12">
                  <GachaLoading message="Поиск наборов..." size="md" variant="sketch" />
                </div>
              )}

              {!isSearching && packSearchQuery.trim() && searchResults.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-400 font-medium mb-2">Наборы не найдены</p>
                  <p className="text-slate-500 text-sm">Попробуйте другой запрос</p>
                </div>
              )}

              {(!packSearchQuery.trim() ? ANIME_PACKS : searchResults).map(pack => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onSelect={handlePackSelect}
                  userCoins={userCoins}
                />
              ))}
            </div>

            <button
              onClick={handleRandomRoll}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
            >
              Случайный призыв (Бесплатно)
            </button>
          </div>
        </div>
      )}

      {/* Custom Pack Creator Modal */}
      {showCustomPackCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-slate-900 rounded-3xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">Создать Кастомный Пак</h2>
                {selectedAnimeIds.size > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 bg-yellow-500/20 px-3 py-1 rounded-full">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-300 font-bold">
                        {Math.max(150, Math.min(600, Math.floor((customPackSearchResults.filter(a => selectedAnimeIds.has(a.id)).reduce((sum, a) => sum + (a.score || 0), 0) / selectedAnimeIds.size) * 60)))} монет
                      </span>
                    </div>
                    {(() => {
                      const avgScore = customPackSearchResults.filter(a => selectedAnimeIds.has(a.id)).reduce((sum, a) => sum + (a.score || 0), 0) / selectedAnimeIds.size;
                      let guaranteedRarity = '';
                      if (avgScore >= 8.5) guaranteedRarity = 'Эпическая';
                      else if (avgScore >= 7.5) guaranteedRarity = 'Супер Редкая';
                      else if (avgScore >= 6.5) guaranteedRarity = 'Редкая';
                      
                      return guaranteedRarity && (
                        <div className="flex items-center gap-1.5 bg-purple-500/20 px-3 py-1 rounded-full">
                          <Star className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-300 font-bold">Гарант: {guaranteedRarity}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCustomPackCreator(false);
                  setCreatedCustomPack(null);
                  setCustomPackQuery("");
                  setCustomPackSearchResults([]);
                  setSelectedAnimeIds(new Set());
                }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-white mb-2">
                Введите название аниме (например, "Титан", "Наруто", "Блич")
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Например: Титан..."
                  value={customPackQuery}
                  onChange={(e) => setCustomPackQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCustomPack()}
                  className="flex-1 h-12 rounded-xl bg-slate-800/50 border border-slate-700 px-4 text-white focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
                <button
                  onClick={handleCreateCustomPack}
                  disabled={isCreatingCustomPack || !customPackQuery.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  {isCreatingCustomPack ? (
                    <GachaLoading message="Поиск" size="sm" variant="default" />
                  ) : (
                    "Найти"
                  )}
                </button>
              </div>
            </div>

            {!isCreatingCustomPack && !createdCustomPack && customPackSearchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">
                      Выбрано: {selectedAnimeIds.size} из {customPackSearchResults.length}
                    </span>
                    {selectedAnimeIds.size > 0 && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
                        Готово к созданию
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllAnime}
                      className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      Выбрать все
                    </button>
                    <button
                      onClick={deselectAllAnime}
                      className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      Снять все
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wider">
                    Найденные аниме (выберите для включения в пак)
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-96 overflow-y-auto p-2">
                    {customPackSearchResults.map(anime => (
                      <div 
                        key={anime.id} 
                        className={`rounded-lg overflow-hidden bg-slate-800/50 border transition-all cursor-pointer ${
                          selectedAnimeIds.has(anime.id) 
                            ? 'border-indigo-500 ring-2 ring-indigo-500/30' 
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        onClick={() => toggleAnimeSelection(anime.id)}
                      >
                        <div className="relative">
                          <img 
                            src={anime.imageUrl} 
                            alt={anime.russian || anime.name} 
                            className="w-full aspect-[2/3] object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute top-1 right-1">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              selectedAnimeIds.has(anime.id)
                                ? 'bg-indigo-500 border-indigo-500'
                                : 'bg-black/50 border-white/50'
                            }`}>
                              {selectedAnimeIds.has(anime.id) && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="p-1.5">
                          <p className="text-xs font-bold text-white truncate">{anime.russian || anime.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-bold text-white">{typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAnimeIds.size > 0 && (
                  <button
                    onClick={handleCreateCustomPackFromSelected}
                    disabled={isCreatingCustomPack}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    {isCreatingCustomPack ? (
                      <GachaLoading message="Создание пака" size="sm" variant="default" />
                    ) : (
                      `Создать пак из ${selectedAnimeIds.size} выбранных аниме`
                    )}
                  </button>
                )}
              </div>
            )}

            {isCreatingCustomPack && (
              <div className="flex items-center justify-center py-12">
                <GachaLoading message="Поиск аниме..." size="md" variant="sketch" />
              </div>
            )}

            {createdCustomPack && customPackSearchResults.length > 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r border border-white/10 animate-in fade-in slide-in-from-top-4 duration-300" style={{backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`, ...{ '--tw-gradient-from': 'oklch(0.5 0.2 280)', '--tw-gradient-to': 'oklch(0.5 0.2 320)' } as React.CSSProperties}}>
                  <h3 className="text-xl font-black text-white mb-2">{createdCustomPack.name}</h3>
                  <p className="text-sm text-white/70 mb-3">{createdCustomPack.description}</p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-bold text-white">{createdCustomPack.price} монет</span>
                    </div>
                    {createdCustomPack.guaranteedRarity && (
                      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-bold text-white">
                          Гарант: {rarityConfig[createdCustomPack.guaranteedRarity as Rarity].label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wider">Найденные аниме ({customPackSearchResults.length})</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-96 overflow-y-auto p-2">
                    {customPackSearchResults.map(anime => (
                      <div key={anime.id} className="rounded-lg overflow-hidden bg-slate-800/50 border border-white/10">
                        <img src={anime.imageUrl} alt={anime.russian || anime.name} className="w-full aspect-[2/3] object-cover" referrerPolicy="no-referrer" />
                        <div className="p-1.5">
                          <p className="text-xs font-bold text-white truncate">{anime.russian || anime.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-bold text-white">{typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectCustomPack(createdCustomPack)}
                  disabled={userCoins < createdCustomPack.price}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  {userCoins < createdCustomPack.price ? "Недостаточно монет" : "Выбрать этот пак"}
                </button>
              </div>
            )}

           
          </div>
        </div>
      )}

      {/* Art Warning Modal */}
      {showArtWarning && revealedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border border-white/10">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
                <RefreshCcw className="w-8 h-8 text-yellow-400" />
              </div>
              
              <div>
                <h3 className="text-2xl font-black text-white mb-3">Отбросить арт?</h3>
                <p className="text-slate-300 leading-relaxed">
                  Этот арт будет добавлен в черный список и не будет появляться при следующих призывах этого персонажа. 
                  Вместо него будут показываться другие арты.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    // Добавляем URL этой картинки в черный список
                    setBlacklistedUrls(prev => [...prev, revealedCard.imageUrl]);
                    setUsedCharacterIds(prev => new Set(prev).add(revealedCard.characterId));
                    setShowCard(false);
                    setShowArtWarning(false);
                  }}
                  className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl transition-all border border-red-500/30"
                >
                  Да, отбросить
                </button>
                <button 
                  onClick={() => setShowArtWarning(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <button onClick={() => setViewedCard(null)} className="absolute top-8 right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            <InteractiveCard card={viewedCard} />
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => removeCard(viewedCard)}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 font-medium"
              >
                <Trash className="w-4 h-4" /> Удалить из коллекции
              </button>
              {viewedCard.isArtBlacklisted && (
                <button 
                  onClick={() => unblacklistArt(viewedCard)}
                  className="flex items-center gap-2 px-6 py-2 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-200 font-medium"
                >
                  <RefreshCcw className="w-4 h-4" /> Разблокировать арт
                </button>
              )}
              <a href={viewedCard.originalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium">
                <ZoomIn className="w-4 h-4" /> Оригинал
              </a>
              <a href={`https://shikimori.one/animes/${viewedCard.shikiId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 font-medium">
                <ExternalLink className="w-4 h-4" /> Шикимори
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase">
            WEEB.<span className="text-primary">X</span> ГАЧА
          </h1>
          <p className="text-slate-400 text-lg font-medium">Нажми чтобы перевернуть карту и увидеть боевые характеристики.</p>
          
          <div className="flex justify-center items-center gap-2 mt-4">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-black text-yellow-400">{userCoins}</span>
          </div>
        </div>

        {selectedPack && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r px-6 py-3 rounded-full border border-white/20">
              <Package className="w-5 h-5 text-white" />
              <span className="text-white font-bold">Выбранный набор: {selectedPack.name}</span>
              <button 
                onClick={() => setSelectedPack(null)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[550px] mb-24 relative">
          {!showCard && !isRolling && (
            <div className="flex flex-col items-center gap-6">
              <button onClick={handleRoll} className="group relative w-72 h-[420px] rounded-[2.5rem] border-2 border-dashed border-slate-700/50 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center hover:border-indigo-500 transition-all">
                <Sparkles className="w-12 h-12 text-indigo-500 mb-4 animate-pulse" />
                <span className="font-black text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">
                  {selectedPack ? `Призвать (${selectedPack.price} монет)` : "Призвать"}
                </span>
              </button>
              
              <button
                onClick={() => setShowPacks(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all"
              >
                <Package className="w-5 h-5" />
                Выбрать набор
              </button>

              <button
                onClick={() => setShowCustomPackCreator(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all"
              >
                <Search className="w-5 h-5" />
                Создать пак
              </button>
            </div>
          )}

          {isRolling && (
            <div className="w-72 h-[420px] rounded-[2.5rem] bg-gradient-to-br from-slate-900/90 to-orange-950/20 border border-orange-500/30 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-orange-400 rounded-full animate-pulse"
                    style={{
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`
                    }}
                  />
                ))}
              </div>
              
              <div className="relative z-10">
                <GachaLoading message="Поиск в мультивселенной..." size="lg" variant="sketch" />
              </div>
              
              <div className="absolute inset-0 rounded-[2.5rem] border-2 border-dashed border-orange-500/20 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
          )}

          {showCard && revealedCard && (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
              <InteractiveCard card={revealedCard} />
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => {
                    setCollectedCards(prev =>[revealedCard, ...prev]);
                    setUsedCharacterIds(prev => new Set(prev).add(revealedCard.characterId));
                    setShowCard(false);
                  }}
                  className="px-8 py-4 bg-white text-black font-black uppercase tracking-wider rounded-2xl hover:bg-indigo-500 hover:text-white transition-all"
                >
                  Сохранить Карту
                </button>
                <button 
                  onClick={() => {
                    setShowArtWarning(true);
                  }}
                  className="px-8 py-4 bg-slate-800/80 text-slate-300 font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-700 transition-all"
                >
                  Отбросить
                </button>
              </div>
            </div>
          )}
        </div>

        {collectedCards.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-500" />
              Коллекция ({collectedCards.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectedCards.map((card) => (
                <div 
                  key={card.uniqueId} 
                  onClick={() => setViewedCard(card)}
                  className={`aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-transform hover:-translate-y-2 ${rarityConfig[card.rarity].glow}`}
                >
                  <img 
                    src={card.imageUrl} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    alt={card.name} 
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, card, true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-90" />
                  <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-r ${rarityConfig[card.rarity].color} shadow-lg`} />
                  {card.isMainCharacter && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 shadow-lg flex items-center justify-center">
                      <Crown className="w-3 h-3 text-black" />
                    </div>
                  )}
                  {card.isArtBlacklisted && (
                    <div className="absolute top-8 left-2 w-4 h-4 rounded-full bg-red-500/80 border border-red-300 flex items-center justify-center">
                      <RefreshCcw className="w-2 h-2 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase truncate">★{card.score.toFixed(1)} {card.anime}</p>
                    <p className="text-sm font-black text-white truncate">{card.name}</p>
                    <p className="text-[8px] font-mono text-white/50 truncate mb-1">ID: {card.uniqueId}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}