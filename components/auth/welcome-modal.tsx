"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, Play, Sparkles, Swords } from "lucide-react"
import { AuthModal } from "@/components/auth/auth-modal"

const customStyles = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setMounted(true)
    const hasVisited = localStorage.getItem("Weeb-X-visited-v3")
    if (!hasVisited) {
      const timer = setTimeout(() => setIsOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setIsOpen(false)
      setClosing(false)
    }, 300)
  }, [])

  const handleStart = () => {
    localStorage.setItem("Weeb-X-visited-v3", "true")
    handleClose()
  }

  const handleSignUp = () => {
    localStorage.setItem("Weeb-X-visited-v3", "true")
    handleClose()
    setTimeout(() => setShowAuthModal(true), 350)
  }

  if (!mounted) return null

  const show = isOpen && !closing

  return (
    <>
      <style>{customStyles}</style>
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ padding: "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 12px)" }}
        onClick={handleStart}
      >
        <div
          className={`relative w-full max-w-[400px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/15 transition-all duration-300 ease-out ${
            show ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background image — tall, not cropped */}
          <div className="absolute inset-0 z-0">
            <div
              className="absolute inset-0 bg-cover bg-top opacity-50"
              style={{ backgroundImage: "url('/anix2.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/60 to-zinc-950" />
          </div>

          {/* Glassmorphism content layer */}
          <div className="relative z-10 flex flex-col bg-white/[0.03] backdrop-blur-xl max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Top: Logo + tagline */}
            <div className="flex flex-col items-center text-center pt-8 px-6 sm:pt-10">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter leading-none font-unbounded animate-in fade-in slide-in-from-bottom-2 duration-500">
                Weeb<span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-orange-600">x</span>
              </h2>
              <p className="mt-2.5 text-sm text-zinc-300/80 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75">
                Стриминг аниме · Гача · PvP · Манга
              </p>
            </div>

            {/* Feature pills */}
            <div className="px-5 sm:px-6 pt-6 pb-5">
              <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                {[
                  { icon: Play, label: "Стриминг", color: "text-orange-400" },
                  { icon: Sparkles, label: "Гача", color: "text-amber-400" },
                  { icon: Swords, label: "PvP", color: "text-red-400" },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl py-2.5">
                    <f.icon className={`w-4 h-4 ${f.color}`} />
                    <span className="text-[10px] text-zinc-300 font-medium">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info text */}
            <div className="px-6 pb-5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
              <p className="text-xs text-zinc-400/70 leading-relaxed text-center">
                Смотрите аниме в HD с русской озвучкой, собирайте карты
                персонажей, сражайтесь на арене и читайте мангу — всё в одном месте.
              </p>
            </div>

            {/* Buttons */}
            <div className="px-6 pb-7 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              <button
                onClick={handleStart}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              >
                Начать смотреть
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={handleSignUp}
                className="w-full h-11 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 hover:text-white border border-white/10 hover:border-white/20 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 group backdrop-blur-sm"
              >
                Войти в аккаунт
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      )}
    </>
  )
}