-- ============================================================================
-- ЭКОНОМИКА v2: самодостаточная гача + рынок как перераспределение
-- ============================================================================
--
-- ЧТО БЫЛО НЕ ТАК
--   1) Стартовый бонус 10 000 = 200 круток по 50. Новичок опустошал бонус
--      за один присед и уходил в даунтайм без причины вернуться.
--   2) Цена карты считалась как «разбор × 8 + статы × 0.3 + индекс × 25».
--      EV карты ≈ 465 монет при цене крутки 50 → ROI гача→маркет ×9.3.
--      Гача печатала монеты, PvE/PvP были лишними, рынок был конвертером
--      гачи в деньги, а не площадкой обмена.
--   3) На маркете не было ни комиссии, ни способа продать мгновенно:
--      чтобы получить монеты, надо было выставить лот и ждать покупателя.
--      Продавать было невыгодно → никто не торговал.
--   4) add_coins_secure / add_dust_secure были выданы роли authenticated:
--      любой вошедший игрок мог вызвать supabase.rpc('add_coins_secure',
--      { p_user_id: <свой id>, p_amount: 999999 }) из консоли браузера.
--      Экономику можно было напечатать в любом объёме.
--
-- ЧТО СТАЛО
--   1) Стартовый бонус 2 000 (40 круток) — хватает на первую серию и гарант,
--      но не выбивает коллекцию.
--   2) Справедливая цена карты задана таблицей RARITY_FAIR_VALUE в lib/economy.ts
--      и подобрана так, чтобы EV крутки ≈ 60 монет при цене 50 (ROI ≈ 1.2).
--      Гача самодостаточна; PvE/PvP дают сверху; маркет перераспределяет.
--   3) На маркете появились комиссия 8% (сток) и мгновенная продажа (70% цены).
--   4) Монетами и пылью нельзя писать напрямую из клиента: RLS оставлен
--      только на чтение, RPC — только для service_role.
--
-- Миграция НЕ трогает балансы существующих игроков: меняются только цены
-- (они уменьшаются примерно в 8–10 раз) и новые правила для новых аккаунтов.
--
-- ПОРЯДОК ПРИМЕНЕНИЯ: сначала эта миграция, потом деплой приложения.
-- Списание монет переведено на economy_spend, а RLS на user_coins/user_dust
-- оставлен только на чтение — без этой миграции крутки и возвраты будут падать.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Стартовый бонус нового аккаунта: 2 000 монет (было 10 000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_final()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, username, updated_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_coins (id, coins)
    VALUES (NEW.id, 2000)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create coins for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_pity (id, bad_luck_streak)
    VALUES (NEW.id, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create pity for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_dust (id, dust)
    VALUES (NEW.id, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create dust for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_battle_progress (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create battle progress for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
    VALUES (NEW.id, '{}', NULL, 'balance')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create battle deck for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_ladder (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create ladder entry for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Дефолт новых строк (используется, если триггер по какой-то причине не сработал)
ALTER TABLE public.user_coins ALTER COLUMN coins SET DEFAULT 2000;

-- ---------------------------------------------------------------------------
-- 2. Журнал движения монет (нужен, чтобы балансировать экономику, а не гадать)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economy_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_ledger_user ON public.economy_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economy_ledger_reason ON public.economy_ledger(reason, created_at DESC);

ALTER TABLE public.economy_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economy_ledger_read_all" ON public.economy_ledger;
CREATE POLICY "economy_ledger_read_all"
  ON public.economy_ledger
  FOR SELECT
  USING (true);

REVOKE ALL ON TABLE public.economy_ledger FROM anon, authenticated;
GRANT SELECT ON TABLE public.economy_ledger TO service_role;

COMMENT ON TABLE public.economy_ledger IS 'История изменений баланса монет: faucets (>) и sinks (<)';

-- ---------------------------------------------------------------------------
-- 3. Ежедневная награда — якорь возврата в игру
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_claim_date DATE,
  streak INTEGER NOT NULL DEFAULT 0,
  total_claims INTEGER NOT NULL DEFAULT 0,
  lifetime_coins INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_daily_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_daily_state_read_own" ON public.user_daily_state;
CREATE POLICY "user_daily_state_read_own"
  ON public.user_daily_state
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_daily_state FROM anon;
GRANT SELECT ON TABLE public.user_daily_state TO authenticated;

-- Награда за день серии. Держим в БД, чтобы клиент не мог нарисовать себе
-- 7-й день за 5 секунд. Значения совпадают с DAILY_REWARDS в lib/economy.ts.
CREATE OR REPLACE FUNCTION public.economy_claim_daily(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_yesterday date := (now() AT TIME ZONE 'utc')::date - 1;
  v_state public.user_daily_state%ROWTYPE;
  v_streak integer;
  v_day integer;
  v_coins integer;
  v_dust integer;
BEGIN
  SELECT * INTO v_state
  FROM public.user_daily_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_streak := 0;
  ELSIF v_state.last_claim_date = v_today THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed', 'streak', v_state.streak);
  ELSIF v_state.last_claim_date = v_yesterday THEN
    v_streak := v_state.streak;            -- серия жива
  ELSE
    v_streak := 0;                          -- пропустил день — серия сброшена
  END IF;

  v_day := (v_streak % 7) + 1;
  v_coins := (ARRAY[50, 75, 100, 125, 175, 225, 300])[v_day];
  v_dust := (ARRAY[0, 0, 25, 25, 50, 50, 100])[v_day];

  INSERT INTO public.user_coins (id, coins)
  VALUES (p_user_id, v_coins)
  ON CONFLICT (id) DO UPDATE
    SET coins = public.user_coins.coins + v_coins, updated_at = NOW();

  IF v_dust > 0 THEN
    INSERT INTO public.user_dust (id, dust)
    VALUES (p_user_id, v_dust)
    ON CONFLICT (id) DO UPDATE
      SET dust = public.user_dust.dust + v_dust, updated_at = NOW();
  END IF;

  INSERT INTO public.economy_ledger (user_id, amount, reason, meta)
  VALUES (p_user_id, v_coins, 'daily_bonus', jsonb_build_object('day', v_day, 'dust', v_dust));

  INSERT INTO public.user_daily_state (user_id, last_claim_date, streak, total_claims, lifetime_coins, updated_at)
  VALUES (p_user_id, v_today, v_day, 1, v_coins, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET last_claim_date = v_today,
        streak = v_day,
        total_claims = public.user_daily_state.total_claims + 1,
        lifetime_coins = public.user_daily_state.lifetime_coins + v_coins,
        updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'day', v_day,
    'coins', v_coins,
    'dust', v_dust,
    'streak', v_day
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Вехи коллекции — цель после первых 10–20 карт
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economy_milestone_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_cards INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, milestone_cards)
);

ALTER TABLE public.economy_milestone_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.economy_milestone_claims FROM anon, authenticated;
GRANT ALL ON TABLE public.economy_milestone_claims TO service_role;

-- Выдать награду за веху, если размер коллекции её достиг.
-- Клиент присылает только заявленное количество карт — функция пересчитывает
-- его сама по таблице user_cards, поэтому «дорисовать» коллекцию нельзя.
CREATE OR REPLACE FUNCTION public.economy_claim_milestone(p_user_id uuid, p_cards integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_real_count integer;
  v_coins integer;
  v_dust integer;
  v_title text;
  v_milestone RECORD;
BEGIN
  SELECT count(*) INTO v_real_count
  FROM public.user_cards
  WHERE user_id = p_user_id;

  IF v_real_count < p_cards THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_cards', 'cards', v_real_count);
  END IF;

  FOR v_milestone IN
    SELECT * FROM (VALUES
      (10,   50,   0, 'Первые десять'),
      (25,  150,  25, 'Коллекционер'),
      (50,  300,  50, 'Полсотни героев'),
      (100, 700, 100, 'Ветеран гачи'),
      (200, 1500, 250, 'Легенда коллекции')
    ) AS t(cards, coins, dust, title)
    WHERE t.cards <= p_cards
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.economy_milestone_claims
      WHERE user_id = p_user_id AND milestone_cards = v_milestone.cards
    );

    v_coins := v_milestone.coins;
    v_dust := v_milestone.dust;
    v_title := v_milestone.title;

    INSERT INTO public.economy_milestone_claims (user_id, milestone_cards)
    VALUES (p_user_id, v_milestone.cards);

    INSERT INTO public.user_coins (id, coins)
    VALUES (p_user_id, v_coins)
    ON CONFLICT (id) DO UPDATE
      SET coins = public.user_coins.coins + v_coins, updated_at = NOW();

    IF v_dust > 0 THEN
      INSERT INTO public.user_dust (id, dust)
      VALUES (p_user_id, v_dust)
      ON CONFLICT (id) DO UPDATE
        SET dust = public.user_dust.dust + v_dust, updated_at = NOW();
    END IF;

    INSERT INTO public.economy_ledger (user_id, amount, reason, meta)
    VALUES (p_user_id, v_coins, 'collection_milestone',
            jsonb_build_object('cards', v_milestone.cards, 'dust', v_dust));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cards', v_real_count, 'granted', v_coins, 'title', v_title);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Маркет: нижняя граница цены, комиссия 8%
-- ---------------------------------------------------------------------------
ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS market_listings_price_check;
ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_price_check CHECK (price >= 1);

-- Комиссия маркета. Монеты сгорают: это сток, из-за которого рушится
-- «напечатать монеты на гаче и сразу слить на рынке».
CREATE OR REPLACE FUNCTION public.market_execute_purchase(
  p_listing_id uuid,
  p_buyer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_buyer_coins integer;
  v_tax integer;
  v_seller_gets integer;
BEGIN
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF v_listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  IF v_listing.reserved_by IS NOT NULL
     AND v_listing.reserved_by != p_buyer_id
     AND v_listing.reserved_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reserved');
  END IF;

  SELECT coins INTO v_buyer_coins
  FROM public.user_coins
  WHERE id = p_buyer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'buyer_no_coins_row');
  END IF;

  IF v_buyer_coins < v_listing.price THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_coins',
      'need', v_listing.price, 'have', v_buyer_coins
    );
  END IF;

  -- 8% комиссии уходит продавцу, 92% — маркету (сжигается)
  v_tax := (v_listing.price * 8) / 100;
  v_seller_gets := v_listing.price - v_tax;

  INSERT INTO public.user_coins (id, coins, updated_at)
  VALUES (v_listing.seller_id, 2000, now())
  ON CONFLICT (id) DO NOTHING;

  PERFORM 1 FROM public.user_coins WHERE id = v_listing.seller_id FOR UPDATE;

  UPDATE public.user_coins
  SET coins = coins - v_listing.price, updated_at = now()
  WHERE id = p_buyer_id;

  UPDATE public.user_coins
  SET coins = coins + v_seller_gets, updated_at = now()
  WHERE id = v_listing.seller_id;

  IF v_tax > 0 THEN
    INSERT INTO public.economy_ledger (user_id, amount, reason, meta)
    VALUES (v_listing.seller_id, -v_tax, 'market_tax',
            jsonb_build_object('listing_id', p_listing_id, 'price', v_listing.price));
  END IF;

  INSERT INTO public.market_sales_history (
    listing_id, seller_id, buyer_id, price, unique_id, serial_id, name, anime, rarity,
    character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, frame_modifier, coating_modifier
  )
  VALUES (
    v_listing.id, v_listing.seller_id, p_buyer_id, v_listing.price,
    v_listing.unique_id, v_listing.serial_id, v_listing.name, v_listing.anime, v_listing.rarity,
    v_listing.character_id,
    v_listing.stats_hp, v_listing.stats_atk, v_listing.stats_def, v_listing.stats_spd, v_listing.stats_luck,
    COALESCE(v_listing.is_main_character, false), v_listing.frame_modifier, v_listing.coating_modifier
  );

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted, frame_modifier, coating_modifier,
    art_position
  )
  VALUES (
    p_buyer_id, v_listing.unique_id, v_listing.serial_id, v_listing.name, v_listing.anime, v_listing.rarity,
    v_listing.image_url, v_listing.original_url, v_listing.fallback_urls,
    v_listing.score, v_listing.shiki_id, v_listing.character_id,
    v_listing.stats_hp, v_listing.stats_atk, v_listing.stats_def, v_listing.stats_spd, v_listing.stats_luck,
    COALESCE(v_listing.is_main_character, false), v_listing.pack_id, v_listing.pack_name,
    COALESCE(v_listing.is_art_blacklisted, false), v_listing.frame_modifier, v_listing.coating_modifier,
    COALESCE(v_listing.art_position, '{"x": 50, "y": 50}'::jsonb)
  );

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'ok', true,
    'unique_id', v_listing.unique_id,
    'tax', v_tax,
    'seller_gets', v_seller_gets
  );
END;
$$;

-- Нижняя граница лота теперь задаётся формулой (60% от справедливой цены),
-- а не жёсткими 50 монетами: мусорные карты должны стоить копейки.
CREATE OR REPLACE FUNCTION public.market_put_listing(
  p_seller_id uuid,
  p_unique_id text,
  p_price integer,
  p_min_price integer,
  p_max_price integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_max_price < p_min_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_price_bounds');
  END IF;

  IF p_price < 1 OR p_price < p_min_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_below_min', 'min_price', p_min_price);
  END IF;

  IF p_price > p_max_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_above_max', 'max_price', p_max_price);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_cards WHERE user_id = p_seller_id AND unique_id = p_unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.market_listings WHERE unique_id = p_unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_listed');
  END IF;

  INSERT INTO public.market_listings (
    seller_id, price, min_price_at_list, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted,
    frame_modifier, coating_modifier, art_position
  )
  SELECT
    p_seller_id, p_price, p_min_price, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), pack_id, pack_name, COALESCE(is_art_blacklisted, false),
    frame_modifier, coating_modifier, COALESCE(art_position, '{"x": 50, "y": 50}'::jsonb)
  FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Мгновенная продажа: монеты сейчас, но 30% цены теряется
-- ---------------------------------------------------------------------------
-- Без неё продавец должен был выставить лот и ждать покупателя — это и есть
-- причина, по которой никто не торговал. Цена приходит с сервера и не может
-- быть подкручена клиентом.
CREATE OR REPLACE FUNCTION public.market_instant_sell(
  p_seller_id uuid,
  p_unique_id text,
  p_price integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.user_cards%ROWTYPE;
BEGIN
  IF p_price < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_price');
  END IF;

  SELECT * INTO v_card
  FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_not_found');
  END IF;

  INSERT INTO public.user_coins (id, coins, updated_at)
  VALUES (p_seller_id, p_price, now())
  ON CONFLICT (id) DO UPDATE
    SET coins = public.user_coins.coins + p_price, updated_at = now();

  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  INSERT INTO public.economy_ledger (user_id, amount, reason, meta)
  VALUES (p_seller_id, p_price, 'instant_sell',
          jsonb_build_object('unique_id', p_unique_id, 'rarity', v_card.rarity));

  RETURN jsonb_build_object('ok', true, 'price', p_price);
END;
$$;

REVOKE ALL ON FUNCTION public.market_instant_sell(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_instant_sell(uuid, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Возвраты круток: одноразовый токен вместо безусловного «add»
-- ---------------------------------------------------------------------------
-- Раньше POST /api/coins принимал { operation: 'add', amount } от клиента:
-- достаточно было одного запроса из консоли, чтобы напечатать себе монеты.
-- Теперь возврат возможен только за токен, который сервер выдаёт при СПИСАНИИ.
-- Токен одноразовый и равен сумме списания, поэтому «списать 50 → вернуть 50»
-- не даёт ни одной лишней монеты: чистый баланс не меняется.
CREATE TABLE IF NOT EXISTS public.economy_refund_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_refund_tokens_user ON public.economy_refund_tokens(user_id, created_at DESC);

ALTER TABLE public.economy_refund_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.economy_refund_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.economy_refund_tokens TO service_role;

-- Выдать токен возврата (вызывается сразу после успешного списания).
CREATE OR REPLACE FUNCTION public.economy_issue_refund(p_user_id uuid, p_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.economy_refund_tokens (user_id, amount)
  VALUES (p_user_id, p_amount)
  RETURNING token INTO v_token;

  -- Подчищаем старые токены (48ч — с запасом на «зависшую» вкладку)
  DELETE FROM public.economy_refund_tokens
  WHERE user_id = p_user_id AND created_at < now() - interval '48 hours';

  RETURN v_token;
END;
$$;

-- Атомарное списание за крутку + выдача токена возврата.
-- Раньше списание было «прочитал → посчитал → записал» из API: два параллельных
-- запроса могли списать монеты дважды, а отрицательный amount вообще начислял
-- монеты. Здесь всё делает база под блокировкой строки.
CREATE OR REPLACE FUNCTION public.economy_spend(p_user_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_token uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_coins WHERE id = p_user_id) THEN
    INSERT INTO public.user_coins (id, coins) VALUES (p_user_id, 2000)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT coins INTO v_balance
  FROM public.user_coins
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins', 'need', p_amount, 'have', v_balance);
  END IF;

  UPDATE public.user_coins
  SET coins = v_balance - p_amount, updated_at = now()
  WHERE id = p_user_id;

  v_token := public.economy_issue_refund(p_user_id, p_amount);

  RETURN jsonb_build_object(
    'ok', true,
    'new_balance', v_balance - p_amount,
    'refund_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.economy_spend(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_spend(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.economy_spend IS 'Атомарное списание монет за крутку с выдачей одноразового токена возврата';

-- Погасить токен и вернуть монеты.
CREATE OR REPLACE FUNCTION public.economy_redeem_refund(p_user_id uuid, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.economy_refund_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.economy_refund_tokens
  WHERE token = p_token AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_already_used');
  END IF;

  UPDATE public.economy_refund_tokens
  SET used_at = now()
  WHERE token = p_token;

  INSERT INTO public.user_coins (id, coins, updated_at)
  VALUES (p_user_id, v_row.amount, now())
  ON CONFLICT (id) DO UPDATE
    SET coins = public.user_coins.coins + v_row.amount, updated_at = now();

  INSERT INTO public.economy_ledger (user_id, amount, reason, meta)
  VALUES (p_user_id, v_row.amount, 'spin_refund', jsonb_build_object('token', p_token));

  RETURN jsonb_build_object('ok', true, 'amount', v_row.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.economy_issue_refund(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_issue_refund(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.economy_redeem_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_redeem_refund(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Закрываем печать монет
-- ---------------------------------------------------------------------------
-- add_coins_secure/add_dust_secure были доступны роли authenticated:
-- консоль браузера позволяла напечатать себе любую сумму.
REVOKE ALL ON FUNCTION public.add_coins_secure(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_dust_secure(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_coins_secure(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_dust_secure(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.economy_claim_daily(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_claim_daily(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.economy_claim_milestone(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_claim_milestone(uuid, integer) TO service_role;

-- Балансы читаются клиентом, но не пишутся: все изменения идут через
-- серверные роуты (service_role) или SECURITY DEFINER функции.
DROP POLICY IF EXISTS "Users can update own coins" ON public.user_coins;
DROP POLICY IF EXISTS "Users can update own dust" ON public.user_dust;
DROP POLICY IF EXISTS "Users can view own coins" ON public.user_coins;
DROP POLICY IF EXISTS "Users can view own dust" ON public.user_dust;

CREATE POLICY "Users can view own coins"
  ON public.user_coins
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view own dust"
  ON public.user_dust
  FOR SELECT
  USING (auth.uid() = id);

COMMENT ON FUNCTION public.economy_claim_daily IS 'Ежедневная награда с серией дней (створ, только service_role)';
COMMENT ON FUNCTION public.economy_claim_milestone IS 'Награда за веху коллекции; количество карт пересчитывается на сервере';
COMMENT ON FUNCTION public.market_instant_sell IS 'Мгновенная продажа карты за монеты по фиксированной цене (70% справедливой)';
