/**
 * Скрипт отладки AI через консоль
 * 
 * Запустите этот скрипт для тестирования поведения AI в изоляции:
 * npx tsx app/battle/ai/debug.ts
 * 
 * Или используйте интерактивный режим:
 * npx tsx app/battle/ai/debug.ts --interactive
 */

import { AIEngine, createAI, createAIDecisionContext, AIConfig } from "./index"
import { Card, BattleZone } from "../types"
import { getCardRole, getCardBasePower } from "../utils"
import { TERRITORY_MODIFIERS } from "../config"
import { Rarity } from "@/types/gacha"

// ============================================================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================================================

const MOCK_CARDS: Card[] = [
  {
    uniqueId: "card-1",
    name: "Какаши Хатаке",
    anime: "Naruto",
    rarity: "rare" as Rarity,
    imageUrl: "",
    stats: { hp: 70, atk: 75, def: 50, spd: 60, luck: 55 },
    isMainCharacter: false,
    score: 1000
  },
  {
    uniqueId: "card-2",
    name: "Наруто Узумаки",
    anime: "Naruto",
    rarity: "rare" as Rarity,
    imageUrl: "",
    stats: { hp: 90, atk: 85, def: 55, spd: 65, luck: 50 },
    isMainCharacter: true,
    score: 1200
  },
  {
    uniqueId: "card-3",
    name: "Сакура Харуно",
    anime: "Naruto",
    rarity: "rare" as Rarity,
    imageUrl: "",
    stats: { hp: 100, atk: 50, def: 80, spd: 45, luck: 40 },
    isMainCharacter: false,
    score: 800
  },
  {
    uniqueId: "card-4",
    name: "Рок Ли",
    anime: "Naruto",
    rarity: "rare" as Rarity,
    imageUrl: "",
    stats: { hp: 75, atk: 90, def: 35, spd: 100, luck: 30 },
    isMainCharacter: false,
    score: 1100
  },
  {
    uniqueId: "card-5",
    name: "Саске Учиха",
    anime: "Naruto",
    rarity: "epic" as Rarity,
    imageUrl: "",
    stats: { hp: 100, atk: 105, def: 55, spd: 90, luck: 55 },
    isMainCharacter: true,
    score: 1500
  },
  {
    uniqueId: "card-6",
    name: "Гаара",
    anime: "Naruto",
    rarity: "epic" as Rarity,
    imageUrl: "",
    stats: { hp: 140, atk: 55, def: 105, spd: 50, luck: 45 },
    isMainCharacter: false,
    score: 1300
  }
]

const MOCK_ZONES: BattleZone[] = [
  {
    id: "zone-1",
    name: "Линия 1",
    nameRu: "Авангардная Линия",
    modifier: TERRITORY_MODIFIERS[0],
    playerCards: [],
    aiCards: [],
    playerScore: 0,
    aiScore: 0,
    owner: "none"
  },
  {
    id: "zone-2",
    name: "Линия 2",
    nameRu: "Центральная Линия",
    modifier: TERRITORY_MODIFIERS[1],
    playerCards: [],
    aiCards: [],
    playerScore: 0,
    aiScore: 0,
    owner: "none"
  },
  {
    id: "zone-3",
    name: "Линия 3",
    nameRu: "Теневая Линия",
    modifier: TERRITORY_MODIFIERS[2],
    playerCards: [],
    aiCards: [],
    playerScore: 0,
    aiScore: 0,
    owner: "none"
  }
]

// ============================================================================
// ФУНКЦИИ ОТЛАДКИ
// ============================================================================

function printCard(card: Card) {
  const role = getCardRole(card)
  const power = getCardBasePower(card)
  console.log(`  - ${card.name} (${card.rarity})`)
  console.log(`    Роль: ${role}, Сила: ${power}`)
  console.log(`    Характеристики: HP:${card.stats.hp} ATK:${card.stats.atk} DEF:${card.stats.def} SPD:${card.stats.spd} LUCK:${card.stats.luck}`)
}

function printZone(zone: BattleZone) {
  console.log(`  Зона: ${zone.name} (${zone.nameRu})`)
  console.log(`    Модификатор: ${zone.modifier.name} (${zone.modifier.description})`)
  console.log(`    Карт игрока: ${zone.playerCards.length}, Карт AI: ${zone.aiCards.length}`)
  console.log(`    Владелец: ${zone.owner}`)
}

function printSeparator() {
  console.log("\n" + "=".repeat(80) + "\n")
}

// ============================================================================
// ТЕСТОВЫЕ СЦЕНАРИИ
// ============================================================================

async function testAllStrategies() {
  printSeparator()
  console.log("ТЕСТИРОВАНИЕ ВСЕХ СТРАТЕГИЙ AI")
  printSeparator()

  const strategies: Array<{ name: string; config: AIConfig }> = [
    { name: "Случайная", config: { strategy: "random", enableLogging: true, logLevel: "detailed" } },
    { name: "По силе", config: { strategy: "power", enableLogging: true, logLevel: "detailed" } },
    { name: "Стратегическая", config: { strategy: "strategic", enableLogging: true, logLevel: "detailed" } },
    { name: "Адаптивная", config: { strategy: "adaptive", enableLogging: true, logLevel: "detailed" } }
  ]

  for (const { name, config } of strategies) {
    console.log(`\n--- Тестирование стратегии: ${name} ---\n`)
    
    const ai = createAI(config)
    const context = createAIDecisionContext(
      MOCK_CARDS.slice(0, 4),
      MOCK_CARDS.slice(4),
      MOCK_ZONES,
      1,
      ai.getConfig()
    )

    console.log("Рука AI:")
    context.hand.forEach(printCard)
    console.log("\nЗоны:")
    context.zones.forEach(printZone)

    const decisions = ai.decideRound(context)
    
    console.log("\n--- Решения ---")
    decisions.forEach((decision, index) => {
      console.log(`\nРешение ${index + 1}:`)
      console.log(`  Карта: ${decision.card.name}`)
      console.log(`  Зона: ${decision.zoneId}`)
      console.log(`  Секретно: ${decision.isSecret}`)
      console.log(`  Обоснование: ${decision.reasoning}`)
      console.log(`  Уверенность: ${(decision.confidence * 100).toFixed(0)}%`)
    })

    printSeparator()
  }
}

async function testSingleStrategy() {
  printSeparator()
  console.log("ТЕСТИРОВАНИЕ ОДНОЙ СТРАТЕГИИ (Стратегическая)")
  printSeparator()

  const ai = createAI({
    strategy: "strategic",
    enableLogging: true,
    logLevel: "verbose"
  })

  const context = createAIDecisionContext(
    MOCK_CARDS.slice(0, 4),
    MOCK_CARDS.slice(4),
    MOCK_ZONES,
    1,
    ai.getConfig()
  )

  console.log("Рука AI:")
  context.hand.forEach(printCard)
  console.log("\nЗоны:")
  context.zones.forEach(printZone)

  const decisions = ai.decideRound(context)
  
  console.log("\n--- Финальные решения ---")
  decisions.forEach((decision, index) => {
    console.log(`\nРешение ${index + 1}:`)
    console.log(`  Карта: ${decision.card.name}`)
    console.log(`  Зона: ${decision.zoneId}`)
    console.log(`  Секретно: ${decision.isSecret}`)
    console.log(`  Обоснование: ${decision.reasoning}`)
    console.log(`  Уверенность: ${(decision.confidence * 100).toFixed(0)}%`)
  })

  console.log("\n--- История решений ---")
  const history = ai.getDecisionHistory()
  console.log(`Всего решений: ${history.length}`)
}

async function testMultipleRounds() {
  printSeparator()
  console.log("ТЕСТИРОВАНИЕ НЕСКОЛЬКИХ РАУНДОВ")
  printSeparator()

  const ai = createAI({
    strategy: "adaptive",
    enableLogging: true,
    logLevel: "detailed"
  })

  for (let round = 1; round <= 3; round++) {
    console.log(`\n${"=".repeat(40)} РАУНД ${round} ${"=".repeat(40)}`)
    
    const context = createAIDecisionContext(
      MOCK_CARDS.slice(0, 4),
      MOCK_CARDS.slice(4),
      MOCK_ZONES,
      round,
      ai.getConfig()
    )

    const decisions = ai.decideRound(context)
    
    console.log(`\nРешения раунда ${round}: ${decisions.length}`)
    decisions.forEach((decision, index) => {
      console.log(`  ${index + 1}. ${decision.card.name} -> ${decision.zoneId} (секретно: ${decision.isSecret})`)
    })
  }

  printSeparator()
}

async function testConfigChanges() {
  printSeparator()
  console.log("ТЕСТИРОВАНИЕ СМЕНЫ КОНФИГУРАЦИИ")
  printSeparator()

  const ai = createAI({
    strategy: "strategic",
    enableLogging: true,
    logLevel: "basic"
  })

  console.log("\n--- Начальная конфигурация ---")
  console.log(JSON.stringify(ai.getConfig(), null, 2))

  console.log("\n--- Смена на случайную стратегию ---")
  ai.setConfig({ strategy: "random", logLevel: "verbose" })
  console.log(JSON.stringify(ai.getConfig(), null, 2))

  const context = createAIDecisionContext(
    MOCK_CARDS.slice(0, 4),
    MOCK_CARDS.slice(4),
    MOCK_ZONES,
    1,
    ai.getConfig()
  )

  const decisions = ai.decideRound(context)
  console.log(`\nРешения с новой конфигурацией: ${decisions.length}`)
}

// ============================================================================
// ИНТЕРАКТИВНЫЙ РЕЖИМ
// ============================================================================

async function interactiveMode() {
  printSeparator()
  console.log("ОТЛАДКА AI - ИНТЕРАКТИВНЫЙ РЕЖИМ")
  printSeparator()
  console.log("Доступные команды:")
  console.log("  test-all - Тест всех стратегий")
  console.log("  test-single - Тест одной стратегии")
  console.log("  test-rounds - Тест нескольких раундов")
  console.log("  test-config - Тест смены конфигурации")
  console.log("  custom - Кастомный тест")
  console.log("  exit - Выход из интерактивного режима")
  printSeparator()

  // Простая реализация readline
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const askQuestion = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        resolve(answer)
      })
    })
  }

  while (true) {
    const command = await askQuestion("\n> ")

    switch (command.toLowerCase()) {
      case "test-all":
        await testAllStrategies()
        break
      case "test-single":
        await testSingleStrategy()
        break
      case "test-rounds":
        await testMultipleRounds()
        break
      case "test-config":
        await testConfigChanges()
        break
      case "custom":
        console.log("\nКастомный тест - настройте AI:")
        const strategy = await askQuestion("Стратегия (random/power/strategic/adaptive): ")
        const logLevel = await askQuestion("Уровень логов (none/basic/detailed/verbose): ")
        
        const ai = createAI({
          strategy: strategy as any,
          enableLogging: true,
          logLevel: logLevel as any
        })

        const context = createAIDecisionContext(
          MOCK_CARDS.slice(0, 4),
          MOCK_CARDS.slice(4),
          MOCK_ZONES,
          1,
          ai.getConfig()
        )

        const decisions = ai.decideRound(context)
        console.log(`\nРешений: ${decisions.length}`)
        break
      case "exit":
        rl.close()
        process.exit(0)
      default:
        console.log("Неизвестная команда. Доступно: test-all, test-single, test-rounds, test-config, custom, exit")
    }
  }
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const isInteractive = args.includes("--interactive") || args.includes("-i")

  if (isInteractive) {
    await interactiveMode()
  } else {
    // По умолчанию запускаем все тесты
    await testAllStrategies()
    await testSingleStrategy()
    await testMultipleRounds()
    await testConfigChanges()
    
    printSeparator()
    console.log("ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
    printSeparator()
  }
}

main().catch(console.error)
