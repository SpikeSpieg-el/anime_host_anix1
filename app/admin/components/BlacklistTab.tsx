"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Ban,
  ExternalLink,
  Loader2,
  Network,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import {
  addIpBan,
  addIpSubnetBan,
  getIpBans,
  lookupIpInfo,
  removeIpBan,
  type IpBanRow,
  type IpLookupResult,
} from "../actions"

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function BlacklistTab() {
  const [bans, setBans] = useState<IpBanRow[]>([])
  const [loading, setLoading] = useState(true)

  // Проверка IP
  const [lookupIp, setLookupIp] = useState("")
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupResult, setLookupResult] = useState<IpLookupResult | null>(null)

  // Ручное добавление
  const [newTarget, setNewTarget] = useState("")
  const [newReason, setNewReason] = useState("")
  const [adding, setAdding] = useState(false)

  const fetchBans = useCallback(async () => {
    try {
      setLoading(true)
      setBans(await getIpBans())
    } catch (err: any) {
      console.error("Failed to fetch ip bans:", err)
      toast.error(String(err?.message || "Не удалось загрузить чёрный список"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBans()
  }, [fetchBans])

  const handleLookup = async () => {
    const ip = lookupIp.trim()
    if (!ip) return
    try {
      setLookupBusy(true)
      setLookupResult(null)
      setLookupResult(await lookupIpInfo(ip))
    } catch (err: any) {
      toast.error(String(err?.message || "Не удалось проверить IP"))
    } finally {
      setLookupBusy(false)
    }
  }

  const banAndRefresh = async (action: () => Promise<IpBanRow>, successPrefix: string) => {
    try {
      const row = await action()
      toast.success(`${successPrefix}: ${row.target} в чёрном списке`)
      setLookupResult(null)
      setLookupIp("")
      await fetchBans()
    } catch (err: any) {
      toast.error(String(err?.message || "Не удалось добавить запись"))
    }
  }

  const handleManualAdd = async () => {
    const target = newTarget.trim()
    if (!target) return
    setAdding(true)
    await banAndRefresh(() => addIpBan(target, newReason), "Добавлено")
    setAdding(false)
    setNewTarget("")
    setNewReason("")
  }

  const handleRemove = async (row: IpBanRow) => {
    if (!confirm(`Разбанить ${row.target}?`)) return
    try {
      await removeIpBan(row.id)
      toast.success(`${row.target} удалён из чёрного списка`)
      await fetchBans()
    } catch (err: any) {
      toast.error(String(err?.message || "Не удалось удалить запись"))
    }
  }

  const lookupReason = lookupResult
    ? `Сканер: ${lookupResult.org || lookupResult.ip}${lookupResult.asn ? ` (${lookupResult.asn})` : ""}`
    : undefined

  return (
    <div className="space-y-6">
      {/* Подсказка */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-xs sm:text-sm text-muted-foreground">
        <Shield className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p>
            Забаненным адресам сайт отдаёт обычный <b>404</b> на все страницы, кроме админки.
            Запись — одиночный IP (<code>5.128.0.1</code>) или подсеть (<code>5.128.0.0/24</code>,
            для IPv6 — <code>/64</code>).
          </p>
          <p>
            Изменения вступают в силу в течение ~30 секунд (кэш в middleware). Аварийный бан без
            админки: переменная окружения <code>BLOCKED_IPS</code> (через запятую).
          </p>
        </div>
      </div>

      {/* Проверка IP */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Search className="w-4 h-4" /> Проверка IP (кто это: провайдер или хостинг)
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={lookupIp}
            onChange={(e) => setLookupIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="Например, 5.128.192.7"
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleLookup}
            disabled={lookupBusy || !lookupIp.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[40px]"
          >
            {lookupBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Проверить
          </button>
        </div>

        {lookupResult && (
          <div
            className={`rounded-lg border p-3 space-y-2 text-sm ${
              lookupResult.isHostingLike
                ? "border-red-500/40 bg-red-500/5"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {lookupResult.isHostingLike ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 text-xs font-semibold">
                  <Server className="w-3.5 h-3.5" /> Похоже на серверный хостинг — можно банить подсеть
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-semibold">
                  <Network className="w-3.5 h-3.5" /> Не похож на хостинг — банить точечно
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm">
              <div><span className="text-muted-foreground">IP: </span><b>{lookupResult.ip}</b></div>
              <div><span className="text-muted-foreground">Оператор/ASN: </span><b>{lookupResult.org || "—"}</b></div>
              <div><span className="text-muted-foreground">Город: </span>{lookupResult.city || "—"}, {lookupResult.region || "—"}</div>
              <div><span className="text-muted-foreground">Страна: </span>{lookupResult.country || "—"}</div>
              {lookupResult.hostname && (
                <div className="sm:col-span-2"><span className="text-muted-foreground">Hostname: </span>{lookupResult.hostname}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() =>
                  banAndRefresh(() => addIpBan(lookupResult.ip, lookupReason), "Забанен IP")
                }
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" /> Забанить IP
              </button>
              <button
                onClick={() =>
                  banAndRefresh(() => addIpSubnetBan(lookupResult.ip, lookupReason), "Забанена подсеть")
                }
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Забанить подсеть (/24)
              </button>
              <a
                href={`https://ipinfo.io/${lookupResult.ip}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-border text-xs flex items-center gap-1.5 hover:bg-muted"
              >
                <ExternalLink className="w-3.5 h-3.5" /> ipinfo.io
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Ручное добавление */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold text-sm">Добавить вручную</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="IP или подсеть: 5.128.0.1, 5.128.0.0/24, 2a03:d000::/48"
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Причина: ночной сканер /watch/61607"
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleManualAdd}
            disabled={adding || !newTarget.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[40px]"
          >
            {adding && <Loader2 className="w-4 h-4 animate-spin" />}
            Забанить
          </button>
        </div>
      </div>

      {/* Список банов */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Чёрный список ({bans.length})</h3>
          <button
            onClick={fetchBans}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Обновить
          </button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : bans.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Пока пусто. Проверьте подозрительный IP выше или добавьте вручную.
          </div>
        ) : (
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-4 py-2 font-medium">IP / подсеть</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Причина</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Когда</th>
                <th className="px-4 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {bans.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono">{row.target}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                    {row.reason || "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleRemove(row)}
                      title="Разбанить"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
