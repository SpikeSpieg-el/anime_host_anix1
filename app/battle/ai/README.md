# Модуль AI для боёв

Модуль искусственного интеллекта для системы боёв CCG (Collectible Card Game). Предоставляет масштабируемую архитектуру для реализации различных стратегий AI с возможностью отладки через консоль.

## Структура

```
app/battle/ai/
├── index.ts              # Основной AI модуль (стратегии, движок, конфигурация)
├── board-evaluation.ts   # Шахматно-подобная оценка доски (эвристики, симуляция)
├── adaptive-learning.ts  # Адаптивное обучение (модель игрока, контр-пики)
├── difficulty.ts         # Динамическая сложность
├── debug.ts              # Консольный скрипт для тестирования и отладки
└── README.md             # Документация
```

## Архитектура

### Компоненты

1. **AIConfig** - Конфигурация AI
   - `strategy`: Выбор стратегии (random, power, strategic, adaptive, chess_like)
   - `enableLogging`: Включение логирования
   - `logLevel`: Уровень детализации логов (none, basic, detailed, verbose)
   - `aggressiveness`: Уровень агрессивности (0-1)
   - `defensiveness`: Уровень защитности (0-1)
   - `bluffChance`: Шанс блефа (0-1)

2. **AIDecisionContext** - Контекст принятия решений
   - `hand`: Карты в руке AI
   - `deck`: Колода AI
   - `zones`: Зоны поля боя
   - `round`: Текущий раунд
   - `cardsPlacedThisRound`: Количество размещённых карт в раунде
   - `opponentPlacements`: Размещения оппонента
   - `config`: Конфигурация AI

3. **AICardDecision** - Решение AI
   - `card`: Выбранная карта
   - `zoneId`: Зона для размещения
   - `isSecret`: Секретное размещение
   - `reasoning`: Обоснование решения
   - `confidence`: Уверенность в решении (0-1)

4. **AIEngine** - Движок AI
   - Управляет стратегиями
   - Принимает решения на основе контекста
   - Сохраняет историю решений
   - Поддерживает динамическую смену конфигурации

### Стратегии

#### RandomStrategy
Случайный выбор карты и зоны.
- **Подходит для**: Тестирования, начальных уровней сложности
- **Логика**: Выбирает случайную карту из руки и случайную зону

#### PowerStrategy
Выбор самой сильной карты.
- **Подходит для**: Средней сложности
- **Логика**: Сортирует карты по силе, выбирает зону с наименьшим количеством карт

#### StrategicStrategy
Стратегический выбор с учётом:
- Силы карты на конкретной зоне
- Бонусов за роли (КНБ)
- Контроля зоны
- Секретного размещения
- **Подходит для**: Высокой сложности
- **Логика**: Анализирует все комбинации карта-зона, выбирает оптимальную

#### AdaptiveStrategy
Адаптивная стратегия, меняющая поведение в зависимости от состояния игры.
- **Подходит для**: Максимальной сложности
- **Логика**: 
  - Выигрывает → играет защитно (Стражи, высокий HP)
  - Проигрывает → играет агрессивно (Авангарды, высокий ATK)
  - Ничья → играет стратегически

#### ChessLikeStrategy
Шахматно-подобная стратегия с 1-ply lookahead и board-level эвристикой.
- **Подходит для**: Максимальной сложности, непредсказуемый AI
- **Логика**:
  - Оценивает всю позицию на доске до и после каждого возможного хода
  - Учитывает контроль зон, материальный баланс, темп и информационное преимущество
  - Строит модель оппонента (предпочитаемые зоны, частота блефа, роли карт)
  - Применяет стратегические эвристики (all-in в финале, сохранение карт, контр-зоны)
  - Раунд 1: разведка, распределение по зонам, сохранение сильных карт
  - Раунд 2: контроль спорных зон, адаптация к поведению оппонента
  - Раунд 3: all-in на проигрываемые/спорные зоны, максимизация силы
  - Fallback на StrategicStrategy при отсутствии валидных ходов

## Использование

### Базовое использование

```typescript
import { createAI, createAIDecisionContext } from './ai'

// Создаём AI с конфигурацией
const ai = createAI({
  strategy: "strategic",
  enableLogging: true,
  logLevel: "detailed"
})

// Создаём контекст принятия решений
const context = createAIDecisionContext(
  aiHand,      // Карты в руке AI
  aiDeck,      // Колода AI
  zones,       // Зоны поля боя
  round,       // Текущий раунд
  ai.getConfig() // Конфигурация AI
)

// Получаем решение
const decision = ai.decideCard(context)
if (decision) {
  console.log(`AI играет ${decision.card.name} на ${decision.zoneId}`)
  console.log(`Обоснование: ${decision.reasoning}`)
}
```

### Получение решений для целого раунда

```typescript
const decisions = ai.decideRound(context)
// decisions[0] - первая карта (открытая)
// decisions[1] - вторая карта (секретная)
```

### Динамическая смена конфигурации

```typescript
// Меняем стратегию во время боя
ai.setConfig({
  strategy: "adaptive",
  aggressiveness: 0.8,
  logLevel: "verbose"
})
```

### История решений

```typescript
const history = ai.getDecisionHistory()
console.log(`Всего решений: ${history.length}`)

// Очистка истории
ai.clearHistory()
```

## Отладка через консоль

### Запуск всех тестов

```bash
npx tsx app/battle/ai/debug.ts
```

### Интерактивный режим

```bash
npx tsx app/battle/ai/debug.ts --interactive
```

В интерактивном режиме доступны команды:
- `test-all` - Тест всех стратегий
- `test-single` - Тест одной стратегии
- `test-rounds` - Тест нескольких раундов
- `test-config` - Тест смены конфигурации
- `custom` - Кастомный тест с настройкой
- `exit` - Выход

### Пример вывода

```
================================================================================

ТЕСТИРОВАНИЕ ВСЕХ СТРАТЕГИЙ AI

================================================================================

--- Тестирование случайной стратегии ---

[AI Engine] --- Начало принятия решения ---
[AI Engine] Раунд: 1
[AI Engine] Размер руки: 4
[AI Engine] Карт размещено в раунде: 0
[AI Engine] Стратегия: random
[AI Strategy] Использование случайной стратегии
[AI Strategy] Случайно: Какаши Хатаке -> Линия 1 (секретно: false)
[AI Engine] --- Решение принято ---
[AI Engine] Карта: Какаши Хатаке
[AI Engine] Зона: zone-1
[AI Engine] Секретно: false
[AI Engine] Обоснование: Случайный выбор
[AI Engine] Уверенность: 30%
```

## Интеграция в battle систему

AI модуль уже интегрирован в `app/battle/hooks/use-battle-data.ts`:

```typescript
// Инициализация AI при старте боя
aiEngineRef.current = createAI({
  strategy: "strategic",
  enableLogging: false, // Отключено в продакшене
  logLevel: "none"
})

// Использование при размещении карт игроком
const decision = aiEngineRef.current.decideCard(context)
if (decision) {
  setAiPlacedThisRound(prev => [...prev, { 
    cardId: decision.card.uniqueId, 
    zoneId: decision.zoneId, 
    isSecret: decision.isSecret 
  }])
}
```

## Настройка стратегий

### Добавление новой стратегии

1. Создайте класс, наследующий `AIStrategy`:

```typescript
class MyCustomStrategy extends AIStrategy {
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование моей кастомной стратегии", "basic")
    
    // Ваша логика здесь
    const card = context.hand[0]
    const zone = context.zones[0]
    
    return {
      card,
      zoneId: zone.id,
      isSecret: false,
      reasoning: "Моя кастомная логика",
      confidence: 0.8
    }
  }
}
```

2. Добавьте стратегию в `AIConfig`:

```typescript
export interface AIConfig {
  strategy?: "random" | "power" | "strategic" | "adaptive" | "my_custom"
  // ...
}
```

3. Добавьте создание стратегии в `AIEngine.createStrategy()`:

```typescript
private createStrategy(): AIStrategy {
  switch (this.config.strategy) {
    // ...
    case "my_custom":
      return new MyCustomStrategy(this.config)
    default:
      return new StrategicStrategy(this.config)
  }
}
```

## Параметры конфигурации

### Strategy
- `random` - Случайный выбор
- `power` - Выбор по силе
- `strategic` - Стратегический выбор (рекомендуется)
- `adaptive` - Адаптивный выбор

### LogLevel
- `none` - Без логов
- `basic` - Только основные события
- `detailed` - Детальные решения
- `verbose` - Максимальная детализация

### Aggressiveness (0-1)
- `0.0` - Полностью пассивный
- `0.5` - Сбалансированный
- `1.0` - Максимально агрессивный

### Defensiveness (0-1)
- `0.0` - Без защиты
- `0.5` - Сбалансированный
- `1.0` - Максимально защитный

### BluffChance (0-1)
- `0.0` - Никогда не блефует
- `0.3` - Иногда блефует (рекомендуется)
- `1.0` - Всегда блефует

## Советы по отладке

1. **Начните с простой стратегии**
   ```typescript
   const ai = createAI({ strategy: "random", logLevel: "verbose" })
   ```

2. **Постепенно увеличивайте сложность**
   ```typescript
   // Сначала power
   ai.setConfig({ strategy: "power", logLevel: "detailed" })
   
   // Затем strategic
   ai.setConfig({ strategy: "strategic", logLevel: "detailed" })
   
   // Наконец adaptive
   ai.setConfig({ strategy: "adaptive", logLevel: "verbose" })
   ```

3. **Анализируйте историю решений**
   ```typescript
   const history = ai.getDecisionHistory()
   history.forEach((decision, i) => {
     console.log(`Решение ${i + 1}:`)
     console.log(`  Карта: ${decision.card.name}`)
     console.log(`  Уверенность: ${(decision.confidence * 100).toFixed(0)}%`)
     console.log(`  Обоснование: ${decision.reasoning}`)
   })
   ```

4. **Тестируйте в изоляции**
   - Используйте `debug.ts` для тестирования без UI
   - Создавайте кастомные сценарии
   - Сравнивайте разные стратегии на одних данных

## Производительность

AI модуль оптимизирован для производительности:
- Минимальные вычисления при `logLevel: "none"`
- Кэширование результатов в `decisionHistory`
- Оптимизированные алгоритмы сортировки и выбора

Для продакшена используйте:
```typescript
const ai = createAI({
  strategy: "strategic",
  enableLogging: false,
  logLevel: "none"
})
```

## Будущие улучшения

Возможные направления развития:
- [ ] Стратегия на основе машинного обучения
- [ ] Обучение на реальных матчах игроков
- [ ] Профилирование стилей игры
- [ ] Динамическая сложность
- [ ] Кооперативный AI (2v2)
- [ ] Специальные стратегии для конкретных подземелий
