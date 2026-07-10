import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Mail, MessageCircle, Github, ShieldAlert, FileText, Clock } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Контакты — Weeb-X",
  description: "Свяжитесь с командой Weeb-X. Обратная связь, поддержка и сотрудничество.",
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
    description: "По техническим проблемам и ошибкам на сайте",
    value: "tech@weeb-x.com",
    href: "mailto:tech@weeb-x.com",
  },
  {
    icon: Github,
    title: "GitHub",
    description: "Отслеживайте развитие проекта и сообщайте о багах",
    value: "github.com/weeb-x",
    href: "https://github.com/weeb-x",
    external: true,
  },
]

export default function ContactsPage() {
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
            <MessageCircle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Контакты</h1>
          </div>
          <p className="text-muted-foreground">
            Свяжитесь с нами по любым вопросам. Мы всегда рады обратной связи!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.href}
              target={method.external ? "_blank" : undefined}
              rel={method.external ? "noopener noreferrer" : undefined}
              className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:bg-accent/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <method.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {method.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {method.description}
                  </p>
                  <p className="text-primary font-mono text-sm truncate group-hover:underline">
                    {method.value}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Время ответа
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Мы стремимся отвечать на все обращения в течение{' '}
              <strong className="text-foreground">24-48 часов</strong> в рабочие дни.
            </p>
            <p className="text-sm text-muted-foreground">
              В выходные и праздничные дни время ответа может быть увеличено.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Перед обращением
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Пожалуйста, проверьте разделы{' '}
              <Link href="/help" className="text-primary hover:underline">
                «Помощь»
              </Link>{' '}
              и{' '}
              <Link href="/faq" className="text-primary hover:underline">
                «Часто задаваемые вопросы»
              </Link>
              — возможно, ответ уже есть там.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Форма обратной связи
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Вы также можете связаться с нами через форму ниже. Заполните все поля, 
            и мы ответим вам на указанный email.
          </p>
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Примечание:</strong> В настоящее время форма 
              обратной связи находится в разработке. Пожалуйста, используйте email для связи.
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Важная информация
          </h3>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                По вопросам авторских прав и DMCA используйте специальный email{' '}
                <Link href="/dmca" className="text-primary hover:underline">
                  dmca@weeb-x.com
                </Link>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                При обращении по техническим вопросам укажите браузер, устройство и подробное 
                описание проблемы
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                Не отправляйте личные данные (пароли, платежную информацию) через email
              </span>
            </li>
          </ul>
        </div>
      </div>

      <Footer />
    </div>
  )
}
