import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Shield, Cookie, Database, Eye, Mail } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Weebx",
  description: "Политика конфиденциальности Weebx. Какие данные мы собираем, как используем cookie и защищаем вашу информацию.",
  alternates: {
    canonical: "https://weeb-x.com/privacy",
  },
  openGraph: {
    title: "Политика конфиденциальности — Weebx",
    description: "Политика конфиденциальности Weebx. Какие данные мы собираем, как используем cookie и защищаем вашу информацию.",
    type: "website",
    url: "https://weeb-x.com/privacy",
    siteName: "Weebx",
    locale: "ru_RU",
  },
}

export default function PrivacyPage() {
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
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Политика конфиденциальности</h1>
          </div>
          <p className="text-muted-foreground">
            Как Weebx собирает, использует и защищает ваши данные.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              1. Общие положения
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                1.1. Настоящая Политика конфиденциальности (далее — «Политика») описывает, как сайт Weebx 
                (далее — «Сайт») собирает, использует и защищает данные пользователей.
              </p>
              <p className="leading-relaxed">
                1.2. Используя Сайт, вы соглашаетесь с условиями настоящей Политики. Если вы не согласны 
                с этими условиями, пожалуйста, не используйте Сайт.
              </p>
              <p className="leading-relaxed">
                1.3. Политика может быть обновлена в любое время. Актуальная версия всегда доступна на этой странице.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              2. Какие данные мы собираем
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                <strong className="text-foreground">Данные аккаунта:</strong> при регистрации мы храним ваш 
                email-адрес и отображаемое имя. Пароли хранятся в виде хэша и никогда не передаются в открытом виде.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Закладки и история просмотра:</strong> мы храним ID аниме, 
                которые вы добавили в закладки или просмотрели, чтобы предоставлять персональные рекомендации.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Игровые данные:</strong> монеты, карты гача, пыль и статистика 
                PvP-баттлов привязаны к вашему аккаунту.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Технические данные:</strong> IP-адрес, тип браузера и 
                устройство — используются для обеспечения безопасности и корректной работы Сайта.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Cookie className="w-5 h-5 text-primary" />
              3. Файлы cookie
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Мы используем файлы cookie и локальное хранилище браузера для работы Сайта. Cookie — это 
              небольшие текстовые файлы, которые сохраняются в вашем браузере.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-3">Обязательные cookie</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Необходимы для работы Сайта. Без них авторизация, плеер и закладки не будут функционировать.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li><code className="text-foreground">sb-*-auth-token</code> — сессия авторизации Supabase</li>
              <li><code className="text-foreground">bookmark_ids</code> — ID закладок для серверных рекомендаций</li>
              <li><code className="text-foreground">watched_history</code> — ID просмотренных тайтлов</li>
              <li><code className="text-foreground">googtrans</code> — выбранный язык перевода</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mb-3">Аналитические cookie</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Используются для понимания того, какие страницы популярны. Вы можете отключить их в настройках cookie.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><code className="text-foreground">Vercel Analytics</code> — анонимная статистика посещений</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              4. Как мы используем данные
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Для авторизации и управления аккаунтом</li>
              <li>Для сохранения закладок, истории просмотра и игровых данных</li>
              <li>Для формирования персональных рекомендаций</li>
              <li>Для аналитики и улучшения работы Сайта</li>
              <li>Для отправки push-уведомлений о новых сериях (с вашего согласия)</li>
              <li>Для предотвращения злоупотреблений и обеспечения безопасности</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              5. Передача данных третьим лицам
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                5.1. Мы не продаём и не передаём ваши персональные данные третьим лицам в коммерческих целях.
              </p>
              <p className="leading-relaxed">
                5.2. Для работы Сайта используются следующие сторонние сервисы:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">Supabase</strong> — хранение данных аккаунта, закладок и истории (Европа)</li>
                <li><strong className="text-foreground">Vercel</strong> — хостинг и анонимная аналитика</li>
              </ul>
              <p className="leading-relaxed">
                5.3. Мы можем раскрыть данные в случае требования закона или для защиты прав Сайта.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              6. Управление согласием
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                6.1. При первом посещении Сайта вы увидите баннер согласия на использование cookie. Вы можете 
                принять все cookie, выбрать только обязательные или настроить выбор индивидуально.
              </p>
              <p className="leading-relaxed">
                6.2. Аналитические cookie загружаются только при вашем согласии. Обязательные cookie работают 
                всегда — без них Сайт не может функционировать.
              </p>
              <p className="leading-relaxed">
                6.3. Вы можете удалить все локальные данные в настройках браузера: очистите cookie и локальное 
                хранилище для домена weeb-x.com.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              7. Безопасность данных
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                7.1. Пароли хранятся в виде криптографического хэша (bcrypt) и не могут быть восстановлены.
              </p>
              <p className="leading-relaxed">
                7.2. Все соединения с Сайтом используют HTTPS-шифрование (TLS 1.3).
              </p>
              <p className="leading-relaxed">
                7.3. Доступ к базе данных защищён Row Level Security (RLS) — пользователи имеют доступ только 
                к своим данным.
              </p>
              <p className="leading-relaxed">
                7.4. Несмотря на принимаемые меры, ни один метод передачи данных через интернет не является 
                полностью безопасным. Мы не можем гарантировать абсолютную безопасность.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              8. Ваши права
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                Вы имеете право:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Знать, какие данные о вас собираются</li>
                <li>Запросить удаление вашего аккаунта и связанных данных</li>
                <li>Отказаться от аналитических cookie</li>
                <li>Отписаться от push-уведомлений в любой момент</li>
              </ul>
              <p className="leading-relaxed mt-3">
                Для реализации этих прав обратитесь через страницу{' '}
                <Link href="/contacts" className="text-primary hover:underline">
                  «Контакты»
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              9. Контакты
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              По вопросам конфиденциальности и защиты данных обращайтесь через страницу{' '}
              <Link href="/contacts" className="text-primary hover:underline">
                «Контакты»
              </Link>
              {' '}или на email{' '}
              <code className="text-foreground">privacy@weeb-x.com</code>.
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Последнее обновление:</strong> {new Date().toLocaleDateString('ru-RU')}
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
