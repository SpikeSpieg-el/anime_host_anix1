import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FileText, Shield, UserCheck, AlertTriangle } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Пользовательское соглашение — Weebx",
  description: "Пользовательское соглашение Weebx. Правила использования сайта и права пользователей.",
  alternates: {
    canonical: "https://weeb-x.com/terms",
  },
  openGraph: {
    title: "Пользовательское соглашение — Weebx",
    description: "Пользовательское соглашение Weebx. Правила использования сайта и права пользователей.",
    type: "website",
    url: "https://weeb-x.com/terms",
    siteName: "Weebx",
    locale: "ru_RU",
  },
}

export default function TermsPage() {
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
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Пользовательское соглашение</h1>
          </div>
          <p className="text-muted-foreground">
            Правила использования сайта Weebx. Пожалуйста, внимательно ознакомьтесь с условиями.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              1. Общие положения
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения 
                между пользователями сайта Weebx (далее — «Сайт») и администрацией Сайта.
              </p>
              <p className="leading-relaxed">
                1.2. Используя Сайт, вы подтверждаете, что прочитали, поняли и принимаете условия 
                настоящего Соглашения. Если вы не согласны с условиями, пожалуйста, не используйте Сайт.
              </p>
              <p className="leading-relaxed">
                1.3. Администрация Сайта оставляет за собой право вносить изменения в настоящее 
                Соглашение в любое время. Актуальная версия всегда доступна на этой странице.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              2. Условия использования
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                2.1. Сайт предоставляет доступ к аниме-контенту в ознакомительных целях. Все материалы 
                предоставляются исключительно для личного некоммерческого использования.
              </p>
              <p className="leading-relaxed">
                2.2. Пользователь обязуется не использовать Сайт в коммерческих целях, не копировать, 
                не распространять и не создавать производные работы на основе контента Сайта.
              </p>
              <p className="leading-relaxed">
                2.3. Пользователь несёт полную ответственность за свои действия при использовании Сайта 
                и обязуется соблюдать применимое законодательство.
              </p>
              <p className="leading-relaxed">
                2.4. Минимальный возраст для использования Сайта — 16 лет. Для просмотра контента с 
                возрастным рейтингом 18+ пользователь должен достичь совершеннолетия.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              3. Ограничения
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                Пользователю <strong className="text-foreground">запрещается</strong>:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Использовать Сайт для распространения вредоносного ПО, вирусов или любого другого 
                вредоносного кода</li>
                <li>Осуществлять попытки взлома, несанкционированного доступа к серверам или данным Сайта</li>
                <li>Использовать автоматизированные системы (боты, скрипты, парсеры) для сбора данных 
                или взаимодействия с Сайтом без письменного разрешения</li>
                <li>Размещать спам, рекламные материалы или контент, нарушающий права третьих лиц</li>
                <li>Публиковать контент, содержащий угрозы, оскорбления, призывы к насилию или 
                дискриминации</li>
                <li>Нарушать права интеллектуальной собственности или распространять пиратский контент</li>
                <li>Выдавать себя за другое лицо или организацию</li>
              </ul>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              4. Аккаунт пользователя
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                4.1. Регистрация на Сайте является добровольной. Некоторые функции Сайта доступны только 
                зарегистрированным пользователям.
              </p>
              <p className="leading-relaxed">
                4.2. Пользователь обязуется предоставлять точную и актуальную информацию при регистрации 
                и поддерживать её в актуальном состоянии.
              </p>
              <p className="leading-relaxed">
                4.3. Пользователь несёт ответственность за сохранность своих учётных данных и за все 
                действия, совершённые под его аккаунтом.
              </p>
              <p className="leading-relaxed">
                4.4. Администрация оставляет за собой право заблокировать или удалить аккаунт при 
                нарушении настоящего Соглашения без предварительного уведомления.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              5. Отказ от ответственности
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                5.1. Сайт предоставляется «как есть» без каких-либо гарантий. Администрация не гарантирует 
                бесперебойную работу Сайта, отсутствие ошибок или точность контента.
              </p>
              <p className="leading-relaxed">
                5.2. Администрация не несёт ответственности за любой прямой или косвенный ущерб, 
                возникший в результате использования или невозможности использования Сайта.
              </p>
              <p className="leading-relaxed">
                5.3. Администрация не несёт ответственности за контент третьих лиц, ссылки на которые 
                могут присутствовать на Сайте.
              </p>
              <p className="leading-relaxed">
                5.4. Администрация оставляет за собой право в любое время изменить или прекратить 
                работу Сайта (полностью или частично) без предварительного уведомления.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              6. Конфиденциальность
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                6.1. Администрация собирает и обрабатывает персональные данные пользователей в 
                соответствии с Политикой конфиденциальности.
              </p>
              <p className="leading-relaxed">
                6.2. Используя Сайт, вы соглашаетесь на сбор и обработку ваших данных в целях 
                предоставления услуг Сайта.
              </p>
              <p className="leading-relaxed">
                6.3. Мы не передаём персональные данные третьим лицам за исключением случаев, 
                предусмотренных законом.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              7. Разрешение споров
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                7.1. Все споры и разногласия, возникающие в связи с использованием Сайта, стороны 
                будут стремиться разрешить путём переговоров.
              </p>
              <p className="leading-relaxed">
                7.2. При невозможности достичь соглашения споры рассматриваются в соответствии с 
                законодательством Российской Федерации.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              8. Заключительные положения
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                8.1. Настоящее Соглашение вступает в силу с момента начала использования Сайта и 
                действует бессрочно.
              </p>
              <p className="leading-relaxed">
                8.2. По вопросам, связанным с настоящим Соглашением, обращайтесь через страницу{' '}
                <Link href="/contacts" className="text-primary hover:underline">
                  «Контакты»
                </Link>
                .
              </p>
              <p className="leading-relaxed">
                8.3. Если какое-либо положение настоящего Соглашения будет признано недействительным, 
                это не влияет на действительность остальных положений.
              </p>
            </div>
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
