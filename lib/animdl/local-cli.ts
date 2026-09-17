import { exec, spawn } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const execAsync = promisify(exec)

export interface CliStream {
  url: string
  referer?: string
  quality?: string
  kind: "hls" | "mp4"
}

/**
 * Определение команды запуска animdl в среде сервера:
 * системный animdl, либо python -m animdl
 */
export async function resolveAnimdlCommand(): Promise<{ cmd: string; argsPrefix: string[] } | null> {
  // 1. Проверяем системный animdl
  try {
    await execAsync("animdl --help", { timeout: 3000 })
    return { cmd: "animdl", argsPrefix: ["-x"] }
  } catch {}

  // 2. Проверяем python3 -m animdl
  try {
    await execAsync("python3 -m animdl --help", { timeout: 3000 })
    return { cmd: "python3", argsPrefix: ["-m", "animdl", "-x"] }
  } catch {}

  // 3. Проверяем python -m animdl
  try {
    await execAsync("python -m animdl --help", { timeout: 3000 })
    return { cmd: "python", argsPrefix: ["-m", "animdl", "-x"] }
  } catch {}

  // 4. Проверяем py -m animdl
  try {
    await execAsync("py -m animdl --help", { timeout: 3000 })
    return { cmd: "py", argsPrefix: ["-m", "animdl", "-x"] }
  } catch {}

  // 5. Проверяем кастомный путь через переменные окружения
  const customExe = process.env.ANIMDL_EXE_PATH || process.env.ANIMEDL_PATH
  if (customExe && fs.existsSync(customExe)) {
    return { cmd: customExe, argsPrefix: ["-x"] }
  }

  return null
}

/**
 * Получить прямые ссылки на серию через animdl grab
 */
export async function grabStreamsFromLocalAnimdl(
  query: string,
  episode: number,
): Promise<CliStream[]> {
  const resolved = await resolveAnimdlCommand()
  if (!resolved) {
    console.log("[animdl/local] animdl не найден в системе (установите pip install animdl)")
    return []
  }

  const cleanQuery = query.replace(/["']/g, "").trim()
  const fullCmd = `${resolved.cmd} ${resolved.argsPrefix.join(" ")} grab "search:${cleanQuery}" -r ${episode} --index 1`

  console.log(`[animdl/local] Запуск: ${fullCmd}`)

  try {
    const { stdout } = await execAsync(fullCmd, {
      timeout: 25000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
    })

    const streams: CliStream[] = []
    const lines = stdout.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Формат JSON (в том числе {"episode": 1, "streams": [...]})
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed.streams)) {
            for (const s of parsed.streams) {
              const url = s.stream_url || s.url
              if (url && typeof url === "string") {
                streams.push({
                  url,
                  referer: s.headers?.referer || s.headers?.Referer || "https://allmanga.to/",
                  quality: s.quality ? `${s.quality}p` : "Auto",
                  kind: url.includes(".m3u8") ? "hls" : "mp4",
                })
              }
            }
            continue
          }
          const url = parsed.stream_url || parsed.url
          if (url && typeof url === "string") {
            streams.push({
              url,
              referer: parsed.headers?.referer || parsed.headers?.Referer || "https://allmanga.to/",
              quality: parsed.quality ? `${parsed.quality}p` : "Auto",
              kind: url.includes(".m3u8") ? "hls" : "mp4",
            })
          }
        } catch {}
      }

      // Формат Stream(...) из вывода Python repr
      const streamUrlMatch = trimmed.match(/stream_url=['"]([^'"]+)['"]/i) || trimmed.match(/https?:\/\/[^\s"'<>]+/i)
      if (streamUrlMatch) {
        const url = streamUrlMatch[1] || streamUrlMatch[0]
        if (url.startsWith("http")) {
          const refererMatch = trimmed.match(/referer=['"]([^'"]+)['"]/i)
          streams.push({
            url,
            referer: refererMatch ? refererMatch[1] : "https://allmanga.to/",
            quality: "Auto",
            kind: url.includes(".m3u8") ? "hls" : "mp4",
          })
        }
      }
    }

    return streams
  } catch (error: any) {
    console.warn(`[animdl/local] Ошибка выполнения ${fullCmd}:`, error?.message || error)
    return []
  }
}

/**
 * Поиск скачанного файла видео в директории
 */
function findDownloadedVideoFile(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findDownloadedVideoFile(fullPath)
      if (found) return found
    } else if (/\.(mp4|mkv|webm|ts)$/i.test(entry.name)) {
      return fullPath
    }
  }
  return null
}

/**
 * Скачать серию через animdl во временный каталог сервера и вернуть путь к файлу
 */
export async function downloadEpisodeForUser(
  query: string,
  episode: number,
): Promise<{ filePath: string; cleanup: () => void } | null> {
  const resolved = await resolveAnimdlCommand()
  if (!resolved) {
    console.warn("[animdl/download] animdl не найден в системе")
    return null
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "animdl-download-"))
  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch (err) {
      console.warn("[animdl/download] Ошибка очистки временной папки:", err)
    }
  }

  const cleanQuery = query.replace(/["']/g, "").trim()
  const args = [
    ...resolved.argsPrefix,
    "download",
    `search:${cleanQuery}`,
    "-e",
    String(episode),
    "--index",
    "1",
    "-d",
    tmpDir,
    "--quality",
    "best",
  ]

  console.log(`[animdl/download] Запуск animdl download: ${resolved.cmd} ${args.join(" ")}`)

  return new Promise((resolve) => {
    const child = spawn(resolved.cmd, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const timeout = setTimeout(() => {
      child.kill("SIGKILL")
      cleanup()
      resolve(null)
    }, 180_000) // 3 минуты тайм-аут

    child.on("close", (code) => {
      clearTimeout(timeout)
      const videoPath = findDownloadedVideoFile(tmpDir)
      if (code === 0 && videoPath && fs.existsSync(videoPath)) {
        resolve({ filePath: videoPath, cleanup })
      } else {
        cleanup()
        resolve(null)
      }
    })

    child.on("error", (err) => {
      clearTimeout(timeout)
      console.warn("[animdl/download] Ошибка процесса animdl:", err)
      cleanup()
      resolve(null)
    })
  })
}
