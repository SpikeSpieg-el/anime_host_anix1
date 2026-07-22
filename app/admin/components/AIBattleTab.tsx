"use client"

import { Brain, CheckCircle, AlertTriangle, Shield } from "lucide-react"
import type { BattleAIDashboard } from "./types"

interface AIBattleTabProps {
  battleAIDashboard: BattleAIDashboard | null
  isBattleAILoading: boolean
  battleAIError: string | null
  learningProfiles: any[]
  onRefresh: () => void
  formatDate: (dateString: string | null) => string
}

export function AIBattleTab({
  battleAIDashboard,
  isBattleAILoading,
  battleAIError,
  learningProfiles,
  onRefresh,
  formatDate,
}: AIBattleTabProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Brain size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            AI Battle Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Баланс локаций, обучение AI и сигналы антифарма.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isBattleAILoading}
          className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
        >
          {isBattleAILoading ? "Обновление..." : "Обновить данные"}
        </button>
      </div>

      {battleAIError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
          <p className="font-semibold text-destructive">Не удалось загрузить AI-статус</p>
          <p className="text-muted-foreground mt-1">{battleAIError}</p>
        </div>
      ) : isBattleAILoading && !battleAIDashboard ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, index) => <div key={index} className="h-28 rounded-xl bg-muted" />)}
        </div>
      ) : !battleAIDashboard ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Данные AI пока не загружены.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего PvE боёв</p>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.totalBattles.toLocaleString('ru-RU')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Винрейт игроков</p>
              <p className="mt-2 text-2xl font-bold">{(battleAIDashboard.summary.playerWinRate * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Цель баланса: 45–65%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Средняя длительность</p>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.averageTurns.toFixed(1)} хода</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Профили обучения</p>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.trackedProfiles.toLocaleString('ru-RU')}</p>
              <p className="text-xs text-muted-foreground mt-1">Локаций: {battleAIDashboard.summary.activeLocations}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle size={18} /><span className="font-semibold">Сбалансированные локации</span></div>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.balancedLocations}</p>
              <p className="mt-1 text-xs text-muted-foreground">Винрейт игроков находится в диапазоне 45–65%.</p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={18} /><span className="font-semibold">Преимущество игроков</span></div>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.playerAdvantageLocations}</p>
              <p className="mt-1 text-xs text-muted-foreground">Игроки выигрывают более 65% боёв. Мало данных: {battleAIDashboard.summary.insufficientLocations}</p>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300"><Shield size={18} /><span className="font-semibold">Риски фарма</span></div>
              <p className="mt-2 text-2xl font-bold">{battleAIDashboard.summary.highRiskProfiles}</p>
              <p className="mt-1 text-xs text-muted-foreground">Высокий риск: частые победы и серия от 5. AI слишком силён: {battleAIDashboard.summary.aiAdvantageLocations}</p>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Баланс по локациям</h3>
                <p className="text-xs text-muted-foreground mt-1">AI корректирует сложность по агрегированным результатам всех игроков.</p>
              </div>
              <span className="text-xs text-muted-foreground">Обновлено: {formatDate(battleAIDashboard.generatedAt)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Локация</th>
                    <th className="px-4 py-3 text-right">Боёв</th>
                    <th className="px-4 py-3 text-right">Игроки</th>
                    <th className="px-4 py-3 text-right">AI</th>
                    <th className="px-4 py-3 text-right">Ходы</th>
                    <th className="px-4 py-3 text-left">Статус</th>
                    <th className="px-4 py-3 text-left">Рекомендация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {battleAIDashboard.locations.map(location => {
                    const labels = {
                      insufficient: "Недостаточно данных",
                      balanced: "Баланс в норме",
                      player_advantage: "Игроки слишком сильны",
                      ai_advantage: "AI слишком силён",
                    }
                    const recommendations = {
                      insufficient: "Нужно минимум 20 боёв для коррекции.",
                      balanced: "Сохранять текущие параметры AI.",
                      player_advantage: "Повысить качество решений и контр-пики.",
                      ai_advantage: "Увеличить вероятность ошибок AI.",
                    }
                    const tone = location.balanceStatus === "balanced"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : location.balanceStatus === "insufficient"
                        ? "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                        : location.balanceStatus === "player_advantage"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    return (
                      <tr key={location.dungeon_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{location.dungeon_id}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{location.battles.toLocaleString('ru-RU')}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{(location.playerWinRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{(location.aiWinRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{location.avgTurns.toFixed(1)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{labels[location.balanceStatus]}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{recommendations[location.balanceStatus]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {battleAIDashboard.locations.length === 0 && <p className="p-8 text-center text-muted-foreground">Пока нет завершённых PvE-боёв для обучения AI.</p>}
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border">
              <h3 className="font-semibold">Антифарм и персональные адаптации</h3>
              <p className="text-xs text-muted-foreground mt-1">Показаны 100 наиболее активных профилей, отсортированных по серии побед и числу побед.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Игрок</th>
                    <th className="px-4 py-3 text-left">Локация</th>
                    <th className="px-4 py-3 text-right">Боёв</th>
                    <th className="px-4 py-3 text-right">Побед</th>
                    <th className="px-4 py-3 text-right">Винрейт</th>
                    <th className="px-4 py-3 text-right">Серия</th>
                    <th className="px-4 py-3 text-left">Риск</th>
                    <th className="px-4 py-3 text-left">Обновлён</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {battleAIDashboard.farmProfiles.map(profile => {
                    const riskLabel = profile.riskLevel === "high" ? "Высокий" : profile.riskLevel === "medium" ? "Средний" : "Нормальный"
                    const riskTone = profile.riskLevel === "high"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : profile.riskLevel === "medium"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    return (
                      <tr key={`${profile.user_id}-${profile.dungeon_id}`} className="hover:bg-muted/30">
                        <td className="px-4 py-3"><p className="font-medium">{profile.username || "Без имени"}</p><p className="font-mono text-[10px] text-muted-foreground">{profile.user_id}</p></td>
                        <td className="px-4 py-3 font-medium">{profile.dungeon_id}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{profile.battles}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{profile.wins}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{(profile.winRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{profile.consecutive_wins}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${riskTone}`}>{riskLabel}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(profile.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {battleAIDashboard.farmProfiles.length === 0 && <p className="p-8 text-center text-muted-foreground">Профили игроков появятся после завершения PvE-боёв.</p>}
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <Brain size={18} className="text-primary" />
                Профили обучения игроков
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Playstyle данные с exponential decay (×0.92 за бой)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Игрок</th>
                    <th className="px-4 py-3 text-right">Боёв</th>
                    <th className="px-4 py-3 text-right">Avg Prov</th>
                    <th className="px-4 py-3 text-left">Роли (decay)</th>
                    <th className="px-4 py-3 text-right">Bluff</th>
                    <th className="px-4 py-3 text-left">Любимые карты</th>
                    <th className="px-4 py-3 text-left">Обновлён</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {learningProfiles.map((profile: any) => {
                    const roles = profile.preferred_roles || {}
                    const totalRole = Object.values(roles).reduce((a: number, b: any) => a + b, 0) || 1
                    const topCards = (profile.favorite_cards || []).slice(0, 3)
                    return (
                      <tr key={profile.user_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{profile.username || "Без имени"}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{profile.user_id?.slice(0, 8)}...</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{profile.total_battles}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{(profile.avg_provision_cost || 0).toFixed(1)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(roles).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([role, count]) => (
                              <span key={role} className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded capitalize">
                                {role}: {(count as number).toFixed(1)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{((profile.bluff_tendency || 0) * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {topCards.map((card: any) => (
                              <div key={card.cardId} className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {card.cardName} <span className="text-primary">×{card.usageCount.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(profile.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {learningProfiles.length === 0 && <p className="p-8 text-center text-muted-foreground">Нет профилей обучения. Сыграй бои для накопления данных.</p>}
          </section>
        </>
      )}
    </div>
  )
}
