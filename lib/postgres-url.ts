/**
 * Вспомогательная функция для проверки строки подключения к Postgres.
 *
 * Размещена в отдельном модуле (вне Route Handler), потому что файл
 * `app/api/**/*.ts` может экспортировать только допустимые поля Route
 * (GET/POST/runtime/dynamic и т.д.), а произвольные хелперы Next.js отбрасывает
 * на этапе проверки типов при сборке (`next build`).
 */

/** Минимальная проверка формата строки подключения Postgres. */
export function isValidPostgresUrl(raw: string): boolean {
  if (!raw || !raw.includes('://')) return false
  try {
    // Разбираем как URL, чтобы отсечь мусор и инъекции.
    const url = new URL(raw)
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  } catch {
    return false
  }
}
