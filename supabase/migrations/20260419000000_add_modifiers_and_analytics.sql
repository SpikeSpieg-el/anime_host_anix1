-- Добавление модификаторов в market_listings и user_cards, создание таблицы аналитики рынка

-- Сначала добавляем поля модификаторов в user_cards
ALTER TABLE public.user_cards
ADD COLUMN IF NOT EXISTS frame_modifier TEXT,
ADD COLUMN IF NOT EXISTS coating_modifier TEXT;

-- Затем добавляем поля модификаторов в market_listings
ALTER TABLE public.market_listings
ADD COLUMN IF NOT EXISTS frame_modifier TEXT,
ADD COLUMN IF NOT EXISTS coating_modifier TEXT;

-- Создаём индексы для модификаторов
CREATE INDEX IF NOT EXISTS idx_market_listings_frame_modifier ON public.market_listings(frame_modifier);
CREATE INDEX IF NOT EXISTS idx_market_listings_coating_modifier ON public.market_listings(coating_modifier);

-- Таблица для отслеживания истории продаж (спрос)
CREATE TABLE IF NOT EXISTS public.market_sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  price INTEGER NOT NULL,
  unique_id TEXT NOT NULL,
  serial_id TEXT NOT NULL,
  name TEXT NOT NULL,
  anime TEXT NOT NULL,
  rarity TEXT NOT NULL,
  stats_hp INTEGER NOT NULL,
  stats_atk INTEGER NOT NULL,
  stats_def INTEGER NOT NULL,
  stats_spd INTEGER NOT NULL,
  stats_luck INTEGER NOT NULL,
  is_main_character BOOLEAN DEFAULT FALSE,
  frame_modifier TEXT,
  coating_modifier TEXT,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_sales_history_rarity ON public.market_sales_history(rarity);
CREATE INDEX IF NOT EXISTS idx_market_sales_history_sold_at ON public.market_sales_history(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_sales_history_frame_modifier ON public.market_sales_history(frame_modifier);
CREATE INDEX IF NOT EXISTS idx_market_sales_history_coating_modifier ON public.market_sales_history(coating_modifier);

ALTER TABLE public.market_sales_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_sales_history_read_all" ON public.market_sales_history;
CREATE POLICY "market_sales_history_read_all"
  ON public.market_sales_history
  FOR SELECT
  USING (true);

COMMENT ON TABLE public.market_sales_history IS 'История продаж для аналитики спроса и предложения';
