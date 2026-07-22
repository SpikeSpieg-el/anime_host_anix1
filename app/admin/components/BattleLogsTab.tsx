"use client"

import { History, Trophy } from "lucide-react"
import type { PvPLog } from "./types"

interface BattleLogsTabProps {
  pvpLogs: PvPLog[]
  isLogsLoading: boolean
  logsError: string | null
  onRefresh: () => void
  formatDate: (dateString: string | null) => string
}

export function BattleLogsTab({
  pvpLogs,
  isLogsLoading,
  logsError,
  onRefresh,
  formatDate,
}: BattleLogsTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <History size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          PvP Battle Logs
        </h2>
        <button
          onClick={onRefresh}
          className="text-sm text-primary hover:underline w-fit"
          disabled={isLogsLoading}
        >
          Refresh
        </button>
      </div>

      {isLogsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : logsError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-500 font-medium">Ошибка загрузки логов: {logsError}</p>
          <button onClick={onRefresh} className="mt-2 text-xs text-red-400 hover:underline">Попробовать снова</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Match ID / Time</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Player 1</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Player 2</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Winner</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Duration</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pvpLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition text-sm">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="font-mono text-[10px] text-muted-foreground mb-1 truncate max-w-[100px]">{log.id}</div>
                      <div className="text-xs">{formatDate(log.created_at)}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2">
                        {log.player1.avatar_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={log.player1.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[80px]">{log.player1.username || 'P1'}</span>
                          <span className="text-[10px] text-muted-foreground">{log.player1_mmr_before} → {log.player1_mmr_after}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2">
                        {log.player2.avatar_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={log.player2.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[80px]">{log.player2.username || 'P2'}</span>
                          <span className="text-[10px] text-muted-foreground">{log.player2_mmr_before} → {log.player2_mmr_after}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {log.winner_id ? (
                        <div className="flex items-center gap-1 text-emerald-500 font-bold">
                          <Trophy size={14} />
                          <span className="truncate max-w-[80px]">
                            {log.winner_id === log.player1_id ? (log.player1.username || 'P1') : (log.player2.username || 'P2')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Draw</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-muted-foreground">
                      {log.duration_seconds}s
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        log.battle_data?.reason === 'complete' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        log.battle_data?.reason === 'disconnect' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {log.battle_data?.reason || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pvpLogs.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No battle logs found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
