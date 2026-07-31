"use client"

import { useState } from "react"
import { 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  EyeOff, 
  Image as ImageIcon, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Sparkles 
} from "lucide-react"
import type { CustomNews } from "./types"

interface NewsTabProps {
  news: CustomNews[]
  isLoading: boolean
  onCreateNews: (news: { title: string; excerpt: string; body?: string | null; image_url?: string | null; author?: string | null; is_published?: boolean }) => Promise<void>
  onUpdateNews: (id: string, updates: { title?: string; excerpt?: string; body?: string | null; image_url?: string | null; author?: string | null; is_published?: boolean }) => Promise<void>
  onDeleteNews: (id: string) => Promise<void>
  onTogglePublished: (id: string, currentStatus: boolean) => Promise<void>
}

export function NewsTab({ news, isLoading, onCreateNews, onUpdateNews, onDeleteNews, onTogglePublished }: NewsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createTab, setCreateTab] = useState<"edit" | "preview">("edit")
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTab, setEditTab] = useState<"edit" | "preview">("edit")
  
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [newExcerpt, setNewExcerpt] = useState("")
  const [newBody, setNewBody] = useState("")
  const [newImageUrl, setNewImageUrl] = useState("")
  const [newAuthor, setNewAuthor] = useState("")
  const [newIsPublished, setNewIsPublished] = useState(false)

  const resetForm = () => {
    setNewTitle("")
    setNewExcerpt("")
    setNewBody("")
    setNewImageUrl("")
    setNewAuthor("")
    setNewIsPublished(false)
    setCreateTab("edit")
    setEditTab("edit")
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newExcerpt.trim()) return
    await onCreateNews({
      title: newTitle,
      excerpt: newExcerpt,
      body: newBody || null,
      image_url: newImageUrl || null,
      author: newAuthor || null,
      is_published: newIsPublished,
    })
    resetForm()
    setShowCreateForm(false)
  }

  const handleStartEdit = (item: CustomNews) => {
    setEditingId(item.id)
    setEditTab("edit")
    setNewTitle(item.title)
    setNewExcerpt(item.excerpt)
    setNewBody(item.body || "")
    setNewImageUrl(item.image_url || "")
    setNewAuthor(item.author || "")
    setNewIsPublished(item.is_published)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    await onUpdateNews(editingId, {
      title: newTitle,
      excerpt: newExcerpt,
      body: newBody || null,
      image_url: newImageUrl || null,
      author: newAuthor || null,
      is_published: newIsPublished,
    })
    setEditingId(null)
    resetForm()
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Вспомогательный компонент для предпросмотра
  const RenderPreview = ({
    title,
    excerpt,
    body,
    imageUrl,
    author,
    isPublished,
  }: {
    title: string
    excerpt: string
    body?: string | null
    imageUrl?: string | null
    author?: string | null
    isPublished?: boolean
  }) => (
    <div className="bg-background border border-border rounded-xl overflow-hidden p-5 space-y-4 shadow-sm">
      {/* Шапка / Картинка */}
      {imageUrl && (
        <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden bg-zinc-950">
          <img
            src={imageUrl}
            alt={title || "Превью"}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        </div>
      )}

      {/* Инфо-бейджи */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs px-2.5 py-1 rounded bg-green-500/20 text-green-400 font-medium">
          Weebx
        </span>
        {isPublished !== undefined && (
          <span className={`text-xs px-2.5 py-1 rounded font-medium ${isPublished ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {isPublished ? 'Опубликовано' : 'Черновик'}
          </span>
        )}
        {author && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Автор: {author}
          </span>
        )}
      </div>

      {/* Заголовок и анонс */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight mb-2">
          {title || "Заголовок новости..."}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed italic">
          {excerpt || "Краткое описание события..."}
        </p>
      </div>

      {/* Полный текст HTML */}
      <div className="pt-4 border-t border-border">
        {body ? (
          <div
            className="shikimori-news-body prose prose-invert max-w-none text-foreground/90 leading-relaxed font-sans text-sm sm:text-base"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Полный текст (HTML) пока не заполнен...
          </p>
        )}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Управление новостями</h2>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm)
            if (!showCreateForm) resetForm()
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Добавить новость
        </button>
      </div>

      {/* Form: Create News */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-lg font-semibold text-foreground">Новая новость</h3>
            
            {/* Переключатель Табов Редактор / Предпросмотр */}
            <div className="flex bg-muted p-1 rounded-lg gap-1 border border-border">
              <button
                type="button"
                onClick={() => setCreateTab("edit")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${createTab === 'edit' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Редактор
              </button>
              <button
                type="button"
                onClick={() => setCreateTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${createTab === 'preview' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Предпросмотр
              </button>
            </div>
          </div>

          {createTab === "preview" ? (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Превью в реальном времени:</span>
              <RenderPreview
                title={newTitle}
                excerpt={newExcerpt}
                body={newBody}
                imageUrl={newImageUrl}
                author={newAuthor}
                isPublished={newIsPublished}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Заголовок *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  placeholder="Заголовок новости"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Краткое описание *</label>
                <textarea
                  value={newExcerpt}
                  onChange={(e) => setNewExcerpt(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
                  placeholder="Краткое описание для карточки в списке..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Полный текст (HTML)</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono text-sm resize-none"
                  placeholder="<p>Ваш текст...</p> <h2>Подзаголовок</h2>"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">URL изображения баннера</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    placeholder="https://example.com/image.jpg"
                  />
                  {newImageUrl && (
                    <img
                      src={newImageUrl}
                      alt="Preview"
                      className="w-12 h-10 object-cover rounded border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Автор</label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  placeholder="Редакция Weebx"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={newIsPublished}
                  onChange={(e) => setNewIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isPublished" className="text-sm text-foreground select-none cursor-pointer">
                  Опубликовать сразу
                </label>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-3 border-t border-border">
            <button type="submit" className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
              Создать
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); resetForm() }}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* News List */}
      <div className="space-y-4">
        {news.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Нет кастомных новостей. Создайте первую!</p>
          </div>
        ) : (
          news.map((item) => {
            const isEditing = editingId === item.id
            const isExpanded = expandedId === item.id

            return (
              <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden transition shadow-sm">
                {isEditing ? (
                  /* Form: Edit Mode */
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h3 className="text-lg font-semibold text-foreground">Редактирование новости</h3>
                      
                      {/* Табы для редактирования */}
                      <div className="flex bg-muted p-1 rounded-lg gap-1 border border-border">
                        <button
                          type="button"
                          onClick={() => setEditTab("edit")}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${editTab === 'edit' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Редактор
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTab("preview")}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${editTab === 'preview' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Предпросмотр
                        </button>
                      </div>
                    </div>

                    {editTab === "preview" ? (
                      <RenderPreview
                        title={newTitle}
                        excerpt={newExcerpt}
                        body={newBody}
                        imageUrl={newImageUrl}
                        author={newAuthor}
                        isPublished={newIsPublished}
                      />
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Заголовок *</label>
                          <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Краткое описание *</label>
                          <textarea
                            value={newExcerpt}
                            onChange={(e) => setNewExcerpt(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Полный текст (HTML)</label>
                          <textarea
                            value={newBody}
                            onChange={(e) => setNewBody(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono text-sm resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">URL изображения</label>
                          <input
                            type="text"
                            value={newImageUrl}
                            onChange={(e) => setNewImageUrl(e.target.value)}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Автор</label>
                          <input
                            type="text"
                            value={newAuthor}
                            onChange={(e) => setNewAuthor(e.target.value)}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`edit-isPublished-${item.id}`}
                            checked={newIsPublished}
                            onChange={(e) => setNewIsPublished(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <label htmlFor={`edit-isPublished-${item.id}`} className="text-sm text-foreground select-none cursor-pointer">
                            Опубликовано
                          </label>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-border">
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
                        Сохранить
                      </button>
                      <button onClick={handleCancelEdit} className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    <div className="p-4 flex items-start gap-4">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0 bg-muted"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate max-w-md">{item.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.is_published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {item.is_published ? 'Опубликовано' : 'Черновик'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.excerpt}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {item.author && <span>Автор: {item.author}</span>}
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      </div>

                      {/* Кнопки действий */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* КНОПКА РАЗВОРОТА ПРЕДПРОСМОТРА */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition ${
                            isExpanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                          title={isExpanded ? "Свернуть" : "Развернуть предпросмотр"}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isExpanded ? "Свернуть" : "Развернуть"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => onTogglePublished(item.id, item.is_published)}
                          className="p-2 hover:bg-muted rounded transition"
                          title={item.is_published ? "Скрыть" : "Опубликовать"}
                        >
                          {item.is_published ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-yellow-400" />}
                        </button>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-2 hover:bg-muted rounded transition"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => onDeleteNews(item.id)}
                          className="p-2 hover:bg-muted rounded transition"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* РАЗВЕРНУТЫЙ БЛОК ПРЕДПРОСМОТРА В СПИСКЕ */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 bg-muted/20">
                        <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          Внешний вид новости на сайте:
                        </div>
                        <RenderPreview
                          title={item.title}
                          excerpt={item.excerpt}
                          body={item.body}
                          imageUrl={item.image_url}
                          author={item.author}
                          isPublished={item.is_published}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}