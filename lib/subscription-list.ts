/**
 * Приведение значений из БД для списка отслеживаемых.
 *
 * Модуль существует ради одной причины: `title_subscriptions` и
 * `translation_alerts` читаются и страницей, и серверной проверкой, и
 * телеграм-ботом. Правила, как понимать `notify_dub` и `episode`, должны быть
 * в одном месте — иначе интерфейс покажет одно, а уведомление придёт по
 * другому. Раньше такое расхождение и стоило обещания про озвучку.
 */

/** `true` только для настоящей истины и строки `"true"`. */
export function toBool(value: unknown): boolean {
  return value === true || value === "true"
}

/** Целое неотрицательное число; мусор и отрицательные — ноль. */
export function toInt(value: unknown): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}