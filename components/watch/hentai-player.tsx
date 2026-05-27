import React, { useEffect, useState, useRef, useCallback } from "react"
import {
Loader2, AlertTriangle, RefreshCw, Lock, Play,
Pause, Volume2, VolumeX, Maximize, Minimize,
ShieldAlert, ListVideo, X, Flame, Activity, Info, ChevronRight
} from "lucide-react"
import { getHentaiPlaylist } from "@/lib/hentai-actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { useAuth } from "@/components/auth-provider"

interface HentaiPlayerProps {
title: string
originalTitle: string
episode: number
isActive: boolean
}

export function HentaiPlayer({ title, originalTitle, episode, isActive }: HentaiPlayerProps) {
const { profile } = useAuth()
const [playlist, setPlaylist] = useState<{name: string, url: string}[]>([])
const [currentIndex, setCurrentIndex] = useState<number | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [isStarted, setIsStarted] = useState(false)
const [showPlaylist, setShowPlaylist] = useState(false)
const [retryKey, setRetryKey] = useState(0)

const [isPlaying, setIsPlaying] = useState(false)
const [progress, setProgress] = useState(0)
const [duration, setDuration] = useState(0)
const [currentTime, setCurrentTime] = useState(0)
const [volume, setVolume] = useState(0.7)
const [isMuted, setIsMuted] = useState(false)
const [showControls, setShowControls] = useState(true)
const [isFullscreen, setIsFullscreen] = useState(false)

const videoRef = useRef<HTMLVideoElement>(null)
const containerRef = useRef<HTMLDivElement>(null)
const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

const formatTime = (seconds: number): string => {
const mins = Math.floor(seconds / 60)
const secs = Math.floor(seconds % 60)
return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const handleUserActivity = useCallback(() => {
setShowControls(true)
if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
if (isPlaying) {
controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000)
}
}, [isPlaying])

useEffect(() => {
setIsStarted(false)
setPlaylist([])
setCurrentIndex(null)
setError(null)
setIsPlaying(false)
setProgress(0)
setCurrentTime(0)
setDuration(0)
}, [originalTitle, episode])

useEffect(() => {
setProgress(0)
setCurrentTime(0)
setDuration(0)
setIsPlaying(false)
}, [currentIndex])

useEffect(() => {
if (!isActive || !isStarted) return;


let isMounted = true;
const fetchData = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const data = await getHentaiPlaylist(title, originalTitle, episode);
    if (!isMounted) return;
    if (data && data.length > 0) setPlaylist(data);
    else setError("Source empty.");
  } catch (err) {
    setError("Forge connection lost.");
  } finally {
    if (isMounted) setIsLoading(false);
  }
};
fetchData();
return () => { isMounted = false };

}, [isStarted, isActive, retryKey, episode, title, originalTitle]);

const togglePlay = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
if (e) e.stopPropagation();
if (!videoRef.current) return;
if (isPlaying) {
videoRef.current.pause();
} else {
videoRef.current.play().catch(() => {});
}
}, [isPlaying]);

const handleFullscreen = (e: React.MouseEvent) => {
e.stopPropagation();
if (!containerRef.current) return;
if (!document.fullscreenElement) {
containerRef.current.requestFullscreen();
setIsFullscreen(true);
} else {
document.exitFullscreen();
setIsFullscreen(false);
}
};

if (!isActive) return null;

// Check if user has dangerous viewing enabled
if (!profile?.allow_nsfw_search) {
  return (
    <div className="relative w-full h-full overflow-hidden border border-white/10 bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="relative mb-6">
          <div className="absolute inset-0 animate-pulse rounded-full bg-red-500/20 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-black/40 backdrop-blur-2xl mx-auto">
            <ShieldAlert className="h-8 w-8 text-red-500" strokeWidth={1.5} />
          </div>
        </div>
        
        <h2 className="mb-3 text-lg font-bold text-white">Доступ запрещен</h2>
        
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
          <p className="text-xs text-red-400">
            Этот контент предназначен только для взрослых пользователей. 
            Включите соответствующую настройку для получения доступа.
          </p>
        </div>
      </div>
    </div>
  );
}

const currentFile = currentIndex !== null ? playlist[currentIndex] : null;

return (
<div
ref={containerRef}
onMouseMove={handleUserActivity}
onTouchStart={handleUserActivity}
className={cn(
"group relative w-full h-full overflow-hidden border border-white/10 bg-[#0a0a0a] transition-all duration-500",
isFullscreen && "fixed inset-0 z-[9999] h-screen w-screen"
)}
>
{/* 1. WARNING SCREEN: FIX (скролл для маленьких экранов) */}
{!isStarted && !isLoading && (
<div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] p-2 sm:p-4 overflow-y-auto">
<div className="absolute inset-0 opacity-20 pointer-events-none"
style={{ background: 'radial-gradient(circle at center, #fb923c 0%, transparent 70%)' }} />

<div className="relative z-10 w-full max-w-[280px] xs:max-w-[320px] sm:max-w-md md:max-w-lg animate-in fade-in zoom-in duration-500">
        <div className="mb-3 xs:mb-4 sm:mb-6 md:mb-8 flex flex-col items-center text-center">
          <div className="relative mb-3 xs:mb-4">
            <div className="absolute inset-0 animate-pulse rounded-full bg-orange-500/20 blur-2xl" />
            <div className="relative flex h-12 w-12 xs:h-14 xs:w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-xl sm:rounded-2xl border border-orange-500/30 bg-black/40 backdrop-blur-2xl">
                <ShieldAlert className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-orange-500" strokeWidth={1.5} />
                <div className="absolute -bottom-1 -right-1 flex h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-orange-600 shadow-lg">
                    <Lock className="h-2 w-2 xs:h-2.5 xs:w-2.5 sm:h-3 sm:w-3 text-white" />
                </div>
            </div>
          </div>
          
          <h2 className="mb-1 text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl font-black uppercase tracking-[0.1em] xs:tracking-[0.15em] md:tracking-[0.2em] text-white">Access Protocol</h2>
          <div className="mb-3 xs:mb-4 flex items-center gap-2 text-[7px] xs:text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-orange-500/60">
            <span className="h-[1px] w-3 xs:w-4 sm:w-6 md:w-8 bg-orange-500/20" />
            Adult Restriction 21+
            <span className="h-[1px] w-3 xs:w-4 sm:w-6 md:w-8 bg-orange-500/20" />
          </div>
          
          <p className="mb-4 xs:mb-6 sm:mb-8 md:mb-10 text-[9px] xs:text-[10px] sm:text-[11px] md:text-sm leading-relaxed text-zinc-500">
            Confirm your biometric signature for <span className="text-zinc-300 font-mono italic">EP_{episode}</span>.
          </p>

          <button 
            onClick={() => setIsStarted(true)}
            className="group relative flex h-10 xs:h-11 sm:h-12 md:h-14 w-full items-center justify-center overflow-hidden rounded-full bg-orange-600 transition-all hover:bg-orange-500 active:scale-95"
          >
            <span className="relative flex items-center gap-2 xs:gap-3 text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.15em] xs:tracking-[0.2em] text-white">
              Ignite Forge <Flame className="h-3 w-3 xs:h-4 xs:w-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )}

  {/* 2. LOADING STATE */}
  {isLoading && (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#050505]">
      <div className="relative h-16 w-16">
         <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-orange-500" />
         <Activity className="h-5 w-5 animate-pulse text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <p className="mt-4 text-[8px] font-black uppercase tracking-[0.4em] text-orange-500/50">Establishing Tunnel</p>
    </div>
  )}

  {/* 3. ERROR STATE */}
  {error && (
    <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black p-4 text-center">
      <AlertTriangle className="mb-2 h-10 w-10 text-red-500" />
      <h3 className="mb-4 text-[10px] font-bold uppercase text-white tracking-widest">{error}</h3>
      <Button variant="outline" onClick={() => setRetryKey(k => k + 1)} className="border-white/10 text-white text-[10px]">
        <RefreshCw className="mr-2 h-3 w-3" /> REBOOT
      </Button>
    </div>
  )}

  {/* 4. ORE CATALOG (Список серий внутри плеера) */}
  {isStarted && !isLoading && !error && playlist.length > 0 && !currentFile && (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#050505] animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-8 md:py-6">
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">Material Catalog</h3>
            <button onClick={() => setIsStarted(false)} className="p-1 text-zinc-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-4xl mx-auto">
                {playlist.map((file, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-900/50 p-3 text-left transition-all hover:border-orange-500/40 active:bg-zinc-800"
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black text-[10px] font-bold text-orange-500 border border-white/5">
                            {idx + 1}
                        </div>
                        <span className="truncate text-[10px] font-bold text-zinc-300 uppercase">{file.name}</span>
                        <ChevronRight className="ml-auto h-4 w-4 text-zinc-700" />
                    </button>
                ))}
            </div>
        </div>
    </div>
  )}

  {/* 5. VIDEO CORE */}
  {currentFile && (
    <video
      ref={videoRef}
      src={currentFile.url}
      key={currentFile.url}
      className={cn(
        "h-full w-full object-contain",
        !isFullscreen
      )}
      onClick={togglePlay}
      onTimeUpdate={() => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
        }
      }}
      onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      playsInline
    />
  )}

  {/* 6. UI CONTROLS */}
  {isStarted && currentFile && (
    <div 
      className={cn(
        "absolute inset-0 z-30 flex flex-col justify-between p-3 md:p-6 transition-opacity duration-300",
        showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }}
      onClick={handleUserActivity}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-[70%]">
            <div className="flex h-5 items-center bg-orange-600 px-2 text-[7px] font-black uppercase text-white rounded">LIVE</div>
            <span className="text-[9px] md:text-[10px] font-bold text-zinc-400 truncate uppercase tracking-widest">{currentFile.name}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowPlaylist(true); }}
          className="flex h-8 w-8 md:w-auto md:px-3 items-center justify-center gap-2 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white"
        >
            <ListVideo className="h-4 w-4" />
            <span className="hidden md:inline text-[9px] font-bold uppercase">Files</span>
        </button>
      </div>

      {/* !!! ЦЕНТРАЛЬНАЯ КНОПКА PLAY (ИСПРАВЛЕНО) !!! */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying && (
            <button 
              onClick={togglePlay}
              className="pointer-events-auto flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20 backdrop-blur-md transition-transform hover:scale-110 active:scale-90"
            >
                <Play className="h-8 w-8 md:h-10 md:w-10 fill-white text-white translate-x-1" />
            </button>
          )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full space-y-2 md:space-y-4" onClick={e => e.stopPropagation()}>
        <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={(val) => {
                if (videoRef.current) videoRef.current.currentTime = (val[0] / 100) * duration;
            }}
            className="cursor-pointer"
        />

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3 md:gap-6">
              <button onClick={togglePlay} className="text-white hover:text-orange-500">
                {isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6 fill-current" /> : <Play className="h-5 w-5 md:h-6 md:w-6 fill-current" />}
              </button>

              <div className="flex items-center gap-2">
                <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400">
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <div className="hidden sm:block w-16 md:w-24">
                    <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={(v) => setVolume(v[0])} />
                </div>
              </div>

              <div className="font-mono text-[9px] md:text-[10px] font-bold text-zinc-500">
                <span className="text-orange-500">{formatTime(currentTime)}</span> / {formatTime(duration)}
              </div>
           </div>

           <button onClick={handleFullscreen} className="text-zinc-500 hover:text-white">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
           </button>
        </div>
      </div>
    </div>
  )}

  {/* 7. PLAYLIST SIDEBAR (Мобильный адаптив) */}
  <div className={cn(
    "absolute inset-0 z-[100] bg-[#050505]/95 backdrop-blur-xl transition-transform duration-500 ease-in-out",
    showPlaylist ? "translate-x-0" : "translate-x-full"
  )}>
     <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">System Modules</span>
            <button onClick={() => setShowPlaylist(false)} className="p-2 text-zinc-500 hover:text-white"><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {playlist.map((file, idx) => (
                <button
                    key={idx}
                    onClick={() => { setCurrentIndex(idx); setShowPlaylist(false); }}
                    className={cn(
                        "flex w-full items-center gap-4 p-4 rounded-xl mb-1 transition-all",
                        currentIndex === idx ? "bg-orange-600/20 text-white" : "text-zinc-500 hover:bg-white/5"
                    )}
                >
                    <div className={cn("h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold border", 
                         currentIndex === idx ? "bg-orange-600 border-orange-500 text-white" : "bg-black border-white/10")}>
                        {idx + 1}
                    </div>
                    <span className="truncate text-xs font-bold uppercase">{file.name}</span>
                </button>
            ))}
        </div>
     </div>
  </div>

  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 146, 60, 0.3); border-radius: 10px; }
  `}</style>
</div>

)
}
