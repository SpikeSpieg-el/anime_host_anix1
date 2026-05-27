"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Upload, Camera, ZoomIn, ZoomOut, RotateCcw, Pencil } from "lucide-react" // Добавили Pencil
import { useToast } from "@/hooks/use-toast"
import Cropper from "react-easy-crop"
import type { Point, Area } from "react-easy-crop"

// --- Вспомогательная функция для обрезки изображения ---
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("No 2d context")
  }

  // Устанавливаем размер канваса под размер обрезки
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"))
        return
      }
      resolve(blob)
    }, "image/jpeg", 1)
  })
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

// --- Основной компонент ---

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
  const [pendingFile, setPendingFile] = useState<File | Blob | null>(null)
  
  // State for Cropper
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Update previewUrl when currentAvatarUrl changes
  useEffect(() => {
    if (currentAvatarUrl !== previewUrl && !pendingFile) {
      setPreviewUrl(currentAvatarUrl || null);
    }
  }, [currentAvatarUrl]);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-24 h-24",
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
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0]
      
      if (!file.type.startsWith('image/')) {
        toast({ title: "Ошибка", description: "Пожалуйста, выберите изображение", variant: "destructive" })
        return
      }

      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "Слишком большой файл", description: "Размер изображения не должен превышать 3MB", variant: "destructive" })
        event.target.value = '' 
        return
      }

      const reader = new FileReader()
      reader.addEventListener('load', () => {
        // При выборе нового файла мы сразу открываем редактор с оригиналом
        setImageSrc(reader.result?.toString() || '')
        setIsDialogOpen(true)
        setZoom(1)
        setCrop({ x: 0, y: 0 })
      })
      reader.readAsDataURL(file)
    }
  }

  // --- НОВАЯ ФУНКЦИЯ: Редактировать текущее ---
  const handleEditCurrent = async () => {
    if (!previewUrl) return;

    try {
      let srcToEdit = previewUrl;

      // Если есть pendingFile (мы уже что-то нарезали, но не сохранили на сервер), 
      // лучше редактировать его, так как это Blob URL
      if (pendingFile) {
        srcToEdit = URL.createObjectURL(pendingFile);
      } 
      // Если это URL с сервера, убираем timestamp (?t=...) чтобы не мешал
      else if (typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
        srcToEdit = previewUrl.split('?')[0];
      }

      // Устанавливаем источник и открываем модалку
      setImageSrc(srcToEdit);
      setIsDialogOpen(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });

    } catch (e) {
      toast({
        title: "Ошибка",
        description: "Не удалось открыть редактор",
        variant: "destructive"
      })
    }
  }

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return

      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      
      const objectUrl = URL.createObjectURL(croppedBlob)
      setPreviewUrl(objectUrl)
      
      setPendingFile(croppedBlob)
      
      setIsDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast({
        title: "Ошибка",
        description: "Не удалось обработать изображение",
        variant: "destructive"
      })
    }
  }

  const handleSaveAvatar = async () => {
    if (!pendingFile) return

    setUploading(true)

    try {
      const fileExt = 'jpg' 
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`
      
      const fileToUpload = new File([pendingFile], "avatar.jpg", { type: "image/jpeg" })

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, fileToUpload, { 
          upsert: true,
          contentType: 'image/jpeg' 
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

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
    } finally {
      setUploading(false)
    }
  }

  const handleCancelAvatar = () => {
    setPreviewUrl(currentAvatarUrl || null)
    setPendingFile(null)
    if (fileInputRef.current) {
        fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setUploading(true)
    try {
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
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <Avatar className={`${sizeClasses[size]} border-2 border-border shadow-sm`}>
            <AvatarImage 
              className="object-cover"
              src={
                previewUrl?.startsWith('blob:') 
                  ? previewUrl 
                  : previewUrl 
                    ? `${previewUrl}?t=${Date.now()}` 
                    : undefined
              } 
              alt="Avatar"
              onLoad={(e) => { e.currentTarget.style.display = 'block'; }} 
            />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {username ? getInitials(username) : 'U'}
            </AvatarFallback>
          </Avatar>
          
          {/* Кнопка загрузки по клику на аватар */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed z-10"
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

        {/* --- ПАНЕЛЬ КНОПОК --- */}
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px] items-center">
          
          {/* 1. Если есть несохраненные изменения (Pending File) */}
          {pendingFile ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveAvatar}
                disabled={uploading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Сохранить
              </Button>
              
              {/* Кнопка "Редактировать" для pending файла */}
              <Button
                variant="secondary"
                size="icon"
                className="w-9 h-9"
                onClick={handleEditCurrent}
                disabled={uploading}
                title="Редактировать"
              >
                 <Pencil className="w-4 h-4" />
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
            // 2. Если просто есть аватар (с сервера)
            <>
               <Button
                variant="outline"
                size="sm"
                onClick={handleEditCurrent}
                disabled={uploading}
                className="gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Редактировать
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                Удалить
              </Button>
            </>
          ) : (
            // 3. Если аватара нет вообще
             <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Загрузить фото
              </Button>
          )}
        </div>
      </div>

      {/* Модальное окно для обрезки */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false)
          // Важно: не очищаем fileInput здесь жестко, чтобы не сбить процесс, 
          // но если это была отмена загрузки нового файла, логику можно доработать.
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактирование аватара</DialogTitle>
            <DialogDescription>
              Выберите область для отображения.
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative w-full h-[300px] bg-black/5 rounded-md overflow-hidden mt-2">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <div className="flex items-center gap-4 py-4">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCropSave}>
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}