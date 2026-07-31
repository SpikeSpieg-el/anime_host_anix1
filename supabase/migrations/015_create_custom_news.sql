-- Create custom_news table for admin-managed news
CREATE TABLE IF NOT EXISTS public.custom_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  author TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_news_is_published ON public.custom_news(is_published);
CREATE INDEX IF NOT EXISTS idx_custom_news_created_at ON public.custom_news(created_at DESC);

-- Enable RLS
ALTER TABLE public.custom_news ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published news
CREATE POLICY "Allow public read access to published news" ON public.custom_news
  FOR SELECT
  USING (is_published = true);

-- Allow authenticated users (admin) full access
CREATE POLICY "Allow authenticated users full access" ON public.custom_news
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);