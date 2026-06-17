-- PvP Custom Rules and Locations System
-- This migration creates tables for managing PvP locations and rules via admin dashboard

-- PvP Locations Table
CREATE TABLE IF NOT EXISTS pvp_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  description TEXT NOT NULL,
  description_ru TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_empty BOOLEAN NOT NULL DEFAULT false, -- If true, this is a neutral location without rules
  icon_name TEXT, -- Lucide icon name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PvP Rules (Modifiers) Table
CREATE TABLE IF NOT EXISTS pvp_rules (
  id TEXT PRIMARY KEY, -- String ID like 'shadow_step'
  name_ru TEXT NOT NULL,
  description_ru TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'general', -- 'info', 'rps', 'role_buff', 'rarity', 'positioning', 'system'
  config JSONB DEFAULT '{}', -- Custom configuration parameters for the rule
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mapping Locations to Rules
CREATE TABLE IF NOT EXISTS pvp_location_rules (
  location_id UUID REFERENCES pvp_locations(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES pvp_rules(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, rule_id)
);

-- Row Level Security
ALTER TABLE pvp_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_location_rules ENABLE ROW LEVEL SECURITY;

-- Policies (Viewable by all, editable by admins via service role or custom policy)
CREATE POLICY "Anyone can view active pvp locations"
  ON pvp_locations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view active pvp rules"
  ON pvp_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view pvp location rules"
  ON pvp_location_rules FOR SELECT
  USING (true);

-- Admin policies (assuming admin check is done via service role or can be added later)
-- For now, we'll allow all operations if authenticated as a workaround or if using service role on server
-- In a real scenario, we'd check for an admin flag in profiles

-- Insert initial rules from server.txt
INSERT INTO pvp_rules (id, name_ru, description_ru, category) VALUES
('shadow_step', 'Теневой выпад', 'Все скрытые карты на этой линии получают +100 к силе при раскрытии.', 'info'),
('mirage_zone', 'Зона иллюзий', 'Сила скрытых карт удваивается, но открытые карты теряют 50% своей силы.', 'info'),
('first_strike', 'Быстрый старт', 'Открытые карты (сыгранные на эту линию первыми) получают бонус +80 к силе.', 'info'),
('ambush_point', 'Точка засады', 'Скрытые карты (сыгранные на эту линию вторыми) получают бонус +120 к силе.', 'info'),
('double_bluff', 'Двойной блеф', 'Если оба игрока сыграли свои скрытые карты на этой линии, обе карты получают +200 к силе.', 'info'),
('dark_zone', 'Темная зона', 'Все показатели карт на этой линии скрыты даже после раскрытия. Победитель определяется вслепую.', 'info'),
('provocation_point', 'Точка провокации', 'Раскрытие скрытой карты Стража на этой линии принудительно раскрывает скрытую карту противника.', 'info'),
('reverse_rps', 'Зеркальный резонанс', 'Правила превосходства ролей меняются: Плут побеждает Авангарда, Авангард побеждает Стража, Страж побеждает Плута.', 'rps'),
('double_rps', 'Абсолютное доминирование', 'Бонус к силе за победу по системе ролей (КНБ) на этой линии увеличивается в два раза.', 'rps'),
('no_rps', 'Чистый триумф', 'На этой линии не действуют правила ролей (КНБ), сравнивается только чистая базовая сила карт.', 'rps'),
('tactical_synergy', 'Тактический союз', 'Если ваши две карты на этой линии имеют разные роли, они обе получают бонус +100 к силе.', 'rps'),
('shared_fate', 'Общая судьба', 'Если карты противников на этой линии имеют одинаковую роль, обе карты получают +150 к силе.', 'rps'),
('unity', 'Единство', 'Если ваши две карты на этой линии из одного аниме, они обе получают бонус +150 к силе.', 'rps'),
('rivalry', 'Соперничество', 'Если карты противников на этой линии из разных аниме, они теряют 50 к силе.', 'rps'),
('sabotage_camp', 'Лагерь диверсантов', 'Плуты на этой линии снижают скрытую силу противостоящей карты противника на 100 единиц.', 'rps'),
('vanguard_ring', 'Авангардный ринг', 'Карты с ролью Авангард получают +150 к базовой силе.', 'role_buff'),
('fortress_gate', 'Железная цитадель', 'Карты с ролью Страж получают +150 к базовой силе.', 'role_buff'),
('speed_valley', 'Долина Ветров', 'Карты с ролью Плут получают +150 к базовой силе.', 'role_buff'),
('iron_curtain', 'Железный занавес', 'Стражи на этой линии полностью защищены от любых негативных эффектов и принудительного снижения силы.', 'role_buff'),
('trash_revolution', 'Восстание низов', 'Карты редкости Мусор и Обычная получают +300% к силе на этой линии.', 'rarity'),
('golden_cage', 'Золотая клетка', 'Карты редкостей Божественные, Трансцендентные и Всемогущие теряют 40% своей силы.', 'rarity'),
('balanced_force', 'Идеальный баланс', 'Карты редкостей Эпические, Сверхредкие и Редкие получают +100 к базовой силе.', 'rarity'),
('black_market', 'Черный рынок', 'Карты редкостей Необычные и Редкие получают +120 к силе.', 'rarity'),
('god_domain', 'Обитель богов', 'Всемогущие карты на этой линии удваиваются в силе.', 'rarity'),
('vandalism', 'Отрицание редкости', 'Все преимущества редкостей отключены. Карты рассчитываются как Обычные.', 'rarity'),
('fools_gold', 'Золото дураков', 'Карты редкостей Легендарные и Мифические приравниваются по силе к редкости Мусор.', 'rarity'),
('lonely_hero', 'Одинокий боец', 'Если у вас на этой линии всего одна карта против двух карт соперника, она получает +200 к силе.', 'positioning'),
('duelist_honor', 'Честь дуэлянта', 'Если на линии находится ровно по одной карте с каждой стороны, они получают +150 к силе.', 'positioning'),
('gravity_well', 'Гравитационный колодец', 'Сила карт на этой линии уменьшается на 50 за каждую карту, сыгранную на соседних линиях.', 'positioning'),
('overdrive', 'Предельная перегрузка', 'Карта с максимальной силой на этой линии наносит урон соседним линиям противника в размере 50% от своей силы.', 'positioning'),
('equality', 'Уравнитель', 'Сила всех карт на этой линии приравнивается к 150, независимо от их реальных показателей.', 'system'),
('power_vacuum', 'Вакуум силы', 'Энергетический сбой. Все карты на этой линии теряют 50% своей базовой силы.', 'system'),
('kamikaze_rift', 'Разлом камикадзе', 'Сильнейшая карта на этой линии по итогам раунда уничтожается.', 'system'),
('stamina_drain', 'Перераспределение', 'Сильнейшая карта на этой линии отдает 100 единиц своей силы самой слабой карте на этой же линии.', 'system'),
('gambler_den', 'Притон азарта', 'Карты с высоким показателем Удачи получают случайный бонус от 50 до 250 силы.', 'system'),
('reversal_gate', 'Врата парадокса', 'Парадокс силы: на этой линии карта с наименьшим показателем силы побеждает карту с наибольшим.', 'system')
ON CONFLICT (id) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  description_ru = EXCLUDED.description_ru,
  category = EXCLUDED.category;
