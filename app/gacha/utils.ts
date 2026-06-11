import React from "react"
import { Card, CollectionRating } from "./types"
import { Rarity, rarityConfig } from "@/types/gacha"

export function generateCardUniqueId(characterId: number, packId?: string): string {
  const uuid = crypto.randomUUID()
  const packPrefix = packId ? `pack-${packId}` : 'random'
  return `${packPrefix}-${characterId}-${uuid}`
}

export function calculateCollectionRating(cards: Card[]): CollectionRating {
  if (cards.length === 0) {
    return {
      overallScore: 0,
      grade: "F",
      gradeColor: "text-stone-400",
      totalPower: 0,
      avgRarity: 0,
      powerScore: 0,
      rarityDistribution: {} as Record<Rarity, number>,
      topCards: [],
      stats: { avgHp: 0, avgAtk: 0, avgDef: 0, avgSpd: 0, avgLuck: 0 }
    }
  }

  const rarityScoreByRarity: Record<Rarity, number> = {
    trash: 0, common: 10, uncommon: 20, rare: 32, super_rare: 45, epic: 60,
    mythic: 72, legendary: 82, ancient: 90, divine: 95, transcendent: 98, omnipotent: 100,
  }

  const rarityDistribution: Record<Rarity, number> = {
    trash: 0, common: 0, uncommon: 0, rare: 0, super_rare: 0, epic: 0,
    mythic: 0, legendary: 0, ancient: 0, divine: 0, transcendent: 0, omnipotent: 0
  }
  
  let totalPower = 0
  let totalStats = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 }

  cards.forEach(card => {
    rarityDistribution[card.rarity] = (rarityDistribution[card.rarity] || 0) + 1
    const cardPower = card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
    totalPower += cardPower
    totalStats.hp += card.stats.hp
    totalStats.atk += card.stats.atk
    totalStats.def += card.stats.def
    totalStats.spd += card.stats.spd
    totalStats.luck += card.stats.luck
  })

  const numCards = cards.length
  
  const avgStats = {
    avgHp: Math.round(totalStats.hp / numCards),
    avgAtk: Math.round(totalStats.atk / numCards),
    avgDef: Math.round(totalStats.def / numCards),
    avgSpd: Math.round(totalStats.spd / numCards),
    avgLuck: Math.round(totalStats.luck / numCards)
  }
  
  const avgRarity = Math.round(
    cards.reduce((acc, c) => acc + (rarityScoreByRarity[c.rarity] ?? 0), 0) / numCards
  )
  
  const avgPower = totalPower / numCards
  const powerScore = Math.max(0, Math.min(Math.round((avgPower / 500) * 100), 100))
  const overallScore = Math.round((avgRarity * 0.55) + (powerScore * 0.45))
  
  let grade: string, gradeColor: string
  
  if (overallScore >= 90) { grade = "S+"; gradeColor = "from-amber-400 to-orange-500" }
  else if (overallScore >= 80) { grade = "S"; gradeColor = "from-amber-500 to-yellow-500" }
  else if (overallScore >= 70) { grade = "A"; gradeColor = "from-purple-400 to-pink-500" }
  else if (overallScore >= 60) { grade = "B"; gradeColor = "from-blue-400 to-cyan-500" }
  else if (overallScore >= 50) { grade = "C"; gradeColor = "from-emerald-400 to-teal-500" }
  else if (overallScore >= 40) { grade = "D"; gradeColor = "from-slate-400 to-slate-500" }
  else { grade = "F"; gradeColor = "from-stone-500 to-stone-700" }
  
  const topCards = [...cards]
    .sort((a, b) => {
      const aScore = rarityConfig[a.rarity].weight + (a.stats.hp + a.stats.atk + a.stats.def + a.stats.spd + a.stats.luck) * 0.1
      const bScore = rarityConfig[b.rarity].weight + (b.stats.hp + b.stats.atk + b.stats.def + b.stats.spd + b.stats.luck) * 0.1
      return bScore - aScore
    })
    .slice(0, 5)
  
  return { overallScore, grade, gradeColor, totalPower, avgRarity, powerScore, rarityDistribution, topCards, stats: avgStats }
}

export const isPinterestUrl = (url: string) => url.includes('i.pinimg.com') || url.includes('pinimg.com')

export const getProxiedSrc = (url: string) => {
  if (!url) return url
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
  return url
}

export const getOptimizedThumbSrc = (url: string, width: number = 384, quality: number = 60) => {
  if (!url) return url
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`
}

export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  card: Card,
  isCollection: boolean = false
) => {
  const target = e.target as HTMLImageElement
  
  target.srcset = ""
  
  if (!target.dataset.triedBypassProxy && target.src.includes('/api/image-proxy')) {
    console.log(`[${card.name}] Pinterest proxy failed, trying direct URL`)
    target.dataset.triedBypassProxy = "true"
    const urlMatch = target.src.match(/url=([^&]+)/)
    if (urlMatch) {
      const originalUrl = decodeURIComponent(urlMatch[1])
      target.src = originalUrl
      return
    }
  }
  
  if (!target.dataset.triedOriginal && card.originalUrl) {
    target.dataset.triedOriginal = "true"
    const cleanUrl = card.originalUrl.split('?')[0]
    target.src = cleanUrl
    return
  }

  if (!target.dataset.triedMirror) {
    target.dataset.triedMirror = "true"
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.jpg`
    return
  }

  if (!target.dataset.triedShikiPng) {
    console.log(`[${card.name}] Попытка Shikimori PNG`)
    target.dataset.triedShikiPng = "true"
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.png`
  } else if (!target.dataset.triedShikiWebp) {
    console.log(`[${card.name}] Попытка Shikimori WebP`)
    target.dataset.triedShikiWebp = "true"
    target.src = `https://shikimori.one/system/characters/webp/original/${card.characterId}.webp`
  } else if (!target.dataset.triedJikan) {
    console.log(`[${card.name}] Попытка Jikan API (MyAnimeList)`)
    target.dataset.triedJikan = "true"
    fetch(`https://api.jikan.moe/v4/characters/${card.characterId}/pictures`)
      .then(res => res.json())
      .then(data => {
        if (data?.data && data.data.length > 0) {
          const pic = data.data.find((p: any) => p.jpg?.image_url) || data.data[0]
          target.src = pic.jpg?.image_url || pic.webp?.image_url
        } else {
          target.src = 'https://picsum.photos/seed/force-error/1/1'
        }
      })
      .catch(() => {
        target.src = 'https://picsum.photos/seed/force-error/1/1'
      })
  } else if (!target.dataset.triedPlaceholder) {
    console.log(`[${card.name}] Все попытки исчерпаны, используем картинку-заглушку`)
    target.dataset.triedPlaceholder = "true"
    const seed = card.anime.replace(/[^a-z0-9]/gi, '') + card.characterId
    target.src = `https://picsum.photos/seed/anime-${seed}/${isCollection ? '200/300' : '400/600'}.jpg`
  } else {
    console.log(`[${card.name}] Картинка-заглушка не загрузилась, показываем UI-заглушку`)
    target.style.display = 'none'
    const containerClass = isCollection ? 'collection-placeholder' : 'image-placeholder'
    const placeholder = target.parentElement?.querySelector(`.${containerClass}`)
    if (!placeholder) {
      const div = document.createElement('div')
      div.className = `${containerClass} absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-white p-2`
      if (isCollection) {
        div.innerHTML = `
          <div class="text-2xl sm:text-3xl mb-1">🎌</div>
          <div class="text-[10px] sm:text-xs font-bold text-center mt-1 truncate w-full px-2">${card.name}</div>
        `
      } else {
        div.innerHTML = `
          <div class="text-4xl sm:text-5xl mb-3">🎌</div>
          <div class="text-sm sm:text-base font-bold text-center mb-1 px-4">${card.name}</div>
          <div class="text-xs text-slate-400 text-center px-4">${card.anime}</div>
          <div class="text-[10px] sm:text-xs px-3 py-1 bg-red-500/20 text-red-300 rounded-full mt-3">Арт недоступен</div>
        `
      }
      target.parentElement?.appendChild(div)
    }
  }
}
