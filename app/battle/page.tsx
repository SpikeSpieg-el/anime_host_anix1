"use client"

import { Navbar } from "@/components/layout/navbar"
import { Swords, AlertCircle, X } from "lucide-react"
import { useBattleData } from "./hooks/use-battle-data"
import { StatsPanel } from "./components/StatsPanel"
import { DungeonSelector } from "./components/DungeonSelector"
import { SelectedTeamPanel } from "./components/SelectedTeamPanel"
import { BattleArena } from "./components/BattleArena"
import { BattleResultView } from "./components/BattleResultView"
import { TeamBuilderModal } from "./components/TeamBuilderModal"
import { glassCard } from "./config"

export default function BattlePage() {
  const {
    sessionLoading,
    userCoins,
    progress,
    dungeons,
    enemies,
    logs,
    selectedCards,
    selectedDungeon,
    setSelectedDungeon,
    battleState,
    setBattleState,
    battleResult,
    battleActionIndex,
    setBattleActionIndex,
    isAutoPlaying,
    setIsAutoPlaying,
    battleSpeed,
    setBattleSpeed,
    showTeamBuilder,
    setShowTeamBuilder,
    teamSearch,
    setTeamSearch,
    sortBy,
    setSortBy,
    error,
    setError,
    staminaTime,
    toggleCardSelection,
    startBattle,
    finishBattle,
    teamPower,
    filteredCards,
  } = useBattleData()

  return (
    <div className="min-h-screen bg-[#05050A] relative text-slate-100 font-sans pb-24 overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Soft space/glass background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-rose-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] left-[50%] w-[30vw] h-[30vw] rounded-full bg-blue-900/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-8 lg:py-12 max-w-[1400px] relative z-10">
        
        {/* Header Title */}
        <div className="text-center mb-10 lg:mb-14">
          <div className="inline-flex items-center justify-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md mb-6 shadow-2xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Режим Арены</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm">
            Битвы <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">PVE</span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-medium">
            Собери сильнейший отряд, покоряй опасные подземелья и добывай монеты для призыва новых героев.
          </p>
        </div>

        {/* Top bar indicators */}
        <StatsPanel progress={progress} userCoins={userCoins} staminaTime={staminaTime} />

        {/* Error notification */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/20 shadow-lg shadow-red-500/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 rounded-md hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* ==========================================
            1. BATTLE SYNCHRONIZATION LOADING STATE
        ========================================== */}
        {battleState === "loading" && (
          <div className={`max-w-md mx-auto p-12 rounded-3xl ${glassCard} flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95`}>
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-rose-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              <Swords className="absolute inset-0 m-auto w-8 h-8 text-rose-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Синхронизация Арены</h3>
            <p className="text-sm text-slate-400">Подготовка противников и расчет вероятностей...</p>
          </div>
        )}

        {/* ==========================================
            2. BATTLE SIMULATION ARENA VIEW
        ========================================== */}
        {battleState === "battle" && battleResult && (
          <BattleArena
            battleResult={battleResult}
            battleActionIndex={battleActionIndex}
            setBattleActionIndex={setBattleActionIndex}
            isAutoPlaying={isAutoPlaying}
            setIsAutoPlaying={setIsAutoPlaying}
            battleSpeed={battleSpeed}
            setBattleSpeed={setBattleSpeed}
            setBattleState={setBattleState}
            selectedCards={selectedCards}
            enemies={enemies}
            progress={progress}
          />
        )}

        {/* ==========================================
            3. COMBAT RESULTS VIEW
        ========================================== */}
        {battleState === "result" && battleResult && (
          <BattleResultView
            battleResult={battleResult}
            finishBattle={finishBattle}
          />
        )}

        {/* ==========================================
            4. MAIN IDLE DASHBOARD
        ========================================== */}
        {battleState === "idle" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
            <DungeonSelector
              dungeons={dungeons}
              progress={progress}
              selectedDungeon={selectedDungeon}
              setSelectedDungeon={setSelectedDungeon}
            />

            <SelectedTeamPanel
              selectedCards={selectedCards}
              toggleCardSelection={toggleCardSelection}
              setShowTeamBuilder={setShowTeamBuilder}
              selectedDungeon={selectedDungeon}
              enemies={enemies}
              teamPower={teamPower}
              progress={progress}
              startBattle={startBattle}
              logs={logs}
            />
          </div>
        )}
      </div>

      {/* ==========================================
          5. BARRACKS HERO SELECT DIALOG
      ========================================== */}
      <TeamBuilderModal
        showTeamBuilder={showTeamBuilder}
        setShowTeamBuilder={setShowTeamBuilder}
        selectedCards={selectedCards}
        toggleCardSelection={toggleCardSelection}
        teamSearch={teamSearch}
        setTeamSearch={setTeamSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filteredCards={filteredCards}
      />
    </div>
  )
}