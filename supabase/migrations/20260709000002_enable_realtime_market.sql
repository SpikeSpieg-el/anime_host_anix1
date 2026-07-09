-- Enable Supabase Realtime on market_listings table
-- This allows the frontend to subscribe to INSERT/UPDATE/DELETE events
-- so that when a card is bought/cancelled/listed, all users see it instantly

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_listings;
