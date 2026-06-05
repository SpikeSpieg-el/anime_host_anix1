-- Migration: Add RPC functions for secure coins and dust operations
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Function to securely add coins to a user's balance
CREATE OR REPLACE FUNCTION public.add_coins_secure(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_coins (id, coins)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE SET
    coins = user_coins.coins + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to securely add dust to a user's balance
CREATE OR REPLACE FUNCTION public.add_dust_secure(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_dust (id, dust)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id) DO UPDATE SET
    dust = user_dust.dust + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.add_coins_secure(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_dust_secure(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.add_coins_secure IS 'Securely adds coins to a user balance with upsert logic';
COMMENT ON FUNCTION public.add_dust_secure IS 'Securely adds dust to a user balance with upsert logic';
