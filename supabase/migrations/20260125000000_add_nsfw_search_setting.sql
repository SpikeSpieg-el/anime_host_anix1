-- Add allow_nsfw_search field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS allow_nsfw_search BOOLEAN DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN profiles.allow_nsfw_search IS 'Allows user to see NSFW content (hentai) in search results';
