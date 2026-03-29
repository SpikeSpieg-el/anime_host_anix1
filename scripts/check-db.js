const { createClient } = require('@supabase/supabase-js')

// Load environment variables manually
const supabaseUrl = 'https://xfjwrdructxzreadmenb.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmandyZHJ1Y3R4enJlYWRtZW5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1MjY3NiwiZXhwIjoyMDg0NzI4Njc2fQ.HMggV5rGO_h8mYf8NGYfj61H7hcMFo46I6WpE-eEn4g'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkDatabase() {
  try {
    console.log('Checking user_cards table...')
    
    // Check if table exists
    const { data, error } = await supabase
      .from('user_cards')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Table check error:', error)
      
      if (error.code === 'PGRST116') {
        console.log('Table user_cards does not exist. Running migration...')
        
        // Run the migration manually
        const { error: migrateError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS public.user_cards (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              unique_id TEXT NOT NULL,
              serial_id TEXT NOT NULL,
              name TEXT NOT NULL,
              anime TEXT NOT NULL,
              rarity TEXT NOT NULL,
              image_url TEXT NOT NULL,
              original_url TEXT NOT NULL,
              fallback_urls TEXT[],
              score DECIMAL NOT NULL DEFAULT 0,
              shiki_id INTEGER NOT NULL,
              character_id INTEGER NOT NULL,
              stats_hp INTEGER NOT NULL DEFAULT 0,
              stats_atk INTEGER NOT NULL DEFAULT 0,
              stats_def INTEGER NOT NULL DEFAULT 0,
              stats_spd INTEGER NOT NULL DEFAULT 0,
              stats_luck INTEGER NOT NULL DEFAULT 0,
              is_main_character BOOLEAN DEFAULT FALSE,
              pack_id TEXT,
              pack_name TEXT,
              is_art_blacklisted BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
            DROP POLICY IF EXISTS "Users can insert own cards" ON public.user_cards;
            DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;
            
            CREATE POLICY "Users can view own cards"
              ON public.user_cards
              FOR SELECT
              USING (auth.uid() = user_id);
            
            CREATE POLICY "Users can insert own cards"
              ON public.user_cards
              FOR INSERT
              WITH CHECK (auth.uid() = user_id);
            
            CREATE POLICY "Users can delete own cards"
              ON public.user_cards
              FOR DELETE
              USING (auth.uid() = user_id);
          `
        })
        
        if (migrateError) {
          console.error('Migration error:', migrateError)
        } else {
          console.log('Migration completed successfully')
        }
      }
    } else {
      console.log('Table user_cards exists')
      console.log('Record count:', data?.length || 0)
    }
    
    // Check indexes
    console.log('Checking indexes...')
    const { data: indexes } = await supabase
      .from('pg_indexes')
      .select('*')
      .eq('tablename', 'user_cards')
    
    console.log('Indexes:', indexes?.length || 0)
    
  } catch (error) {
    console.error('Database check error:', error)
  }
}

checkDatabase()
