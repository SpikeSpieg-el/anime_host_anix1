"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, ChevronRight, Check } from "lucide-react"

interface PreferenceData {
  favoriteGenres: string[]
  mood: string
  pacing: string
  artStyle: string
  themes: string[]
}

interface PreferenceSurveyProps {
  onComplete: (data: PreferenceData) => void
  onCancel: () => void
}

const GENRES = [
  "Экшен", "Фэнтези", "Комедия", "Драма", "Романтика",
  "Хоррор", "Научная фантастика", "Повседневность", "Спорт",
  "Приключения", "Мистика", "Психологическое"
]

const MOODS = [
  { id: "exciting", label: "Адреналин и драйв", emoji: "⚡" },
  { id: "relaxing", label: "Расслабление и уют", emoji: "🌸" },
  { id: "emotional", label: "Эмоции и драма", emoji: "💔" },
  { id: "intellectual", label: "Загадки и размышления", emoji: "🧠" },
  { id: "romantic", label: "Романтика и отношения", emoji: "💕" },
  { id: "dark", label: "Мрачная атмосфера", emoji: "🌑" }
]

const PACING = [
  { id: "fast", label: "Быстрый темп, экшен с первой минуты" },
  { id: "medium", label: "Сбалансированный темп" },
  { id: "slow", label: "Медленный, вдумчивый темп" }
]

const ART_STYLES = [
  { id: "modern", label: "Современная анимация (2020+)" },
  { id: "classic", label: "Классический стиль (2000-2019)" },
  { id: "retro", label: "Ретро стиль (90-е)" },
  { id: "any", label: "Любой стиль" }
]

const THEMES = [
  "Дружба", "Любовь", "Семья", "Самопожертвование", "Месть",
  "Рост персонажа", "Политика", "Технологии", "Природа", "Музыка"
]

export function PreferenceSurvey({ onComplete, onCancel }: PreferenceSurveyProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<PreferenceData>({
    favoriteGenres: [],
    mood: "",
    pacing: "",
    artStyle: "",
    themes: []
  })

  const toggleGenre = (genre: string) => {
    setData(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres.includes(genre)
        ? prev.favoriteGenres.filter(g => g !== genre)
        : [...prev.favoriteGenres, genre].slice(0, 5) // Максимум 5 жанров, минимум 1
    }))
  }

  const toggleTheme = (theme: string) => {
    setData(prev => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme].slice(0, 3) // Максимум 3 темы
    }))
  }

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1)
    } else {
      onComplete(data)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1: return data.favoriteGenres.length >= 1
      case 2: return data.mood !== ""
      case 3: return data.pacing !== "" && data.artStyle !== ""
      case 4: return data.themes.length >= 1
      default: return false
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-purple-500" : "bg-zinc-700"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Genres */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Какие жанры вам нравятся?</h3>
            <p className="text-sm text-zinc-400">Выберите 1-5 жанров</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                  data.favoriteGenres.includes(genre)
                    ? "bg-purple-500/20 border-purple-500 text-purple-300"
                    : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{genre}</span>
                  {data.favoriteGenres.includes(genre) && (
                    <Check className="w-4 h-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mood */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Какое настроение вы ищете?</h3>
            <p className="text-sm text-zinc-400">Выберите одно настроение</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setData(prev => ({ ...prev, mood: mood.id }))}
                className={`p-4 rounded-xl border transition-all text-left ${
                  data.mood === mood.id
                    ? "bg-purple-500/20 border-purple-500"
                    : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <div className="text-2xl mb-2">{mood.emoji}</div>
                <div className="font-medium text-white">{mood.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Pacing & Art Style */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Темп повествования</h3>
            <div className="space-y-2">
              {PACING.map((pace) => (
                <button
                  key={pace.id}
                  onClick={() => setData(prev => ({ ...prev, pacing: pace.id }))}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    data.pacing === pace.id
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{pace.label}</span>
                    {data.pacing === pace.id && <Check className="w-4 h-4" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-2">Стиль анимации</h3>
            <div className="space-y-2">
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setData(prev => ({ ...prev, artStyle: style.id }))}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    data.artStyle === style.id
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{style.label}</span>
                    {data.artStyle === style.id && <Check className="w-4 h-4" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Themes */}
      {step === 4 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Какие темы вам интересны?</h3>
            <p className="text-sm text-zinc-400">Выберите 1-3 темы</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme}
                onClick={() => toggleTheme(theme)}
                className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                  data.themes.includes(theme)
                    ? "bg-purple-500/20 border-purple-500 text-purple-300"
                    : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{theme}</span>
                  {data.themes.includes(theme) && <Check className="w-4 h-4" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="text-zinc-400 hover:text-white"
            >
              Назад
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-zinc-400 hover:text-white"
          >
            Отмена
          </Button>
        </div>
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6"
        >
          {step === 4 ? "Создать рекомендации" : "Далее"}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
