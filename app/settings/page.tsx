"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { AvatarUpload } from "@/components/avatar-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, User, ArrowLeft, Shield, ShieldAlert } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile?.username || "")
  const [allowNsfwSearch, setAllowNsfwSearch] = useState(profile?.allow_nsfw_search || false)
  const [loading, setLoading] = useState(false)
  const [loadingNsfw, setLoadingNsfw] = useState(false)
  const { toast } = useToast()

  const handleUsernameSave = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: username || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      
      toast({
        title: "Успешно",
        description: "Имя пользователя обновлено"
      })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить имя пользователя",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "")
      setAllowNsfwSearch(profile.allow_nsfw_search || false)
    }
  }, [profile])

  const handleAvatarChange = async (avatarUrl: string | null) => {
    await refreshProfile()
  }

  const handleNsfwSearchToggle = async (enabled: boolean) => {
    if (!user) return

    setLoadingNsfw(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          allow_nsfw_search: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setAllowNsfwSearch(enabled)
      await refreshProfile()
      
      toast({
        title: "Успешно",
        description: enabled 
          ? "Опасный поиск включен. Теперь в результатах поиска может отображаться контент для взрослых." 
          : "Опасный поиск отключен. Контент для взрослых будет скрыт из результатов поиска."
      })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройку",
        variant: "destructive"
      })
    } finally {
      setLoadingNsfw(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Настройки</h1>
          <p className="text-zinc-400">Пожалуйста, войдите в аккаунт для доступа к настройкам</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all mb-4">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Настройки профиля</h1>
          <p className="text-zinc-400">Управление вашим профилем и настройками</p>
        </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              Аватар
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Загрузите изображение для вашего профиля. Максимальный размер: 5MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              currentAvatarUrl={profile?.avatar_url}
              userId={user.id}
              username={profile?.username || user.email || ""}
              onAvatarChange={handleAvatarChange}
              size="lg"
            />
          </CardContent>
        </Card>

        {/* Username Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Имя пользователя</CardTitle>
            <CardDescription className="text-zinc-400">
              Это имя будет отображаться в вашем профиле
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              className="bg-zinc-800 border-zinc-700 text-white"
              maxLength={50}
            />
            <Button 
              onClick={handleUsernameSave}
              disabled={loading || username === profile?.username}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </CardContent>
        </Card>

        {/* NSFW Search Settings */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Настройки поиска
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Управление отображением контента для взрослых в результатах поиска
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="nsfw-search" className="text-white cursor-pointer">
                  Опасный поиск (NSFW)
                </Label>
                <p className="text-sm text-zinc-400">
                  Включить отображение контента для взрослых (хентай) в результатах поиска
                </p>
              </div>
              <Switch
                id="nsfw-search"
                checked={allowNsfwSearch}
                onCheckedChange={handleNsfwSearchToggle}
                disabled={loadingNsfw}
                className="data-[state=checked]:bg-orange-600"
              />
            </div>
            {allowNsfwSearch && (
              <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg">
                <p className="text-sm text-orange-200 flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Опасный поиск включен. В результатах поиска может отображаться контент для взрослых. 
                    Вы всегда можете отфильтровать хентай через фильтры каталога.
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Информация об аккаунте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Email:</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">ID:</span>
              <span className="text-white font-mono text-sm">{user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Дата регистрации:</span>
              <span className="text-white">
                {new Date(user.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
