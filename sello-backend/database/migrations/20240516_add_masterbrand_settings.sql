-- Add settings columns to tb_masterbrand
ALTER TABLE tb_masterbrand
ADD COLUMN IF NOT EXISTS settings JSON DEFAULT (JSON_OBJECT('outOfStock', true, 'brandCustom', false, 'codEnabled', true));

-- Update existing rows to have default settings if null
UPDATE tb_masterbrand 
SET settings = JSON_OBJECT('outOfStock', true, 'brandCustom', false, 'codEnabled', true)
WHERE settings IS NULL;
