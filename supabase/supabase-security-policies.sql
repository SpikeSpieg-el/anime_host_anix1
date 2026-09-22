-- ============================================================
-- SUPABASE RLS SECURITY POLICIES (FIXED & HARDENED)
-- ============================================================

-- 1. ВКЛЮЧАЕМ RLS НА ВСЕХ ТАБЛИЦАХ (с проверкой существования)
DO $$
BEGIN
    -- Enable RLS only if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_coins' AND table_schema = 'public') THEN
        ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cards' AND table_schema = 'public') THEN
        ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_inventory' AND table_schema = 'public') THEN
        ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookmarks' AND table_schema = 'public') THEN
        ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watch_history' AND table_schema = 'public') THEN
        ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_stats' AND table_schema = 'public') THEN
        ALTER TABLE account_stats ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_pity' AND table_schema = 'public') THEN
        ALTER TABLE user_pity ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'market_listings' AND table_schema = 'public') THEN
        ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================
-- 2. ФУНКЦИЯ ПРОВЕРКИ АДМИНА (УПРОЩЕННАЯ ВЕРСИЯ)
-- ============================================================
-- Если у вас нет колонки is_admin, эта функция всегда возвращает false
-- Вы можете добавить свою логику проверки админов здесь
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Если колонка is_admin существует, проверяем её
  -- Если нет - возвращаем false (нет админов)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin' AND table_schema = 'public'
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    );
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- ============================================================
-- 3. ТАБЛИЦА PROFILES (Защита от самовыдачи админки)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
        DROP POLICY IF EXISTS "No direct profile inserts" ON profiles;
        DROP POLICY IF EXISTS "No direct profile deletes" ON profiles;

        -- Публичный просмотр профилей
        CREATE POLICY "Anyone can read profiles"
          ON profiles FOR SELECT
          USING (true);

        -- Проверяем, существует ли колонка is_admin
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'is_admin' AND table_schema = 'public'
        ) THEN
            -- Защита: Пользователь может менять свой профиль, НО НЕ МОЖЕТ изменить is_admin на true!
            CREATE POLICY "Users can update own profile safe"
              ON profiles FOR UPDATE
              USING (auth.uid() = id)
              WITH CHECK (
                auth.uid() = id AND 
                -- Если пользователь не админ, он не имеет права трогать колонку is_admin
                (is_admin = false OR is_admin() = true)
              );
        ELSE
            -- Если колонки is_admin нет, просто разрешаем обновление своего профиля
            CREATE POLICY "Users can update own profile"
              ON profiles FOR UPDATE
              USING (auth.uid() = id)
              WITH CHECK (auth.uid() = id);
        END IF;

        CREATE POLICY "No direct profile inserts"
          ON profiles FOR INSERT
          WITH CHECK (false);

        CREATE POLICY "No direct profile deletes"
          ON profiles FOR DELETE
          USING (false);
    END IF;
END $$;

-- ============================================================
-- 4. ТАБЛИЦА USER_COINS (Деньги и валюта)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_coins' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can read own coins" ON user_coins;
        DROP POLICY IF EXISTS "No direct coin inserts" ON user_coins;
        DROP POLICY IF EXISTS "No direct coin updates" ON user_coins;
        DROP POLICY IF EXISTS "No direct coin deletes" ON user_coins;

        -- Внимание: если у вас колонка user_id, замените id на user_id
        CREATE POLICY "Users can read own coins"
          ON user_coins FOR SELECT
          USING (auth.uid() = id);

        -- Блокируем прямые изменения монет с клиента
        CREATE POLICY "No direct coin modifications"
          ON user_coins FOR ALL
          USING (false)
          WITH CHECK (false);
    END IF;
END $$;

-- ============================================================
-- 5. ТАБЛИЦА CARDS (Коллекционные карты)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cards' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can read own cards" ON cards;
        DROP POLICY IF EXISTS "Users can update own cards limited" ON cards;
        DROP POLICY IF EXISTS "No direct card inserts" ON cards;
        DROP POLICY IF EXISTS "No direct card deletes" ON cards;

        CREATE POLICY "Users can read own cards"
          ON cards FOR SELECT
          USING (auth.uid() = user_id);

        -- Прямой UPDATE с клиента блокируем, чтобы не накручивали статы карт!
        -- Смену колоды делайте через Server Action / API Route с Service Role Key
        CREATE POLICY "Cards modify server only"
          ON cards FOR ALL
          USING (false)
          WITH CHECK (false);
    END IF;
END $$;

-- ============================================================
-- 6. ТАБЛИЦА USER_INVENTORY & ACCOUNT_STATS & USER_PITY
-- ============================================================
DO $$
BEGIN
    -- Инвентарь
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_inventory' AND table_schema = 'public') THEN
        CREATE POLICY "Users can read own inventory"
          ON user_inventory FOR SELECT
          USING (auth.uid() = user_id);

        CREATE POLICY "Inventory modify server only"
          ON user_inventory FOR ALL
          USING (false)
          WITH CHECK (false);
    END IF;

    -- Статистика аккаунта
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_stats' AND table_schema = 'public') THEN
        CREATE POLICY "Users can read own stats"
          ON account_stats FOR SELECT
          USING (auth.uid() = user_id);

        CREATE POLICY "Stats modify server only"
          ON account_stats FOR ALL
          USING (false)
          WITH CHECK (false);
    END IF;

    -- Гача / Гарант (Pity)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_pity' AND table_schema = 'public') THEN
        CREATE POLICY "Users can read own pity"
          ON user_pity FOR SELECT
          USING (auth.uid() = id);

        CREATE POLICY "Pity modify server only"
          ON user_pity FOR ALL
          USING (false)
          WITH CHECK (false);
    END IF;
END $$;

-- ============================================================
-- 7. ТАБЛИЦА MARKET_LISTINGS (Рынок)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'market_listings' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Anyone can read market listings" ON market_listings;
        DROP POLICY IF EXISTS "Users can create own listings" ON market_listings;
        DROP POLICY IF EXISTS "Users can update own listings" ON market_listings;
        DROP POLICY IF EXISTS "Users can delete own listings" ON market_listings;

        -- Смотреть лоты могут все
        CREATE POLICY "Anyone can read market listings"
          ON market_listings FOR SELECT
          USING (true);

        -- Выставление на рынок и покупка должны идти ИСКЛЮЧИТЕЛЬНО через API/Server Action!
        -- Иначе неизбежен дюп карт и денег.
        CREATE POLICY "Market listings modify server only"
          ON market_listings FOR INSERT
          WITH CHECK (false);

        CREATE POLICY "Market listings update server only"
          ON market_listings FOR UPDATE
          USING (false)
          WITH CHECK (false);

        CREATE POLICY "Market listings delete server only"
          ON market_listings FOR DELETE
          USING (false);
    END IF;
END $$;

-- ============================================================
-- 8. ЗАКЛАДКИ И ИСТОРИЯ (BOOKMARKS / WATCH_HISTORY)
-- ============================================================
DO $$
BEGIN
    -- Закладки
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookmarks' AND table_schema = 'public') THEN
        CREATE POLICY "Users can manage own bookmarks"
          ON bookmarks FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- История просмотров
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watch_history' AND table_schema = 'public') THEN
        CREATE POLICY "Users can manage own history"
          ON watch_history FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ
-- ============================================================
-- 1. Этот скрипт безопасен - он проверяет существование таблиц и колонок перед созданием политик
-- 2. Запустите этот скрипт в SQL Editor в Supabase Dashboard
-- 3. После выполнения проверьте, что RLS включен на всех таблицах:
--    Authentication -> Policies -> убедитесь, что переключатель RLS включен
-- 4. Если какие-то таблицы отсутствуют в вашей БД, скрипт просто пропустит их
-- 5. Если колонка is_admin отсутствует, скрипт создаст упрощенные политики без проверки админов
-- 6. Проверьте работу приложения после применения политик
-- 7. Все операции изменения монет, карт и инвентаря теперь должны идти через API routes
-- ============================================================