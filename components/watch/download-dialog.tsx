"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileVideo,
  HardDrive,
  Loader2,
  Magnet,
  Terminal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"

/**
 * Диалог «Скачать»: прямая загрузка серии через пайплайн animdl
 * (mp4 / HLS-плейлист через наш прокси), торренты AniLibria
 * и готовая команда animdl CLI. Плюс классические трекеры вручную.
 */

interface DownloadFile {
  label: string
  kind: "hls" | "mp4"
  downloadUrl: string | null
}

interface DownloadTorrent {
  id: number
  quality: string
  series: string
  size: string
  seeders: number
  leechers: number
  url: string
  magnet: string | null
}

interface DownloadResponse {
  ok: boolean
  reason?: string
  providerLabel?: string
  ruDub?: boolean
  matchedTitle?: string
  files?: DownloadFile[]
  torrents?: DownloadTorrent[]
  cli?: string
}

interface DownloadDialogProps {
  title: string
  originalTitle?: string
  episode: number
  trackerQuery?: string
}

const getTrackerLink = (tracker: "rutracker" | "rutor", query: string) => {
  const term = encodeURIComponent(query)
  if (tracker === "rutracker") return `https://rutracker.org/forum/tracker.php?nm=${term}`
  if (tracker === "rutor") return `https://rutor.info/search/0/0/0/0/${term}`
  return "#"
}

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Fallback для http-контекста
      const textarea = document.createElement("textarea")
      textarea.value = value
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000)
  }, [])

  return { copiedKey, copy }
}

export function DownloadDialog({ title, originalTitle, episode, trackerQuery }: DownloadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<DownloadResponse | null>(null)
  const { copiedKey, copy } = useCopyToClipboard()

  const query = trackerQuery || title

  const loadOptions = useCallback(async (options?: { refresh?: boolean }) => {
    if (!title) return
    setIsLoading(true)
    setData(null)
    try {
      const url = new URL("/api/animdl/download", window.location.origin)
      url.searchParams.set("title", title)
      if (originalTitle) url.searchParams.set("original", originalTitle)
      url.searchParams.set("episode", String(episode))
      if (options?.refresh) url.searchParams.set("refresh", "1")

      const response = await fetch(url.toString(), { cache: "no-store" })
      setData((await response.json()) as DownloadResponse)
    } catch {
      setData({ ok: false, reason: "network" })
    } finally {
      setIsLoading(false)
    }
  }, [title, originalTitle, episode])

  // Загружаем варианты при открытии диалога и при смене серии.
  useEffect(() => {
    if (isOpen) {
      loadOptions()
    }
  }, [isOpen, loadOptions])

  const files = data?.ok ? data.files ?? [] : []
  const torrents = data?.ok ? data.torrents ?? [] : []
  const cliCommand = data?.cli || `animdl download "search:${originalTitle || title}" -e ${episode} --quality best`

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => trackEvent(AnalyticsEvent.CLICK, { action: "download_dialog_open", episode })}
          className="gap-2 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Скачать</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-foreground w-[90vw] max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Скачать аниме</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Прямая загрузка серии (animdl) и торренты с русской озвучкой.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Прямая загрузка серии через пайплайн animdl */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
              <FileVideo className="w-3 h-3" />
              Серия {episode}
              {data?.ok && data.providerLabel && (
                <span className="normal-case tracking-normal font-medium text-primary">
                  · {data.providerLabel}
                  {data.ruDub ? " · русская озвучка" : ""}
                </span>
              )}
            </h3>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Ищем прямые ссылки…
              </div>
            )}

            {!isLoading && files.length === 0 && (
              <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/40 border border-border">
                Прямая ссылка на серию не нашлась. Попробуйте торренты ниже или animdl CLI.
              </p>
            )}

            {files.map((file, index) => (
              <div key={`${file.label}-${index}`} className="flex items-center gap-2">
                {file.kind === "mp4" ? (
                  <a
                    href={file.downloadUrl ?? "#"}
                    className="flex items-center justify-between flex-1 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 hover:border-primary/50 transition-all"
                    onClick={() => trackEvent(AnalyticsEvent.EPISODE_PLAY, { source: "animdl-mp4" })}
                  >
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" />
                      MP4 {file.label}
                    </span>
                    <span className="text-xs text-muted-foreground">прямая ссылка</span>
                  </a>
                ) : (
                  <a
                    href={file.downloadUrl ?? "#"}
                    download
                    className="flex items-center justify-between flex-1 px-4 py-3 rounded-xl bg-card/50 border border-border hover:border-primary/40 hover:bg-card/80 transition-all"
                  >
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Плейлист {file.label} (.m3u8)
                    </span>
                    <span className="text-xs text-muted-foreground">VLC / yt-dlp</span>
                  </a>
                )}
              </div>
            ))}

            {files.length === 0 && !isLoading && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                💡 Скачайте плейлист .m3u8 и откройте в VLC — все сегменты пойдут через
                прокси сайта. Либо используйте команду animdl ниже.
              </p>
            )}
          </div>

          {/* Торренты AniLibria */}
          {torrents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                <Magnet className="w-3 h-3" />
                Торренты AniLibria · русская озвучка
              </h3>
              {torrents.map((torrent) => (
                <div
                  key={torrent.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-card/50 border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{torrent.quality}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {torrent.series} · {torrent.size} · ↑ {torrent.seeders} ↓ {torrent.leechers}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={torrent.url}
                      className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      .torrent
                    </a>
                    {torrent.magnet && (
                      <button
                        title="Скопировать magnet-ссылку"
                        onClick={() => copy(`magnet-${torrent.id}`, torrent.magnet as string)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        {copiedKey === `magnet-${torrent.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* animdl CLI */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              Через animdl CLI
            </h3>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900 border border-border">
              <code className="flex-1 text-[11px] leading-relaxed text-emerald-400 font-mono break-all">
                {cliCommand}
              </code>
              <button
                title="Скопировать команду"
                onClick={() => copy("cli", cliCommand)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
              >
                {copiedKey === "cli" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Требуется Python: <code className="text-foreground">pip install animdl</code>.
              Команда скачает серию в лучшем качестве.
            </p>
          </div>

          {/* Внешние трекеры */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
              <HardDrive className="w-3 h-3" />
              Искать вручную
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={getTrackerLink("rutracker", query)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-card/50 border border-border hover:border-primary/40 hover:bg-card/80 transition-all group"
              >
                <span className="font-medium text-sm">RuTracker</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
              <a
                href={getTrackerLink("rutor", query)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-card/50 border border-border hover:border-primary/40 hover:bg-card/80 transition-all group"
              >
                <span className="font-medium text-sm">Rutor</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border text-muted-foreground hover:text-foreground"
            onClick={() => loadOptions({ refresh: true })}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Обновить ссылки
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
