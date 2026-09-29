#!/usr/bin/env node
// scripts/economy-report.mjs
//
// Считает экономику гачи и печатает отчёт: распределение редкостей,
// EV одной крутки в монетах, ROI «крутка → продажа», сколько круток живёт
// на стартовом бонусе и сколько даёт PvE за день.
//
// Запуск: npm run economy:report
// Если ROI > 1.3 — гача снова стала печатным станком, см. tests/unit/lib/economy.test.ts

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent",
]

// lib/economy.ts
const FAIR_VALUE = {
  trash: 5, common: 7, uncommon: 11, rare: 44, super_rare: 88, epic: 170,
  mythic: 335, legendary: 560, ancient: 920, divine: 1350, transcendent: 2300,
  omnipotent: 5700,
}
const DUST_VALUE = {
  trash: 4, common: 5, uncommon: 8, rare: 30, super_rare: 60, epic: 115,
  mythic: 230, legendary: 380, ancient: 640, divine: 880, transcendent: 1500,
  omnipotent: 3700,
}
const SPIN_COST = 50
const STARTING_COINS = 2000
const MARKET_TAX = 0.08
const INSTANT_SELL_RATE = 0.7
const LISTING_MIN_RATE = 0.6
const LISTING_MAX_RATE = 2.5
const PVE_DAILY_CAP = 500
const DAILY_TOTAL = [50, 75, 100, 125, 175, 225, 300]

// app/gacha/actions.ts: generateStats()
const BASE_MIN = [5, 12, 19, 26, 33, 40, 47, 54, 62, 72, 82, 90]
const BASE_MAX = [25, 32, 39, 46, 53, 60, 67, 74, 82, 90, 96, 100]

// Примерное распределение оценок аниме на Shikimori (среднее 7.0, σ 0.95)
function gaussian() {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function randScore() {
  return Math.max(3.2, Math.min(9.4, 7.0 + 0.95 * gaussian()))
}

function calcBaseRarity(score) {
  if (score >= 8.8) return "mythic"
  if (score >= 8.3) return "epic"
  if (score >= 7.8) return "super_rare"
  if (score >= 7.2) return "rare"
  if (score >= 7.0) return "uncommon"
  if (score >= 6.6) return "common"
  return "trash"
}

function rollRarity(score, isMain) {
  let rarity = calcBaseRarity(score)
  let boost = 0
  if (score >= 9.0) {
    const x = Math.random()
    if (x < 0.03) boost += 2
    else if (x < 0.10) boost += 1
  } else if (score >= 8.5) {
    if (Math.random() < 0.08) boost += 1
  }
  if (isMain) boost += 1
  if (Math.random() < 0.01) boost += 1
  if (Math.random() < 0.001) boost += 3
  if (Math.random() < 0.0001) boost += 5
  if (boost > 0) {
    const i = RARITY_ORDER.indexOf(rarity)
    rarity = RARITY_ORDER[Math.min(i + boost, RARITY_ORDER.length - 1)]
  }
  return rarity
}

function avgStatSum(rarity) {
  const i = RARITY_ORDER.indexOf(rarity)
  return (((BASE_MIN[i] + BASE_MAX[i]) / 2) * 5 * 0.95) | 0
}

function fairValue(rarity, isMain) {
  const sum = avgStatSum(rarity)
  const mult = 1 + Math.min(0.3, sum / 1000)
  return Math.max(1, Math.round(FAIR_VALUE[rarity] * mult * (isMain ? 1.25 : 1)))
}

const N = 200_000
const counts = Object.create(null)
let ev = 0
for (let i = 0; i < N; i++) {
  const score = randScore()
  const isMain = Math.random() > 0.9
  const rarity = rollRarity(score, isMain)
  counts[rarity] = (counts[rarity] || 0) + 1
  ev += fairValue(rarity, isMain)
}
const evSpin = ev / N
const roi = evSpin / SPIN_COST

const fmt = (n) => Math.round(n).toLocaleString("ru-RU")
const pct = (n) => (n * 100).toFixed(2).padStart(6) + "%"

console.log("\n=== ЭКОНОМИКА ГАЧИ ===\n")
console.log(`Цена крутки:            ${SPIN_COST} монет`)
console.log(`Стартовый бонус:        ${fmt(STARTING_COINS)} монет (${STARTING_COINS / SPIN_COST} круток)`)
console.log(`Комиссия маркета:       ${(MARKET_TAX * 100).toFixed(0)}%`)
console.log(`Мгновенная продажа:     ${(INSTANT_SELL_RATE * 100).toFixed(0)}% от цены`)
console.log(`Границы лота:           ${(LISTING_MIN_RATE * 100).toFixed(0)}% — ${(LISTING_MAX_RATE * 100).toFixed(0)}% от цены\n`)

console.log("Редкость         Шанс     Цена   Пыль    Мин. лот   Вклад в EV")
console.log("-".repeat(70))
for (const rarity of RARITY_ORDER) {
  const share = (counts[rarity] || 0) / N
  if (share === 0) continue
  const fair = fairValue(rarity, false)
  const contribution = (share * fair) / evSpin
  console.log(
    rarity.padEnd(14) +
    pct(share) +
    String(fair).padStart(9) +
    String(DUST_VALUE[rarity]).padStart(8) +
    String(Math.round(fair * LISTING_MIN_RATE)).padStart(12) +
    pct(contribution)
  )
}

console.log("-".repeat(70))
console.log(`\nEV одной крутки:         ${fmt(evSpin)} монет`)
console.log(`ROI «крутка → рынок»:    x${roi.toFixed(2)}  ${roi <= 1.3 ? "OK" : "СЛОМАНО — гача печатает монеты"}`)
console.log(`ROI после комиссии:      x${(roi * (1 - MARKET_TAX)).toFixed(2)}`)
console.log(`ROI через мгновенную:    x${(roi * INSTANT_SELL_RATE).toFixed(2)}  (ниже 1 — распродажа убыточна, это нормально)`)

console.log("\n=== ВОРОНКА ===\n")
const dailyAvg = DAILY_TOTAL.reduce((a, b) => a + b, 0) / DAILY_TOTAL.length
console.log(`Ежедневная награда:      ~${fmt(dailyAvg)} монет/день (${(dailyAvg / SPIN_COST).toFixed(1)} круток)`)
console.log(`Потолок PvE за день:     ${fmt(PVE_DAILY_CAP)} монет (${(PVE_DAILY_CAP / SPIN_COST).toFixed(0)} круток)`)
console.log(`Суммарно «за день»:      ~${fmt(dailyAvg + PVE_DAILY_CAP)} монет = ${((dailyAvg + PVE_DAILY_CAP) / SPIN_COST).toFixed(0)} круток`)
console.log(`\nСтартовых круток хватает на: ${fmt((STARTING_COINS * roi) / SPIN_COST)} карт (${fmt(STARTING_COINS)} монет → ${fmt(STARTING_COINS * roi)} монет дропа)\n`)
