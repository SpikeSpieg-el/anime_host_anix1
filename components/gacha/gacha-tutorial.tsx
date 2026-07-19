"use client"

import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import type { LucideIcon } from "lucide-react"
import { Sparkles, Package, Search, Coins, Star, Swords, Heart, ArrowRight, ArrowLeft, X, Database, Check, MousePointerClick, ShoppingCart, Tag, TrendingUp, Users, Shield, Zap, Target, Crown, Dumbbell, Info } from "lucide-react"

export interface GachaTutorialState {
  isRolling: boolean
  showCard: boolean
  revealedCard: unknown
  collectedCardsCount: number
}

export type TutorialType = "gacha" | "marketplace" | "battle"

type TutorialAccent = "pink" | "amber" | "indigo" | "red"

export interface TutorialStep {
  selector: string
  title: string
  message: string
  icon: LucideIcon
  accent: TutorialAccent
  details?: string[]
  highlightPadding?: number
  isIntro?: boolean
  requireClick?: boolean
  clickHint?: string
  waitForState?: (state: GachaTutorialState) => boolean
  isWaiting?: boolean
}

const GACHA_TUTORIAL_STEPS: TutorialStep[] = [
  {
    selector: "",
    isIntro: true,
    title: "Добро пожаловать в Гачу",
    message: "Ня~ Здесь ты призываешь персонажей, собираешь коллекцию и создаёшь команду для битв. Я проведу тебя через первую крутку — это займёт всего минутку, мяу!",
    icon: Heart,
    accent: "pink",
    details: ["Получи первую карту", "Разберись с валютами", "Узнай, где наборы и коллекция"],
  },
  {
    selector: "",
    isIntro: true,
    title: "Как проходит обучение",
    message: "Я буду подсвечивать нужные элементы лапкой, ня~ На шагах с действием нажимай прямо на выделенную область, а остальные листай кнопками.",
    icon: MousePointerClick,
    accent: "indigo",
    details: ["На телефоне подсказка закреплена снизу", "Прогресс сохранится после завершения", "Обучение можно пропустить в любой момент"],
  },
  {
    selector: "[data-tutorial='coins']",
    title: "Монеты",
    message: "Монетки нужны для призывов, мяу! Обычная крутка стоит 50 монет, а у тематических наборов может быть своя цена.",
    icon: Coins,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='dust']",
    title: "Пыль",
    message: "Пыль выдаётся за распыление ненужных карт, ня~ Чем выше редкость карты, тем больше ценной пыльцы ты получишь.",
    icon: Sparkles,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='roll-button']",
    title: "Сделай первый призыв",
    message: "Нажми лапкой на выделенную карту призыва, ня! Система выберет случайного персонажа и покажет его редкость и характеристики.",
    icon: Sparkles,
    accent: "indigo",
    highlightPadding: 12,
    requireClick: true,
    clickHint: "Нажми на область призыва",
  },
  {
    selector: "",
    title: "Идёт призыв",
    message: "Барабан судьбы уже крутится, мяу~ Дождись завершения анимации — следующий шаг откроется автоматически.",
    icon: Sparkles,
    accent: "indigo",
    isWaiting: true,
    waitForState: (state) => !state.isRolling,
  },
  {
    selector: "[data-tutorial='save-card']",
    title: "Добавь карту в коллекцию",
    message: "Сохрани персонажа, чтобы использовать его в коллекции и битвах, ня! Отброшенная карта не будет добавлена.",
    icon: Database,
    accent: "indigo",
    highlightPadding: 12,
    requireClick: true,
    clickHint: "Нажми «Сохранить»",
    waitForState: (state) => !state.showCard,
  },
  {
    selector: "[data-tutorial='collection']",
    title: "Твоя коллекция",
    message: "Все сохранённые карты лежат здесь, мяу~ Открой любую, чтобы рассмотреть её, изменить оформление или распылить.",
    icon: Star,
    accent: "amber",
    highlightPadding: 12,
  },
  {
    selector: "[data-tutorial='select-pack']",
    title: "Тематические наборы",
    message: "Хочешь героев из определённого аниме, ня? Выбери готовый тематический набор — открыть список можно после обучения.",
    icon: Package,
    accent: "indigo",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='create-pack']",
    title: "Собственный набор",
    message: "Не нашёл нужное аниме, мяу? Создай персональный набор через поиск и призывай персонажей из выбранного тайтла.",
    icon: Search,
    accent: "pink",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='filters']",
    title: "Поиск и фильтры",
    message: "Сортируй коллекцию по имени, редкости и характеристикам — так нужная карта найдётся быстрее кошачьего прыжка, ня~",
    icon: Search,
    accent: "indigo",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='nav-battle']",
    title: "Готово — можно в бой",
    message: "Команда собрана — пора показать коготки, ня! Переходи в битвы: там карты раскрывают роли, силу и особые преимущества.",
    icon: Swords,
    accent: "red",
    details: ["Собирай сильные сочетания", "Следи за стоимостью колоды", "Побеждай и получай награды"],
    highlightPadding: 10,
  },
]

const MARKETPLACE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    selector: "",
    isIntro: true,
    title: "Добро пожаловать на Маркет карт",
    message: "Ня~ Здесь ты можешь покупать редких персонажей у других игроков и продавать свои ненужные карты! Давай разберёмся, как это работает.",
    icon: ShoppingCart,
    accent: "amber",
    details: ["Узнай, как покупать карты", "Разберись с фильтрами поиска", "Научись продавать свои карты"],
  },
  {
    selector: "",
    isIntro: true,
    title: "Как проходит обучение",
    message: "Я буду подсвечивать нужные элементы лапкой, ня~ Просто листай шаги кнопками и изучай интерфейс маркета!",
    icon: MousePointerClick,
    accent: "indigo",
    details: ["Подсказка закреплена снизу на телефоне", "Обучение можно пропустить", "Прогресс сохранится после завершения"],
  },
  {
    selector: "[data-tutorial='market-listings']",
    title: "Витрина карт",
    message: "Здесь показаны все карты, которые игроки выставили на продажу, ня~ Нажми на любую карточку, чтобы увидеть подробности и купить.",
    icon: Tag,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='market-filters']",
    title: "Фильтры поиска",
    message: "Используй фильтры, чтобы найти нужную карту, мяу! Можно искать по имени, редкости, цене, силе и другим критериям.",
    icon: Search,
    accent: "indigo",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='market-card']",
    title: "Карта на продаже",
    message: "Каждая карточка показывает редкость, цену и характеристики персонажа, ня~ Нажми на карту, чтобы открыть окно с деталями.",
    icon: Tag,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='market-buy-button']",
    title: "Кнопка покупки",
    message: "Когда найдёшь нужную карту, нажми «Купить», ня~ Откроется окно с подтверждением покупки и списанием монет с твоего баланса.",
    icon: ShoppingCart,
    accent: "indigo",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='market-mine-tab']",
    title: "Вкладка «Мои лоты»",
    message: "Перейди сюда, чтобы увидеть свои выставленные на продажу карты, ня~ Можно снять карту с продажи в любой момент.",
    icon: TrendingUp,
    accent: "pink",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='market-your-listings']",
    title: "Твои активные продажи",
    message: "Здесь ты видишь все свои выставленные карты, мяу! Нажми «Снять», чтобы убрать карту с продажи — она вернётся в коллекцию.",
    icon: Users,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "",
    title: "Как продать карту",
    message: "Чтобы продать карту, вернись в коллекцию на вкладке «Гача», открой карту и нажми «Продать на маркете», ня~ Система подскажет минимальную и максимальную цену.",
    icon: TrendingUp,
    accent: "pink",
    details: ["Открой карту в коллекции", "Нажми «Продать на маркете»", "Установи цену в пределах лимитов"],
  },
  {
    selector: "",
    title: "Советы по торговле",
    message: "Ня~ Вот несколько советов: следи за спросом, выставляй справедливые цены и не продавай карты, которые нужны в команде для битв!",
    icon: TrendingUp,
    accent: "pink",
    details: ["Изучай рыночные цены", "Продавай дубликаты", "Покупай выгодно"],
  },
  {
    selector: "",
    title: "Обучение завершено",
    message: "Отлично, мяу! Теперь ты знаешь, как работает маркет карт. Покупай и продавай персонажей, чтобы собрать лучшую коллекцию!",
    icon: Check,
    accent: "indigo",
    details: ["Маркет изучен", "Готов к торговле", "Удачи в сделках!"],
  },
]

const BATTLE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    selector: "",
    isIntro: true,
    title: "Добро пожаловать на Арену",
    message: "Ня~ Здесь твои карты сражаются в тактических дуэлях! Собери колоду, выбери формацию и побеждай на трёх линиях боя.",
    icon: Swords,
    accent: "red",
    details: ["Узнай, как собрать колоду", "Разберись с весом и формацией", "Пойми, как начать бой"],
  },
  {
    selector: "",
    isIntro: true,
    title: "Как проходит обучение",
    message: "Я буду подсвечивать нужные элементы лапкой, ня~ Просто листай шаги кнопками и изучай интерфейс арены!",
    icon: MousePointerClick,
    accent: "indigo",
    details: ["Подсказка закреплена снизу на телефоне", "Обучение можно пропустить", "Прогресс сохранится после завершения"],
  },
  {
    selector: "[data-tutorial='battle-stats']",
    title: "Твои показатели",
    message: "Здесь виден твой уровень, опыт, монеты, пыль и энергия, ня~ Энергия тратится на каждый бой и восстанавливается со временем.",
    icon: Crown,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='battle-deck']",
    title: "Твоя колода",
    message: "Для боя нужно собрать колоду из 6 карт, ня~ Нажми на пустой слот или кнопку «Изменить состав», чтобы выбрать персонажей.",
    icon: Shield,
    accent: "indigo",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='battle-provision']",
    title: "Вес колоды",
    message: "У каждой карты есть вес в зависимости от редкости, ня~ Суммарный вес не должен превышать 30 очков. Сильные карты весят больше!",
    icon: Dumbbell,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='battle-formation']",
    title: "Формация",
    message: "Выбери формацию, чтобы усилить определённые роли карт, ня~ Каждая формация даёт бонус разным типам персонажей.",
    icon: Zap,
    accent: "indigo",
    highlightPadding: 8,
  },
  {
    selector: "[data-tutorial='battle-power']",
    title: "Сила колоды",
    message: "Здесь показана общая сила твоей колоды, ня~ Она зависит от статов карт, синергий, ауры лидера и формации. Чем выше — тем лучше!",
    icon: Zap,
    accent: "amber",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='battle-start']",
    title: "Кнопка начала боя",
    message: "Когда колода собрана и локация выбрана, нажми «Вступить в дуэль», ня~ Если кнопка неактивна — проверь вес колоды и энергию.",
    icon: Swords,
    accent: "red",
    highlightPadding: 10,
  },
  {
    selector: "[data-tutorial='battle-location']",
    title: "Выбор локации",
    message: "Нажми сюда, чтобы выбрать локацию для боя, ня~ Разные локации имеют разную сложность и награды. Начни с лёгких!",
    icon: Target,
    accent: "indigo",
    highlightPadding: 10,
  },
  {
    selector: "",
    title: "Как проходит бой",
    message: "Бой длится 3 раунда на 3 линиях, ня~ Каждый раунд ты выставляешь 2 карты: одну открыто, другую вслепую. После раскрытия применяются модификаторы и КНБ-бонусы!",
    icon: Info,
    accent: "indigo",
    details: ["3 раунда, 3 линии", "1 карта открыто, 1 вслепую", "Побеждай на 2 из 3 линий"],
  },
  {
    selector: "",
    title: "КНБ-роли карт",
    message: "У каждой карты есть роль, ня~ Авангард бьёт Плутов, Страж бьёт Авангардов, а Плут бьёт Стражей. Используй это для преимущества!",
    icon: Swords,
    accent: "red",
    details: ["Авангард → Плут (+50%)", "Страж → Авангард (+50%)", "Плут → Страж (+50%)"],
  },
  {
    selector: "",
    title: "Обучение завершено",
    message: "Отлично, мяу! Теперь ты знаешь, как работает арена. Собирай сильную колоду, используй КНБ-роли и побеждай!",
    icon: Check,
    accent: "indigo",
    details: ["Арена изучена", "Готов к дуэлям", "Удачи в битвах!"],
  },
]

// === Typewriter hook ===
function useTypewriter(text: string, speed = 22) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    if (timerRef.current) clearTimeout(timerRef.current)

    const tick = () => {
      if (indexRef.current >= text.length) {
        setDone(true)
        return
      }
      indexRef.current++
      setDisplayed(text.slice(0, indexRef.current))
      timerRef.current = setTimeout(tick, speed)
    }
    timerRef.current = setTimeout(tick, speed)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, speed])

  const skip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDisplayed(text)
    setDone(true)
    indexRef.current = text.length
  }, [text])

  return { displayed, done, skip }
}

const TypewriterText = ({ text, className, speed = 22 }: { text: string; className?: string; speed?: number }) => {
  const { displayed, done, skip } = useTypewriter(text, speed)
  return (
    <span className={className} onClick={done ? undefined : skip} style={{ cursor: done ? "default" : "pointer" }}>
      {displayed}
      {!done && (
        <span
          className="inline-block w-[2px] ml-0.5 align-middle"
          style={{
            height: "1.1em",
            background: "currentColor",
            animation: "blink-cursor 0.8s step-end infinite",
          }}
        />
      )}
    </span>
  )
}

export function GachaTutorial({ onComplete, gachaState, tutorialType = "gacha" }: { onComplete: () => void; gachaState?: GachaTutorialState; tutorialType?: TutorialType }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: "top" | "bottom" }>({ top: 0, left: 0, placement: "bottom" })
  const overlayRef = useRef<HTMLDivElement>(null)
  const tutorialPanelRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number | null>(null)
  const observedRollingRef = useRef(false)

  const tutorialSteps = tutorialType === "marketplace" ? MARKETPLACE_TUTORIAL_STEPS : tutorialType === "battle" ? BATTLE_TUTORIAL_STEPS : GACHA_TUTORIAL_STEPS
  const step = tutorialSteps[currentStep]
  const isLastStep = currentStep === tutorialSteps.length - 1
  const StepIcon = step.icon
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  const getTutorialTarget = useCallback(() => {
    if (!step.selector) return null
    const elements = Array.from(document.querySelectorAll<HTMLElement>(step.selector))
    return elements.find((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
    }) ?? null
  }, [step.selector])

  const mobilePanelAtTop = isMobile && step.selector === "[data-tutorial='nav-battle']"

  const scrollToTutorialTarget = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = getTutorialTarget()
    if (!element) return

    const mobile = window.innerWidth < 640
    const rect = element.getBoundingClientRect()
    const panelRect = tutorialPanelRef.current?.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const edgeGap = 20
    const topSafeArea = 68

    if (!mobile) {
      const isVisible = rect.top >= topSafeArea && rect.bottom <= viewportHeight - edgeGap
      if (!isVisible) element.scrollIntoView({ behavior, block: "center", inline: "center" })
      return
    }

    const panelOnTop = step.selector === "[data-tutorial='nav-battle']"
    const visibleTop = panelOnTop ? (panelRect?.bottom ?? viewportHeight * 0.48) + edgeGap : topSafeArea
    const visibleBottom = panelOnTop ? viewportHeight - edgeGap : (panelRect?.top ?? viewportHeight * 0.48) - edgeGap
    const visibleHeight = Math.max(80, visibleBottom - visibleTop)
    const desiredTop = rect.height >= visibleHeight
      ? visibleTop
      : visibleTop + (visibleHeight - rect.height) / 2
    const delta = rect.top - desiredTop

    if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior })
  }, [getTutorialTarget, step.selector])

  const updateHighlight = useCallback(() => {
    const mobile = window.innerWidth < 640
    setIsMobile(mobile)

    const element = getTutorialTarget()
    if (!element) {
      setHighlightRect(null)
      setTooltipPos({ top: window.innerHeight / 2, left: window.innerWidth / 2, placement: "bottom" })
      return
    }

    const rect = element.getBoundingClientRect()
    const padding = step.highlightPadding ?? 10
    const highlightedRect = new DOMRect(
      Math.max(6, rect.x - padding),
      Math.max(6, rect.y - padding),
      Math.min(rect.width + padding * 2, window.innerWidth - 12),
      Math.min(rect.height + padding * 2, window.innerHeight - 12),
    )
    setHighlightRect(highlightedRect)

    // Calculate tooltip position
    if (mobile) return
    const tooltipWidth = 380
    const tooltipHeight = 310
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 18

    let placement: "top" | "bottom" = "bottom"
    let top = rect.bottom + padding + gap
    let left = rect.left + rect.width / 2 - tooltipWidth / 2

    // If not enough space below, try above
    if (top + tooltipHeight > viewportHeight - 16) {
      placement = "top"
      top = rect.top - padding - tooltipHeight - gap
    }

    // If not enough space above either, try right side
    if (top < 16) {
      top = Math.max(16, Math.min(rect.bottom + gap, viewportHeight - tooltipHeight - 16))
      placement = "bottom"
    }

    // If not enough space on right, try left
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16
    }

    // Clamp to viewport
    left = Math.max(16, left)
    top = Math.max(16, Math.min(top, viewportHeight - tooltipHeight - 16))
    setTooltipPos({ top, left, placement })
  }, [getTutorialTarget, step.highlightPadding])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => scrollToTutorialTarget("smooth"))
    const highlightTimer = window.setTimeout(updateHighlight, 450)
    const correctionTimer = window.setTimeout(() => {
      scrollToTutorialTarget("smooth")
      updateHighlight()
    }, 700)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(highlightTimer)
      window.clearTimeout(correctionTimer)
    }
  }, [currentStep, scrollToTutorialTarget, updateHighlight])

  useEffect(() => {
    const handleResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(updateHighlight)
    }

    updateHighlight()
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleResize, true)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleResize, true)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [currentStep, updateHighlight])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep((previous) => previous + 1)
    }
  }, [isLastStep, onComplete])

  const handleBack = useCallback(() => {
    setCurrentStep((previous) => Math.max(0, previous - 1))
  }, [])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handleSkipAction = () => {
    if (currentStep === 4) {
      setCurrentStep(7)
      return
    }
    handleNext()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleSkip()
      if (event.key === "ArrowLeft" && currentStep > 0 && !step.isWaiting) handleBack()
      if (event.key === "ArrowRight" && !step.requireClick && !step.isWaiting) handleNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentStep, handleBack, handleNext, handleSkip, step.isWaiting, step.requireClick])

  // Auto-advance when waitForState condition is met
  useEffect(() => {
    if (!step.waitForState || !gachaState) return
    if (step.isWaiting && gachaState.isRolling) {
      observedRollingRef.current = true
      return
    }
    if (step.isWaiting && !observedRollingRef.current) return
    if (!step.waitForState(gachaState)) return

    const timer = window.setTimeout(handleNext, 500)
    return () => window.clearTimeout(timer)
  }, [gachaState, handleNext, step])

  useEffect(() => {
    observedRollingRef.current = false
  }, [currentStep])

  // Cat-girl mascot using PNG image
  const CatGirlMascot = ({ size = 80, className = "" }: { size?: number; className?: string }) => (
    <Image
      src="/catgirl_tutorial.webp"
      alt="Кошкодевочка-проводник"
      width={size}
      height={size}
      priority
      className={`pointer-events-none select-none object-contain drop-shadow-2xl ${className}`}
      style={{ width: size, height: size }}
    />
  )

  const tooltipArrow = () => {
    if (tooltipPos.placement === "bottom") return "-top-2 left-1/2 -translate-x-1/2 rotate-45 border-l border-t border-white/10"
    return "-bottom-2 left-1/2 -translate-x-1/2 rotate-45 border-b border-r border-white/10"
  }

  const accentStyles: Record<TutorialAccent, { icon: string; glow: string; ring: string }> = {
    pink: { icon: "text-pink-300", glow: "from-pink-500 to-fuchsia-500", ring: "border-pink-400 shadow-pink-500/30" },
    amber: { icon: "text-amber-300", glow: "from-amber-400 to-orange-500", ring: "border-amber-400 shadow-amber-500/30" },
    indigo: { icon: "text-indigo-300", glow: "from-indigo-400 to-violet-500", ring: "border-indigo-400 shadow-indigo-500/30" },
    red: { icon: "text-rose-300", glow: "from-rose-500 to-red-500", ring: "border-rose-400 shadow-rose-500/30" },
  }
  const accent = accentStyles[step.accent]
  const isIntroStep = step.isIntro === true

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" ref={overlayRef}>
      {/* Dark overlay with spotlight cutout (only for non-intro, non-waiting steps) */}
      {!isIntroStep && !step.isWaiting && (
        <svg className="absolute inset-0 size-full pointer-events-auto" aria-hidden="true">
          <defs>
            <mask id="tutorial-spotlight">
              <rect width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect x={highlightRect.x} y={highlightRect.y} width={highlightRect.width} height={highlightRect.height} rx="18" fill="black" />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(2, 6, 23, 0.82)" mask="url(#tutorial-spotlight)" />
        </svg>
      )}

      {/* Full dark overlay for intro steps */}
      {isIntroStep && (
        <div className="absolute inset-0 pointer-events-auto bg-slate-950/88 backdrop-blur-md" />
      )}

      {/* Highlight border ring */}
      {highlightRect && !isIntroStep && (
        <div
          className={`absolute rounded-[18px] border-2 shadow-[0_0_0_4px_rgba(255,255,255,0.06),0_0_32px_currentColor] transition-all duration-300 ${accent.ring}`}
          style={{ top: highlightRect.y, left: highlightRect.x, width: highlightRect.width, height: highlightRect.height }}
        >
          {/* Pulsing glow */}
          <div className="absolute inset-0 rounded-[16px] border border-white/60 motion-safe:animate-pulse" />
        </div>
      )}

      {/* Click-through interceptor for requireClick steps */}
      {highlightRect && !isIntroStep && step.requireClick && (
        <button
          type="button"
          aria-label={step.clickHint}
          className="absolute z-10 pointer-events-auto cursor-pointer rounded-[18px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
          style={{ top: highlightRect.y, left: highlightRect.x, width: highlightRect.width, height: highlightRect.height }}
          onClick={(event) => {
            event.stopPropagation()
            const element = getTutorialTarget()
            if (!element || element.matches(":disabled, [aria-disabled='true']")) return
            element.click()
            handleNext()
          }}
        >
          {/* Pulsing "click here" indicator */}
          <span className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r ${accent.glow} px-3 py-2 text-xs font-black text-white shadow-xl motion-safe:animate-bounce`}>
            <MousePointerClick className="size-3.5" />
            Нажми здесь
          </span>
        </button>
      )}

      {/* === INTRO WELCOME MODAL === */}
      {isIntroStep && (
        <div className="absolute inset-0 flex items-end justify-center p-0 pointer-events-auto sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gacha-tutorial-title"
            className="relative max-h-[calc(100dvh-12px)] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:max-w-2xl sm:rounded-[32px] sm:bg-slate-950/92 sm:zoom-in-95"
          >
            {/* Decorative top bar */}
            <div className={`h-1.5 bg-gradient-to-r ${accent.glow}`} />

            {/* Floating decorative sparkles */}
            <div className="absolute inset-x-0 top-0 h-40 overflow-hidden opacity-50" aria-hidden="true">
              <div className="absolute -left-16 -top-20 size-52 rounded-full bg-pink-500/25 blur-3xl" />
              <div className="absolute -right-16 -top-16 size-52 rounded-full bg-indigo-500/25 blur-3xl" />
            </div>

            <div className="relative grid gap-5 p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:grid-cols-[180px_1fr] sm:gap-7 sm:p-8">
              {/* Mascot image prominently displayed */}
              <div className="mx-auto flex size-28 items-end justify-center rounded-full bg-gradient-to-b from-white/10 to-transparent sm:size-44 sm:self-center">
                <CatGirlMascot size={isMobile ? 120 : 180} className="motion-safe:animate-[float_3s_ease-in-out_infinite]" />
              </div>

              <div className="min-w-0">
                {/* Title and message */}
                <div className="text-center sm:text-left">
                  <div className="mb-3 flex items-center justify-center gap-2 sm:justify-start">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 ${accent.icon}`}>
                      <StepIcon className="size-5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Кошкодевочка-проводник</span>
                  </div>
                  <h2 id="gacha-tutorial-title" className="text-balance text-2xl font-black tracking-tight text-white sm:text-3xl">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base"><TypewriterText text={step.message} /></p>
                </div>

                {step.details && (
                  <div className="mt-4 grid gap-2 sm:mt-5">
                    {step.details.map((detail) => (
                      <div key={detail} className="flex items-center gap-2.5 text-sm text-slate-200">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><Check className="size-3" /></span>
                        {detail}
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress dots */}
                <div className="mt-5" aria-label={`Шаг ${currentStep + 1} из ${tutorialSteps.length}`}>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Шаг {currentStep + 1}</span>
                    <span>{tutorialSteps.length}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${accent.glow} transition-[width] duration-500`} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Buttons */}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={handleSkip} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                    Пропустить обучение
                  </button>
                  <div className="flex gap-2">
                    {currentStep > 0 && (
                      <button type="button" onClick={handleBack} aria-label="Предыдущий шаг" className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                        <ArrowLeft className="size-4" />
                      </button>
                    )}
                    <button type="button" onClick={handleNext} className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${accent.glow} px-6 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}>
                      {currentStep === 0 ? "Начать" : "Далее"} <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* === WAITING STEP (floating banner, no overlay) === */}
      {step.isWaiting && (
        <div className="absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-30 mx-auto max-w-md animate-in fade-in slide-in-from-top-3 duration-300 sm:top-6">
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-indigo-400/25 bg-slate-950/90 p-3 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl sm:p-4">
            <CatGirlMascot size={52} className="shrink-0 motion-safe:animate-[float_3s_ease-in-out_infinite]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-indigo-300">
                <StepIcon className="size-4 motion-safe:animate-spin" />
                <h2 className="text-sm font-black text-white">{step.title}</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm"><TypewriterText text={step.message} speed={18} /></p>
            </div>
          </div>
        </div>
      )}

      {/* === TOOLTIP FOR MECHANIC STEPS === */}
      {!isIntroStep && !step.isWaiting && (
        <section
          ref={tutorialPanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gacha-tutorial-title"
          className={`absolute inset-x-0 z-20 pointer-events-auto transition-all duration-300 ease-out sm:inset-auto sm:w-[380px] ${mobilePanelAtTop ? "top-0" : "bottom-0"}`}
          style={isMobile ? undefined : { top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className={`relative max-h-[52dvh] overflow-y-auto border border-white/10 bg-slate-950/96 shadow-2xl shadow-black/70 backdrop-blur-xl sm:max-h-none sm:rounded-2xl ${mobilePanelAtTop ? "rounded-b-[26px]" : "rounded-t-[26px]"}`}>
            {/* Arrow */}
            {!isMobile && <div className={`absolute size-4 bg-slate-950 ${tooltipArrow()}`} />}

            {/* Decorative top bar */}
            <div className={`h-1 bg-gradient-to-r ${accent.glow}`} />

            {/* Content */}
            <div className="p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5">
              {/* Header with mascot and icon */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 self-start">
                  <div className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-pink-500/15 to-indigo-500/10 sm:size-16">
                    <CatGirlMascot size={isMobile ? 58 : 66} className="translate-y-1 motion-safe:animate-[float_3s_ease-in-out_infinite]" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 rounded-full border border-pink-300/20 bg-pink-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-lg">ня~</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <span className={`hidden size-10 shrink-0 place-items-center rounded-xl bg-white/5 sm:grid ${accent.icon}`}><StepIcon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-pink-300/70 sm:text-[10px] sm:tracking-[0.16em]">Кошкодевочка · шаг {currentStep + 1} из {tutorialSteps.length}</div>
                      <h2 id="gacha-tutorial-title" className="mt-0.5 text-lg font-black leading-tight text-white">{step.title}</h2>
                    </div>
                    <button type="button" onClick={handleSkip} aria-label="Закрыть обучение" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:hidden"><X className="size-5" /></button>
                  </div>
                  <p className="mt-3 text-sm leading-5 text-slate-300"><TypewriterText text={step.message} /></p>
                </div>
              </div>

              {/* Progress dots */}
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full bg-gradient-to-r ${accent.glow} transition-[width] duration-500`} style={{ width: `${progress}%` }} />
              </div>

              {/* Buttons */}
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={handleBack} disabled={currentStep === 0 || step.requireClick} aria-label="Предыдущий шаг" className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  <ArrowLeft className="size-4" />
                </button>
                {step.requireClick ? (
                  <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1">
                    <div className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r ${accent.glow} px-3 text-center text-xs font-black text-white shadow-lg`}>
                      <MousePointerClick className="size-4 shrink-0" />
                      {step.clickHint}
                    </div>
                    <button type="button" onClick={handleSkipAction} className="min-h-7 text-[11px] font-bold text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:text-white">
                      Продолжить без действия
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={handleNext} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${accent.glow} px-5 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}>
                    {isLastStep ? <><Check className="size-4" /> Завершить</> : <>Далее <ArrowRight className="size-4" /></>}
                  </button>
                )}
                <button type="button" onClick={handleSkip} className="hidden min-h-11 px-2 text-xs font-bold text-slate-500 transition-colors hover:text-white sm:block">
                  Пропустить
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Floating mascot (when element is highlighted, show small mascot near it) */}
      {highlightRect && !isIntroStep && !isMobile && (
        <div className="absolute hidden pointer-events-none transition-all duration-500 ease-out lg:block" style={{ top: Math.max(8, highlightRect.y - 64), left: Math.min(window.innerWidth - 72, highlightRect.x + highlightRect.width + 8) }}>
          <CatGirlMascot size={56} className="motion-safe:animate-[float_3s_ease-in-out_infinite]" />
          {/* Pointer hand */}
          <MousePointerClick className={`absolute -bottom-1 -left-2 size-6 ${accent.icon} motion-safe:animate-bounce`} />
        </div>
      )}

      {/* Close button */}
      {!isMobile && (
        <button type="button" onClick={handleSkip} aria-label="Закрыть обучение" className="absolute right-5 top-5 z-40 grid size-11 pointer-events-auto place-items-center rounded-xl border border-white/10 bg-slate-950/75 text-slate-400 shadow-lg backdrop-blur-xl transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <X className="size-5" />
        </button>
      )}

      {/* Step counter */}
      {!isMobile && !step.isWaiting && (
        <div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2 text-xs font-bold text-slate-300 shadow-lg backdrop-blur-xl">
          Шаг {currentStep + 1} из {tutorialSteps.length}
        </div>
      )}
    </div>
  )
}
