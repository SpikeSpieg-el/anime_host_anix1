import Link from "next/link"
import { cn } from "@/lib/utils"
import { safeSerializeJson } from "@/lib/seo/safe-json"
import { BackButton } from "@/components/shared/back-button"

const SITE_URL = "https://weeb-x.com"

export interface PageCrumb {
  label: string
  /** undefined — последняя крошка (текущая страница), она не ссылка. */
  href?: string
}

interface PageBreadcrumbsProps {
  items: PageCrumb[]
  /** Кнопка «Назад» перед крошками. По умолчанию включена. */
  back?: boolean
  /** Куда ведёт «Назад», если история браузера пуста. */
  backFallback?: string
  className?: string
}

/**
 * Хлебные крошки + кнопка «Назад» для страниц второго уровня.
 *
 * Раньше крошки были руками написаны в двух местах (app/genre/*), а кнопка
 * «Назад» — в четырёх, и каждый раз чуть по-своему. Здесь один компонент,
 * который рендерится и как серверный, и внутри клиентских страниц: в нём нет
 * ни директивы "use client", ни серверных API.
 *
 * Заодно отдаёт разметку BreadcrumbList — Google рисует в выдаче путь
 * «Главная / Каталог / …» вместо голого URL.
 */
export function PageBreadcrumbs({
  items,
  back = true,
  backFallback = "/",
  className,
}: PageBreadcrumbsProps) {
  if (!items.length) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeSerializeJson(jsonLd) }}
      />

      {/*
            min-w-0 обязателен на корне. Компонент часто стоит flex-элементом
            в тулбаре вида `justify-between` (например на /watch), а у flex-элемента
            min-width: auto — то есть он не сжимается уже своего контента и
            выпирает за родителя. С min-w-0 блок ужимается, дальше срабатывают
            min-w-0/flex-1 у <nav> и truncate у последней крошки.
          */}
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
        {back && <BackButton fallbackHref={backFallback} className="shrink-0" />}
        {back && (
          <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block dark:bg-white/10" />
        )}

        <nav aria-label="Хлебные крошки" className="min-w-0 flex-1">
          {/*
            nowrap + truncate, а не flex-wrap.
            На телефоне длинное название («Перерождение в аристократа со
            способностью анализа 3») переносило крошки на вторую строку, а
            кнопку «Назад» flex-wrap отбрасывал на отдельную: три строки
            служебной разметки вместо одной. Теперь последний элемент
            сжимается и обрезается многоточием, остальные — фиксированной ширины.
          */}
          <ol className="flex items-center gap-1.5 overflow-hidden text-xs text-muted-foreground dark:text-zinc-500">
            {items.map((item, index) => {
              const isLast = index === items.length - 1
              return (
                <li
                  key={item.href ?? item.label}
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast ? "min-w-0 flex-1" : "shrink-0",
                  )}
                >
                  {index > 0 && (
                    <span aria-hidden className="shrink-0 text-border dark:text-zinc-700">
                      /
                    </span>
                  )}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="shrink-0 transition-colors hover:text-primary dark:hover:text-orange-400"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      // title показывает полное название, когда текст обрезан:
                      // на десктопе хвост виден целиком, на телефоне — нет.
                      title={isLast ? item.label : undefined}
                      className={cn(
                        isLast &&
                          "truncate font-medium text-foreground dark:text-zinc-300",
                      )}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      </div>
    </>
  )
}