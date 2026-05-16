-- Ensure is_active column exists and is indexed for performance
ALTER TABLE tb_products MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE tb_merchant_products MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Add index if not exists (MySQL syntax varies, so we just run it)
CREATE INDEX idx_products_active ON tb_products(is_active);
CREATE INDEX idx_merch_products_active ON tb_merchant_products(is_active);
