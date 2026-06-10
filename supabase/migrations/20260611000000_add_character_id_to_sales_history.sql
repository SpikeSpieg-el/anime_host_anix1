-- Добавление character_id в market_sales_history для корректного отображения изображений в истории сделок

ALTER TABLE public.market_sales_history
ADD COLUMN IF NOT EXISTS character_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_market_sales_history_character_id ON public.market_sales_history(character_id);
