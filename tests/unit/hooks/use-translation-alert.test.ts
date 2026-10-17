/**
 * Регрессия на `useTranslationAlert.subscribe` — плашка «Озвучка не найдена».
 *
 * Тест поднимает НАСТОЯЩИЙ хук с подменённым Supabase, а не переписывает его
 * логику у себя: баг жил именно в том, как хук читает существующую строку
 * перед записью, и копия этого кода в тесте повторила бы баг, а не поймала.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const USER_ID = "user-1"
const ANIME_ID = "64510"

/** Что лежит в `title_subscriptions` на момент клика. */
type ExistingRow = { notify_new_episodes: boolean; notify_dub: boolean } | null

/** Последняя строка, ушедшая в `title_subscriptions`. */
let writtenRow: Record<string, unknown> | null = null

/** Последний UPDATE в `title_subscriptions` (снятие канала озвучки). */
let updatedRow: Record<string, unknown> | null = null

/** Сколько раз удаляли строку `title_subscriptions`. */
let subscriptionDeletes = 0

/** Мок supabase-клиента. Хук пишет в две таблицы, и порядок важен. */
function installSupabaseMock(existing: ExistingRow) {
  const from = vi.fn((table: string) => {
    if (table !== "title_subscriptions" && table !== "translation_alerts") {
      throw new Error(`неожиданная таблица в тесте: ${table}`)
    }

    let mode: "select" | "upsert" | "delete" | "update" = "select"

    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      upsert: (row: Record<string, unknown>) => {
        mode = "upsert"
        // Следим только за интересующей таблицей: запись ожидания озвучки —
        // не то, что здесь проверяется.
        if (table === "title_subscriptions") writtenRow = row
        return Promise.resolve({ data: null, error: null })
      },
      update: (row: Record<string, unknown>) => {
        mode = "update"
        if (table === "title_subscriptions") updatedRow = row
        return builder
      },
      delete: () => {
        mode = "delete"
        if (table === "title_subscriptions") subscriptionDeletes++
        // Именно builder, а не готовый промис: хук зовёт `.delete().eq(...)`,
        // как и в реальном supabase-js. Промис здесь ронял бы цепочку в catch
        // — и отписка молча «проходила», ничего не записав.
        return builder
      },
      then: (resolve: (v: unknown) => unknown) => {
        // Чтение существующей подписки — единственный запрос, который
        // действительно что-то возвращает. Остальным таблицам нужны пустые
        // списки, чтобы хук увидел «нет активного ожидания».
        const payload =
          mode === "select" ? (table === "title_subscriptions" && existing ? [existing] : []) : null
        return resolve({ data: payload, error: null })
      },
    }

    return builder
  })

  vi.doMock("@/lib/supabase", () => ({ supabase: { from } }))
}

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: USER_ID }, loading: false }),
}))

/** Ровно то, что передаёт плашка «Озвучка не найдена» из плеера. */
interface PlateInput {
  animeId: string
  animeTitle: string
  poster?: string | null
  episode: number
  reason: "no-translations" | "episode-not-ready"
  baselineEpisode: number
}

interface HookHandle {
  subscribe: (next: PlateInput) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
}

/** Что плашка передаёт при клике на тайтле, у которого нет озвучки. */
const PLATE: PlateInput = {
  animeId: ANIME_ID,
  animeTitle: "Наруто",
  poster: null,
  episode: 1,
  reason: "no-translations",
  baselineEpisode: 0,
}

let container: HTMLDivElement
let root: Root
let handle: HookHandle | null = null

/** Поднять хук и отдать его наружу для вызова `subscribe`. */
async function mountHook(): Promise<void> {
  const { useTranslationAlert } = await import("@/hooks/use-translation-alert")

  function Harness() {
    const alert = useTranslationAlert(ANIME_ID)
    handle = {
      // Хук принимает ровно то, что передаёт плашка, — без подстановок,
      // чтобы тест проверял настоящий контракт, а не свою обёртку.
      subscribe: (next) => alert.subscribe(next),
      unsubscribe: () => alert.unsubscribe(),
    }
    return null
  }

  await act(async () => {
    root.render(createElement(Harness))
  })
}

describe("плашка «Озвучка не найдена» не включает ожидание новых серий", () => {
  beforeEach(() => {
    writtenRow = null
    updatedRow = null
    subscriptionDeletes = 0
    handle = null
    vi.resetModules()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("не расширяет обещание, когда подписки на тайтл ещё не было", async () => {
    // Главный баг. Человек нажал «Уведомить меня» в плеере — то есть просил
    // сообщить ПРО ОЗВУЧКУ. Раньше хук подставлял вместо отсутствующей строки
    // синтетическую с `null` в колонках, а `mapSubscriptionRow` читал `null`
    // как «неизвестно» → `true`. В итоге молча включалось ожидание новых
    // серий, и человек получал «вышла серия N» на тайтл, который не отслеживал.
    installSupabaseMock(null)
    await mountHook()

    await act(async () => {
      await handle!.subscribe(PLATE)
    })

    expect(writtenRow).not.toBeNull()
    expect(writtenRow!.notify_dub).toBe(true)
    expect(writtenRow!.notify_new_episodes).toBe(false)
  })

  it("не включает серии у подписки, которая ждёт только озвучку", async () => {
    // Повторный клик по плашке на тайтле, который уже ждёт озвучку.
    installSupabaseMock({ notify_new_episodes: false, notify_dub: true })
    await mountHook()

    await act(async () => {
      await handle!.subscribe(PLATE)
    })

    expect(writtenRow!.notify_dub).toBe(true)
    expect(writtenRow!.notify_new_episodes).toBe(false)
  })

  it("не гасит уже обещанное ожидание новых серий", async () => {
    // Обратная сторона: человек подписался на серии кнопкой «Следить за
    // тайтлом», потом нажал «Уведомить меня» в плеере. Плашка обещает только
    // озвучку — и не должна молча отменять то, про что человек не говорил.
    installSupabaseMock({ notify_new_episodes: true, notify_dub: false })
    await mountHook()

    await act(async () => {
      await handle!.subscribe(PLATE)
    })

    expect(writtenRow!.notify_new_episodes).toBe(true)
    expect(writtenRow!.notify_dub).toBe(true)
  })

  it("помечает источник как translation_alert, а не manual", async () => {
    // `source` — справочная колонка для разбора поломок. Подписка, созданная
    // плашкой в плеере, должна отличаться от созданной кнопкой на странице.
    installSupabaseMock(null)
    await mountHook()

    await act(async () => {
      await handle!.subscribe(PLATE)
    })

    expect(writtenRow!.source).toBe("translation_alert")
  })
})

describe("отписка действительно отписывает", () => {
  beforeEach(() => {
    writtenRow = null
    updatedRow = null
    subscriptionDeletes = 0
    handle = null
    vi.resetModules()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("снимает канал озвучки, оставляя подписку на серии", async () => {
    // Главный сценарий: человек подписан на «серии и озвучку», потом нажал
    // «Не хочу уведомлений» про озвучку. Раньше строка с notify_dub = true
    // оставалась нетронутой, и кнопка на странице тайтла продолжала
    // обещать «серии и озвучка» — то есть отписка ничего не отменяла.
    installSupabaseMock({ notify_new_episodes: true, notify_dub: true })
    await mountHook()

    await act(async () => {
      await handle!.unsubscribe()
    })

    expect(updatedRow).not.toBeNull()
    expect(updatedRow!.notify_dub).toBe(false)
    // Серии человек не трогал — строку сносить нельзя.
    expect(subscriptionDeletes).toBe(0)
  })

  it("гасит подписку целиком, если серии человек не ждал", async () => {
    // Подписка была только ради озвучки: других каналов нет, и сносить
    // нужно всю строку, а не оставлять болтающийся пустой остаток.
    installSupabaseMock({ notify_new_episodes: false, notify_dub: true })
    await mountHook()

    await act(async () => {
      await handle!.unsubscribe()
    })

    expect(subscriptionDeletes).toBe(1)
    expect(updatedRow).toBeNull()
  })

  it("при отсутствии подписки не пишет ничего лишнего", async () => {
    installSupabaseMock(null)
    await mountHook()

    await act(async () => {
      await handle!.unsubscribe()
    })

    expect(subscriptionDeletes).toBe(0)
    expect(updatedRow).toBeNull()
  })
})
