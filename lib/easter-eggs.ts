/**
 * Easter Eggs & Secret Commands
 * Вводятся в поисковой строке начиная с /
 */

export interface EasterEgg {
  command: string
  description: string
  action: () => void | Promise<void>
  unlocked?: boolean
}

// Список всех секретных команд
export const easterEggs: EasterEgg[] = [
  {
    command: "?commands",
    description: "Показать список всех команд",
    action: () => showHelp(),
  },
  {
    command: "?rickroll",
    description: "Классика никогда не умирает",
    action: rickroll,
  },
  {
    command: "?wholesome",
    description: "Милая цитата для поднятия настроения",
    action: showWholesome,
  },
  {
    command: "?chaos",
    description: "Режим хаоса (инверсия цветов)",
    action: toggleChaos,
  },
  {
    command: "?matrix",
    description: "Проснись, Нео...",
    action: toggleMatrix,
  },
  {
    command: "?anime",
    description: "Случайное аниме из топ-100",
    action: randomAnime,
  },
  {
    command: "?mood",
    description: "Твоё настроение сегодня",
    action: showMood,
  },
  {
    command: "?gachi",
    description: "BILLY HERRINGTON MEMORIAL",
    action: gachi,
  },
  {
    command: "?nyan",
    description: "NYAN NYAN NYAN",
    action: nyan,
  },
  {
    command: "?todo",
    description: "Напоминание о делах",
    action: todo,
  },
  {
    command: "?konami",
    description: "Ты нашёл секретную команду!",
    action: konami,
  },
  {
    command: "?404",
    description: "Аниме не найдено (шутка)",
    action: error404,
  },
  {
    command: "?waifu",
    description: "Твоя ваifu на сегодня",
    action: waifu,
  },
  {
    command: "?powerup",
    description: "Режим супер сайяна",
    action: powerup,
  },
  {
    command: "?portal",
    description: "Открой портал в другой мир",
    action: portal,
  },
  {
    command: "?shower",
    description: "Деньги с неба (как в аниме)",
    action: shower,
  },
  {
    command: "?glitch",
    description: "Системный сбой в матрице",
    action: glitch,
  },
]

// Функции для каждой команды
async function showHelp() {
  const { toast } = await import("sonner")
  const helpText = easterEggs
    .filter((egg) => egg.command !== "?commands")
    .map((egg) => `${egg.command} - ${egg.description}`)
    .join("\n")

  toast("Секретные команды", {
    description: helpText,
    duration: 10000,
  })
}

async function rickroll() {
  const { toast } = await import("sonner")
  
  // Создаём iframe с Rick Roll
  const iframe = document.createElement("iframe")
  iframe.src = "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
  iframe.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80vw;
    height: 60vh;
    border: none;
    border-radius: 12px;
    z-index: 99999;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `
  document.body.appendChild(iframe)

  // Кнопка закрытия
  const closeBtn = document.createElement("button")
  closeBtn.textContent = "✕"
  closeBtn.style.cssText = `
    position: fixed;
    top: calc(50% - 30vh);
    left: calc(50% + 40vw);
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    z-index: 100000;
    padding: 8px 12px;
    border-radius: 50%;
  `
  closeBtn.onclick = () => {
    iframe.remove()
    closeBtn.remove()
  }
  document.body.appendChild(closeBtn)

  toast("🎵 Never gonna give you up!", {
    description: "Never gonna let you down~",
    duration: 5000,
  })
}

async function showWholesome() {
  const { toast } = await import("sonner")
  
  const quotes = [
    "Ты сильнее, чем думаешь - Аниме teaches us",
    "Даже если будет трудно, не сдавайся! - Naruto",
    "Твоя улыбка освещает этот мир",
    "Ты заслуживаешь быть счастливым",
    "Каждый день - это новый шанс",
    "Ты не один, мы с тобой! - Fairy Tail vibes",
    "Просто дыши. Всё будет хорошо",
    "Ты amazing, не забывай об этом",
  ]

  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]
  
  toast("💖 Милость дня", {
    description: randomQuote,
    duration: 8000,
  })
}

async function toggleChaos() {
  const { toast } = await import("sonner")
  
  const existing = document.getElementById("chaos-mode")
  if (existing) {
    existing.remove()
    toast("Режим хаоса выключен", { duration: 2000 })
    return
  }

  const style = document.createElement("style")
  style.id = "chaos-mode"
  style.textContent = `
    * {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    @keyframes rainbow {
      0% { filter: hue-rotate(0deg) invert(1); }
      100% { filter: hue-rotate(360deg) invert(1); }
    }
    body {
      animation: rainbow 5s linear infinite;
    }
  `
  document.head.appendChild(style)

  toast("🌈 РЕЖИМ ХАОСА АКТИВИРОВАН", {
    description: "Твой глазной врач будет недоволен",
    duration: 3000,
  })
}

async function toggleMatrix() {
  const { toast } = await import("sonner")
  
  const existing = document.getElementById("matrix-rain")
  if (existing) {
    existing.remove()
    toast("Матрица выключена", { duration: 2000 })
    return
  }

  const canvas = document.createElement("canvas")
  canvas.id = "matrix-rain"
  canvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.3;
  `
  document.body.appendChild(canvas)

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    canvas.remove()
    return
  }

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const katakana = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const characters = katakana.split("")

  const fontSize = 16
  const columns = canvas.width / fontSize
  const drops: number[] = []

  for (let i = 0; i < columns; i++) {
    drops[i] = 1
  }

  function draw() {
    if (!ctx) return
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = "#0F0"
    ctx.font = `${fontSize}px monospace`

    for (let i = 0; i < drops.length; i++) {
      const text = characters[Math.floor(Math.random() * characters.length)]
      ctx.fillText(text, i * fontSize, drops[i] * fontSize)

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0
      }
      drops[i]++
    }
  }

  const interval = setInterval(draw, 33)

  // Сохраняем интервал для очистки
  ;(canvas as any)._matrixInterval = interval

  // Клик для выключения
  canvas.onclick = () => {
    clearInterval(interval)
    canvas.remove()
    toast("Ты вышел из Матрицы", { duration: 2000 })
  }

  toast("🟢 Проснись, Нео...", {
    description: "Кликни чтобы выйти из матрицы",
    duration: 3000,
  })
}

async function randomAnime() {
  const { toast } = await import("sonner")
  
  const top100 = [
    "Fullmetal Alchemist: Brotherhood",
    "Steins;Gate",
    "Hunter x Hunter (2011)",
    "Gintama°",
    "Shingeki no Kyojin",
    "One Piece",
    "Naruto: Shippuuden",
    "Death Note",
    "Demon Slayer",
    "Attack on Titan",
    "My Hero Academia",
    "Tokyo Ghoul",
    "Sword Art Online",
    "Dragon Ball Z",
    "One Punch Man",
    "Code Geass",
    "Cowboy Bebop",
    "Neon Genesis Evangelion",
    "Jujutsu Kaisen",
    "Chainsaw Man",
  ]

  const random = top100[Math.floor(Math.random() * top100.length)]
  
  toast("🎲 Случайное аниме", {
    description: `Попробуй посмотреть: ${random}`,
    action: {
      label: "Найти",
      onClick: () => {
        window.location.href = `/catalog?search=${encodeURIComponent(random)}`
      },
    },
    duration: 8000,
  })
}

async function showMood() {
  const { toast } = await import("sonner")
  
  const hour = new Date().getHours()
  const moods = [
    { time: "🌅 Утро", mood: "Ты полон сил! (или нет)", emoji: "☕" },
    { time: "🌞 День", mood: "Продуктивный день в разгаре", emoji: "💪" },
    { time: "🌆 Вечер", mood: "Время для аниме-марафона", emoji: "🍿" },
    { time: "🌙 Ночь", mood: "Ты всё ещё здесь? Всё ок?", emoji: "👀" },
    { time: "🌃 Глубокая ночь", mood: "Аниме-дожор активирован", emoji: "💀" },
  ]

  let moodIndex = 0
  if (hour >= 5 && hour < 12) moodIndex = 0
  else if (hour >= 12 && hour < 17) moodIndex = 1
  else if (hour >= 17 && hour < 23) moodIndex = 2
  else if (hour >= 23 && hour < 2) moodIndex = 3
  else moodIndex = 4

  const selected = moods[moodIndex]
  
  toast(`${selected.emoji} ${selected.time}`, {
    description: selected.mood,
    duration: 5000,
  })
}

async function gachi() {
  const { toast } = await import("sonner")
  
  const phrases = [
    "BILLY HERRINGTON MEMORIAL 1969-2018",
    "Welcome to the dungeon",
    "Hey, slave!",
    "Ass we can",
    "Good night, boys",
  ]

  const random = phrases[Math.floor(Math.random() * phrases.length)]
  
  toast("💪 GACHI MODE", {
    description: random,
    duration: 4000,
  })
}

async function nyan() {
  const { toast } = await import("sonner")
  
  const nyan = "🐱 NYAN " + "NYAN ".repeat(10) + "🐱"
  
  toast(nyan, {
    description: "NYAN NYAN NYAN NYAN NYAN",
    duration: 3000,
  })

  // Проигрываем звук (опционально)
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==")
    audio.volume = 0.1
    await audio.play().catch(() => {})
  } catch {
    // Игнорируем ошибки аудио
  }
}

async function todo() {
  const { toast } = await import("sonner")
  
  const todos = [
    "📝 Выучить японский (0/50 слов)",
    "📚 Прочитать мангу (0/100 глав)",
    "💪 Сделать зарядку (0/1)",
    "😴 Лечь спать до 3 AM (0/1)",
    "🍜 Приготовить рамен (0/1)",
    "🎨 Нарисовать вайфу (0/1)",
  ]

  const random = todos[Math.floor(Math.random() * todos.length)]
  
  toast("📋 Твои дела на сегодня", {
    description: random,
    duration: 6000,
  })
}

async function konami() {
  const { toast } = await import("sonner")
  
  toast("🎮 KONAMI CODE", {
    description: "↑↑↓↓←→←→BA - ты нашёл секрет!",
    duration: 5000,
  })
}

async function error404() {
  const { toast } = await import("sonner")

  const errors = [
    "Аниме не найдено... шутка, просто введи нормальное название",
    "404: Твоя социальная жизнь не обнаружена",
    "Ошибка: Слишком много аниме в базе",
    "404: Мотивация не найдена",
  ]

  const random = errors[Math.floor(Math.random() * errors.length)]

  toast("❌ 404 Error", {
    description: random,
    duration: 4000,
  })
}

async function waifu() {
  const { toast } = await import("sonner")

  const waifus = [
    { name: "Рем", anime: "Re:Zero", color: "💙" },
    { name: "Аска", anime: "Evangelion", color: "🔴" },
    { name: "Микаса", anime: "Attack on Titan", color: "🧣" },
    { name: "Макима", anime: "Chainsaw Man", color: "👁️" },
    { name: "Йор", anime: "Spy x Family", color: "🗡️" },
    { name: "Зеро Ту", anime: "Darling in the FranXX", color: "👿" },
    { name: "Рин Тосака", anime: "Fate/Stay Night", color: "💜" },
    { name: "Хина Хяuga", anime: "Tokyo Revengers", color: "💛" },
  ]

  const random = waifus[Math.floor(Math.random() * waifus.length)]

  toast(`${random.color} Твоя вайфу на сегодня: ${random.name}`, {
    description: `Из ${random.anime}`,
    duration: 6000,
  })

  // Создаём эффект сердечек
  const hearts = document.createElement("div")
  hearts.id = "waifu-hearts"
  hearts.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99999;
  `
  document.body.appendChild(hearts)

  for (let i = 0; i < 20; i++) {
    const heart = document.createElement("div")
    heart.textContent = ["💖", "💕", "💗", "💓", "💞"][Math.floor(Math.random() * 5)]
    heart.style.cssText = `
      position: absolute;
      font-size: ${20 + Math.random() * 30}px;
      left: ${Math.random() * 100}%;
      top: 100%;
      animation: floatUp ${3 + Math.random() * 2}s ease-out forwards;
      opacity: 0.8;
    `
    hearts.appendChild(heart)
  }

  const style = document.createElement("style")
  style.textContent = `
    @keyframes floatUp {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(-100vh) rotate(360deg);
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)

  setTimeout(() => {
    hearts.remove()
    style.remove()
  }, 6000)
}

async function powerup() {
  const { toast } = await import("sonner")

  const existing = document.getElementById("powerup-mode")
  if (existing) {
    existing.remove()
    toast("Режим супер сайяна выключен", { duration: 2000 })
    return
  }

  toast("⚡ РЕЖИМ СУПЕР САЙЯНА АКТИВИРОВАН!", {
    description: "Твоя сила растёт!",
    duration: 3000,
  })

  const style = document.createElement("style")
  style.id = "powerup-mode"
  style.textContent = `
    @keyframes superSaiyan {
      0% { filter: hue-rotate(0deg) brightness(1); }
      25% { filter: hue-rotate(30deg) brightness(1.3); }
      50% { filter: hue-rotate(60deg) brightness(1.5); }
      75% { filter: hue-rotate(30deg) brightness(1.3); }
      100% { filter: hue-rotate(0deg) brightness(1); }
    }
    
    @keyframes lightning {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }
    
    body {
      animation: superSaiyan 0.5s ease-in-out infinite;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(255,255,0,0.3) 0%, transparent 70%);
      pointer-events: none;
      z-index: 9998;
      animation: lightning 0.2s ease-in-out infinite;
    }
    
    body::after {
      content: '⚡';
      position: fixed;
      font-size: 100px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: lightning 0.3s ease-in-out infinite;
      pointer-events: none;
      z-index: 9997;
    }
  `
  document.head.appendChild(style)
}

async function portal() {
  const { toast } = await import("sonner")

  const existing = document.getElementById("portal-effect")
  if (existing) {
    existing.remove()
    toast("Портал закрыт", { duration: 2000 })
    return
  }

  toast("🌀 ОТКРЫВАЕМ ПОРТАЛ...", {
    description: "Держись крепче!",
    duration: 3000,
  })

  const portal = document.createElement("div")
  portal.id = "portal-effect"
  portal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 0;
    height: 0;
    border-radius: 50%;
    background: radial-gradient(circle, #00ffff 0%, #ff00ff 30%, #9900ff 60%, #000000 100%);
    box-shadow: 0 0 100px 50px rgba(153, 0, 255, 0.8),
                0 0 200px 100px rgba(255, 0, 255, 0.6),
                inset 0 0 100px 50px rgba(0, 255, 255, 0.8);
    z-index: 99999;
    animation: portalOpen 2s ease-out forwards, portalSpin 3s linear infinite;
  `
  document.body.appendChild(portal)

  const style = document.createElement("style")
  style.textContent = `
    @keyframes portalOpen {
      0% {
        width: 0;
        height: 0;
        opacity: 0;
      }
      50% {
        opacity: 1;
      }
      100% {
        width: 100vmax;
        height: 100vmax;
        opacity: 0.8;
      }
    }
    
    @keyframes portalSpin {
      0% {
        transform: translate(-50%, -50%) rotate(0deg);
      }
      100% {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }
    
    @keyframes portalClose {
      0% {
        width: 100vmax;
        height: 100vmax;
        opacity: 0.8;
      }
      100% {
        width: 0;
        height: 0;
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)

  setTimeout(() => {
    portal.style.animation = "portalClose 1s ease-in forwards"
    setTimeout(() => {
      portal.remove()
      style.remove()
    }, 1000)
  }, 4000)
}

async function shower() {
  const { toast } = await import("sonner")

  const existing = document.getElementById("money-shower")
  if (existing) {
    existing.remove()
    toast("Дождь из денег прекратился", { duration: 2000 })
    return
  }

  toast("💰 MONEY MONEY MONEY!", {
    description: "Как в аниме про богатых!",
    duration: 3000,
  })

  const shower = document.createElement("div")
  shower.id = "money-shower"
  shower.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99998;
  `
  document.body.appendChild(shower)

  const symbols = ["💰", "💵", "💸", "💎", "🪙", "¥", "$", "€"]

  for (let i = 0; i < 50; i++) {
    const money = document.createElement("div")
    money.textContent = symbols[Math.floor(Math.random() * symbols.length)]
    money.style.cssText = `
      position: absolute;
      font-size: ${20 + Math.random() * 40}px;
      left: ${Math.random() * 100}%;
      top: -50px;
      animation: moneyFall ${2 + Math.random() * 3}s linear forwards;
      animation-delay: ${Math.random() * 2}s;
    `
    shower.appendChild(money)
  }

  const style = document.createElement("style")
  style.textContent = `
    @keyframes moneyFall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0.5;
      }
    }
  `
  document.head.appendChild(style)

  setTimeout(() => {
    shower.remove()
    style.remove()
  }, 6000)
}

async function glitch() {
  const { toast } = await import("sonner")

  const existing = document.getElementById("glitch-mode")
  if (existing) {
    existing.remove()
    toast("Система восстановлена", { duration: 2000 })
    return
  }

  toast("⚠️ SYSTEM GLITCH DETECTED", {
    description: "Всё ломается...",
    duration: 3000,
  })

  const style = document.createElement("style")
  style.id = "glitch-mode"
  style.textContent = `
    @keyframes glitch {
      0% {
        transform: translate(0);
        filter: hue-rotate(0deg);
      }
      20% {
        transform: translate(-5px, 5px);
        filter: hue-rotate(90deg);
      }
      40% {
        transform: translate(5px, -5px);
        filter: hue-rotate(180deg);
      }
      60% {
        transform: translate(-5px, -5px);
        filter: hue-rotate(270deg);
      }
      80% {
        transform: translate(5px, 5px);
        filter: hue-rotate(0deg);
      }
      100% {
        transform: translate(0);
        filter: hue-rotate(0deg);
      }
    }
    
    @keyframes glitchText {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    * {
      animation: glitch 0.3s ease-in-out infinite;
    }
    
    body::before {
      content: '⚠️ SYSTEM ERROR ⚠️';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 48px;
      font-weight: bold;
      color: #ff0000;
      text-shadow: 3px 3px 0 #00ff00, -3px -3px 0 #0000ff;
      z-index: 99999;
      animation: glitchText 0.1s ease-in-out infinite;
      background: rgba(0, 0, 0, 0.8);
      padding: 40px;
      border: 3px solid #ff0000;
    }
  `
  document.head.appendChild(style)
}

// Проверка команды
export function checkEasterEgg(input: string, showToast?: (title: string, options?: any) => void): boolean {
  const command = input.trim().toLowerCase()
  const egg = easterEggs.find((e) => e.command === command)
  
  if (egg) {
    egg.action()
    return true
  }
  
  return false
}

