import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, HelpCircle } from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { FAQStructuredData } from "@/components/seo/structured-data"

export const metadata: Metadata = {
  title: "FAQ — Weeb.X. Ответы на вопросы о гаче, PvP и аниме",
  description: "Часто задаваемые вопросы о Weeb.X: как работает гача, как участвовать в PvP-арене, как смотреть аниме онлайн бесплатно.",
  keywords: [
    "faq",
    "вопросы и ответы",
    "гача как работает",
    "pvp арена правила",
    "как смотреть аниме",
    "регистрация на сайте",
    "бесплатно аниме",
  ],
  alternates: {
    canonical: "https://weeb.x/faq",
  },
  openGraph: {
    title: "FAQ — Weeb.X. Ответы на вопросы",
    description: "Часто задаваемые вопросы о Weeb.X: гача, PvP, аниме-стриминг.",
    type: "website",
    url: "https://weeb.x/faq",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Weeb.X FAQ",
      },
    ],
    siteName: "Weeb.X",
    locale: "ru_RU",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const faqCategories = [
  {
    title: "Общие вопросы",
    questions: [
      {
        question: "Что такое Weeb.X?",
        answer:
          "Weeb.X — это бесплатная платформа для просмотра аниме онлайн в высоком качестве. Мы предлагаем удобный интерфейс без отвлекающих факторов, персонализированные рекомендации и возможность отслеживать историю просмотра.",
      },
      {
        question: "Нужно ли регистрироваться для просмотра?",
        answer:
          "Нет, регистрация не обязательна для просмотра аниме. Однако создание аккаунта даёт доступ к дополнительным функциям: закладкам, истории просмотра, персональным рекомендациям и настройкам профиля.",
      },
      {
        question: "Бесплатно ли использование сайта?",
        answer:
          "Да, Weeb.X полностью бесплатен. Мы не показываем навязчивую рекламу и не требуем подписку для доступа к контенту.",
      },
    ],
  },
  {
    title: "Просмотр и качество",
    questions: [
      {
        question: "В каком качестве доступно аниме?",
        answer:
          "Большинство аниме доступно в HD-качестве (720p и выше). Качество воспроизведения может зависеть от источника и автоматически адаптируется под скорость вашего интернет-соединения.",
      },
      {
        question: "Есть ли субтитры и озвучка?",
        answer:
          "Да, мы предоставляем различные варианты перевода: от разных студий озвучивания и субтитров. Выберите предпочтительный вариант в плеере при просмотре.",
      },
      {
        question: "Почему видео тормозит или не загружается?",
        answer:
          "Проверьте скорость интернет-соединения, попробуйте снизить качество воспроизведения или обновить страницу. Если проблема сохраняется, попробуйте другой браузер или очистите кэш.",
      },
    ],
  },
  {
    title: "Аккаунт и профиль",
    questions: [
      {
        question: "Как зарегистрироваться?",
        answer:
          "Нажмите кнопку «Регистрация» в верхней части сайта, введите email и пароль. После подтверждения вы получите доступ ко всем функциям аккаунта.",
      },
      {
        question: "Как восстановить пароль?",
        answer:
          "На странице входа нажмите «Забыли пароль?», введите ваш email. Мы отправим инструкцию по сбросу пароля.",
      },
      {
        question: "Как изменить имя пользователя или аватар?",
        answer:
          "Перейдите в раздел «Настройки» в личном кабинете. Там вы можете изменить имя пользователя и загрузить новый аватар.",
      },
    ],
  },
  {
    title: "Функции сайта",
    questions: [
      {
        question: "Как добавить аниме в закладки?",
        answer:
          "На странице аниме нажмите на иконку закладки. Вы можете добавлять аниме в разные списки: «Просмотрено», «Планирую», «Смотрю» и другие.",
      },
      {
        question: "Как работает история просмотра?",
        answer:
          "История автоматически сохраняется при просмотре. Вы можете вернуться к последней просмотренной серии через раздел «История». Данные хранятся 90 дней.",
      },
      {
        question: "Как получить персональные рекомендации?",
        answer:
          "Рекомендации формируются на основе вашей истории просмотра и закладок. Чем больше аниме вы смотрите и добавляете в избранное, тем точнее становятся рекомендации.",
      },
    ],
  },
  {
    title: "Гача и PvP",
    questions: [
      {
        question: "Как работает гача-система?",
        answer:
          "Гача-система — это механика получения персонажей через крутки. Вы тратите игровую валюту или реальные деньги на паки и получаете карты разной редкости: N, R, SR, SSR. Чем выше редкость, тем сильнее персонаж. Система пити гарантирует легендарный дроп после определённого количества круток.",
      },
      {
        question: "Как получить бесплатную гачу?",
        answer:
          "Новые игроки получают стартовый пакет с бесплатной круткой. Ежедневные бонусы также включают бесплатные крутки. Участвуйте в ивентах и PvP-битвах для получения дополнительной валюты.",
      },
      {
        question: "Как участвовать в PvP-арене?",
        answer:
          "Для участия в PvP-арене нужна авторизация. Соберите команду из 5 персонажей с балансом ролей (танки, дамагеры, саппорты). Сражайтесь с другими игроками, поднимайтесь в рейтинге и получайте награды. Чем выше ранг, тем больше валюты и эксклюзивных призов.",
      },
      {
        question: "Что такое синергия персонажей?",
        answer:
          "Синергия — это бонус, который активируется при использовании определённых персонажей вместе. Некоторые герои усиливают друг друга при совместном использовании в команде. Изучайте описания карт для максимальной эффективности.",
      },
      {
        question: "Как фармить игровую валюту?",
        answer:
          "Выполняйте ежедневные задания, участвуйте в PvP-битвах, входите каждый день для получения бонуса входа. Участвуйте в сезонных ивентах с увеличенными наградами. Чем выше ваш ранг в PvP, тем больше валюты вы получаете.",
      },
    ],
  },
  {
    title: "Технические вопросы",
    questions: [
      {
        question: "Какие браузеры поддерживаются?",
        answer:
          "Weeb.X работает во всех современных браузерах: Chrome, Firefox, Safari, Edge. Для лучшей производительности рекомендуем использовать последнюю версию браузера.",
      },
      {
        question: "Работает ли сайт на мобильных устройствах?",
        answer:
          "Да, сайт полностью адаптирован для мобильных устройств и планшетов. Интерфейс автоматически подстраивается под размер экрана.",
      },
      {
        question: "Что делать, если я нашёл ошибку?",
        answer:
          "Сообщите об ошибке через страницу «Контакты». Опишите проблему максимально подробно: браузер, устройство, шаги для воспроизведения.",
      },
    ],
  },
]

export default function FAQPage() {
  const faqItems = faqCategories.flatMap(category => 
    category.questions.map(q => ({ question: q.question, answer: q.answer }))
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FAQStructuredData items={faqItems} />
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
            <h1 className="text-3xl font-bold text-foreground">Часто задаваемые вопросы</h1>
          </div>
          <p className="text-muted-foreground">
            Найдите ответы на популярные вопросы о Weeb.X.
          </p>
        </div>

        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                {category.title}
              </h2>
              <div className="space-y-4">
                {category.questions.map((faq, faqIndex) => (
                  <div
                    key={faqIndex}
                    className="bg-card border border-border rounded-xl p-6"
                  >
                    <h3 className="text-lg font-medium text-foreground mb-3">
                      {faq.question}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Не нашли ответ на свой вопрос?
          </h3>
          <p className="text-muted-foreground mb-4">
            Посетите страницу{' '}
            <Link href="/help" className="text-primary hover:underline">
              «Помощь»
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
