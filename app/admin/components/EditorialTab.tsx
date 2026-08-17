"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Sparkles, Edit, Trash2, Plus, Loader2, Eye, FileText, HelpCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { FormattedEditorialContent } from "@/components/watch/watch-page-layout-wrapper"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface EditorialReview {
  id: string
  anime_id: string
  content: string
  author: string
  created_at: string
  updated_at: string
}

export function EditorialTab() {
  const [reviews, setReviews] = useState<EditorialReview[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [animeId, setAnimeId] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState("Редакция Weebx")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCheatSheet, setShowCheatSheet] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const copyTemplate = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    toast.success("Шаблон скопирован в буфер")
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const insertTemplate = (template: string) => {
    setContent((prev) => (prev ? `${prev}\n\n${template}` : template))
    toast.success("Шаблон добавлен в текст")
  }

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("editorial_reviews")
        .select("*")
        .order("updated_at", { ascending: false })

      if (error) throw error
      setReviews((data as EditorialReview[]) || [])
    } catch (err: any) {
      console.error("Failed to fetch editorial reviews:", err)
      toast.error("Ошибка при загрузке отзывов редакции")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!animeId.trim() || !content.trim()) {
      toast.error("Заполните Shikimori ID и текст отзыва")
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase.from("editorial_reviews").upsert(
        {
          anime_id: animeId.trim(),
          content: content.trim(),
          author: author.trim() || "Редакция Weebx",
        },
        { onConflict: "anime_id" }
      )

      if (error) throw error

      toast.success(editingId ? "Мнение редакции обновлено!" : "Мнение редакции добавлено!")
      setAnimeId("")
      setContent("")
      setAuthor("Редакция Weebx")
      setEditingId(null)
      setShowPreview(false)
      fetchReviews()
    } catch (err: any) {
      console.error("Error saving review:", err)
      toast.error(`Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (review: EditorialReview) => {
    setAnimeId(review.anime_id)
    setContent(review.content)
    setAuthor(review.author || "Редакция Weebx")
    setEditingId(review.id)
    setShowPreview(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (anime_id: string) => {
    if (!confirm("Удалить мнение редакции для этого аниме?")) return

    try {
      const { error } = await supabase
        .from("editorial_reviews")
        .delete()
        .eq("anime_id", anime_id)

      if (error) throw error
      toast.success("Отзыв удалён")
      fetchReviews()
    } catch (err: any) {
      console.error("Error deleting review:", err)
      toast.error("Ошибка при удалении")
    }
  }

  const handleCancel = () => {
    setAnimeId("")
    setContent("")
    setAuthor("Редакция Weebx")
    setEditingId(null)
    setShowPreview(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {editingId ? "Редактировать мнение редакции" : "Добавить мнение редакции"}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground flex items-center gap-1.5 transition"
          >
            {showPreview ? <FileText className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Редактировать текст" : "Предпросмотр"}
          </button>
        </div>

        {/* Блок-туториал по оформлению Markdown */}
        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all">
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className="flex w-full items-center justify-between text-left font-semibold text-primary hover:text-primary/80 transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary shrink-0" />
              <span>Шпаргалка и туториал по оформлению (что поддерживается парсером)</span>
            </div>
            {showCheatSheet ? (
              <ChevronUp className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-primary shrink-0" />
            )}
          </button>

          {showCheatSheet && (
            <div className="mt-4 space-y-4 pt-3 border-t border-primary/15 text-xs text-foreground/90">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* 1. Блок вердикта */}
                <div className="p-3 rounded-lg bg-background/80 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      ⭐ 1. Блок «Вердикт»
                    </span>
                    <button
                      type="button"
                      onClick={() => insertTemplate("Вердикт:\nКраткий итог обзора и финальные впечатления редакции.\n8.5/10")}
                      className="px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-medium transition"
                    >
                      Вставить
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Строки, начинающиеся со слова <code className="text-primary font-mono font-semibold">Вердикт:</code> или <code className="text-primary font-mono font-semibold">### Вердикт</code>, превращаются в красивый градиентный премиум-кард. Последняя строка с оценкой (напр. <code>8/10</code> или <code>8.5 из 10</code>) выделится в золотую звезду!
                  </p>
                  <pre className="p-2 rounded bg-muted font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
              {`Вердикт:
              Один из лучших тайтлов года с восхитительной анимацией.
              9/10`}
                  </pre>
                </div>

                {/* 2. Заголовки */}
                <div className="p-3 rounded-lg bg-background/80 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      📌 2. Заголовки (H1, H2, H3)
                    </span>
                    <button
                      type="button"
                      onClick={() => insertTemplate("## Сюжет и атмосфера\n### Персонажи")}
                      className="px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-medium transition"
                    >
                      Вставить
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    <code className="text-primary font-mono font-semibold"># Заголовок</code> — большой градиентный H1<br />
                    <code className="text-primary font-mono font-semibold">## Раздел</code> — H2 с цветным индикатором полоски<br />
                    <code className="text-primary font-mono font-semibold">### Подраздел</code> — H3 со звездочкой ✦
                  </p>
                  <pre className="p-2 rounded bg-muted font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
                    {`# Главная мысль
                    ## Почему стоит смотреть
                    ### Музыкальное сопровождение`}
                  </pre>
                </div>

                {/* 3. Списки */}
                <div className="p-3 rounded-lg bg-background/80 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      📋 3. Списки (маркированные и нумерованные)
                    </span>
                    <button
                      type="button"
                      onClick={() => insertTemplate("- Плюсы:\n- Отличный визуал\n- Глубокие персонажи\n\n1. Шаг первый\n2. Шаг второй")}
                      className="px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-medium transition"
                    >
                      Вставить
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    <code className="text-primary font-mono font-semibold">- Пункт</code> или <code className="text-primary font-mono font-semibold">* Пункт</code> — маркированный список с акцентными точками.<br />
                    <code className="text-primary font-mono font-semibold">1. Пункт</code> — нумерованный список со стильными бейджами.
                  </p>
                </div>

                {/* 4. Цитаты и Вставки */}
                <div className="p-3 rounded-lg bg-background/80 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      💬 4. Цитаты и Форматирование текста
                    </span>
                    <button
                      type="button"
                      onClick={() => insertTemplate("> «Мы не выбираем, кем родиться, но выбираем, кем стать.»\n\n**Жирный текст**, *курсив*, `код/тег`, [Ссылка](https://weeb-x.com)")}
                      className="px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-medium transition"
                    >
                      Вставить
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    <code className="text-primary font-mono font-semibold">&gt; Цитата</code> — стильная цитата с левой рамкой.<br />
                    <code className="text-primary font-mono font-semibold">**жирный**</code>, <code className="text-primary font-mono font-semibold">*курсив*</code>, <code className="text-primary font-mono font-semibold">`код`</code>, <code className="text-primary font-mono font-semibold">[текст](https://url)</code>.
                  </p>
                </div>
              </div>

              {/* Пример готового шаблона статьи */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-primary text-xs">✨ Готовый образец полного обзора</span>
                  <p className="text-muted-foreground text-[11px]">Вставьте готовый каркас со всеми элементами и заполните своими мыслями.</p>
                </div>
                <button
                  type="button"
                  onClick={() => insertTemplate(
                    `## Впечатления от просмотра
                    **Аниме производит сильное впечатление** с первых же минут благодаря великолепной режиссуре и проработке мира.

                    - Потрясающий визуальный стиль
                    - Харизматичные главные герои
                    - Саундтрек, пробирающий до мурашек

                    > «Каждая сцена наполнена эмоциями и вниманием к мельчайшим деталям.»

                    ### Кому точно понравится
                    1. Любителям качественной драмы
                    2. Ценителям нестандартного сюжета

                    Вердикт:
                    Один из самых ярких и запоминающихся тайтлов сезона, который точно стоит посмотреть каждому.
                    9.2/10`
                  )}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" /> Вставить готовый каркас
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Shikimori ID аниме *
              </label>
              <input
                type="text"
                placeholder="Например: 63403"
                value={animeId}
                onChange={(e) => setAnimeId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Автор
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {showPreview ? (
            <div className="p-5 rounded-xl bg-card border border-primary/30 shadow-inner min-h-[150px]">
              <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-semibold">
                Предпросмотр внешнего вида на странице:
              </div>
              <FormattedEditorialContent content={content || "Введите текст для предпросмотра..."} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Текст обзора / мнения редакции *
              </label>
              <textarea
                rows={8}
                placeholder="Напишите уникальный комментарий для SEO. Разделяйте абзацы двойным энтером..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingId ? "Сохранить изменения" : "Добавить отзыв"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition text-sm font-medium"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Список имеющихся отзывов */}
      <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
        <h3 className="text-base font-bold text-foreground mb-4">
          Список отзывов ({reviews.length})
        </h3>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка отзывов...</div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Пока нет ни одного отзыва редакции.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row justify-between items-start gap-4"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary text-sm">
                      Anime ID: {item.anime_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {item.author || "Редакция Weebx"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {new Date(item.updated_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-2">
                    {item.content}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-md bg-muted hover:bg-muted/80 text-foreground transition"
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.anime_id)}
                    className="p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}