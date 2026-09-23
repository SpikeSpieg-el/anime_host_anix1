"use client"

import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

interface SocialLinkButtonProps {
  platform: string
  href: string
  icon: React.ReactNode
  label: string
  location: string
  hoverColor: string
}

/**
 * Внешняя ссылка на соцсеть с клик-аналитикой.
 * Вынесен в Client Component: Server Component не может рендерить onClick
 * (иначе `next build` падает на prerender c "Event handlers cannot be
 * passed to Client Component props").
 */
export function SocialLinkButton({
  platform,
  href,
  icon,
  label,
  location,
  hoverColor,
}: SocialLinkButtonProps) {
  const handleClick = () => {
    trackEvent(AnalyticsEvent.SOCIAL_CLICK, { platform, location })
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-background/50 transition-colors ${hoverColor}`}
      onClick={handleClick}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </a>
  )
}
