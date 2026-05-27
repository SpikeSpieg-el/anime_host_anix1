"use client"

import { useState, useEffect } from 'react'
import { Mic, MicOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TVVoiceSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function TVVoiceSearch({ onSearch, placeholder = "Поиск аниме..." }: TVVoiceSearchProps) {
  const [isListening, setIsListening] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recognition, setRecognition] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = false
        recognitionInstance.interimResults = false
        recognitionInstance.lang = 'ru-RU'

        recognitionInstance.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setSearchQuery(transcript)
          onSearch(transcript)
          setIsListening(false)
        }

        recognitionInstance.onerror = () => {
          setIsListening(false)
        }

        recognitionInstance.onend = () => {
          setIsListening(false)
        }

        setRecognition(recognitionInstance)
      }
    }
  }, [onSearch])

  const toggleListening = () => {
    if (!recognition) return

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearch(searchQuery)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-4 h-12 text-lg"
        />
      </div>
      
      {recognition && (
        <Button
          type="button"
          onClick={toggleListening}
          size="lg"
          variant={isListening ? "destructive" : "secondary"}
          className="h-12 px-6"
        >
          {isListening ? (
            <>
              <MicOff className="h-5 w-5 mr-2" />
              Остановить
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
              Голос
            </>
          )}
        </Button>
      )}
      
      <Button type="submit" size="lg" className="h-12 px-6">
        Поиск
      </Button>
    </form>
  )
}
