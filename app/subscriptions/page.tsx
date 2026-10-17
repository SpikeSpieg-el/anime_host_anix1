"use client"

/**
 * Список отслеживаемых тайтлов (`/subscriptions`).
 *
 * Отдельное место намеренно: колокольчик в шапке показывает «пришли»
 * (`episode_updates`), а здесь — «жду» (`title_subscriptions` +
 * `translation_alerts`). Смешивать их нельзя: у «пришли» есть кнопка
 * «очистить всё», и если бы она гасила ещё и ожидания, человек нажал бы её
 * и решил, что перестал следить, а проверка продолжала бы присылать пуши.
 *
 * Каналы переключаются по отдельности. Раньше кнопка на странице тайтла
 * показывала одну строку «Уведомлю о: серии и озвучка», и снять один канал,
 * не потеряв второй, было невозможно — приходилось отписываться целиком.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, ArrowUpDown, Bell, BellOff, BellRing, LoaderCircle, RotateCcw, Save, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SubscriptionsSkeleton } from "@/components/shared/skeleton"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { AuthModal } from "@/components/auth/auth-modal"
import { useAuth } from "@/components/auth/auth-provider"
import { useCover } from "@/components/providers/cover-provider"
import { supabase } from "@/lib/supabase"
import { getWatchPath } from "@/lib/seo/watch-url"
import { pluralEpisodesAccusative } from "@/lib/translation-alerts"
import { cn } from "@/lib/utils"
import type { SubscriptionListItem } from "@/app/api/subscriptions/route"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Filter = "all" | "episodes" | "dub"
type SortMode = "waiting" | "title" | "recent"
type DeleteTarget = { type: "anime"; animeId: string; animeTitle: string } | { type: "all" }

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth()
  const { preloadBatch, getFromCache } = useCover()

  const [items, setItems] = useState<SubscriptionListItem[]>([])
  const [savedChannels, setSavedChannels] = useState<
    Map<string, { notifyNewEpisodes: boolean; notifyDub: boolean }>
  >(new Map())
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("waiting")
  const [saving, setSaving] = useState(false)
  const [loadingCoverIds, setLoadingCoverIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  /** Тайтлы, для которых обложку уже пытались догрузить — чтобы не гонять повторно. */
  const attemptedRef = useRef<Set<string>>(new Set())
  /** Актуальная ссылка на `preloadBatch`; см. объяснение в его эффекте. */
  const preloadRef = useRef(preloadBatch)
  preloadRef.current = preloadBatch
  /** Фоновая догрузка должна оборваться только при уходе со страницы. */
  const unmountedRef = useRef(false)

  const load = useCallback(async () => {
    if (!user) {
      setItems([])
      setSavedChannels(new Map())
      setLoaded(true)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) {
      setLoaded(true)
      return
    }

    try {
      const res = await fetch("/api/subscriptions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (!res.ok) {
        setError("Не удалось загрузить список")
        setLoaded(true)
        return
      }
      const data = await res.json().catch(() => null)
      const subscriptions: SubscriptionListItem[] = Array.isArray(data?.subscriptions)
        ? data.subscriptions
        : []
      setItems(subscriptions)
      setSavedChannels(
        new Map(
          subscriptions.map((item) => [
            item.animeId,
            {
              notifyNewEpisodes: item.notifyNewEpisodes,
              notifyDub: item.notifyDub,
            },
          ]),
        ),
      )
      setError(null)
    } catch (e) {
      console.warn("[subscriptions] load failed:", e)
      setError("Не удалось загрузить список")
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  useEffect(() => {
    return () => {
      unmountedRef.current = true
    }
  }, [])

  /**
   * Обложки для тайтлов, у которых в подписке их нет.
   *
   * У половины подписок колонка `poster` пустая: их заводили годами назад, а
   * обложку писало только приложение-плашка в плеере. В Shikimori у части
   * таких тайтлов тоже ничего нет — там лежит `missing_original.jpg`.
   *
   * На остальных страницах сайта это решает `cover-provider`: он идёт по
   * AniList → Kitsu → Kodik → MAL и кэширует результат на 7 дней. Здесь мы
   * пользуемся тем же самым механизмом, только фоном и порциями: список
   * сначала рисуется с буквами-заглушками, а картинки подставляются по мере
   * прихода. Ждать четыре внешних API на каждый из 47 тайтлов перед отрисовкой
   * страницы нельзя — это десятки секунд.
   */
  useEffect(() => {
    // Уже пробовали — повторно не гоним: иначе эффект, зависящий от `items`,
    // после каждой подстановки запускал бы догрузку заново по кругу.
    const pending = items.filter((item) => !item.poster && !attemptedRef.current.has(item.animeId))
    if (pending.length === 0) return
    for (const item of pending) attemptedRef.current.add(item.animeId)

    const CHUNK = 12

    const run = async () => {
      for (let start = 0; start < pending.length; start += CHUNK) {
        if (unmountedRef.current) return
        const chunk = pending.slice(start, start + CHUNK)
        const chunkIds = chunk.map((item) => item.animeId)
        setLoadingCoverIds((current) => new Set([...current, ...chunkIds]))
        try {
          // Результат никуда не возвращаем наружу: `cover-provider` сам
          // кладёт его в свой кэш, и компонент подхватит обложку на
          // следующем рендере (см. `itemsWithPosters`). Забирать его здесь
          // через `getFromCache` бессмысленно — это колбэк, замыкающийся на
          // состояние кэша на момент старта эффекта, то есть устаревшее.
          await preloadRef.current(
            chunk.map((item) => ({
              id: item.animeId,
              shikimoriUrl: "",
              romajiName: "",
              russianName: item.animeTitle,
            })),
          )
        } catch (e) {
          console.warn("[subscriptions] догрузка обложек не удалась:", e)
        } finally {
          setLoadingCoverIds((current) => {
            const next = new Set(current)
            for (const id of chunkIds) next.delete(id)
            return next
          })
        }
      }
    }

    void run()
    // Зависимость только от `items`, и НЕ от `preloadBatch`. Провайдер
    // пересоздаёт эту функцию на каждое попадание в кэш, то есть буквально
    // после каждой найденной обложки. С ней в зависимостях эффект
    // перезапускался, его cleanup сбрасывал `cancelled`, и цикл обрывался
    // после двух чанков из четырёх — половина тайтлов навсегда оставалась с
    // буквой. Останавливаем только размонтирование.
  }, [items])

  /**
   * Обложка из кэша `cover-provider`, если в подписке её нет.
   *
   * Берётся прямо на рендере, а не в эффекте: провайдер хранит найденные
   * обложки в своём состоянии, и компонент, читающий контекст,
   * перерисовывается сам, когда кэш наполнился. Никакой синхронизации
   * состояния не нужно — и не нужно ждать окончания догрузки, чтобы
   * показать первые картинки.
   */
  const itemsWithPosters = useMemo(
    () =>
      items.map((item) => {
        if (item.poster) return item
        const cached = getFromCache(item.animeId)
        const poster = cached?.poster
        if (!poster || poster.startsWith("data:")) return item
        return { ...item, poster }
      }),
    [items, getFromCache],
  )

  /** Переключатели редактируют черновик; сервер обновляется общей кнопкой. */
  const toggleChannel = useCallback(
    (animeId: string, channel: "episodes" | "dub", next: boolean) => {
      if (saving) return
      setError(null)
      setItems((current) =>
        current.map((item) =>
          item.animeId === animeId
            ? {
                ...item,
                notifyNewEpisodes: channel === "episodes" ? next : item.notifyNewEpisodes,
                notifyDub: channel === "dub" ? next : item.notifyDub,
              }
            : item,
        ),
      )
    },
    [saving],
  )

  const dirtyItems = useMemo(
    () =>
      items.filter((item) => {
        const saved = savedChannels.get(item.animeId)
        return (
          saved &&
          (saved.notifyNewEpisodes !== item.notifyNewEpisodes ||
            saved.notifyDub !== item.notifyDub)
        )
      }),
    [items, savedChannels],
  )

  const discardChanges = useCallback(() => {
    setItems((current) =>
      current.map((item) => {
        const saved = savedChannels.get(item.animeId)
        return saved
          ? {
              ...item,
              notifyNewEpisodes: saved.notifyNewEpisodes,
              notifyDub: saved.notifyDub,
            }
          : item
      }),
    )
    setError(null)
  }, [savedChannels])

  const saveChanges = useCallback(async () => {
    if (saving || dirtyItems.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error("no session")

      const results: Array<{ item: SubscriptionListItem; ok: boolean }> = []
      const batchSize = 5
      for (let start = 0; start < dirtyItems.length; start += batchSize) {
        const batchResults = await Promise.all(
          dirtyItems.slice(start, start + batchSize).map(async (item) => {
            try {
              const res = await fetch("/api/subscriptions", {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  animeId: item.animeId,
                  animeTitle: item.animeTitle,
                  poster: item.poster,
                  notifyNewEpisodes: item.notifyNewEpisodes,
                  notifyDub: item.notifyDub,
                }),
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              return { item, ok: true }
            } catch (e) {
              console.error(`[subscriptions] save failed for ${item.animeId}:`, e)
              return { item, ok: false }
            }
          }),
        )
        results.push(...batchResults)
      }

      const successful = results.filter((result) => result.ok).map((result) => result.item)
      const failed = results.filter((result) => !result.ok).map((result) => result.item)

      if (successful.length > 0) {
        setSavedChannels((current) => {
          const next = new Map(current)
          for (const item of successful) {
            next.set(item.animeId, {
              notifyNewEpisodes: item.notifyNewEpisodes,
              notifyDub: item.notifyDub,
            })
          }
          return next
        })
        await load()

        if (failed.length > 0) {
          const failedById = new Map(failed.map((item) => [item.animeId, item]))
          setItems((current) =>
            current.map((item) => {
              const draft = failedById.get(item.animeId)
              return draft
                ? {
                    ...item,
                    notifyNewEpisodes: draft.notifyNewEpisodes,
                    notifyDub: draft.notifyDub,
                  }
                : item
            }),
          )
        }
      }

      if (failed.length > 0) {
        setError(
          `Не удалось сохранить настройки для ${failed.length} тайтлов. Остальные изменения сохранены.`,
        )
      }
    } catch (e) {
      console.error("[subscriptions] save changes failed:", e)
      setError("Не удалось сохранить изменения")
    } finally {
      setSaving(false)
    }
  }, [dirtyItems, load, saving])

  const deleteSubscriptions = useCallback(async () => {
    if (!deleteTarget) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error("no session")

      const url =
        deleteTarget.type === "anime"
          ? `/api/subscriptions?animeId=${encodeURIComponent(deleteTarget.animeId)}`
          : "/api/subscriptions"
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("delete failed")

      setItems((current) =>
        deleteTarget.type === "all"
          ? []
          : current.filter((item) => item.animeId !== deleteTarget.animeId),
      )
      setSavedChannels((current) => {
        if (deleteTarget.type === "all") return new Map()
        const next = new Map(current)
        next.delete(deleteTarget.animeId)
        return next
      })
      setDeleteTarget(null)
    } catch (e) {
      console.warn("[subscriptions] delete failed:", e)
      setError(
        deleteTarget.type === "all"
          ? "Не удалось отписаться"
          : "Не удалось удалить тайтл из списка",
      )
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget])

  /**
   * Порядок строк.
   *
   * Список НЕ переупорядочивается как следствие правки. Переключение тумблера
   * меняет ключ сортировки (появилось ожидание озвучки — значит «ждём»), и при
   * обычном пересчёте карточка улетает наверх прямо в момент, когда человек её
   * трогает: курсор остаётся на месте, а под ним — другая строка. На 91 тайтле
   * это ещё и означало два скачка: сначала по выдуманному номеру серии, потом
   * по настоящему.
   *
   * Поэтому порядок зафиксирован и обновляется только по явному действию:
   * первая загрузка, смена сортировки, смена фильтра или поиска. Внутри
   * порядка содержимое строк остаётся живым — переключатель работает сразу.
   */
  const [orderIds, setOrderIds] = useState<string[] | null>(null)

  const computeOrder = useCallback(
    (source: SubscriptionListItem[]): string[] => {
      const needle = query.trim().toLowerCase()
      let list = source

      if (filter === "episodes") list = list.filter((item) => item.notifyNewEpisodes)
      else if (filter === "dub") list = list.filter((item) => item.notifyDub)

      if (needle) {
        list = list.filter((item) => item.animeTitle.toLowerCase().includes(needle))
      }

      const sorted = [...list]
      if (sortMode === "title") {
        sorted.sort((a, b) => a.animeTitle.localeCompare(b.animeTitle, "ru"))
      } else if (sortMode === "recent") {
        // Чем свежее проверка, тем ближе к началу; без проверки — в конец.
        const ts = (item: SubscriptionListItem) =>
          item.lastCheckedAt ? Date.parse(item.lastCheckedAt) : 0
        sorted.sort((a, b) => ts(b) - ts(a))
      } else {
        // «Скоро ждать» — то, за чем человек чаще всего и пришёл на страницу.
        // Сначала те, у кого есть ожидание озвучки, потом меньший номер серии.
        sorted.sort((a, b) => {
          const aDub = a.notifyDub && a.wantedEpisode ? a.wantedEpisode : Number.MAX_SAFE_INTEGER
          const bDub = b.notifyDub && b.wantedEpisode ? b.wantedEpisode : Number.MAX_SAFE_INTEGER
          if (aDub !== bDub) return aDub - bDub
          return a.animeTitle.localeCompare(b.animeTitle, "ru")
        })
      }

      return sorted.map((item) => item.animeId)
    },
    [filter, query, sortMode],
  )

  // Пересортировка только по явным действиям пользователя. Зависимостей здесь
  // намеренно нет от `itemsWithPosters`: переключение тумблера меняет данные,
  // но не волю человека насчёт порядка.
  useEffect(() => {
    if (!loaded) return
    setOrderIds(computeOrder(itemsWithPosters))
  }, [loaded, computeOrder])

  const visible = useMemo(() => {
    if (!orderIds) {
      // До первой сортировки показываем как есть — скелет уже отработал.
      return itemsWithPosters
    }

    const byId = new Map(itemsWithPosters.map((item) => [item.animeId, item]))
    const known = new Set(orderIds)
    const result: SubscriptionListItem[] = []
    for (const id of orderIds) {
      const item = byId.get(id)
      if (item) result.push(item)
    }

    // Строки, появившиеся уже после сортировки (их в orderIds нет), — в конец.
    for (const item of itemsWithPosters) {
      if (!known.has(item.animeId)) result.push(item)
    }

    return result
  }, [itemsWithPosters, orderIds])

  const counts = useMemo(
    () => ({
      all: items.length,
      episodes: items.filter((item) => item.notifyNewEpisodes).length,
      dub: items.filter((item) => item.notifyDub).length,
    }),
    [items],
  )

  return (
    <main
      className={cn(
        "relative min-h-screen bg-background text-foreground",
        dirtyItems.length > 0
          ? "pb-[calc(var(--bottom-nav-height)+12rem)] md:pb-36"
          : "pb-20 md:pb-24",
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <Navbar />

      <div className="container relative z-10 mx-auto max-w-7xl px-3 pb-12 pt-6 sm:px-4 sm:pt-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:bg-accent hover:text-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
        </div>

        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-2.5">
              <BellRing className="h-[26px] w-[26px] text-orange-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground dark:text-white sm:text-3xl">
                Отслеживаемое
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground dark:text-zinc-400 sm:text-sm">
                {items.length} {items.length === 1 ? "тайтл" : "тайтлов"} в списке
              </p>
            </div>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Меняйте каналы уведомлений отдельно — настройки применятся только после
          нажатия «Сохранить изменения».
        </p>

          {!authLoading && !user ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <BellOff className="w-10 h-10 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-5">
                Отслеживаемые тайтлы видны только в аккаунте.
              </p>
              <Button onClick={() => setShowAuthModal(true)}>Войти</Button>
            </div>
          ) : (
            <>
              {items.length > 0 && (
                <div className="mb-6 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-border bg-secondary/40 p-2 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 sm:p-2.5 md:flex-row md:items-center">
                  <div className="relative w-full min-w-0 md:max-w-md md:flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="search"
                        placeholder="Поиск по отслеживаемым..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Поиск по отслеживаемым тайтлам"
                        className="h-10 pl-9 pr-8 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 rounded-xl"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          aria-label="Очистить поиск"
                          className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto rounded-xl border border-border/80 bg-background/80 p-1 dark:border-zinc-800 dark:bg-zinc-950/80">
                      <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                        Все · {counts.all}
                      </FilterButton>
                      <FilterButton
                        active={filter === "episodes"}
                        onClick={() => setFilter("episodes")}
                      >
                        Новые серии · {counts.episodes}
                      </FilterButton>
                      <FilterButton active={filter === "dub"} onClick={() => setFilter("dub")}>
                        Озвучка · {counts.dub}
                      </FilterButton>
                      {visible.length !== items.length && (
                        <span className="text-xs text-muted-foreground">
                          показано {visible.length} из {items.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          setSortMode(
                            sortMode === "waiting"
                              ? "title"
                              : sortMode === "title"
                                ? "recent"
                                : "waiting",
                          )
                        }
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary hover:bg-secondary hover:text-foreground dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white sm:text-sm"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                        <span>
                          {sortMode === "waiting"
                            ? "Сначала те, где ждут"
                            : sortMode === "title"
                              ? "По названию"
                              : "По свежей проверке"}
                        </span>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        className="w-full rounded-xl border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:text-red-400 sm:w-auto sm:text-sm"
                        onClick={() => setDeleteTarget({ type: "all" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Отписаться от всех
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {dirtyItems.length > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-[120] mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-primary/40 bg-background/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:inset-x-4 sm:flex-row sm:items-center sm:justify-between sm:p-4 md:bottom-6"
                >
                  <p className="min-w-0 text-sm text-muted-foreground">
                    Не сохранено изменений:{" "}
                    <span className="font-semibold text-foreground">{dirtyItems.length}</span>
                  </p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={discardChanges}
                      className="w-full sm:w-auto"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Отменить
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void saveChanges()}
                      disabled={saving}
                      className="w-full sm:w-auto"
                    >
                      {saving ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saving ? "Сохраняем..." : "Сохранить изменения"}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-6 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {!loaded ? (
                // Скелетон, а не один спиннер: список длинный, и «вращалка»
                // оставляет пустое полэкрана до прихода данных.
                <div className="mt-6">
                  <SubscriptionsSkeleton />
                </div>
              ) : visible.length === 0 ? (
                <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
                  <Bell className="w-10 h-10 mx-auto text-muted-foreground/50 mb-4" />
                  {items.length === 0 ? (
                    <>
                      <p className="text-foreground font-semibold mb-2">
                        Вы ничего не отслеживаете
                      </p>
                      <p className="text-muted-foreground mb-5 text-sm">
                        Кнопка «Следить за тайтлом» есть на странице аниме — она ждёт
                        и новые серии, и появление озвучки.
                      </p>
                      <Button asChild>
                        <Link href="/schedule">Найти что посмотреть</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm">
                        {query
                          ? `Ничего не найдено по запросу «${query}».`
                          : "В этом фильтре ничего нет."}
                      </p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => {
                        setQuery("")
                        setFilter("all")
                      }}>
                        Показать все
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <ul className="mt-6 space-y-3">
                  {visible.map((item) => (
                    <SubscriptionRow
                      key={item.animeId}
                      item={item}
                      busy={saving}
                      loadingCover={loadingCoverIds.has(item.animeId)}
                      onToggle={toggleChannel}
                      onDelete={() =>
                        setDeleteTarget({
                          type: "anime",
                          animeId: item.animeId,
                          animeTitle: item.animeTitle,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
      </div>
      <Footer />
      <ScrollToTop />
      <AuthModal isOpen={showAuthModal} onClose={setShowAuthModal} />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <AlertDialogTitle>
                {deleteTarget?.type === "all"
                  ? "Отписаться от всех тайтлов?"
                  : "Удалить тайтл из списка?"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left text-sm">
              {deleteTarget?.type === "all"
                ? "Все тайтлы будут удалены из отслеживаемых, а уведомления отключены. Это действие нельзя отменить."
                : `«${deleteTarget?.animeTitle ?? ""}» будет удалён из отслеживаемых, а уведомления отключены. Это действие нельзя отменить.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deleting}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                setDeleting(true)
                void deleteSubscriptions()
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              {deleting ? "Удаление..." : "Подтвердить удаление"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 border font-medium rounded-xl transition-all text-xs sm:text-sm",
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-background/80 border-border text-muted-foreground hover:text-foreground hover:border-primary dark:bg-zinc-950/80 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white",
      )}
    >
      {children}
    </button>
  )
}

function SubscriptionRow({
  item,
  busy,
  loadingCover,
  onToggle,
  onDelete,
}: {
  item: SubscriptionListItem
  busy: boolean
  loadingCover: boolean
  onToggle: (animeId: string, channel: "episodes" | "dub", next: boolean) => void
  onDelete: () => void
}) {
  const poster = item.poster && !item.poster.startsWith("data:") ? item.poster : null
  // Спиннер поверх обложки — ровно как в AnimeCard (`anime-card.tsx`):
  // картинка едет с внешнего CDN, и без него карточка выглядит битой.
  const [posterLoading, setPosterLoading] = useState(Boolean(poster))
  /**
   * Показывать ли спиннер — только если картинка реально грузится.
   *
   * `next/image` грузит лениво, и 74 обложки из 91 лежат ниже первого экрана
   * и не начинают грузиться вообще. Спиннер на них вращался бы вечно: картинка
   * не едет, а полоса крутится. Поэтому включаем его только когда элемент
   * дошёл до области просмотра — тогда запрос действительно пошёл.
   */
  const [posterInView, setPosterInView] = useState(false)
  const posterRef = useRef<HTMLAnchorElement | null>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)

  // Новый адрес картинки — грузим заново.
  useEffect(() => {
    setPosterLoading(Boolean(poster))
  }, [poster])

  /**
   * Гасим индикатор по факту готовности картинки, а не по событию.
   *
   * Чего тут не работало и почему:
   *
   * 1) `onLoad` пропускается, когда картинка приходит из кэша браузера и
   *    завершается раньше, чем React навесил обработчик.
   * 2) Однократная проверка `img.complete` в эффекте ловит не тот момент:
   *    при смене сортировки карточка из-под первого экрана переезжает в
   *    зону видимости, эффект срабатывает, а картинка ещё не догрузилась.
   *    Дальше подтверждений нет — `onLoad` для неё уже отработал раньше,
   *    а новых событий не будет. Картинка на экране, полоса крутится вечно.
   * 3) Скан по флагу усугублял: взведение `true` при смене `posterInView`
   *    воскрешало уже погашенный индикатор.
   *
   * Поэтому флаг умеет только опускаться, а готовность опрашивается, пока
   * идёт загрузка. Таймер живёт ровно столько, сколько грузится, и снимается
   * при первом же подтверждении — это страховка от «событие потерялось», а не
   * способ узнать о загрузке.
   */
  useEffect(() => {
    if (!posterLoading || !poster || !posterInView) return

    let timer: ReturnType<typeof setInterval> | null = null

    const confirm = () => {
      const img = posterImgRef.current
      if (!img || !img.complete) return
      setPosterLoading(false)
      if (timer) clearInterval(timer)
      timer = null
    }

    confirm()
    timer = setInterval(confirm, 250)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [posterLoading, poster, posterInView])

  // Обложки приходят не сразу: сперва приходят те, что лежат в подписке,
  // остальные догружает `cover-provider` фоном. Спиннер должен появиться и
  // для «пришедшей позже» картинки, поэтому состояние сбрасывается на смену
  // самого URL — инициализатор `useState` на это не смотрит.
  useEffect(() => {
    setPosterLoading(Boolean(poster))
  }, [poster])

  useEffect(() => {
    const el = posterRef.current
    if (!el) return

    if (typeof IntersectionObserver === "undefined") {
      setPosterInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPosterInView(true)
          observer.disconnect()
        }
      },
      // Немного заранее, чтобы полоса успела появиться к моменту, когда
      // карточка реально доедет до края экрана.
      { rootMargin: "250px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-2.5 sm:gap-4 sm:p-3",
        busy && "opacity-60",
      )}
    >
      <Link
        href={getWatchPath(item.animeId, item.animeTitle)}
        ref={posterRef}
        className="relative w-11 h-16 sm:w-14 sm:h-20 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center"
        aria-hidden
        tabIndex={-1}
      >
        {poster ? (
          <Image
            ref={posterImgRef}
            src={poster}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
            unoptimized={!poster.includes("weeb-x.com")}
            onLoad={() => setPosterLoading(false)}
            onError={() => setPosterLoading(false)}
          />
        ) : (
          // Обложки нет у большинства подписок (их заводят годами, а постер
          // пишется не всегда). Пустая серая плашка читается как «картинка
          // сломалась» — заглушка с первой буквой читается как «картинки не
          // было».
          <span className="text-base sm:text-lg font-black text-muted-foreground/50 select-none">
            {(item.animeTitle || "?").trim().charAt(0).toUpperCase()}
          </span>
        )}

        {posterInView && (poster ? posterLoading : loadingCover) && (
          <div className="absolute inset-0 bg-neutral-200 dark:bg-zinc-800 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-orange-500/20 border-t-orange-500 animate-spin" />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={getWatchPath(item.animeId, item.animeTitle)}
          className="font-semibold hover:text-primary transition-colors line-clamp-2 text-sm sm:text-base"
        >
          {item.animeTitle}
        </Link>

        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
          {describeWaiting(item)}
          {item.lastCheckedAt && (
            <span className="opacity-70"> · {formatCheckedAt(item.lastCheckedAt)}</span>
          )}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <ChannelToggle
            checked={item.notifyNewEpisodes}
            disabled={busy}
            onChange={(next) => void onToggle(item.animeId, "episodes", next)}
            label="Новые серии"
          />
          <ChannelToggle
            checked={item.notifyDub}
            disabled={busy}
            onChange={(next) => void onToggle(item.animeId, "dub", next)}
            label="Озвучка"
          />
          {dubHasNothingToWaitFor(item) && (
            <span className="text-[11px] text-muted-foreground/80">
              {item.episodesTotal
                ? `озвучка уже есть для всех ${item.episodesTotal}`
                : "озвучка уже есть для всех серий"}
            </span>
          )}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Удалить «${item.animeTitle}» из отслеживаемых`}
        title="Удалить из отслеживаемых"
        disabled={busy}
        onClick={onDelete}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  )
}

/**
 * Чем занят конкретный тайтл. Винительный падеж: «Ждём 1 серию», а не
 * «Ждём 1 серия» — форма в именительном падеже здесь не согласована.
 */
/**
 * Чем занят конкретный тайтл. Винительный падеж: «Ждём 1 серию», а не
 * «Ждём 1 серия» — форма в именительном падеже здесь не согласована.
 *
 * Про «озвучка уже есть для всех серий» в эту строку НЕ попадает: склейка
 * вида «озвучка уже есть для всех серий и новые серии» читается как одно
 * длинное обещание. Это не ожидание, а пояснение — ему место отдельной
 * строкой под переключателями.
 */
function describeWaiting(item: SubscriptionListItem): string {
  const parts: string[] = []
  if (item.notifyDub && item.wantedEpisode) {
    parts.push(
      `Ждём ${item.wantedEpisode} ${pluralEpisodesAccusative(item.wantedEpisode)} с озвучкой`,
    )
  }
  if (item.notifyNewEpisodes) parts.push("новые серии")
  return parts.length > 0 ? parts.join(" и ") : "Ожидание выключено"
}

/** Канал озвучки включён, но ждать нечего — тайтл закончен, озвучка полная. */
function dubHasNothingToWaitFor(item: SubscriptionListItem): boolean {
  return item.notifyDub && !item.wantedEpisode
}

function ChannelToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-colors",
        checked ? "text-primary" : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-wait",
      )}
    >
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted border border-border",
        )}
      >
        {/* Позиция задана явно через left + translate, а не только translate:
            без `left` абсолютно позиционированный элемент берёт статическое
            место в потоке, из-за чего ручка вылезала за дорожку на 12px и
            наезжала на подпись. */}
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white",
            "transition-transform duration-150",
            checked ? "translate-x-3" : "translate-x-0",
          )}
        />
      </span>
      {label}
    </button>
  )
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return "только что"

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} мин назад`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`

  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}