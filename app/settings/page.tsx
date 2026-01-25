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
          <p className="text-muted-foreground">Пожалуйста, войдите в аккаунт для доступа к настройкам</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Настройки профиля</h1>
          <p className="text-muted-foreground">Управление вашим профилем и настройками</p>
        </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <User className="w-5 h-5" />
              Аватар
            </CardTitle>
            <CardDescription className="text-muted-foreground">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Имя пользователя</CardTitle>
            <CardDescription className="text-muted-foreground">
              Это имя будет отображаться в вашем профиле
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              className="bg-muted border text-foreground"
              maxLength={50}
            />
            <Button 
              onClick={handleUsernameSave}
              disabled={loading || username === profile?.username}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </CardContent>
        </Card>

        {/* NSFW Search Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Настройки поиска
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Управление отображением контента для взрослых в результатах поиска
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="nsfw-search" className="text-foreground cursor-pointer">
                  Опасный поиск (NSFW)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Включить отображение контента для взрослых (хентай) в результатах поиска
                </p>
              </div>
              <Switch
                id="nsfw-search"
                checked={allowNsfwSearch}
                onCheckedChange={handleNsfwSearchToggle}
                disabled={loadingNsfw}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            {allowNsfwSearch && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="text-sm text-primary flex items-start gap-2">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Информация об аккаунте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="text-foreground">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID:</span>
              <span className="text-foreground font-mono text-sm">{user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Дата регистрации:</span>
              <span className="text-foreground">
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
