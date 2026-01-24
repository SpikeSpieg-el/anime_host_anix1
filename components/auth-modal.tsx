"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2, X } from "lucide-react"

interface AuthModalProps {
  isOpen?: boolean
  onClose?: () => void
  children?: React.ReactNode
}

export function AuthModal({ isOpen: externalIsOpen, onClose, children }: AuthModalProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false) // Для экрана успешной регистрации

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = onClose || setInternalIsOpen

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setError(null)
    setSuccess(false)
    setLoading(false)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setIsOpen(false)
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        })
        if (error) throw error
        // Показываем экран успеха вместо алерта
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || "Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    resetForm()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      {children || (
        <DialogTrigger asChild>
          <Button variant="ghost" className="gap-2 text-zinc-400 hover:text-white transition-colors">
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Войти</span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="overflow-hidden p-0 bg-[#09090b] border border-white/10 text-white sm:max-w-[420px] shadow-2xl shadow-orange-500/5">
        
        {/* Декоративный градиент на фоне */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />

        <div className="relative p-8">
          

          {!success ? (
            <>
              <DialogHeader className="mb-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 ring-1 ring-white/5">
                  {isLogin ? (
                    <LogIn className="w-6 h-6 text-orange-500" />
                  ) : (
                    <UserPlus className="w-6 h-6 text-orange-500" />
                  )}
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  {isLogin ? "Добро пожаловать" : "Создать аккаунт"}
                </DialogTitle>
                <p className="text-zinc-400 text-sm mt-2">
                  {isLogin 
                    ? "Введите свои данные для входа в систему" 
                    : "Зарегистрируйтесь, чтобы получить доступ ко всем функциям"
                  }
                </p>
              </DialogHeader>

              <form onSubmit={handleAuth} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-semibold text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Обработка...
                    </span>
                  ) : (
                    isLogin ? "Войти" : "Зарегистрироваться"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                >
                  {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                  <span className="text-orange-500 hover:text-orange-400">
                    {isLogin ? "Создать" : "Войти"}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Экран успешной регистрации */
            <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <DialogTitle className="text-xl font-bold text-white mb-2">
                Проверьте почту
              </DialogTitle>
              <p className="text-zinc-400 text-sm px-4 leading-relaxed">
                Мы отправили вам ссылку для подтверждения аккаунта на адрес <strong>{email}</strong>. Пожалуйста, перейдите по ней, чтобы завершить регистрацию.
              </p>
              <Button 
                onClick={() => setIsOpen(false)}
                className="mt-8 bg-white/10 hover:bg-white/20 text-white border border-white/10 w-full rounded-xl"
              >
                Закрыть
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}