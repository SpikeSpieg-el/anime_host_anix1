"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { AvatarUpload } from "@/components/auth/avatar-upload"
import { AuthModal } from "@/components/auth/auth-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, User, ArrowLeft, Shield, ShieldAlert, LogIn, UserPlus, Tv, Unlink, RefreshCw, ExternalLink } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { SuccessNotification } from "@/components/settings/success-notification"
import { Footer } from "@/components/layout/footer"
import { ReferralCard } from "@/components/profile/ReferralCard"

export default function SettingsPage() {
  const { user, profile, refreshProfile, session } = useAuth()
  const [username, setUsername] = useState(profile?.username || "")
  const [allowNsfwSearch, setAllowNsfwSearch] = useState(profile?.allow_nsfw_search || false)
  const [loading, setLoading] = useState(false)
  const [loadingNsfw, setLoadingNsfw] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [successPopup, setSuccessPopup] = useState({ isOpen: false, title: '', message: '' })
  const [lampaDevices, setLampaDevices] = useState<any[]>([])
  const [lampaLoading, setLampaLoading] = useState(false)
  const [lampaUnlinking, setLampaUnlinking] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const { toast } = useToast()

  const fetchLampaDevices = async () => {
    if (!user || !session?.access_token) return
    setLampaLoading(true)
    try {
      const res = await fetch('/api/lampa/devices', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.success) {
        setLampaDevices(data.devices || [])
      }
    } catch (err) {
      console.error('Failed to fetch Lampa devices:', err)
    } finally {
      setLampaLoading(false)
    }
  }

  useEffect(() => {
    if (user && session) {
      fetchLampaDevices()
    }
  }, [user?.id, session?.access_token])

  useEffect(() => {
    if (!user || !session?.access_token || !profile?.referral_code) return

    const fetchReferralStats = async () => {
      try {
        const response = await fetch("/api/referrals", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Не удалось загрузить статистику рефералов")
        }
        setReferralCount(result.referralCount)
      } catch (error) {
        console.error("Failed to fetch referral stats:", error)
      }
    }

    fetchReferralStats()
  }, [user?.id, session?.access_token, profile?.referral_code])

  const handleUnlinkDevice = async (deviceId: string) => {
    if (!session?.access_token) return
    setLampaUnlinking(deviceId)
    try {
      const res = await fetch('/api/lampa/devices', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ device_id: deviceId })
      })
      const data = await res.json()
      if (data.success) {
        setLampaDevices(prev => prev.filter(d => d.id !== deviceId))
        setSuccessPopup({
          isOpen: true,
          title: 'Устройство отвязано',
          message: 'Устройство Lampa успешно отвязано от вашего аккаунта'
        })
      } else {
        toast({ title: 'Ошибка', description: data.message || 'Не удалось отвязать устройство', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Ошибка', description: 'Сетевая ошибка', variant: 'destructive' })
    } finally {
      setLampaUnlinking(null)
    }
  }

  const handleUsernameSave = async () => {
    if (!user) return

    setLoading(true)
    try {
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
      
      setSuccessPopup({
        isOpen: true,
        title: "Успешно",
        message: "Имя пользователя обновлено"
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
      
      setSuccessPopup({
        isOpen: true,
        title: "Успешно",
        message: enabled 
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

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="max-w-sm mx-auto space-y-6">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Требуется авторизация</h3>
                  <p className="text-muted-foreground mb-6">
                    Войдите в аккаунт или зарегистрируйтесь, чтобы получить доступ к настройкам профиля
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Войти
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Регистрация
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)}>
          <></>
        </AuthModal>

        <Footer />
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
              Загрузите изображение для вашего профиля. Максимальный размер: 3MB
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
        {profile?.referral_code && (
          <ReferralCard referralCode={profile.referral_code} referralCount={referralCount} />
        )}

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

        {/* Lampa Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Tv className="w-5 h-5" />
              Lampa — синхронизация с ТВ
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Привяжите приложение Lampa на Android TV для синхронизации истории просмотра
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Activation link */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Активация нового устройства</p>
                <p className="text-xs text-muted-foreground">
                  Откройте страницу активации и введите PIN-код с ТВ
                </p>
              </div>
              <Link
                href="/activate"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Активировать
              </Link>
            </div>

            {/* Devices list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Привязанные устройства</p>
                <button
                  onClick={fetchLampaDevices}
                  disabled={lampaLoading}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${lampaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {lampaLoading && lampaDevices.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : lampaDevices.length === 0 ? (
                <div className="text-center py-6 px-4 bg-muted/30 rounded-lg border border-dashed">
                  <Tv className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Нет привязанных устройств Lampa
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lampaDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {device.device_name || 'Lampa Device'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Активен с {new Date(device.created_at).toLocaleDateString('ru-RU')}
                          {device.last_used_at && (
                            <> · Последнее использование: {new Date(device.last_used_at).toLocaleDateString('ru-RU')}</>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnlinkDevice(device.id)}
                        disabled={lampaUnlinking === device.id}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 disabled:opacity-50 font-medium ml-3 flex-shrink-0"
                      >
                        {lampaUnlinking === device.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlink className="w-3.5 h-3.5" />
                        )}
                        Отвязать
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Full tutorial */}
            <details className="group bg-muted/30 rounded-lg border overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer p-3 select-none hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Tv className="w-4 h-4 text-primary" />
                  Полная инструкция по подключению Lampa
                </span>
                <svg
                  className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>

              <div className="px-4 pb-4 pt-1 space-y-4 text-sm">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">Установите плагин в Lampa</p>
                    <p className="text-muted-foreground text-xs">
                      На вашем Android TV откройте Lampa, перейдите в:
                    </p>
                    <p className="text-muted-foreground text-xs pl-3 border-l-2 border-primary/30 ml-1">
                      Настройки → Плагины → Добавить (или «+»)
                    </p>
                    <p className="text-muted-foreground text-xs">Вставьте URL плагина:</p>
                    <div className="flex items-center gap-2 bg-background border rounded-md p-2 mt-1">
                      <code className="text-xs text-primary flex-1 break-all">
                        https://weeb-x.com/lampa/weebx-plugin.js
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText('https://weeb-x.com/lampa/weebx-plugin.js')
                          toast({ title: 'Скопировано', description: 'URL плагина скопирован в буфер обмена' })
                        }}
                        className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
                      >
                        Копировать
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">Включите плагин</p>
                    <p className="text-muted-foreground text-xs">
                      После добавления плагина включите его переключателем (если он выключен).
                      Перезагрузите Lampa, если плагин не появился сразу.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">Откройте плагин в настройках Lampa</p>
                    <p className="text-muted-foreground text-xs">
                      Перейдите в Настройки Lampa — там появится новый пункт
                      <span className="text-foreground font-medium"> «Weebx Синхронизация»</span>.
                      Нажмите на него. На экране ТВ появится 6-значный PIN-код.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">Активируйте устройство на сайте</p>
                    <p className="text-muted-foreground text-xs">
                      С телефона или компьютера перейдите на страницу активации и введите PIN-код:
                    </p>
                    <Link
                      href="/activate"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      weeb-x.com/activate
                    </Link>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">✓</div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">Готово!</p>
                    <p className="text-muted-foreground text-xs">
                      После ввода PIN-кода на сайте, Lampa автоматически получит токен авторизации.
                      История просмотра будет синхронизироваться между Lampa и Weebx автоматически —
                      вы увидите прогресс на сайте и в разделе «Продолжить просмотр».
                    </p>
                  </div>
                </div>

                {/* FAQ */}
                <div className="pt-2 border-t space-y-2">
                  <p className="font-medium text-foreground text-xs">Частые вопросы:</p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p><span className="text-foreground font-medium">PIN не работает?</span> Код действителен 10 минут. Запросите новый, открыв плагин снова.</p>
                    <p><span className="text-foreground font-medium">Плагин не появился в настройках?</span> Перезагрузите Lampa после установки. Проверьте, что плагин включён в списке плагинов.</p>
                    <p><span className="text-foreground font-medium">История не синхронизируется?</span> Убедитесь, что вы вошли в один и тот же аккаунт Weebx на сайте и при активации плагина.</p>
                    <p><span className="text-foreground font-medium">Как отвязать ТВ?</span> Нажмите «Отвязать» в списке устройств выше, либо откройте плагин в Lampa и выберите «Отвязать устройство».</p>
                  </div>
                </div>
              </div>
            </details>
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

      <ScrollToTop />
      
      <SuccessNotification
        isOpen={successPopup.isOpen}
        onClose={() => setSuccessPopup({ isOpen: false, title: '', message: '' })}
        title={successPopup.title}
        message={successPopup.message}
      />

      <Footer />
    </div>
  )
}
