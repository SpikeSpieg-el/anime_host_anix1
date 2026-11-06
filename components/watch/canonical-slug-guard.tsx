"use client"

import { useEffect } from "react"

/**
 * Страховка для устаревших slug'ов /watch.
 *
 * Основной редирект отдаёт middleware настоящим HTTP 301. Сюда попадают только
 * адреса, которых в его кэше ещё нет. Раньше это был `permanentRedirect()` в
 * теле страницы — но из-за app/loading.tsx статус уже 200, Next успевал лишь
 * вставить <meta refresh>, а страница при этом не отдавала ни байта, пока не
 * догрузится тайтл. Теперь HTML приходит сразу, а замена адреса происходит
 * после монтирования.
 *
 * `replace`, а не `push`: битый вариант не должен осесть в истории телефона.
 */
export function CanonicalSlugGuard({ target }: { target: string }) {
  useEffect(() => {
    // location.replace вместо router.replace: нужен полный переход, иначе
    // RSC-запрос уйдёт на неканонический URL и получит тот же 200.
    window.location.replace(target)
  }, [target])

  return null
}
