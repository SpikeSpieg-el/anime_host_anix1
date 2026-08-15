"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { 
  Camera,
  Users,
  Images,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Eye
} from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { CoverModal } from "@/components/watch/cover-modal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { 
  getAnimeScreenshots, 
  getAnimeScreenshotsThumbnails, 
  getAnimeCharacters
} from "@/lib/shikimori"

interface WatchPageGalleryProps {
  anime: Anime
}

export function WatchPageGallery({ anime }: WatchPageGalleryProps) {
  const [galleryCovers, setGalleryCovers] = useState<string[]>([])
  const [screenshotThumbnails, setScreenshotThumbnails] = useState<string[]>([])
  const [allScreenshots, setAllScreenshots] = useState<string[]>([])
  const [displayedScreenshots, setDisplayedScreenshots] = useState<string[]>([])
  const [screenshotsLimit, setScreenshotsLimit] = useState(4)
  
  const [allCharacters, setAllCharacters] = useState<Array<{name: string, avatar: string, role?: string}>>([])
  const [displayedCharacters, setDisplayedCharacters] = useState<Array<{name: string, avatar: string, role?: string}>>([])
  const [charactersLimit, setCharactersLimit] = useState(6)
  
  const [selectedScreenshot, setSelectedScreenshot] = useState<string>("")
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState<number>(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCover, setSelectedCover] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadGalleryData = async () => {
      setGalleryLoading(true)
      try {
        setGalleryCovers([anime.poster])

        const [thumbnailsData, screenshotsData, charactersData] = await Promise.all([
          getAnimeScreenshotsThumbnails(anime.shikimoriId),
          getAnimeScreenshots(anime.shikimoriId),
          getAnimeCharacters(anime.shikimoriId)
        ])

        if (!active) return

        setScreenshotThumbnails(thumbnailsData || [])
        setAllScreenshots(screenshotsData || [])
        setDisplayedScreenshots((thumbnailsData || []).slice(0, screenshotsLimit))

        setAllCharacters(charactersData || [])
        setDisplayedCharacters((charactersData || []).slice(0, charactersLimit))
      } catch (error) {
        console.error('Failed to load gallery data:', error)
      } finally {
        if (active) setGalleryLoading(false)
      }
    }

    loadGalleryData()
    return () => { active = false }
  }, [anime.poster, anime.shikimoriId])

  useEffect(() => {
    if (screenshotThumbnails.length > 0) {
      setDisplayedScreenshots(screenshotThumbnails.slice(0, screenshotsLimit))
    }
  }, [screenshotsLimit, screenshotThumbnails])

  useEffect(() => {
    if (allCharacters.length > 0) {
      setDisplayedCharacters(allCharacters.slice(0, charactersLimit))
    }
  }, [charactersLimit, allCharacters])

  const screenshotsList = allScreenshots.length > 0 ? allScreenshots : screenshotThumbnails

  const handlePreviousScreenshot = useCallback(() => {
    if (screenshotsList.length === 0) return
    const newIndex = currentScreenshotIndex === 0 
      ? screenshotsList.length - 1 
      : currentScreenshotIndex - 1
    setCurrentScreenshotIndex(newIndex)
    setSelectedScreenshot(screenshotsList[newIndex] || "")
  }, [screenshotsList, currentScreenshotIndex])

  const handleNextScreenshot = useCallback(() => {
    if (screenshotsList.length === 0) return
    const newIndex = currentScreenshotIndex === screenshotsList.length - 1 
      ? 0 
      : currentScreenshotIndex + 1
    setCurrentScreenshotIndex(newIndex)
    setSelectedScreenshot(screenshotsList[newIndex] || "")
  }, [screenshotsList, currentScreenshotIndex])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return
      if (e.key === 'ArrowLeft') handlePreviousScreenshot()
      if (e.key === 'ArrowRight') handleNextScreenshot()
      if (e.key === 'Escape') setIsModalOpen(false)
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleGlobalKeyDown)
      return () => document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isModalOpen, handlePreviousScreenshot, handleNextScreenshot])

  const openModal = (index: number) => {
    const img = screenshotsList[index] || ""
    setSelectedScreenshot(img)
    setCurrentScreenshotIndex(index)
    setIsModalOpen(true)
  }

  const SectionContainer = ({ children, className, id }: { children: React.ReactNode, className?: string, id?: string }) => (
    <div className={cn("bg-card/20 border border-border rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm transition-all hover:border-primary/20", className)} id={id}>
      {children}
    </div>
  )

  const SectionHeader = ({ icon: Icon, title, action }: { icon: any, title: string, action?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-4 md:mb-6">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <h2 className="text-base md:text-xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      {galleryLoading ? (
        <>
          <SectionContainer>
            <SectionHeader icon={Camera} title="Кадры из аниме" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-lg w-full" />
              ))}
            </div>
          </SectionContainer>
          <SectionContainer>
            <SectionHeader icon={Users} title="Персонажи" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-3 p-3">
                  <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-full" />
                  <div className="space-y-2 w-full flex flex-col items-center">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </SectionContainer>
        </>
      ) : (
        <>
          {galleryCovers.length > 1 && (
            <SectionContainer>
              <SectionHeader icon={Images} title="Галерея" />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                {galleryCovers.map((cover, index) => (
                  <div 
                    key={index} 
                    onClick={() => setSelectedCover(cover)}
                    role="button"
                    tabIndex={0}
                    className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary/50 transition-all group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <Image
                      src={cover || ""}
                      alt={`Art ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                      <Eye className="w-6 h-6 text-white opacity-90" />
                    </div>
                  </div>
                ))}
              </div>
            </SectionContainer>
          )}

          {displayedScreenshots.length > 0 && (
            <SectionContainer id="frames">
              <SectionHeader 
                icon={Camera} 
                title="Кадры из аниме" 
                action={
                  screenshotThumbnails.length > displayedScreenshots.length && (
                    <Button
                      onClick={() => setScreenshotsLimit(prev => prev + 4)}
                      size="sm"
                      variant="ghost"
                      className="text-xs md:text-sm h-8 px-2 md:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      Показать ещё
                    </Button>
                  )
                }
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {displayedScreenshots.map((src, index) => (
                  <div 
                    key={index}
                    onClick={() => openModal(index)}
                    className="group relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                  >
                    <Image
                      src={src || ""}
                      alt={`Screenshot ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                      <Maximize2 className="w-8 h-8 text-white opacity-80" />
                    </div>
                  </div>
                ))}
              </div>
            </SectionContainer>
          )}

          {displayedCharacters.length > 0 && (
            <SectionContainer id="characters">
              <SectionHeader 
                icon={Users} 
                title="Персонажи" 
                action={
                  allCharacters.length > displayedCharacters.length && (
                    <Button
                      onClick={() => setCharactersLimit(prev => prev + 6)}
                      size="sm"
                      variant="ghost"
                      className="text-xs md:text-sm h-8 px-2 md:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      Показать ещё
                    </Button>
                  )
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {displayedCharacters.map((char, index) => (
                  <div 
                    key={index} 
                    className="group flex flex-col items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-inner ring-2 ring-border/50 group-hover:ring-primary/40 transition-all">
                      <Image
                        src={char.avatar || ""}
                        alt={char.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="100px"
                      />
                    </div>
                    <div className="text-center w-full">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {char.name}
                      </h3>
                      {char.role && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {char.role}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionContainer>
          )}
        </>
      )}

      {/* Cover Modal */}
      <CoverModal
        isOpen={Boolean(selectedCover)}
        onClose={() => setSelectedCover(null)}
        imageUrl={selectedCover || ""}
        title={anime.title}
        subtitle="Обложка аниме"
      />

      {/* Fullscreen Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-[100vw] w-full h-[100dvh] p-0 bg-background/95 backdrop-blur-xl border-none shadow-none flex flex-col items-center justify-center z-[100]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Скриншот {currentScreenshotIndex + 1}</DialogTitle>
          <DialogDescription className="sr-only">
            Просмотр кадров из аниме {anime.title}
          </DialogDescription>

          <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent h-20">
            <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
              <span className="text-xs md:text-sm font-medium text-white/90">
                {currentScreenshotIndex + 1} / {screenshotsList.length}
              </span>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="p-2 rounded-full bg-black/40 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative w-full h-full flex items-center justify-center p-0 md:p-8 md:pb-32 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); handlePreviousScreenshot(); }}
              className="hidden md:flex absolute left-4 lg:left-8 z-40 p-3 rounded-full bg-black/30 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNextScreenshot(); }}
              className="hidden md:flex absolute right-4 lg:right-8 z-40 p-3 rounded-full bg-black/30 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            <div className="md:hidden absolute inset-y-0 left-0 w-1/4 z-30" onClick={handlePreviousScreenshot} />
            <div className="md:hidden absolute inset-y-0 right-0 w-1/4 z-30" onClick={handleNextScreenshot} />

            {selectedScreenshot && (
              <div className="relative w-full h-full max-h-[80vh] md:max-h-full">
                <Image
                  src={selectedScreenshot}
                  alt="Fullscreen view"
                  fill
                  className="object-contain"
                  priority
                  quality={85}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}