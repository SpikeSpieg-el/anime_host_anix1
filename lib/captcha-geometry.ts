/**
 * Геометрия пазла captcha. Общая для сервера и клиента.
 *
 * Этот модуль намеренно НЕ импортирует `node:crypto`: его тянет в себя
 * компонент `anime-slider-captcha.tsx` с директивой "use client", а node-модули
 * в браузерном бандле ломают сборку. Всё крипто — в `lib/captcha-puzzle.ts`.
 */

/** SVG-контур ушка пазла. Единицы координат == CSS-пиксели. */
export const PUZZLE_PATH =
  "M 0,0 L 14,0 C 14,6 18,9 22,9 C 26,9 30,6 30,0 L 44,0 L 44,14 C 50,14 53,18 53,22 C 53,26 50,30 44,30 L 44,44 L 30,44 C 30,38 26,35 22,35 C 18,35 14,38 14,44 L 0,44 L 0,30 C 6,30 9,26 9,22 C 9,18 6,14 0,14 Z"

/** Габарит квадратной части кусочка (44×44) — по нему считается maxDrag. */
export const PUZZLE_BOX = 44

/** Полный габарит контура с выпуклостями (53×53). */
export const PUZZLE_EXTENT = 53

/**
 * Диапазоны позиции дырки в долях контейнера.
 *
 * Верхняя граница X = 0.72, а не 0.75, как раньше: при 0.75 кусочек с
 * выпуклостями (53px) вылезал бы за правый край контейнера на телефоне, и
 * «идеальное» положение становилось недостижимым — капча не решалась руками.
 */
export const TARGET_X_MIN = 0.3
export const TARGET_X_MAX = 0.72
export const TARGET_Y_MIN = 0.18
export const TARGET_Y_MAX = 0.62

/** Границы контейнера пазла, в которые клиент обязан укладываться. */
export const CONTAINER_MIN_WIDTH = 240
export const CONTAINER_MAX_WIDTH = 720
export const CONTAINER_MIN_HEIGHT = 100
export const CONTAINER_MAX_HEIGHT = 420

export interface CoverMapping {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Параметры `object-cover` для данного контейнера и исходной картинки.
 *
 * Сервер рисует дырку прямо в пикселях исходного webp, а браузер потом
 * показывает готовый SVG тем же `object-cover`. Значит сервер обязан повторить
 * ровно ту же формулу, что и браузер, иначе дырка уедет от того места, куда
 * встаёт кусочек.
 */
export function coverMapping(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): CoverMapping {
  const scale = Math.max(containerWidth / imageWidth, containerHeight / imageHeight)
  const displayedWidth = imageWidth * scale
  const displayedHeight = imageHeight * scale

  return {
    scale,
    offsetX: (containerWidth - displayedWidth) / 2,
    offsetY: (containerHeight - displayedHeight) / 2,
  }
}

/** Перевод координаты контейнера в координаты исходной картинки. */
export function containerToImage(
  x: number,
  y: number,
  mapping: CoverMapping
): { x: number; y: number } {
  return {
    x: (x - mapping.offsetX) / mapping.scale,
    y: (y - mapping.offsetY) / mapping.scale,
  }
}
