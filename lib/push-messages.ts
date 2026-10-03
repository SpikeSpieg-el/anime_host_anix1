/**
 * Человекочитаемые причины отказа push-подписки.
 *
 * Вынесено из `components/watch/episode-update-badge.tsx`, потому что те же
 * тексты нужны плашке «Скоро / Озвучка не найдена»: там отказ push не должен
 * выглядеть как «уведомление не придёт вовсе» — ожидание всё равно сохраняется
 * и показывается в колокольчике на сайте.
 */

import type { PushErrorReason } from "@/hooks/use-push-notifications"

export function getPushErrorMessage(reason: PushErrorReason | null): string {
  switch (reason) {
    case "permission-denied":
      return "Разрешение отклонено. Откройте настройки сайта (иконка замка в адресной строке) → Уведомления → Разрешить, затем попробуйте снова."
    case "permission-dismissed":
      return "Окно разрешения было закрыто. Нажмите кнопку ещё раз."
    case "not-logged-in":
      return "Войдите в аккаунт, чтобы включить push-уведомления."
    case "not-secure-context":
      return "Push-уведомления работают только на HTTPS-соединении."
    case "no-notification-api":
      return "Этот браузер не поддерживает уведомления."
    case "sw-registration-failed":
      return "Не удалось зарегистрировать service worker. Очистите кэш браузера и попробуйте снова."
    case "no-vapid-key":
      return "Сервер не настроен для push-уведомлений (VAPID ключи). Обратитесь к администратору."
    case "push-subscribe-failed":
      return "Браузер отказался создавать подписку. Возможно, push заблокирован в настройках браузера."
    case "save-failed":
      return "Не удалось сохранить подписку на сервере. Попробуйте позже."
    case "unsupported":
      return "Этот браузер не поддерживает push-уведомления."
    default:
      return "Не удалось включить. Проверьте разрешения браузера."
  }
}

/**
 * Короткая подсказка для случая, когда push недоступен, но ожидание сохранено.
 * Главное — не обещать того, что система не может выполнить, и не пугать
 * пользователя, будто уведомление не придёт вообще.
 */
export function getPushFallbackHint(reason: PushErrorReason | null): string {
  switch (reason) {
    case "permission-denied":
    case "permission-dismissed":
      return "Push в браузере выключен — напомним в колокольчике на сайте."
    case "no-vapid-key":
    case "unsupported":
    case "no-notification-api":
    case "sw-registration-failed":
    case "push-subscribe-failed":
      return "Push здесь недоступен — уведомление появится в колокольчике на сайте."
    default:
      return "Если push не придёт, уведомление появится в колокольчике на сайте."
  }
}
