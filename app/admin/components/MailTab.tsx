"use client"

import { Mail, Gift, BellRing, Send } from "lucide-react"
import Link from "next/link"
import type { SimpleUser, MailType } from "./types"
import { MAIL_TYPES } from "./constants"

interface MailTabProps {
  simpleUsers: SimpleUser[]
  mailTargetUserId: string
  onMailTargetChange: (value: string) => void
  mailType: MailType
  onMailTypeChange: (type: MailType) => void
  mailTitle: string
  onMailTitleChange: (value: string) => void
  mailBody: string
  onMailBodyChange: (value: string) => void
  mailAmount: number
  onMailAmountChange: (value: number) => void
  mailCardJson: string
  onMailCardJsonChange: (value: string) => void
  isMailSending: boolean
  onSendMail: () => void
  onSendMailBulk: () => void
  onRefreshUsers: () => void
  pushTargetUserId: string
  onPushTargetChange: (value: string) => void
  pushTitle: string
  onPushTitleChange: (value: string) => void
  pushBody: string
  onPushBodyChange: (value: string) => void
  pushUrl: string
  onPushUrlChange: (value: string) => void
  isPushSending: boolean
  onSendPush: () => void
  onSendPushBulk: () => void
}

export function MailTab({
  simpleUsers,
  mailTargetUserId,
  onMailTargetChange,
  mailType,
  onMailTypeChange,
  mailTitle,
  onMailTitleChange,
  mailBody,
  onMailBodyChange,
  mailAmount,
  onMailAmountChange,
  mailCardJson,
  onMailCardJsonChange,
  isMailSending,
  onSendMail,
  onSendMailBulk,
  onRefreshUsers,
  pushTargetUserId,
  onPushTargetChange,
  pushTitle,
  onPushTitleChange,
  pushBody,
  onPushBodyChange,
  pushUrl,
  onPushUrlChange,
  isPushSending,
  onSendPush,
  onSendPushBulk,
}: MailTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <Mail size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Рассылка и подарки
        </h2>
        <button
          onClick={onRefreshUsers}
          className="text-sm text-primary hover:underline w-fit"
        >
          Обновить список
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Получатель</label>
          <select
            value={mailTargetUserId}
            onChange={(e) => onMailTargetChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          >
            <option value="">Выберите пользователя...</option>
            {simpleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username || "Без имени"} {u.email ? `(${u.email})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Тип письма</label>
          <select
            value={mailType}
            onChange={(e) => onMailTypeChange(e.target.value as MailType)}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          >
            {MAIL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Заголовок</label>
          <input
            type="text"
            value={mailTitle}
            onChange={(e) => onMailTitleChange(e.target.value)}
            placeholder="Заголовок письма..."
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Текст письма</label>
          <textarea
            value={mailBody}
            onChange={(e) => onMailBodyChange(e.target.value)}
            placeholder="Текст письма..."
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-24"
          />
        </div>

        {(mailType === "coins" || mailType === "dust") && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">
              Количество ({mailType})
            </label>
            <input
              type="number"
              value={mailAmount}
              onChange={(e) => onMailAmountChange(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>
        )}

        {mailType === "card_gift" && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">
              JSON карты
            </label>
            <textarea
              value={mailCardJson}
              onChange={(e) => onMailCardJsonChange(e.target.value)}
              placeholder='Вставьте объект Card в формате JSON. Можно получить в редакторе карт...'
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-32 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Совет: откройте{" "}
              <Link href="/admin/card-editor" className="text-primary hover:underline">редактор карт</Link>
              , чтобы создать карту и скопировать её JSON.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onSendMail}
            disabled={isMailSending || !mailTargetUserId}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Mail size={18} />
            {isMailSending ? "Отправка..." : "Отправить"}
          </button>
          <button
            onClick={onSendMailBulk}
            disabled={isMailSending}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition disabled:opacity-50"
          >
            <Gift size={18} />
            {isMailSending ? "Отправка..." : `Отправить всем (${simpleUsers.length})`}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <BellRing size={18} className="text-primary" />
          Push-уведомления
        </h3>
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Получатель</label>
            <select
              value={pushTargetUserId}
              onChange={(e) => onPushTargetChange(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            >
              <option value="">Выберите пользователя...</option>
              {simpleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username || "Без имени"} {u.email ? `(${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Заголовок</label>
            <input
              type="text"
              value={pushTitle}
              onChange={(e) => onPushTitleChange(e.target.value)}
              placeholder="Заголовок уведомления..."
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Текст</label>
            <textarea
              value={pushBody}
              onChange={(e) => onPushBodyChange(e.target.value)}
              placeholder="Текст уведомления..."
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL (опционально)</label>
            <input
              type="text"
              value={pushUrl}
              onChange={(e) => onPushUrlChange(e.target.value)}
              placeholder="/watch/12345 или https://..."
              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={onSendPush}
              disabled={isPushSending || !pushTargetUserId}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
            >
              <Send size={16} />
              {isPushSending ? "Отправка..." : "Отправить"}
            </button>
            <button
              onClick={onSendPushBulk}
              disabled={isPushSending}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition disabled:opacity-50"
            >
              <BellRing size={16} />
              {isPushSending ? "Отправка..." : `Всем (${simpleUsers.length})`}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Push-уведомления получают только пользователи с активной подпиской. Устройства с истёкшими подписками удаляются автоматически.
          </p>
        </div>
      </div>
    </div>
  )
}
