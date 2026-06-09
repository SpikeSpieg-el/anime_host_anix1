import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/components/auth/auth-provider'
import { Card } from '../types'

const PVP_SERVER_URL = process.env.NEXT_PUBLIC_PVP_SERVER_URL || 'http://localhost:3001'

interface MatchData {
  matchId: string
  opponentId: string
  territories: any[]
  yourDeck: Card[]
  yourLeaderId: string | null
  yourFormation: string
  opponentDeck: Card[]
  opponentLeaderId: string | null
  opponentFormation: string
  isPlayer1: boolean
}

interface RoundResults {
  round: number
  player1Placements: any[]
  player2Placements: any[]
  zoneWinners: string[]
  zoneResults: any[]
  player1Score: number
  player2Score: number
}

interface PvPState {
  status: 'idle' | 'connecting' | 'in_queue' | 'matched' | 'in_battle' | 'ended'
  queueSize: number
  matchData: MatchData | null
  error: string | null
  mmrChange: number | null
  roundResults: RoundResults | null
}

export function usePvPBattle(options?: {
  onRoundResolved?: (results: any) => void
  onStartNewRound?: (data: any) => void
  onMatchEnded?: (data: any) => void
}) {
  const { session } = useAuth()
  const [pvpState, setPvpState] = useState<PvPState>({
    status: 'idle',
    queueSize: 0,
    matchData: null,
    error: null,
    mmrChange: null,
    roundResults: null
  })

  const socketRef = useRef<Socket | null>(null)
  
  // Use a ref for options to avoid re-triggering connection useEffect
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Initialize socket connection
  useEffect(() => {
    if (!session?.access_token) return

    console.log('[PvP] Connecting to server:', PVP_SERVER_URL)
    
    const socket = io(PVP_SERVER_URL, {
      auth: {
        token: session.access_token
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[PvP] Connected to server')
      setPvpState(prev => ({ ...prev, status: 'idle', error: null }))
    })

    socket.on('connect_error', (err) => {
      console.error('[PvP] Connection error:', err.message)
      setPvpState(prev => ({ 
        ...prev, 
        status: 'idle', 
        error: 'Не удалось подключиться к PvP серверу' 
      }))
    })

    socket.on('disconnect', () => {
      console.log('[PvP] Disconnected from server')
    })

    socket.on('queue_joined', (data) => {
      console.log('[PvP] Joined queue, size:', data.queueSize)
      setPvpState(prev => ({ 
        ...prev, 
        status: 'in_queue', 
        queueSize: data.queueSize 
      }))
    })

    socket.on('queue_left', () => {
      console.log('[PvP] Left queue')
      setPvpState(prev => ({ 
        ...prev, 
        status: 'idle', 
        queueSize: 0 
      }))
    })

    socket.on('match_found', (data: MatchData) => {
      console.log('[PvP] Match found:', data.matchId)
      setPvpState(prev => ({ 
        ...prev, 
        status: 'matched', 
        matchData: data 
      }))
    })

    socket.on('opponent_moved', () => {
      console.log('[PvP] Opponent made a move')
      // This can trigger UI updates to show "Opponent is ready"
    })

    socket.on('round_resolved', (results: RoundResults) => {
      console.log('[PvP] Round resolved:', results)
      setPvpState(prev => ({ 
        ...prev, 
        roundResults: results,
        status: 'in_battle'
      }))
      if (optionsRef.current?.onRoundResolved) {
        optionsRef.current.onRoundResolved(results)
      }
    })

    socket.on('start_new_round', (data) => {
      console.log('[PvP] Starting new round:', data.round)
      setPvpState(prev => ({
        ...prev,
        matchData: prev.matchData ? {
          ...prev.matchData,
          yourDeck: data.yourDeck
        } : null,
        roundResults: null,
        status: 'in_battle'
      }))
      if (optionsRef.current?.onStartNewRound) {
        optionsRef.current.onStartNewRound(data)
      }
    })

    socket.on('match_ended', (data) => {
      console.log('[PvP] Match ended:', data)
      setPvpState(prev => ({ 
        ...prev, 
        status: 'ended', 
        mmrChange: data.mmrChange 
      }))
      if (optionsRef.current?.onMatchEnded) {
        optionsRef.current.onMatchEnded(data)
      }
    })

    socket.on('opponent_disconnect', (data) => {
      console.log('[PvP] Opponent disconnected, auto-win for current player')
      setPvpState(prev => ({ 
        ...prev, 
        status: 'ended', 
        mmrChange: data.mmrChange || 10 
      }))
      if (optionsRef.current?.onMatchEnded) {
        optionsRef.current.onMatchEnded({ 
          winner: session?.user?.id, 
          mmrChange: data.mmrChange || 10,
          reason: 'opponent_disconnect' 
        })
      }
    })

    socket.on('error', (data) => {
      console.error('[PvP] Server error:', data.message)
      setPvpState(prev => ({ 
        ...prev, 
        error: data.message 
      }))
    })

    return () => {
      console.log('[PvP] Cleaning up socket connection')
      socket.disconnect()
    }
  }, [session?.access_token])

  // Join matchmaking queue
  const joinQueue = useCallback((deck: Card[], leaderId: string | null, formation: string) => {
    if (!socketRef.current?.connected) {
      setPvpState(prev => ({ 
        ...prev, 
        error: 'Не подключен к PvP серверу' 
      }))
      return
    }

    console.log('[PvP] Joining queue with deck:', deck.length)
    setPvpState(prev => ({ ...prev, status: 'connecting' }))
    
    socketRef.current.emit('join_queue', {
      deck: deck.map(c => ({
        uniqueId: c.uniqueId,
        name: c.name,
        anime: c.anime,
        rarity: c.rarity,
        imageUrl: c.imageUrl,
        stats: c.stats,
        role: c.role,
        provisionCost: c.provisionCost
      })),
      leaderId,
      formation
    })
  }, [])

  // Leave matchmaking queue
  const leaveQueue = useCallback(() => {
    if (!socketRef.current?.connected) return

    console.log('[PvP] Leaving queue')
    socketRef.current.emit('leave_queue')
  }, [])

  // Place cards during battle
  const placeCards = useCallback((matchId: string, placements: any[]) => {
    if (!socketRef.current?.connected) return

    console.log('[PvP] Placing cards for match:', matchId)
    socketRef.current.emit('place_cards', {
      matchId,
      placements
    })
  }, [])

  // Reset state
  const resetPvP = useCallback(() => {
    setPvpState({
      status: 'idle',
      queueSize: 0,
      matchData: null,
      error: null,
      mmrChange: null,
      roundResults: null
    })
  }, [])

  return {
    pvpState,
    joinQueue,
    leaveQueue,
    placeCards,
    resetPvP,
    isConnected: socketRef.current?.connected || false
  }
}
