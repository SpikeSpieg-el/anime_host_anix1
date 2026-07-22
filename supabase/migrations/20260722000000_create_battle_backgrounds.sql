-- Battle Backgrounds table for custom full-screen battle backgrounds
CREATE TABLE IF NOT EXISTS battle_backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'both' CHECK (mode IN ('pvp', 'pve', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE battle_backgrounds ENABLE ROW LEVEL SECURITY;

-- Anyone can read active backgrounds (needed for client-side fetch)
CREATE POLICY "Anyone can read battle backgrounds"
  ON battle_backgrounds FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (admin actions use service role)
CREATE POLICY "Service role can manage battle backgrounds"
  ON battle_backgrounds FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
