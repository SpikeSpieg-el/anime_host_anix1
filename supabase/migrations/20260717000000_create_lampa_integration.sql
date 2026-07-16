-- Lampa integration tables for PIN-based device auth and watch sync

-- Table: lampa_device_codes
-- Stores temporary PIN codes for TV-to-web activation flow
CREATE TABLE IF NOT EXISTS lampa_device_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin VARCHAR(6) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  user_id UUID, -- NULL until user enters PIN on website
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, authorized, expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  authorized_at TIMESTAMPTZ
);

-- Index for fast PIN lookup
CREATE INDEX IF NOT EXISTS idx_lampa_device_codes_pin ON lampa_device_codes(pin);
CREATE INDEX IF NOT EXISTS idx_lampa_device_codes_status ON lampa_device_codes(status);
CREATE INDEX IF NOT EXISTS idx_lampa_device_codes_expires ON lampa_device_codes(expires_at);

-- Table: lampa_device_tokens
-- Stores long-lived tokens for authenticated Lampa devices
CREATE TABLE IF NOT EXISTS lampa_device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of the JWT token
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_lampa_device_tokens_user ON lampa_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_lampa_device_tokens_hash ON lampa_device_tokens(token_hash);

-- Enable RLS
ALTER TABLE lampa_device_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lampa_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lampa_device_codes
-- Service role can do everything (used by API routes with service key)
-- Users can only read their own authorized codes
CREATE POLICY "Service role full access to device codes"
  ON lampa_device_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can read their own device codes"
  ON lampa_device_codes FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for lampa_device_tokens
CREATE POLICY "Service role full access to device tokens"
  ON lampa_device_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can read their own device tokens"
  ON lampa_device_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Function to clean up expired codes (can be called via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_lampa_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM lampa_device_codes WHERE expires_at < now() AND status = 'pending';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
