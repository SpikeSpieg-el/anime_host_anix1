import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, HelpCircle, Search, Bookmark, History, Settings, Shield, Mail } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Помощь — Weeb.X",
  description: "Центр помощи пользователей Weeb.X. Узнайте, как использовать все функции нашего аниме-стриминга.",
}

const helpSections = [
  {
    icon: Search,
    title: "Поиск аниме",
    description: "Как найти нужное аниме в каталоге",
    content: `Используйте строку поиска в верхней части сайта для быстрого нахождения аниме по названию. 
    Также вы можете/browse каталог с использованием фильтров по жанрам, году выпуска, статусу и другим параметрам.`,
  },
  {
    icon: Bookmark,
    title: "Закладки",
    description: "Управление списком избранного",
    content: `Добавляйте аниме в закладки, нажав на иконку закладки на странице аниме. 
    Все сохранённые аниме доступны в разделе «Закладки» в личном кабинете. 
    Вы можете создавать списки «Просмотрено», «Планирую посмотреть», «Смотрю» и другие.`,
  },
  {
    icon: History,
    title: "История просмотра",
    description: "Отслеживание просмотренных серий",
    content: `История просмотра автоматически сохраняется при просмотре аниме. 
    Вы можете вернуться к последней просмотренной серии в любое время через раздел «История». 
    История хранится в течение 90 дней.`,
  },
  {
    icon: Settings,
    title: "Настройки профиля",
    description: "Управление аккаунтом и предпочтениями",
    content: `В настройках профиля вы можете изменить имя пользователя, загрузить аватар, 
    настроить параметры поиска (включая NSFW-фильтр) и управлять другими предпочтениями.`,
  },
  {
    icon: Shield,
    title: "Безопасность",
    description: "Защита вашего аккаунта",
    content: `Мы рекомендуем использовать надёжные пароли и не передавать данные учётной записи третьим лицам. 
    При подозрении на несанкционированный доступ немедленно смените пароль.`,
  },
  {
    icon: Mail,
    title: "Обратная связь",
    description: "Связь с поддержкой",
    content: `Если вы не нашли ответ на свой вопрос, свяжитесь с нами через страницу «Контакты». 
    Мы стараемся отвечать на все обращения в течение 24-48 часов.`,
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Помощь</h1>
          </div>
          <p className="text-muted-foreground">
            Центр помощи пользователей Weeb.X. Найдите ответы на вопросы о функциях сайта.
          </p>
        </div>

        <div className="grid gap-6">
          {helpSections.map((section, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-1">{section.title}</h2>
                  <p className="text-sm text-muted-foreground mb-3">{section.description}</p>
                  <p className="text-foreground leading-relaxed">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">Нужна дополнительная помощь?</h3>
          <p className="text-muted-foreground mb-4">
            Если вы не нашли ответ на свой вопрос, посетите страницу{' '}
            <Link href="/faq" className="text-primary hover:underline">
              «Часто задаваемые вопросы»
            </Link>{' '}
            или свяжитесь с нами через страницу{' '}
            <Link href="/contacts" className="text-primary hover:underline">
              «Контакты»
            </Link>
            .
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
