"use client"

import { useState } from "react"
import { SearchSuggestions } from "@/components/search-suggestions"

export default function SearchTestPage() {
  const [searchValue, setSearchValue] = useState("")

  const handleSearchSelect = (query: string) => {
    alert(`Выбран поиск: ${query}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Тест поиска с подсказками</h1>
        
        <div className="mb-4">
          <p className="text-zinc-400 mb-4">
            Начните вводить название аниме (минимум 2 символа) и увидите до 5 подсказок с постерами и информацией.
          </p>
        </div>

        <div className="mb-8">
          <SearchSuggestions
            value={searchValue}
            onChange={setSearchValue}
            onSelect={handleSearchSelect}
            placeholder="Поиск аниме..."
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Функциональность:</h2>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Поиск с дебаунсом (300ms)</li>
            <li>• До 5 результатов поиска</li>
            <li>• История поиска (до 5 последних запросов)</li>
            <li>• Постеры и информация об аниме</li>
            <li>• Клик по результату для перехода</li>
            <li>• Закрытие по Escape или клику вне</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
