"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/layout/navbar"
import { Card, CardStats } from "@/app/gacha/types"
import { Rarity, rarityConfig } from "@/types/gacha"
import { getProxiedSrc } from "@/lib/image-loader"
import { frameNames, coatingNames, FrameOverlay, CoatingOverlay } from "@/components/gacha/card-modifiers"
import {
  Sparkles,
  RefreshCcw,
  Image as ImageIcon,
  Type,
  Activity,
  Star,
  Zap,
  Shield,
  Heart,
  Trash2,
  Crown,
  Hash,
  Layers,
  Gift,
  CalendarPlus,
  Loader2,
  Copy,
  ClipboardPaste,
  FileJson,
  Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  checkAdminAuth,
  getAdminUsersSimple,
  getBanners,
  adminGiftCardToUser,
  addBannerCard,
  setBannerGuaranteedCard,
} from "@/app/admin/actions"
import { generateStatsForRarity } from "@/app/gacha/actions"
import { getCardProvision, getCardBasePower, getCardRole } from "@/app/battle/utils"
import { RARITY_PROVISION_BASE, RARITY_AVG_STATS, ROLE_CONFIG } from "@/app/battle/config"

interface SimpleUser {
  id: string
  username: string | null
  avatar_url: string | null
  email: string | null
  updated_at: string | null
  created_at: string | null
}

interface Banner {
  id: string
  name: string
  description?: string | null
  image_url?: string | null
  is_active?: boolean
  boosted_rarity?: string | null
  price?: number | null
}

export default function CardEditorPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedBannerId, setSelectedBannerId] = useState<string>("")
  const [isFeaturedCard, setIsFeaturedCard] = useState(false)
  const [guaranteedPity, setGuaranteedPity] = useState(77)
  const [selectedGuaranteedBannerId, setSelectedGuaranteedBannerId] = useState<string>("")
  const [jsonInput, setJsonInput] = useState<string>("")
  const [showJsonInput, setShowJsonInput] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const [card, setCard] = useState<Partial<Card>>({
    name: "Новый персонаж",
    anime: "Название аниме",
    rarity: "common",
    imageUrl: "",
    originalUrl: "",
    score: 8.5,
    shikiId: 0,
    characterId: Math.floor(Math.random() * 1000000),
    stats: {
      hp: 50,
      atk: 50,
      def: 50,
      spd: 50,
      luck: 50
    },
    isMainCharacter: false,
    frameModifier: undefined,
    coatingModifier: undefined,
    imageLayers: undefined
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ok = await checkAdminAuth()
        if (cancelled) return
        setIsAuthed(ok)
        setAuthChecked(true)
        if (!ok) {
          router.push("/admin")
          return
        }
        // Load users + banners for the gift / banner flows
        const [u, b] = await Promise.all([getAdminUsersSimple(), getBanners()])
        if (cancelled) return
        setUsers(u as SimpleUser[])
        setBanners(b as Banner[])

        // Check for card data to edit (passed via sessionStorage)
        const editData = sessionStorage.getItem('edit-card-data')
        if (editData) {
          try {
            const parsedCard = JSON.parse(editData) as Card
            setCard({
              ...parsedCard,
              stats: parsedCard.stats
            })
            sessionStorage.removeItem('edit-card-data')
            toast.info("Данные карты загружены для редактирования")
          } catch (e) {
            console.error("Failed to parse edit card data", e)
          }
        }
      } catch (e) {
        console.error("Admin auth check failed", e)
        setAuthChecked(true)
        setIsAuthed(false)
        router.push("/admin")
      }
    })()
    return () => { cancelled = true }
  }, [router])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-400 mx-auto animate-spin" />
          <p className="text-slate-400">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Trash2 className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-black text-white">Доступ запрещен</h1>
          <p className="text-slate-400">Требуется авторизация администратора.</p>
          <Button onClick={() => router.push('/admin')}>Войти в админ-панель</Button>
        </div>
      </div>
    )
  }

  const buildFinalCard = (): Card | null => {
    const hasLayers = card.imageLayers && card.imageLayers.some(l => l)

    if (!card.name || (!card.imageUrl && !hasLayers)) {
      toast.error("Заполните имя и ссылку на изображение или 3D слои")
      return null
    }

    // Auto-fill imageUrl from layers if missing
    let finalImageUrl = card.imageUrl
    if (!finalImageUrl && hasLayers) {
      // Pick character layer first, then background, then foreground
      finalImageUrl = card.imageLayers![1] || card.imageLayers![0] || card.imageLayers![2]
    }

    const uniqueId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const serialId = `CST-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`

    const finalCard: Card = {
      ...card as Card,
      imageUrl: finalImageUrl!,
      originalUrl: finalImageUrl!,
      uniqueId,
      serialId,
      orderIndex: Date.now()
    }

    return finalCard
  }

  const handleGiftToUser = async () => {
    if (!selectedUserId) {
      toast.error("Выберите пользователя")
      return
    }
    const finalCard = buildFinalCard()
    if (!finalCard) return

    try {
      setIsSaving(true)
      await adminGiftCardToUser(selectedUserId, finalCard)
      toast.success("Карта отправлена пользователю в подарок!")
    } catch (error) {
      toast.error("Ошибка при отправке подарка")
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetGuaranteedCard = async () => {
    if (!selectedGuaranteedBannerId) {
      toast.error("Выберите баннер для гаранта")
      return
    }
    if (guaranteedPity < 1) {
      toast.error("Пити должен быть минимум 1")
      return
    }
    const finalCard = buildFinalCard()
    if (!finalCard) return

    try {
      setIsSaving(true)
      await setBannerGuaranteedCard(selectedGuaranteedBannerId, finalCard, guaranteedPity)
      toast.success(`Карта установлена как гарант с pity = ${guaranteedPity}!`)
    } catch (error) {
      toast.error("Ошибка при установке гаранта")
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddToBanner = async () => {
    if (!selectedBannerId) {
      toast.error("Выберите баннер")
      return
    }
    const finalCard = buildFinalCard()
    if (!finalCard) return

    try {
      setIsSaving(true)
      await addBannerCard({
        bannerId: selectedBannerId,
        cardPayload: finalCard,
        isFeatured: isFeaturedCard,
      })
      toast.success("Карта добавлена в баннер!")
    } catch (error) {
      toast.error("Ошибка при добавлении в баннер")
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRandomizeStats = async () => {
    try {
      const newStats = await generateStatsForRarity(card.rarity as string)
      setCard(prev => ({ ...prev, stats: newStats }))
      toast.success(`Случайные статы сгенерированы для редкости "${rarityConfig[card.rarity as Rarity]?.label}"`)
    } catch (e) {
      toast.error("Ошибка генерации статов")
      console.error(e)
    }
  }

  const generateShikiId = () => {
    setCard(prev => ({ ...prev, shikiId: Math.floor(Math.random() * 1000000) }))
  }

  const generateCharacterId = () => {
    setCard(prev => ({ ...prev, characterId: Math.floor(Math.random() * 1000000) }))
  }

  const handleCopyJson = () => {
    const finalCard = buildFinalCard()
    if (!finalCard) return
    const json = JSON.stringify(finalCard, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      toast.success("JSON скопирован в буфер обмена!")
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error("Не удалось скопировать JSON")
    })
  }

  const handleLoadFromJson = () => {
    try {
      const parsed = JSON.parse(jsonInput) as Partial<Card>
      if (!parsed.name || !parsed.rarity) {
        toast.error("JSON должен содержать минимум name и rarity")
        return
      }
      setCard({
        ...parsed,
        stats: parsed.stats || { hp: 50, atk: 50, def: 50, spd: 50, luck: 50 }
      })
      toast.success("Карта загружена из JSON!")
      setShowJsonInput(false)
      setJsonInput("")
    } catch (e) {
      toast.error("Невалидный JSON")
      console.error(e)
    }
  }

  const updateStat = (stat: keyof CardStats, value: number) => {
    setCard(prev => ({
      ...prev,
      stats: {
        ...prev.stats!,
        [stat]: value
      }
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 overflow-x-hidden">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-20 sm:pt-24 lg:pt-28">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          
          {/* Preview Section */}
          <div className="w-full lg:w-1/3 lg:sticky lg:top-28 z-10 space-y-6">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Предпросмотр
            </h2>
            
            <div className={`relative aspect-[2/3] w-full max-w-[280px] sm:max-w-[320px] mx-auto rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl ${rarityConfig[card.rarity as Rarity]?.glow}`}>
              {/* 3D Layers Preview */}
              {card.imageLayers && card.imageLayers.some(l => l) ? (
                <div className="absolute inset-0">
                  {/* BG Layer */}
                  {card.imageLayers[0] && (
                    <img
                      src={getProxiedSrc(card.imageLayers[0])}
                      alt="bg"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  {/* Character Layer */}
                  {card.imageLayers[1] && (
                    <img
                      src={getProxiedSrc(card.imageLayers[1])}
                      alt="char"
                      className="absolute inset-0 w-full h-full object-contain z-10"
                    />
                  )}
                  {/* Foreground Layer */}
                  {card.imageLayers[2] && (
                    <img
                      src={getProxiedSrc(card.imageLayers[2])}
                      alt="vfx"
                      className="absolute inset-0 w-full h-full object-cover z-20 opacity-80"
                    />
                  )}
                </div>
              ) : card.imageUrl ? (
                <img
                  src={getProxiedSrc(card.imageUrl)}
                  alt={card.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <ImageIcon className="w-12 h-12 opacity-20" />
                  <span className="text-xs font-bold uppercase tracking-widest">Нет изображения</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              
              {/* Modifier Overlays */}
              <CoatingOverlay coating={card.coatingModifier} />
              <FrameOverlay frame={card.frameModifier} />
              
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-black/40 border border-white/20`}>
                   <span className={`bg-gradient-to-r ${rarityConfig[card.rarity as Rarity]?.color} bg-clip-text text-transparent`}>
                    {rarityConfig[card.rarity as Rarity]?.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-[10px] font-black">{card.score?.toFixed(1)}</span>
                </div>
              </div>

              {card.isMainCharacter && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 shadow-lg flex items-center justify-center border border-yellow-200 z-20">
                  <Crown className="w-4 h-4 text-amber-950" />
                </div>
              )}

              <div className="absolute bottom-4 inset-x-4">
                <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-2xl p-4 shadow-2xl">
                  <h3 className="text-lg font-black uppercase leading-none truncate mb-1">{card.name}</h3>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {card.frameModifier && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase font-black">
                        {frameNames[card.frameModifier]}
                      </span>
                    )}
                    {card.coatingModifier && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase font-black">
                        {coatingNames[card.coatingModifier]}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider truncate">{card.anime}</p>
                  <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-[8px] font-mono text-white/40 tracking-wider">ID: custom</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-400">
                <span>Характеристики</span>
                <Activity className="w-4 h-4" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatPreview label="HP" value={card.stats?.hp || 0} color="from-red-500 to-rose-600" />
                <StatPreview label="ATK" value={card.stats?.atk || 0} color="from-orange-500 to-amber-600" />
                <StatPreview label="DEF" value={card.stats?.def || 0} color="from-blue-500 to-indigo-600" />
                <StatPreview label="SPD" value={card.stats?.spd || 0} color="from-emerald-500 to-teal-600" />
                <StatPreview label="LCK" value={card.stats?.luck || 0} color="from-purple-500 to-pink-600" />
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="w-full lg:w-2/3 space-y-8">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">Создание Карты</h1>
              <p className="text-slate-400">Админ-инструмент: создайте карту и подарите пользователю или добавьте в баннер</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-slate-400" /> Имя персонажа
                  </Label>
                  <Input 
                    value={card.name} 
                    onChange={e => setCard(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-900/50 border-white/10 focus:border-indigo-500 h-12 text-lg font-bold"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-slate-400" /> Название аниме
                  </Label>
                  <Input 
                    value={card.anime} 
                    onChange={e => setCard(prev => ({ ...prev, anime: e.target.value }))}
                    className="bg-slate-900/50 border-white/10 focus:border-indigo-500 h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-400" /> URL изображения
                  </Label>
                  <Input 
                    value={card.imageUrl} 
                    onChange={e => setCard(prev => ({ ...prev, imageUrl: e.target.value, originalUrl: e.target.value }))}
                    className="bg-slate-900/50 border-white/10 focus:border-indigo-500 h-12"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Редкость</Label>
                    <Select 
                      value={card.rarity} 
                      onValueChange={v => setCard(prev => ({ ...prev, rarity: v as Rarity }))}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {Object.entries(rarityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key} className="focus:bg-white/10 focus:text-white">
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Рейтинг MAL</Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={card.score} 
                      onChange={e => setCard(prev => ({ ...prev, score: parseFloat(e.target.value) }))}
                      className="bg-slate-900/50 border-white/10 h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" /> Shiki ID
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={generateShikiId}>
                        <RefreshCcw className="w-3 h-3" />
                      </Button>
                    </Label>
                    <Input 
                      type="number" 
                      value={card.shikiId} 
                      onChange={e => setCard(prev => ({ ...prev, shikiId: parseInt(e.target.value) }))}
                      className="bg-slate-900/50 border-white/10 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" /> Character ID
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={generateCharacterId}>
                        <RefreshCcw className="w-3 h-3" />
                      </Button>
                    </Label>
                    <Input 
                      type="number" 
                      value={card.characterId} 
                      onChange={e => setCard(prev => ({ ...prev, characterId: parseInt(e.target.value) }))}
                      className="bg-slate-900/50 border-white/10 h-12"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-900/30 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                      <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight">Главный герой</p>
                      <p className="text-[10px] text-white/50">Добавляет корону на карту</p>
                    </div>
                  </div>
                  <Switch 
                    checked={card.isMainCharacter} 
                    onCheckedChange={v => setCard(prev => ({ ...prev, isMainCharacter: v }))} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Рамка</Label>
                    <Select 
                      value={card.frameModifier || "none"} 
                      onValueChange={v => setCard(prev => ({ ...prev, frameModifier: v === "none" ? undefined : v }))}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="none">Без рамки</SelectItem>
                        {Object.entries(frameNames).map(([key, name]) => (
                          <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Покрытие</Label>
                    <Select 
                      value={card.coatingModifier || "none"} 
                      onValueChange={v => setCard(prev => ({ ...prev, coatingModifier: v === "none" ? undefined : v }))}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="none">Без эффекта</SelectItem>
                        {Object.entries(coatingNames).map(([key, name]) => (
                          <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-6 bg-slate-900/30 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="font-black uppercase tracking-widest text-sm text-slate-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> 3D Слои (PNG)
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase font-black tracking-widest">Задний план (Background)</Label>
                      <Input 
                        placeholder="URL для фона..."
                        value={card.imageLayers?.[0] || ""} 
                        onChange={e => {
                          const layers = [...(card.imageLayers || ["", "", ""])];
                          layers[0] = e.target.value;
                          setCard(prev => ({ ...prev, imageLayers: layers as [string, string, string] }));
                        }}
                        className="bg-slate-900/50 border-white/10 h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase font-black tracking-widest">Средний план (Character)</Label>
                      <Input 
                        placeholder="URL для персонажа..."
                        value={card.imageLayers?.[1] || ""} 
                        onChange={e => {
                          const layers = [...(card.imageLayers || ["", "", ""])];
                          layers[1] = e.target.value;
                          setCard(prev => ({ ...prev, imageLayers: layers as [string, string, string] }));
                        }}
                        className="bg-slate-900/50 border-white/10 h-10 text-xs border-indigo-500/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase font-black tracking-widest">Передний план (VFX/Particles)</Label>
                      <Input 
                        placeholder="URL для эффектов..."
                        value={card.imageLayers?.[2] || ""} 
                        onChange={e => {
                          const layers = [...(card.imageLayers || ["", "", ""])];
                          layers[2] = e.target.value;
                          setCard(prev => ({ ...prev, imageLayers: layers as [string, string, string] }));
                        }}
                        className="bg-slate-900/50 border-white/10 h-10 text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Оставьте пустым, чтобы использовать основное изображение</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-900/30 rounded-3xl border border-white/5 space-y-6">
                <h3 className="font-black uppercase tracking-widest text-sm text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Характеристики (0-100)
                </h3>
                
                <StatSlider label="HP" icon={<Heart className="w-4 h-4 text-red-500" />} value={card.stats?.hp || 0} onChange={v => updateStat('hp', v)} />
                <StatSlider label="ATK" icon={<Zap className="w-4 h-4 text-orange-500" />} value={card.stats?.atk || 0} onChange={v => updateStat('atk', v)} />
                <StatSlider label="DEF" icon={<Shield className="w-4 h-4 text-blue-500" />} value={card.stats?.def || 0} onChange={v => updateStat('def', v)} />
                <StatSlider label="SPD" icon={<RefreshCcw className="w-4 h-4 text-emerald-500" />} value={card.stats?.spd || 0} onChange={v => updateStat('spd', v)} />
                <StatSlider label="LCK" icon={<Star className="w-4 h-4 text-purple-500" />} value={card.stats?.luck || 0} onChange={v => updateStat('luck', v)} />

                {/* Randomize stats + Power/Provision indicator */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-500 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> Сила и вес карты
                    </h4>
                    <Button
                      onClick={handleRandomizeStats}
                      variant="outline"
                      className="h-9 bg-white/5 border-white/10 hover:bg-white/10 rounded-xl font-bold text-xs whitespace-nowrap"
                    >
                      <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                      Случайные статы
                    </Button>
                  </div>

                  {(() => {
                  const fullCard = card as Card
                  const hasStats = card.stats && (card.stats.hp !== undefined)
                  if (!hasStats) return null

                  const provision = getCardProvision(fullCard)
                  const basePower = getCardBasePower(fullCard)
                  const role = getCardRole(fullCard)
                  const baseProvision = RARITY_PROVISION_BASE[card.rarity as string] ?? 0
                  const avgStats = RARITY_AVG_STATS[card.rarity as string] ?? 100
                  const s = fullCard.stats
                  const actualTotalStats = (s.hp / 8) + s.atk + s.def + s.spd + s.luck
                  const statRatio = actualTotalStats / avgStats
                  const isOverpowered = statRatio > 1.3
                  const isUnderpowered = statRatio < 0.7
                  const isBalanced = !isOverpowered && !isUnderpowered

                  return (
                    <div className="space-y-3">
                      {/* Provision + Power */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Вес (Provision)</p>
                          <p className={`text-2xl font-black ${provision > baseProvision + 2 ? "text-red-400" : provision < baseProvision - 1 ? "text-blue-400" : "text-emerald-400"}`}>
                            {provision}
                          </p>
                          <p className="text-[9px] text-slate-600 mt-0.5">база: {baseProvision}</p>
                        </div>
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Базовая сила</p>
                          <p className="text-2xl font-black text-indigo-400">
                            {basePower}
                          </p>
                          <p className="text-[9px] text-slate-600 mt-0.5">макс: 200</p>
                        </div>
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Роль</p>
                          <p className={`text-sm font-black ${ROLE_CONFIG[role]?.color || "text-slate-400"}`}>
                            {ROLE_CONFIG[role]?.label || "—"}
                          </p>
                          <p className="text-[9px] text-slate-600 mt-0.5">по КНБ</p>
                        </div>
                      </div>

                      {/* Rarity match indicator */}
                      <div className={`p-3 rounded-xl border ${isBalanced ? "bg-emerald-500/10 border-emerald-500/20" : isOverpowered ? "bg-red-500/10 border-red-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Соответствие редкости</span>
                          <span className={`text-xs font-black ${isBalanced ? "text-emerald-400" : isOverpowered ? "text-red-400" : "text-blue-400"}`}>
                            {isBalanced ? "✓ Норма" : isOverpowered ? "⚠ Слишком сильная" : "↓ Слабая"}
                          </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden relative">
                          {/* Expected range zone (70%-130%) */}
                          <div className="absolute inset-y-0 left-[35%] right-[35%] bg-emerald-500/20" />
                          {/* Actual ratio marker */}
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-white rounded-full"
                            style={{ left: `${Math.min(100, Math.max(0, statRatio * 50))}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                          <span>0%</span>
                          <span className="text-emerald-500">норма 70-130%</span>
                          <span>200%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          Сумма статов: <span className="font-bold text-slate-300">{Math.round(actualTotalStats)}</span> / ожидание: <span className="font-bold text-slate-300">{avgStats}</span> ({Math.round(statRatio * 100)}%)
                        </p>
                      </div>
                    </div>
                  )
                })()}
                </div>
              </div>
            </div>

            {/* JSON Import/Export section */}
            <div className="space-y-4 p-6 bg-slate-900/40 rounded-3xl border border-white/5">
              <h3 className="font-black uppercase tracking-widest text-sm text-slate-400 flex items-center gap-2">
                <FileJson className="w-4 h-4" /> JSON Экспорт / Импорт
              </h3>

              <div className="flex gap-3">
                <Button
                  onClick={handleCopyJson}
                  variant="outline"
                  className="flex-1 h-12 bg-white/5 border-white/10 hover:bg-white/10 rounded-2xl font-bold"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-emerald-400" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Копировать JSON
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowJsonInput(!showJsonInput)}
                  variant="outline"
                  className="flex-1 h-12 bg-white/5 border-white/10 hover:bg-white/10 rounded-2xl font-bold"
                >
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  {showJsonInput ? "Скрыть" : "Загрузить из JSON"}
                </Button>
              </div>

              {showJsonInput && (
                <div className="space-y-3">
                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    placeholder='Вставьте JSON карты здесь...\nНапример: {"name":"...","rarity":"...","stats":{...}}'
                    className="w-full h-48 p-3 bg-slate-950/80 border border-white/10 rounded-2xl text-xs font-mono text-white/80 resize-y focus:border-indigo-500 focus:outline-none"
                  />
                  <Button
                    onClick={handleLoadFromJson}
                    disabled={!jsonInput.trim()}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 font-black uppercase tracking-widest rounded-2xl disabled:opacity-50"
                  >
                    <FileJson className="w-4 h-4 mr-2" />
                    Загрузить карту из JSON
                  </Button>
                </div>
              )}
            </div>

            {/* Admin delivery section: gift to user OR add to banner */}
            <div className="space-y-6 p-6 bg-slate-900/40 rounded-3xl border border-white/5">
              <h3 className="font-black uppercase tracking-widest text-sm text-slate-400 flex items-center gap-2">
                <Gift className="w-4 h-4" /> Доставка карты
              </h3>

              {/* Gift to user */}
              <div className="space-y-3 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  <Gift className="w-4 h-4 text-indigo-400" /> Подарить пользователю
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                    <SelectValue placeholder="Выберите пользователя..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white max-h-72">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="focus:bg-white/10 focus:text-white">
                        {u.username || "Без имени"} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                    {users.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">Нет пользователей</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleGiftToUser}
                  disabled={isSaving || !selectedUserId}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 font-black uppercase tracking-widest rounded-2xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Подарить пользователю
                    </>
                  )}
                </Button>
              </div>

              {/* Add to banner */}
              <div className="space-y-3 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  <CalendarPlus className="w-4 h-4 text-pink-400" /> Добавить в баннер
                </Label>
                <Select value={selectedBannerId} onValueChange={setSelectedBannerId}>
                  <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                    <SelectValue placeholder="Выберите баннер..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white max-h-72">
                    {banners.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="focus:bg-white/10 focus:text-white">
                        {b.name} {b.is_active ? "" : "(неактивен)"}
                      </SelectItem>
                    ))}
                    {banners.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">Нет баннеров</div>
                    )}
                  </SelectContent>
                </Select>
                <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight">Избранная карта</p>
                    <p className="text-[10px] text-white/50">Повышенный вес / featured</p>
                  </div>
                  <Switch checked={isFeaturedCard} onCheckedChange={setIsFeaturedCard} />
                </div>
                <Button
                  onClick={handleAddToBanner}
                  disabled={isSaving || !selectedBannerId}
                  className="w-full h-12 bg-pink-600 hover:bg-pink-500 font-black uppercase tracking-widest rounded-2xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Добавление...
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Добавить в баннер
                    </>
                  )}
                </Button>
              </div>

              {/* Set as guaranteed card */}
              <div className="space-y-3 p-4 bg-amber-950/30 rounded-2xl border border-amber-500/20">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Установить как гарант баннера
                </Label>
                <p className="text-[10px] text-amber-300/60">Карта будет гарантированно выпадать игроку после N круток этого баннера</p>
                <Select value={selectedGuaranteedBannerId} onValueChange={setSelectedGuaranteedBannerId}>
                  <SelectTrigger className="bg-slate-900/50 border-white/10 h-12">
                    <SelectValue placeholder="Выберите баннер для гаранта..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white max-h-72">
                    {banners.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="focus:bg-white/10 focus:text-white">
                        {b.name} {b.is_active ? "" : "(неактивен)"}
                      </SelectItem>
                    ))}
                    {banners.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">Нет баннеров</div>
                    )}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase font-black tracking-widest">Pity (количество круток до гаранта)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={guaranteedPity}
                    onChange={e => setGuaranteedPity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-slate-900/50 border-white/10 h-12"
                  />
                </div>
                <Button
                  onClick={handleSetGuaranteedCard}
                  disabled={isSaving || !selectedGuaranteedBannerId}
                  className="w-full h-12 bg-amber-600 hover:bg-amber-500 font-black uppercase tracking-widest rounded-2xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Установка...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Установить гарант (pity: {guaranteedPity})
                    </>
                  )}
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setCard(prev => ({ ...prev, characterId: Math.floor(Math.random() * 1000000) }))}
                className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 rounded-2xl"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Сгенерировать новый Character ID
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatSlider({ label, icon, value, onChange }: { label: string, icon: React.ReactNode, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter">
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-slate-300 bg-black/40 px-2 py-0.5 rounded-md min-w-[30px] text-center">{value}</span>
      </div>
      <Slider 
        value={[value]} 
        max={100} 
        step={1} 
        onValueChange={([v]: number[]) => onChange(v)}
        className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
      />
    </div>
  )
}

function StatPreview({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-black text-white/50">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
