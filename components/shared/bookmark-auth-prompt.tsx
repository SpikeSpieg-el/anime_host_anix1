"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthPromptBanner } from "@/components/watch/auth-prompt-banner"

const BOOKMARK_COUNT_KEY = "weebx_bookmark_count"

export function BookmarkAuthPrompt() {
  const { user } = useAuth()
  const [showPrompt, setShowPrompt] = useState(false)
  const bookmarkCountRef = useRef(0)

  useEffect(() => {
    if (user) {
      setShowPrompt(false)
      return
    }

    // Загружаем текущий счетчик из localStorage
    if (typeof window !== "undefined") {
      const savedCount = localStorage.getItem(BOOKMARK_COUNT_KEY)
      if (savedCount) {
        bookmarkCountRef.current = parseInt(savedCount, 10)
      }
    }

    const handleBookmarkAdded = () => {
      if (user) return

      bookmarkCountRef.current += 1

      // Сохраняем новый счетчик
      try {
        localStorage.setItem(BOOKMARK_COUNT_KEY, String(bookmarkCountRef.current))
      } catch {
        // Игнорируем в incognito/private mode
      }

      // Показываем плашку каждые 2 добавления
      if (bookmarkCountRef.current % 2 === 0) {
        setShowPrompt(true)
      }
    }

    window.addEventListener("bookmark-added", handleBookmarkAdded)

    return () => {
      window.removeEventListener("bookmark-added", handleBookmarkAdded)
    }
  }, [user])

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (user) return null

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.aside
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          role="region"
          aria-label="Уведомление о синхронизации закладок"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-40 max-w-md pointer-events-auto"
        >
          <AuthPromptBanner
            variant="bookmarks"
            onDismiss={handleDismiss}
            className="shadow-2xl shadow-black/40 border-primary/30"
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
