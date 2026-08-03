import { Metadata } from "next"
import Link from "next/link"
import { 
  Mail, 
  MessageCircle, 
  ShieldAlert, 
  FileText, 
  Clock, 
  PlayCircle, 
  Sparkles, 
  ArrowRight,
  Send,
  HelpCircle
} from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Контакты — Weebx",
  description: "Свяжитесь с командой Weebx. Обратная связь, поддержка, DMCA и вопросы сотрудничества.",
  alternates: {
    canonical: "https://weeb-x.com/contacts",
  },
  openGraph: {
    title: "Контакты — Weebx",
    description: "Свяжитесь с командой Weebx. Обратная связь, поддержка, DMCA и вопросы сотрудничества.",
    type: "website",
    url: "https://weeb-x.com/contacts",
    siteName: "Weebx",
    locale: "ru_RU",
  },
}

// Schema.org микроразметка для поисковиков
const contactsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Контакты — Weebx",
  "description": "Свяжитесь с командой Weebx. Обратная связь, поддержка и сотрудничество.",
  "url": "https://weeb-x.com/contacts",
  "mainEntity": {
    "@type": "Organization",
    "name": "Weebx",
    "url": "https://weeb-x.com",
    "logo": "https://weeb-x.com/icon.svg",
    "email": "support@weeb-x.com",
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "email": "support@weeb-x.com",
        "contactType": "customer support",
        "availableLanguage": ["Russian"]
      },
      {
        "@type": "ContactPoint",
        "email": "dmca@weeb-x.com",
        "contactType": "copyright officer",
        "availableLanguage": ["Russian", "English"]
      }
    ]
  }
}

const contactMethods = [
  {
    icon: Mail,
    title: "Email для общих вопросов",
    description: "По вопросам сотрудничества, предложений и общим вопросам",
    value: "support@weeb-x.com",
    href: "mailto:support@weeb-x.com",
  },
  {
    icon: ShieldAlert,
    title: "DMCA и авторские права",
    description: "Для правообладателей и вопросов об авторском праве",
    value: "dmca@weeb-x.com",
    href: "mailto:dmca@weeb-x.com",
  },
  {
    icon: MessageCircle,
    title: "Техническая поддержка",
    description: "По техническим проблемам, багам и ошибкам в плеере",
    value: "tech@weeb-x.com",
    href: "mailto:tech@weeb-x.com",
  },
]

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Schema.org Микроразметка */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactsJsonLd) }}
      />

      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Баннер для конвертации трафика из поиска */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border border-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Ищете, что посмотреть?</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Тысячи аниме онлайн бесплатно в HD
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Все серии с русской озвучкой и субтитрами доступны без регистрации.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all">
            <Link href="/catalog" className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              В Каталог
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
          </Button>
        </div>

        {/* Заголовок страницы */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Контакты
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Свяжитесь с командой Weebx по любым вопросам. Мы всегда открыты к обратной связи и сотрудничеству!
          </p>
        </div>

        {/* Способы связи */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card/50 border border-border/80 rounded-2xl p-5 hover:border-primary/50 hover:bg-card transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <method.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {method.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
                    {method.description}
                  </p>
                  <p className="text-primary font-mono text-xs sm:text-sm font-semibold truncate group-hover:underline">
                    {method.value}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Время ответа и Раздел Помощи */}
        <div className="mt-6 grid gap-4 sm:gap-6 md:grid-cols-2">
          <div className="bg-card/40 border border-border/80 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Время ответа
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Мы стремимся отвечать на все обращения в течение{' '}
              <strong className="text-foreground font-semibold">24–48 часов</strong> в рабочие дни.
            </p>
            <p className="text-xs text-muted-foreground/80">
              В выходные и праздничные дни время ответа может быть увеличено.
            </p>
          </div>

          <div className="bg-card/40 border border-border/80 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Часто задаваемые вопросы
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Если у вас возник вопрос по работе сайта или плеера, возможно, решение уже есть в справочном разделе:
            </p>
            <div className="flex flex-wrap gap-2">
              <Link 
                href="/faq" 
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-border/50"
              >
                Частые вопросы (FAQ)
              </Link>
              <Link 
                href="/dmca" 
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-border/50"
              >
                Правообладателям (DMCA)
              </Link>
            </div>
          </div>
        </div>

        {/* Канал обратной связи / Телеграм */}
        <div className="mt-6 p-5 sm:p-6 bg-card/40 border border-border/80 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <Send className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Быстрая связь через Telegram
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            По вопросам быстрого решения проблем с видеоплеером, предложениям по сайту или заказу аниме напишите нам напрямую на электронную почту <strong className="text-foreground">support@weeb-x.com</strong> или воспользуйтесь поддержкой.
          </p>
          <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-semibold">Примечание:</strong> При обращении по техническим вопросам (не грузится плеер, пропал звук) укажите устройство, браузер и название аниме.
            </p>
          </div>
        </div>

        {/* Важная информация */}
        <div className="mt-6 p-5 sm:p-6 bg-primary/5 border border-primary/20 rounded-2xl">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
            Важная информация
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>
                По вопросам правообладания используйте адрес{' '}
                <a href="mailto:dmca@weeb-x.com" className="text-primary hover:underline font-mono">
                  dmca@weeb-x.com
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>
                Не передавайте личную информацию, пароли или платежные данные через писем поддержки
              </span>
            </li>
          </ul>
        </div>

      </main>

      <Footer />
    </div>
  )
}