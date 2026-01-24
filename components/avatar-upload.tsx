"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Upload, Camera } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  userId: string
  username?: string
  onAvatarChange?: (avatarUrl: string | null) => void
  size?: "sm" | "md" | "lg"
}

export function AvatarUpload({ 
  currentAvatarUrl, 
  userId, 
  username,
  onAvatarChange,
  size = "md" 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-20 h-20", 
    lg: "w-32 h-32"
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive"
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Ошибка", 
        description: "Размер файла не должен превышать 5MB",
        variant: "destructive"
      })
      return
    }

    // Create preview and store file for later upload
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
      setPendingFile(file)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAvatar = async () => {
    if (!pendingFile) return

    setUploading(true)

    try {
      // Upload to Supabase Storage
      const fileExt = pendingFile.name.split('.').pop()
      const fileName = `${userId}/avatar.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, pendingFile, { 
          upsert: true,
          contentType: pendingFile.type 
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (updateError) throw updateError

      onAvatarChange?.(publicUrl)
      setPendingFile(null)
      
      toast({
        title: "Успешно",
        description: "Аватар обновлен"
      })

    } catch (error: any) {
      console.error('Avatar upload error:', error)
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить аватар",
        variant: "destructive"
      })
      // Reset preview on error
      setPreviewUrl(currentAvatarUrl || null)
      setPendingFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleCancelAvatar = () => {
    setPreviewUrl(currentAvatarUrl || null)
    setPendingFile(null)
  }

  const handleRemoveAvatar = async () => {
    setUploading(true)

    try {
      // Remove from storage
      if (currentAvatarUrl) {
        const fileName = currentAvatarUrl.split('/').pop()
        if (fileName) {
          await supabase.storage
            .from('avatars')
            .remove([`${userId}/avatar.${fileName.split('.').pop()}`])
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      setPreviewUrl(null)
      onAvatarChange?.(null)

      toast({
        title: "Успешно",
        description: "Аватар удален"
      })

    } catch (error: any) {
      console.error('Avatar removal error:', error)
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить аватар",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage 
            src={
              // Если это base64 (предпросмотр), не добавляем timestamp
              previewUrl?.startsWith('data:') 
                ? previewUrl 
                : previewUrl 
                  ? `${previewUrl}?t=${new Date().getTime()}` 
                  : undefined
            } 
            alt="Avatar" 
          />
          <AvatarFallback className="bg-gradient-to-tr from-orange-500 to-purple-600 text-white font-semibold">
            {username ? getInitials(username) : 'U'}
          </AvatarFallback>
        </Avatar>
        
        {/* Upload button overlay */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <div className="flex gap-2 justify-center">
        {pendingFile ? (
          <>
            <Button
              size="sm"
              onClick={handleSaveAvatar}
              disabled={uploading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Сохранить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelAvatar}
              disabled={uploading}
            >
              Отмена
            </Button>
          </>
        ) : previewUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={uploading}
            className="text-red-500 hover:text-red-600 border-red-500/20 hover:border-red-500/30"
          >
            Удалить аватар
          </Button>
        ) : null}
      </div>
    </div>
  )
}
