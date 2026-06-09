import React, { useState } from 'react'
import { Swords, Users, Trophy, Loader2, X, AlertCircle } from 'lucide-react'
import { Card } from '../types'
import { Leaderboard } from './Leaderboard'
import { glassCard, DECK_SIZE } from '../config'

interface PvPArenaProps {
  selectedCards: Card[]
  leaderId: string | null
  formation: string
  onClose: () => void
  pvpState: any
  joinQueue: (deck: Card[], leaderId: string | null, formation: string) => void
  leaveQueue: () => void
  isConnected: boolean
}

export const PvPArena: React.FC<PvPArenaProps> = ({
  selectedCards,
  leaderId,
  formation,
  onClose,
  pvpState,
  joinQueue,
  leaveQueue,
  isConnected
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const handleJoinQueue = () => {
    if (selectedCards.length !== DECK_SIZE) {
      alert(`Необходимо выбрать ровно ${DECK_SIZE} карт для PvP битвы`)
      return
    }
    joinQueue(selectedCards, leaderId, formation)
  }

  const handleLeaveQueue = () => {
    leaveQueue()
  }

  if (showLeaderboard) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setShowLeaderboard(false)}
          className="self-start px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-slate-300 transition-colors border border-white/10"
        >
          ← Назад в Арену
        </button>
        <Leaderboard />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-white flex items-center justify-center gap-3 drop-shadow-sm mb-2">
          <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Swords className="w-6 h-6" />
          </span>
          Арена PvP
        </h2>
        <p className="text-sm text-slate-400">
          Сразитесь с реальными игроками в рейтинговом матче
        </p>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className={`${glassCard} p-4 flex items-center gap-3 border-l-4 border-orange-500`}>
          <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-orange-400">Подключение к PvP серверу...</p>
            <p className="text-xs text-slate-400 mt-1">Проверьте, что PvP сервер запущен</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {pvpState.error && (
        <div className={`${glassCard} p-4 flex items-center gap-3 border-l-4 border-red-500`}>
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400">{pvpState.error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-bold text-red-400 transition-colors"
          >
            Перезагрузить
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Queue Status Card */}
        <div className={`${glassCard} p-6 flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Поиск Матча</h3>
              <p className="text-xs text-slate-400">
                {pvpState.status === 'idle' && 'Готов к поиску'}
                {pvpState.status === 'connecting' && 'Подключение...'}
                {pvpState.status === 'in_queue' && `В очереди (${pvpState.queueSize} игроков)`}
                {pvpState.status === 'matched' && 'Матч найден!'}
                {pvpState.status === 'in_battle' && 'В бою'}
                {pvpState.status === 'ended' && 'Матч завершён'}
              </p>
            </div>
          </div>

          {/* Queue Actions */}
          <div className="flex flex-col gap-3">
            {pvpState.status === 'idle' && (
              <button
                onClick={handleJoinQueue}
                disabled={!isConnected || selectedCards.length !== DECK_SIZE}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Swords className="w-5 h-5" />
                Начать Поиск
              </button>
            )}

            {pvpState.status === 'in_queue' && (
              <button
                onClick={handleLeaveQueue}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black rounded-xl transition-all border border-red-500/30 flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Отменить Поиск
              </button>
            )}

            {(pvpState.status === 'connecting' || pvpState.status === 'in_queue') && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-sm text-slate-400">
                  {pvpState.status === 'connecting' ? 'Подключение...' : 'Поиск противника...'}
                </span>
              </div>
            )}

            {pvpState.status === 'matched' && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Swords className="w-5 h-5 text-green-400" />
                  <span className="text-lg font-black text-green-400">Матч Найден!</span>
                </div>
                <p className="text-sm text-center text-slate-300">
                  Противник: <span className="font-bold text-white">{pvpState.matchData?.opponentId.slice(0, 8)}...</span>
                </p>
                <p className="text-xs text-center text-slate-400 mt-2">
                  Переход на арену...
                </p>
              </div>
            )}

            {selectedCards.length !== DECK_SIZE && pvpState.status === 'idle' && (
              <p className="text-xs text-center text-orange-400 bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/20">
                Выберите ровно {DECK_SIZE} карт для участия в PvP
              </p>
            )}
          </div>
        </div>

        {/* Deck Info Card */}
        <div className={`${glassCard} p-6 flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <Trophy className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Ваша Колода</h3>
              <p className="text-xs text-slate-400">
                {selectedCards.length}/{DECK_SIZE} карт выбрано
              </p>
            </div>
          </div>

          {/* Deck Preview */}
          <div className="grid grid-cols-3 gap-2">
            {selectedCards.map((card, idx) => (
              <div
                key={card.uniqueId}
                className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-slate-900/50 relative group"
              >
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[10px] font-bold text-white truncate">{card.name}</p>
                  </div>
                </div>
              </div>
            ))}
            {Array.from({ length: DECK_SIZE - selectedCards.length }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="aspect-[2/3] rounded-lg border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center"
              >
                <span className="text-2xl text-white/20">?</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard Button */}
      <button
        onClick={() => setShowLeaderboard(true)}
        className={`${glassCard} p-4 hover:bg-white/[0.06] transition-all flex items-center justify-between group`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-black text-white">Таблица Лидеров</h3>
            <p className="text-xs text-slate-400">Посмотреть рейтинг игроков</p>
          </div>
        </div>
        <div className="text-slate-400 group-hover:text-white transition-colors">→</div>
      </button>

      {/* Info Section */}
      <div className={`${glassCard} p-4`}>
        <h4 className="text-sm font-bold text-white mb-2">Как работает PvP?</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Соберите колоду из {DECK_SIZE} карт</li>
          <li>• Нажмите "Начать Поиск" для поиска противника</li>
          <li>• Система подберёт игрока с похожим рейтингом (MMR)</li>
          <li>• Побеждайте и повышайте свой ранг!</li>
          <li>• За победу: +MMR, за поражение: -MMR</li>
        </ul>
      </div>
    </div>
  )
}
