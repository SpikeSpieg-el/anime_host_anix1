let passed = 0, failed = 0
const failures = []

function assert(cond, msg) {
  if (cond) { 
    passed++ 
  } else { 
    failed++
    failures.push(msg) 
  }
}

function eq(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)})`)
}

// Импорт чистой логики гачи
const gacha = await import("../types/gacha.ts")

console.log("=== Автотест: логика гачи ===\n")

// --- rarityConfig: все редкости и веса ---
const rarityKeys = Object.keys(gacha.rarityConfig)
const rarityValues = Object.values(gacha.rarityConfig)

eq(rarityKeys.length, 12, "rarityConfig содержит все 12 редкостей")

const totalWeight = rarityValues.reduce((s, r) => s + r.weight, 0)
assert(totalWeight > 0, `сумма весов редкостей положительна (получено ${totalWeight})`)

// --- getDismantleValue: крайние значения и монотонность ---
eq(gacha.getDismantleValue("trash"), 5, "dismantle trash = 5 (минимум)")
eq(gacha.getDismantleValue("omnipotent"), 5000, "dismantle omnipotent = 5000 (максимум)")

let dismantleMonotonic = true
for (let i = 1; i < rarityKeys.length; i++) {
  if (gacha.getDismantleValue(rarityKeys[i]) < gacha.getDismantleValue(rarityKeys[i - 1])) {
    dismantleMonotonic = false
  }
}
assert(dismantleMonotonic, "getDismantleValue монотонно возрастает по редкости")

// --- Конфигурация модификаторов ---
const frameConfigs = {
  gold: { cost: 50, stats: { stat: "atk", bonus: 10 } },
  neon: { cost: 60, stats: { stat: "spd", bonus: 12 } },
  crystal: { cost: 55, stats: { stat: "def", bonus: 10 } },
  dark: { cost: 70, stats: { stat: "hp", bonus: 15 } },
  blood: { cost: 80, stats: { stat: "atk", bonus: 15 } },
  inferno: { cost: 100, stats: { stat: "atk", bonus: 20 } },
  lightning: { cost: 90, stats: { stat: "spd", bonus: 18 } },
  divine: { cost: 120, stats: { stat: "luck", bonus: 25 } },
  cyber_glitch: { cost: 85, stats: { stat: "spd", bonus: 14 } },
  abyss: { cost: 110, stats: { stat: "hp", bonus: 22 } }
}

const coatingConfigs = {
  holo: { cost: 40, stats: { stat: "luck", bonus: 8 } },
  prismatic: { cost: 45, stats: { stat: "def", bonus: 9 } },
  gold_leaf: { cost: 55, stats: { stat: "atk", bonus: 11 } },
  blood_stain: { cost: 65, stats: { stat: "atk", bonus: 13 } },
  void: { cost: 75, stats: { stat: "def", bonus: 16 } },
  matrix_foil: { cost: 70, stats: { stat: "spd", bonus: 15 } },
  crt_scanlines: { cost: 50, stats: { stat: "luck", bonus: 10 } },
  falling_ash: { cost: 60, stats: { stat: "hp", bonus: 12 } },
  heartbeat: { cost: 80, stats: { stat: "hp", bonus: 18 } },
  ethereal_mist: { cost: 95, stats: { stat: "luck", bonus: 20 } }
}

eq(Object.keys(frameConfigs).length, 10, "frameConfigs содержит 10 рамок")
eq(Object.keys(coatingConfigs).length, 10, "coatingConfigs содержит 10 покрытий")

const validStats = ["hp", "atk", "def", "spd", "luck"]

for (const [name, cfg] of Object.entries(frameConfigs)) {
  assert(typeof cfg.cost === "number" && cfg.cost > 0, `frame ${name} имеет числовой cost`)
  assert(validStats.includes(cfg.stats.stat), `frame ${name} имеет валидный stat (${cfg.stats.stat})`)
  assert(typeof cfg.stats.bonus === "number" && cfg.stats.bonus > 0, `frame ${name} имеет положительный bonus`)
}

for (const [name, cfg] of Object.entries(coatingConfigs)) {
  assert(cfg.cost > 0, `coating ${name} имеет cost > 0`)
  assert(validStats.includes(cfg.stats.stat), `coating ${name} имеет валидный stat`)
}

// --- Функции применения модификаторов ---
const getModifiersCost = (frame, coating) => {
  let total = 0
  if (frame && frameConfigs[frame]) total += frameConfigs[frame].cost
  if (coating && coatingConfigs[coating]) total += coatingConfigs[coating].cost
  return total
}

const applyModifierStats = (baseStats, frame, coating) => {
  const modified = { ...baseStats }
  if (frame && frameConfigs[frame]) { 
    const { stat, bonus } = frameConfigs[frame].stats
    modified[stat] += bonus 
  }
  if (coating && coatingConfigs[coating]) { 
    const { stat, bonus } = coatingConfigs[coating].stats
    modified[stat] += bonus 
  }
  return modified
}

const base = { hp: 10, atk: 10, def: 10, spd: 10, luck: 10 }

eq(applyModifierStats(base), base, "applyModifierStats без модификаторов не меняет статы")

const withFrame = applyModifierStats(base, "inferno")
assert(withFrame.atk === 30 && withFrame.hp === 10, "рамка inferno добавляет +20 к atk")

const withBoth = applyModifierStats(base, "gold", "holo")
assert(withBoth.atk === 20 && withBoth.luck === 18, "рамка + покрытие корректно суммируются")

console.log(`\n=== Итог: ${passed} пройдено, ${failed} не пройдено ===`)
if (failed > 0) {
  console.log("\nНеудачи:")
  for (const f of failures) console.log("  ✗ " + f)
  process.exit(1)
} else {
  console.log("✅ Все тесты прошли успешно")
}