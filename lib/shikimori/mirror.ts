/**
 * Автоматический выбор зеркала Shikimori.
 *
 * Зачем: основной домен shikimori.one хрупкий — Cloudflare 522 (бэкенд
 * недоступен), блокировки, техработы. При этом зеркала (.me, .io, .org) отдают
 * те же API-данные и картинки. Раньше домен был зашит в BASE_URL, и падение
 * .one роняло весь контент сайта до ручной правки кода.
 *
 * Как работает:
 *  - весь исходящий трафик через lib/shikimori/client.ts подменяет origin
 *    с канонического `https://shikimori.one` на текущее живое зеркало
 *    (см. toActiveShikimoriOrigin);
 *  - после сбоя (5xx/ошибка сети) фоново перепроверяем все зеркала и
 *    переключаемся на первое живое по порядку приоритета;
 *  - если долго не было перепроверки — раз в 15 минут проверяем в фоне,
 *    чтобы вовремя вернуться на приоритетное .one, когда оно оживёт;
 *  - env-переменные:
 *      SHIKIMORI_DOMAIN  — жёстко зафиксировать домен (авточек отключается);
 *      SHIKIMORI_MIRRORS — свой список зеркал через запятую.
 *
 * Канонический BASE_URL в config.ts оставлен .one: он же ключ кэша и часть
 * URL'ов картинок в БД. Картинки в любом случае идут через image-service,
 * который делает свою ротацию зеркал (см. coolify-image-service/server.js).
 */

export const SHIKIMORI_CANONICAL_ORIGIN = "https://shikimori.one";

const FORCED_DOMAIN = (process.env.SHIKIMORI_DOMAIN || "").trim();

const DEFAULT_MIRRORS = ["shikimori.one", "shikimori.me", "shikimori.io", "shikimori.org"];

export const SHIKIMORI_MIRROR_DOMAINS: string[] = (() => {
  const fromEnv = (process.env.SHIKIMORI_MIRRORS || "").trim();
  const list = (fromEnv ? fromEnv.split(",") : DEFAULT_MIRRORS)
    .map(s => s.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MIRRORS;
})();

let activeDomain = FORCED_DOMAIN || SHIKIMORI_MIRROR_DOMAINS[0];
let lastResolvedAt = 0;
let lastProbeAttemptAt = 0;
let inflight: Promise<string> | null = null;

const PROBE_TIMEOUT_MS = 5_000;
const PROBE_COOLDOWN_MS = 3_000;
const PROBE_REFRESH_MS = 15 * 60_000;

/** Текущий активный домен (синхронно, без сети). */
export function getShikimoriDomain(): string {
  return FORCED_DOMAIN || activeDomain;
}

/**
 * Подменить канонический origin на активное зеркало.
 * URL с другим origin (не shikimori.one) возвращается как есть.
 */
export function toActiveShikimoriOrigin(url: string): string {
  const domain = getShikimoriDomain();
  if (!url.startsWith(SHIKIMORI_CANONICAL_ORIGIN)) return url;
  if (domain === "shikimori.one") return url;
  return url.replace(SHIKIMORI_CANONICAL_ORIGIN, `https://${domain}`);
}

/** Живое зеркало = отвечает любым статусом ниже 500 (429 от лимитов — тоже живой бэкенд). */
async function probeMirror(domain: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}/api/animes/1`, {
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Опросить все зеркала и выбрать первое живое по приоритету. */
export async function resolveShikimoriMirror(): Promise<string> {
  if (FORCED_DOMAIN) return activeDomain;
  if (inflight) return inflight;

  inflight = (async () => {
    const probed = await Promise.all(
      SHIKIMORI_MIRROR_DOMAINS.map(async (domain) => ({
        domain,
        healthy: await probeMirror(domain),
      })),
    );

    const best = probed.find(p => p.healthy)?.domain;
    if (best && best !== activeDomain) {
      console.log(`[Shikimori] Смена зеркала: ${activeDomain} → ${best}`);
      activeDomain = best;
    } else if (!best) {
      console.warn(
        `[Shikimori] Ни одно зеркало не ответило (${SHIKIMORI_MIRROR_DOMAINS.join(", ")}); остаёмся на ${activeDomain}`,
      );
    }
    lastResolvedAt = Date.now();
    return activeDomain;
  })();

  inflight.finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Вызывается после сбоя запроса: запускает фоновую перепроверку зеркал.
 * Не ждём её результата — провалившийся запрос всё равно уйдёт в fallback.
 */
export function noteShikimoriFailure(): void {
  if (FORCED_DOMAIN) return;
  const now = Date.now();
  if (now - lastProbeAttemptAt < PROBE_COOLDOWN_MS) return;
  lastProbeAttemptAt = now;
  void resolveShikimoriMirror().catch(() => {});
}

/**
 * Вызывается перед очередным запросом: если зеркала давно не проверялись,
 * перепроверяем в фоне (в т.ч. чтобы вернуться на приоритетный .one).
 */
export function maybeRefreshShikimoriMirror(): void {
  if (FORCED_DOMAIN) return;
  const now = Date.now();
  if (now - lastProbeAttemptAt < PROBE_COOLDOWN_MS) return;
  if (lastResolvedAt && now - lastResolvedAt < PROBE_REFRESH_MS) return;
  lastProbeAttemptAt = now;
  void resolveShikimoriMirror().catch(() => {});
}

// Прогрев при старте процесса: до первых запросов выбрать живое зеркало.
// В тестах сеть не трогаем — тесты ожидают канонический .one.
if (process.env.NODE_ENV !== "test") {
  lastProbeAttemptAt = Date.now();
  void resolveShikimoriMirror().catch(() => {});
}
