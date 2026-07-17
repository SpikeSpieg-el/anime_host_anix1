"use client"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import {
  BookOpen,
  Users,
  Swords,
  History,
  Sparkles,
  Mail,
  Calendar,
  Lock,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  Gift,
  Star,
  Settings,
  Map,
} from "lucide-react"

interface Section {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  steps: { title: string; detail: string }[]
  tips?: string[]
  warnings?: string[]
}

const sections: Section[] = [
  {
    id: "login",
    title: "Вход в админку",
    icon: <Lock className="w-5 h-5" />,
    description: "Авторизация в панели администратора",
    steps: [
      { title: "Откройте /admin", detail: "Перейдите по адресу вашего сайта на страницу /admin" },
      { title: "Введите логин и пароль", detail: "Используются переменные окружения ADMIN_USERNAME и ADMIN_PASSWORD" },
      { title: "Войдите", detail: "После успешной авторизации вы увидите Dashboard с 6 вкладками" },
    ],
    warnings: [
      "Не делитесь логином и паролем с посторонними",
      "Кука admin_auth хранится в браузере — после выхода нужно войти заново",
    ],
  },
  {
    id: "users",
    title: "Users Management — Управление пользователями",
    icon: <Users className="w-5 h-5" />,
    description: "Просмотр всех пользователей, их истории просмотров, закладок и AI-статистики",
    steps: [
      { title: "Поиск пользователей", detail: "Используйте строку поиска для фильтрации по имени или ID" },
      { title: "View Details", detail: "Нажмите кнопку «View Details» у любого пользователя для раскрытия подробной информации" },
      { title: "Watch History", detail: "Просмотр истории просмотров аниме — последние 5 или все записи" },
      { title: "Bookmarks", detail: "Просмотр закладок пользователя — последние 5 или все записи" },
      { title: "AI Learning Statistics", detail: "Статистика PvP-битв: всего битв, агрессивный/оборонительный рейтинг, любимые карты, предпочитаемые роли и редкости, средний provision cost" },
    ],
    tips: [
      "Кнопка «Show All» показывает полную историю вместо последних 5 записей",
      "AI-статистика отображается только если пользователь участвовал в PvP-битвах",
    ],
  },
  {
    id: "pvp",
    title: "PvP Settings — Настройка PvP",
    icon: <Swords className="w-5 h-5" />,
    description: "Управление правилами (модификаторами) PvP и кастомными локациями",
    steps: [
      { title: "PvP Rules", detail: "Список всех правил-модификаторов с переключателем вкл/выкл. Каждое правило имеет название, описание и категорию" },
      { title: "Включить/выключить правило", detail: "Нажмите переключатель (toggle) в правом верхнем углу карточки правила" },
      { title: "Custom Locations", detail: "Нажмите «Add Location» для создания новой PvP-локации" },
      { title: "Создание локации", detail: "Заполните: Name (внутреннее), Name (рус), Description (внутреннее), Description (рус). Отметьте «Neutral Location» если не нужны правила, иначе выберите правила из списка активных" },
      { title: "Удаление локации", detail: "Наведите курсор на карточку локации и нажмите иконку корзины" },
    ],
    tips: [
      "Обычно на одну локацию назначается 1 правило",
      "Neutral Location — локация без правил (чистая арена)",
      "Только активные правила доступны для выбора при создании локации",
    ],
  },
  {
    id: "battle_logs",
    title: "Battle Logs — Логи PvP-битв",
    icon: <History className="w-5 h-5" />,
    description: "Просмотр истории PvP-битв между игроками",
    steps: [
      { title: "Откройте вкладку Battle Logs", detail: "Логи загружаются автоматически при переходе на вкладку" },
      { title: "Обновить логи", detail: "Нажмите кнопку обновления для повторной загрузки" },
      { title: "Просмотр результатов", detail: "Каждый лог содержит: имена игроков, MMR до/после, победителя, длительность битвы, колоды игроков" },
    ],
    tips: [
      "Логи загружаются последние 100 записей",
      "Если победитель null — битва закончилась ничьей или дисконнектом",
    ],
  },
  {
    id: "cards",
    title: "Карты — Редактор карт",
    icon: <Sparkles className="w-5 h-5" />,
    description: "Создание кастомных карт с 3D-слоями, статами и модификаторами",
    steps: [
      { title: "Откройте редактор", detail: "Нажмите «Открыть редактор карт» — перейдёте на /admin/card-editor" },
      { title: "Заполните基本信息", detail: "Имя персонажа, название аниме, URL изображения, редкость, рейтинг MAL, Shiki ID, Character ID" },
      { title: "Настройте характеристики", detail: "HP, ATK, DEF, SPD, LUCK — ползунки от 0 до 100" },
      { title: "Модификаторы", detail: "Выберите рамку (Frame) и покрытие (Coating) из выпадающих списков" },
      { title: "3D слои (опционально)", detail: "Заполните URL для Background, Character и VFX слоёв. Используйте PNG с прозрачностью" },
      { title: "Главный герой", detail: "Включите тумблер, чтобы добавить корону на карту" },
      { title: "Доставка карты", detail: "Внизу страницы есть 3 варианта доставки: подарок пользователю, добавление в баннер, установка как гаранта баннера" },
    ],
    tips: [
      "3D-слои работают только с PNG изображениями с прозрачным фоном",
      "Если указаны 3D-слои, основной URL изображения можно не заполнять — он подставится автоматически",
      "Character ID должен быть уникальным — используйте кнопку генерации",
    ],
    warnings: [
      "URL изображения должен быть прямым ссылкой на картинку (https://...)",
      "Для 3D-карт используйте только PNG с альфа-каналом",
    ],
  },
  {
    id: "mail",
    title: "Рассылка — Почта и подарки",
    icon: <Mail className="w-5 h-5" />,
    description: "Отправка писем, монет, пыли и карт пользователям",
    steps: [
      { title: "Выберите получателя", detail: "Из выпадающего списка выберите пользователя. Список загружается при первом открытии вкладки" },
      { title: "Выберите тип письма", detail: "Доступные типы: message (сообщение), card_gift (подарок карты), coins (монеты), dust (пыль), event_reward (награда события)" },
      { title: "Заполните заголовок и текст", detail: "Заголовок и текст письма видны пользователю в почтовом ящике" },
      { title: "Для coins/dust", detail: "Укажите количество валюты для начисления" },
      { title: "Для card_gift", detail: "Вставьте JSON объект карты в текстовое поле. JSON можно получить из редактора карт" },
      { title: "Отправить", detail: "Нажмите «Отправить» для одного пользователя или «Отправить всем» для массовой рассылки" },
    ],
    tips: [
      "Массовая рассылка отправляет письмо ВСЕМ пользователям в списке",
      "Для подарка карты проще создать её в редакторе карт и скопировать JSON оттуда",
      "Пользователи видят письма во вкладке «Inbox» на странице гача",
    ],
    warnings: [
      "Массовая рассылка необратима — убедитесь, что выбрали правильный тип и содержание",
      "JSON карты должен быть валидным — проверьте перед отправкой",
    ],
  },
  {
    id: "events",
    title: "События — Баннеры и гача",
    icon: <Calendar className="w-5 h-5" />,
    description: "Создание и управление гача-баннерами, добавление карт, настройка гаранта",
    steps: [
      { title: "Создать баннер", detail: "Нажмите «Создать баннер» и заполните форму: название, описание, URL изображения, featured anime IDs (через запятую), буст редкости, цена, цвет (Tailwind gradient), даты начала/окончания, сортировка, активен" },
      { title: "Редактировать баннер", detail: "Нажмите иконку карандаша на карточке баннера — раскроется форма редактирования" },
      { title: "Включить/выключить баннер", detail: "Используйте переключатель (toggle) на карточке баннера" },
      { title: "Удалить баннер", detail: "Нажмите иконку корзины — потребуется подтверждение" },
      { title: "Добавить карты в баннер", detail: "Нажмите «Карты баннера» для раскрытия секции карт. Вставьте JSON карты, укажите вес (weight) и featured-статус, нажмите «Добавить карту»" },
      { title: "Редактировать карту баннера", detail: "Измените вес или featured-чекбокс прямо в списке карт, затем нажмите иконку карандаша для сохранения" },
      { title: "Удалить карту из баннера", detail: "Нажмите иконку корзины рядом с картой" },
      { title: "Гарантированная карта (гарант)", detail: "При создании или редактировании баннера в секции «Гарантированная карта» вставьте JSON карты и укажите pity (количество круток до гаранта, например 77). 0 = выключено" },
    ],
    tips: [
      "Featured anime IDs — это ID аниме с Shikimori (например: 1, 21, 5114)",
      "Цвет — Tailwind CSS gradient класс (например: from-purple-600 to-pink-700)",
      "Sort order определяет порядок отображения баннеров на странице гача",
      "Баннер виден игрокам только если is_active=true и дата начала прошла, а дата окончания не наступила (или не указана)",
      "Вес карты (weight) определяет вероятность выпадения — чем выше, тем чаще выпадает",
      "Featured-карты помечаются особым значком в баннере",
      "Гарант-карта выпадает игроку гарантированно после N круток этого баннера. Каждый игрок имеет свой счётчик круток (таблица user_banner_pulls)",
      "Альтернативный способ установки гаранта: через Card Editor → «Установить как гарант баннера»",
    ],
    warnings: [
      "Удаление баннера удаляет все связанные карты и счётчики круток",
      "Изменение pity не сбрасывает уже существующие счётчики игроков",
      "Если у баннера есть и карты (banner_cards), и featured anime IDs, приоритет отдаётся картам",
    ],
  },
  {
    id: "card-editor-delivery",
    title: "Card Editor — Доставка карты (3 способа)",
    icon: <Gift className="w-5 h-5" />,
    description: "Как отправить созданную карту игрокам: подарок, баннер или гарант",
    steps: [
      { title: "1. Подарок пользователю", detail: "В секции «Подарить пользователю» выберите пользователя из списка и нажмите «Подарить пользователю». Карта придёт в почтовый ящик игрока" },
      { title: "2. Добавить в баннер", detail: "В секции «Добавить в баннер» выберите баннер, укажите featured-статус и нажмите «Добавить в баннер». Карта добавится в пул карт баннера с весом 1 (можно изменить позже в настройках баннера)" },
      { title: "3. Установить как гарант", detail: "В секции «Установить как гарант баннера» выберите баннер, укажите pity (по умолчанию 77) и нажмите кнопку. Карта станет гарантированной для этого баннера — игрок получит её после N круток" },
    ],
    tips: [
      "Можно использовать несколько способов одновременно: добавить карту в пул баннера И установить как гарант",
      "При добавлении в баннер через Card Editor вес = 1. Измените вес в разделе Events → Карты баннера",
      "Гарант и пул карт работают независимо: гарант срабатывает по pity, а пул — по весам при каждой крутке",
    ],
  },
  {
    id: "workflow-example",
    title: "Пример: Создание кастомной карты с гарантом 77",
    icon: <Lightbulb className="w-5 h-5" />,
    description: "Полный сценарий от создания карты до настройки гаранта",
    steps: [
      { title: "Шаг 1: Создайте баннер", detail: "Перейдите в Events → «Создать баннер». Заполните название, описание, цену, даты. Оставьте секцию гаранта пустой — заполним позже через Card Editor. Нажмите «Создать баннер»" },
      { title: "Шаг 2: Откройте Card Editor", detail: "Перейдите в Карты → «Открыть редактор карт»" },
      { title: "Шаг 3: Создайте карту", detail: "Заполните имя, аниме, URL картинки, выберите редкость, настройте статы (HP/ATK/DEF/SPD/LUCK), добавьте рамку/покрытие по желанию" },
      { title: "Шаг 4: Добавьте карту в пул баннера", detail: "В секции «Добавить в баннер» выберите созданный баннер, отметьте featured если нужно, нажмите «Добавить в баннер»" },
      { title: "Шаг 5: Установите гарант", detail: "В секции «Установить как гарант баннера» выберите тот же баннер, убедитесь что pity = 77, нажмите «Установить гарант (pity: 77)»" },
      { title: "Шаг 6: Проверьте", detail: "Вернитесь в Events → найдите баннер. Вы увидите бейдж «Гарант-карта: [имя] (через 77 круток)». Раскройте «Карты баннера» — там будет ваша карта" },
      { title: "Шаг 7: Тест", detail: "Откройте страницу гача (/gacha), выберите баннер, крутите 77 раз — на 77-й крутке выпадет гарантированная карта" },
    ],
    tips: [
      "Вес карты в пуле определяет шанс выпадения ДО срабатывания гаранта",
      "Гарант срабатывает один раз — после получения счётчик сбрасывается (guaranteed_claimed = true)",
      "Если игрок уже получил гаранта, при следующих крутках он получает карты из пула по весам",
    ],
  },
]

export default function AdminTutorialPage() {
  const [expandedId, setExpandedId] = useState<string | null>("login")

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <ScrollToTop />
      <Footer />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 lg:pt-28 pb-20">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition mb-4"
          >
            <ArrowLeft size={16} />
            Назад в админку
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Туториал админ-панели</h1>
              <p className="text-slate-400 mt-1">Полное руководство по всем разделам админки Weeb-X</p>
            </div>
          </div>

          {/* Quick nav */}
          <div className="flex flex-wrap gap-2 mt-6">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setExpandedId(s.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
              >
                {s.icon}
                {s.title.split("—")[0].trim()}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section) => {
            const isExpanded = expandedId === section.id
            return (
              <div
                key={section.id}
                id={section.id}
                className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden scroll-mt-24"
              >
                {/* Section header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 flex-shrink-0">
                      {section.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate">{section.title}</h2>
                      <p className="text-sm text-slate-400 truncate">{section.description}</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {/* Section content */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Steps */}
                    <div className="space-y-3">
                      {section.steps.map((step, i) => (
                        <div
                          key={i}
                          className="flex gap-3 p-3 bg-slate-950/50 rounded-xl border border-white/5"
                        >
                          <div className="flex-shrink-0 w-7 h-7 bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-black text-indigo-400">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{step.title}</p>
                            <p className="text-sm text-slate-400 mt-0.5">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tips */}
                    {section.tips && section.tips.length > 0 && (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                          <Lightbulb className="w-4 h-4" />
                          Советы
                        </div>
                        {section.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-emerald-300/80">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {section.warnings && section.warnings.length > 0 && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          Внимание
                        </div>
                        {section.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-amber-300/80">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="mt-10 p-6 bg-slate-900/30 border border-white/5 rounded-2xl text-center">
          <p className="text-sm text-slate-400">
            Туториал покрывает все 6 вкладок админ-панели: Users, PvP, Battle Logs, Карты, Рассылка, События.
            <br />
            Для дополнительной информации смотрите код в <code className="text-indigo-400">app/admin/</code>.
          </p>
        </div>
      </main>
    </div>
  )
}
