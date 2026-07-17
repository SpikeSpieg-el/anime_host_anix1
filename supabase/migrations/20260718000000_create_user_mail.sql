-- Migration: Create user_mail table for gacha inbox (gifts, event rewards, currency)
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create user_mail table
CREATE TABLE IF NOT EXISTS public.user_mail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'system', -- 'system' | 'admin' | 'event:<event_id>'
  type TEXT NOT NULL CHECK (type IN ('card_gift', 'coins', 'dust', 'event_reward', 'message')),
  title TEXT NOT NULL,
  body TEXT,
  -- For card_gift: full card payload as JSONB (matches Card interface)
  card_payload JSONB,
  -- For coins/dust: amount
  amount INTEGER DEFAULT 0,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_mail_user_id ON public.user_mail(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mail_is_read ON public.user_mail(is_read);
CREATE INDEX IF NOT EXISTS idx_user_mail_is_claimed ON public.user_mail(is_claimed);
CREATE INDEX IF NOT EXISTS idx_user_mail_created_at ON public.user_mail(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_mail ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own mail" ON public.user_mail;
DROP POLICY IF EXISTS "Users can update own mail" ON public.user_mail;
DROP POLICY IF EXISTS "Users can delete own mail" ON public.user_mail;

-- Policy: Users can view their own mail
CREATE POLICY "Users can view own mail"
  ON public.user_mail
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own mail (mark read/claimed)
CREATE POLICY "Users can update own mail"
  ON public.user_mail
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own mail
CREATE POLICY "Users can delete own mail"
  ON public.user_mail
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: INSERT is done via service role key (admin only), so no INSERT policy for users.

COMMENT ON TABLE public.user_mail IS 'Stores gacha inbox messages with optional attachments (cards, coins, dust)';
COMMENT ON COLUMN public.user_mail.type IS 'Mail type: card_gift | coins | dust | event_reward | message';
COMMENT ON COLUMN public.user_mail.card_payload IS 'Full Card object as JSONB for card_gift type';
COMMENT ON COLUMN public.user_mail.amount IS 'Amount of coins/dust for currency gifts';
COMMENT ON COLUMN public.user_mail.is_claimed IS 'Whether the attachment has been claimed by the user';
