-- Optional: track SMS vs email on each message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_channel TEXT DEFAULT 'sms';
