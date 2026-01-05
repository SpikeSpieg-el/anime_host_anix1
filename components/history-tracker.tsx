"use client"
import { useEffect } from "react"

export function HistoryTracker({ anime }: { anime: any }) {
  useEffect(() => {
    // 1. Получаем текущую историю
    const history = JSON.parse(localStorage.getItem("watch-history") || "[]")
    
    // 2. Убираем дубликаты (если это аниме уже есть, удаляем старую запись)
    const filtered = history.filter((item: any) => item.id !== anime.id)
    
    // 3. Добавляем текущее аниме в начало
    const newItem = {
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: Date.now()
    }
    
    // 4. Сохраняем (максимум 20 штук)
    localStorage.setItem("watch-history", JSON.stringify([newItem, ...filtered].slice(0, 20)))
    
  }, [anime])

  return null // Этот компонент ничего не рисует, только логика
}