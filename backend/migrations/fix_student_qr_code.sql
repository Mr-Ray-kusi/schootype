-- Some older student tables require qr_code. Keep it optional and aligned with barcode.
ALTER TABLE students ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE nonstaffs ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE nonstaffs ADD COLUMN IF NOT EXISTS photo_url TEXT;

DO $$
BEGIN
  BEGIN
    ALTER TABLE students ALTER COLUMN qr_code DROP NOT NULL;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE staffs ALTER COLUMN qr_code DROP NOT NULL;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE nonstaffs ALTER COLUMN qr_code DROP NOT NULL;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;

UPDATE students SET qr_code = barcode WHERE qr_code IS NULL AND barcode IS NOT NULL;
UPDATE staffs SET qr_code = barcode WHERE qr_code IS NULL AND barcode IS NOT NULL;
UPDATE nonstaffs SET qr_code = barcode WHERE qr_code IS NULL AND barcode IS NOT NULL;
