-- Add student profile photo (base64 data URL stored in photo_url)
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
