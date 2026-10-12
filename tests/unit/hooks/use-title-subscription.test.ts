/**
 * Регрессия: кнопка подписки не должна зависать в состоянии «Сохраняем...».
 *
 * Живой баг, найденный прогоном в браузере. Человек нажимал «Следить за
 * тайтлом», и кнопка навсегда оставалась в состоянии «Сохраняем...» и
 * `disabled`: подписка создавалась, но отписаться прямо со страницы было
 * уже нельзя — кнопка не реагировала на клики. Приходилось перезагружать
 * страницу, и только тогда управление возвращалось.
 *
 * Причина в том, что `subscribe` сам рассылает `SUBSCRIPTIONS_CHANGED_EVENT`,
 * обработчик которого зовёт `refresh()`, а тот увеличивает `requestRef`.
 * Сверка `requestId === requestRef.current` в `finally` после этого всегда
 * ложна, и `setLoading(false)` не выполнялся НИКОГДА.
 *
 * Правило, которое проверяет этот файл: флаг «идёт запрос» снимает тот, кто
 * его поставил. Отменять его по сверке «последнего победившего запроса»
 * нельзя — любое пересечение с фоновым `refresh()` увело бы кнопку в
 * вечный spinner.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const USER_ID = "user-1"
const ANIME_ID = "64510"

/** Строки, реально ушедшие в таблицу. */
let upserted: Array<Record<string, unknown>> = []
/** Что вернёт чтение `title_subscriptions`. */
let existingRow: { notify_new_episodes: boolean; notify_dub: boolean } | null = null
/** Ответ на удаление. */
let deleteError: { message: string } | null = null

function installSupabaseMock() {
  const from = vi.fn((table: string) => {
    if (table !== "title_subscriptions") {
      throw new Error(`неожиданная таблица в тесте: ${table}`)
    }

    let mode: "select" | "upsert" | "delete" = "select"

    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      upsert: (row: Record<string, unknown>) => {
        mode = "upsert"
        upserted.push(row)
        return Promise.resolve({ data: null, error: null })
      },
      // Возвращаем builder, а не промис: хук зовёт `.delete().eq().eq()`,
      // то есть фильтры ставятся ПОСЛЕ delete, и результатом должен
      // остаться цепочный объект.
      delete: () => {
        mode = "delete"
        return builder
      },
      then: (resolve: (v: unknown) => unknown) => {
        const error = mode === "delete" ? deleteError : null
        const data = mode === "select" && existingRow ? [existingRow] : null
        return resolve({ data, error })
      },
    }

    return builder
  })

  vi.doMock("@/lib/supabase", () => ({ supabase: { from } }))
}

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: USER_ID }, loading: false }),
}))

interface HookHandle {
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  loading: boolean
  subscribed: boolean
}

let container: HTMLDivElement
let root: Root
let handle: HookHandle | null = null

async function mountHook(): Promise<void> {
  const { useTitleSubscription } = await import("@/hooks/use-title-subscription")

  function Harness() {
    const { subscription, loaded, loading, subscribe, unsubscribe } = useTitleSubscription(ANIME_ID)
    handle = {
      // Обёртка повторяет контракт кнопки: `busy` = loading || (!loaded && есть
      // аккаунт). Именно `busy` вешал кнопку в `disabled`.
      subscribe: () => subscribe({ animeTitle: "Наруто", poster: null, baselineEpisode: 10 }),
      unsubscribe: () => unsubscribe(),
      loading: loading || (!loaded && true),
      subscribed: Boolean(subscription),
    }
    return null
  }

  await act(async () => {
    root.render(createElement(Harness))
  })
}

describe("кнопка подписки не зависает после записи", () => {
  beforeEach(() => {
    upserted = []
    existingRow = null
    deleteError = null
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

  it("снимает «Сохраняем...» после успешной подписки", async () => {
    installSupabaseMock()
    await mountHook()

    let ok = false
    await act(async () => {
      ok = await handle!.subscribe()
    })

    expect(ok).toBe(true)
    expect(upserted).toHaveLength(1)
    // Главная проверка: после записи кнопка обязана вернуться в рабочее
    // состояние, иначе отписаться невозможно.
    expect(handle!.loading).toBe(false)
  })

  it("снимает «Сохраняем...» после отписки", async () => {
    existingRow = { notify_new_episodes: true, notify_dub: true }
    installSupabaseMock()
    await mountHook()

    let ok = false
    await act(async () => {
      ok = await handle!.unsubscribe()
    })

    expect(ok).toBe(true)
    expect(handle!.loading).toBe(false)
  })

  it("повторная подписка после отписки снова доступна", async () => {
    // Полный круг: подписка → отписка → подписка. До фикса кнопка
    // застревала на первом же шаге, и цикл становился невозможен.
    existingRow = { notify_new_episodes: true, notify_dub: true }
    installSupabaseMock()
    await mountHook()

    await act(async () => {
      await handle!.unsubscribe()
    })
    expect(handle!.loading).toBe(false)

    await act(async () => {
      await handle!.subscribe()
    })
    expect(handle!.loading).toBe(false)
    expect(upserted).toHaveLength(1)
  })

  it("снимает «Сохраняем...» даже когда запись не удалась", async () => {
    deleteError = { message: "boom" }
    existingRow = { notify_new_episodes: true, notify_dub: true }
    installSupabaseMock()
    await mountHook()

    let ok = true
    await act(async () => {
      ok = await handle!.unsubscribe()
    })

    expect(ok).toBe(false)
    // Ошибка — это тоже конец запроса: кнопка обязана перестать быть busy,
    // иначе человек не сможет ни повторить, ни уйти со страницы.
    expect(handle!.loading).toBe(false)
  })
})