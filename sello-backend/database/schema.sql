-- Selo Phase 1 Database Schema
-- Import this file in phpMyAdmin or run: mysql -u root -p < database/schema.sql
-- The schema models a single masterbrand, inherited merchant catalogues, delinked products, and COD orders.

CREATE DATABASE IF NOT EXISTS selo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE selo_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tb_order_items;
DROP TABLE IF EXISTS tb_orders;
DROP TABLE IF EXISTS tb_notifications;
DROP TABLE IF EXISTS tb_app_catalogue;
DROP TABLE IF EXISTS tb_merchant_products;
DROP TABLE IF EXISTS tb_products;
DROP TABLE IF EXISTS tb_categories;
DROP TABLE IF EXISTS tb_users;
DROP TABLE IF EXISTS tb_merchants;
DROP TABLE IF EXISTS tb_masterbrand;
SET FOREIGN_KEY_CHECKS = 1;

-- Masterbrand owns the universal catalogue shared with inherited merchants.
CREATE TABLE tb_masterbrand (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  code          VARCHAR(60) NOT NULL UNIQUE,
  description   TEXT,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Merchants inherit products from the masterbrand and can later delink individual products.
CREATE TABLE tb_merchants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NOT NULL,
  name            VARCHAR(160) NOT NULL,
  code            VARCHAR(80) NOT NULL UNIQUE,
  slug            VARCHAR(160) NOT NULL UNIQUE,
  description     TEXT,
  contact_email   VARCHAR(160),
  phone           VARCHAR(30),
  address         TEXT,
  theme_color     VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_merchants_masterbrand
    FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  INDEX idx_tb_merchants_masterbrand (masterbrand_id),
  INDEX idx_tb_merchants_slug (slug)
) ENGINE=InnoDB AUTO_INCREMENT=100001;

-- Platform users are dashboard users only in Phase 1: admin and merchant admins.
CREATE TABLE tb_users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NULL,
  merchant_id     INT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('SUPER_ADMIN', 'MASTERBRAND_ADMIN', 'MERCHANT_ADMIN') NOT NULL,
  phone           VARCHAR(30),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_users_masterbrand
    FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE SET NULL,
  CONSTRAINT fk_tb_users_merchant
    FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE SET NULL,
  INDEX idx_tb_users_role (role),
  INDEX idx_tb_users_merchant (merchant_id)
) ENGINE=InnoDB;

-- Nested category structure: root category + optional subcategory.
CREATE TABLE tb_categories (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NOT NULL,
  parent_id       INT NULL,
  name            VARCHAR(150) NOT NULL,
  slug            VARCHAR(180) NOT NULL,
  description     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_categories_masterbrand
    FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_categories_parent
    FOREIGN KEY (parent_id) REFERENCES tb_categories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tb_categories_slug (masterbrand_id, parent_id, slug),
  INDEX idx_tb_categories_parent (parent_id)
) ENGINE=InnoDB;

-- Universal masterbrand catalogue. Merchants inherit these rows by default.
CREATE TABLE tb_products (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id    INT NOT NULL,
  category_id       INT NOT NULL,
  sku               VARCHAR(100) NOT NULL UNIQUE,
  name              VARCHAR(180) NOT NULL,
  short_description VARCHAR(255),
  description       TEXT,
  ai_description    TEXT,
  price             DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock_qty         INT NOT NULL DEFAULT 0,
  image_url         VARCHAR(500),
  sort_order        INT NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_products_masterbrand
    FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_products_category
    FOREIGN KEY (category_id) REFERENCES tb_categories(id) ON DELETE RESTRICT,
  INDEX idx_tb_products_category (category_id),
  INDEX idx_tb_products_masterbrand (masterbrand_id)
) ENGINE=InnoDB;

-- Delinked merchant copy of a master product. Only created after merchant chooses to delink.
CREATE TABLE tb_merchant_products (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id       INT NOT NULL,
  source_product_id INT NOT NULL,
  category_id       INT NOT NULL,
  sku               VARCHAR(100) NOT NULL,
  name              VARCHAR(180) NOT NULL,
  short_description VARCHAR(255),
  description       TEXT,
  ai_description    TEXT,
  price             DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock_qty         INT NOT NULL DEFAULT 0,
  image_url         VARCHAR(500),
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  is_delinked       TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_merchant_products_merchant
    FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_merchant_products_source
    FOREIGN KEY (source_product_id) REFERENCES tb_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_merchant_products_category
    FOREIGN KEY (category_id) REFERENCES tb_categories(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_tb_merchant_products_source (merchant_id, source_product_id),
  INDEX idx_tb_merchant_products_merchant (merchant_id)
) ENGINE=InnoDB;

-- Catalogue bridge points a merchant either to the master row or to its delinked merchant row.
CREATE TABLE tb_app_catalogue (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id         INT NOT NULL,
  product_id          INT NOT NULL,
  override_product_id INT NULL,
  source_type         ENUM('MASTER', 'MERCHANT') NOT NULL DEFAULT 'MASTER',
  is_available        TINYINT(1) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_app_catalogue_merchant
    FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_app_catalogue_product
    FOREIGN KEY (product_id) REFERENCES tb_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_app_catalogue_override
    FOREIGN KEY (override_product_id) REFERENCES tb_merchant_products(id) ON DELETE SET NULL,
  UNIQUE KEY uq_tb_app_catalogue (merchant_id, product_id),
  INDEX idx_tb_app_catalogue_override (override_product_id)
) ENGINE=InnoDB;

-- Orders are stored against a merchant. Customer auth is skipped in Phase 1, so details are snapshot based.
CREATE TABLE tb_orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_no          VARCHAR(50) NOT NULL UNIQUE,
  masterbrand_id    INT NOT NULL,
  merchant_id       INT NOT NULL,
  placed_by_user_id INT NULL,
  customer_name     VARCHAR(120) NOT NULL,
  customer_phone    VARCHAR(30) NOT NULL,
  customer_email    VARCHAR(160),
  customer_address  TEXT NOT NULL,
  payment_method    ENUM('COD') NOT NULL DEFAULT 'COD',
  payment_status    ENUM('PENDING', 'COLLECTED') NOT NULL DEFAULT 'PENDING',
  order_status      ENUM('PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PLACED',
  subtotal          DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount      DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_orders_masterbrand
    FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_orders_merchant
    FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_orders_user
    FOREIGN KEY (placed_by_user_id) REFERENCES tb_users(id) ON DELETE SET NULL,
  INDEX idx_tb_orders_merchant (merchant_id),
  INDEX idx_tb_orders_status (order_status)
) ENGINE=InnoDB;

-- Order item snapshots preserve exactly what the customer ordered even after future catalogue edits.
CREATE TABLE tb_order_items (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  order_id             INT NOT NULL,
  source_product_id    INT NULL,
  merchant_product_id  INT NULL,
  product_name_snapshot VARCHAR(180) NOT NULL,
  sku_snapshot         VARCHAR(100),
  quantity             INT NOT NULL DEFAULT 1,
  unit_price           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  line_total           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_tb_order_items_order
    FOREIGN KEY (order_id) REFERENCES tb_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_order_items_source
    FOREIGN KEY (source_product_id) REFERENCES tb_products(id) ON DELETE SET NULL,
  CONSTRAINT fk_tb_order_items_merchant_product
    FOREIGN KEY (merchant_product_id) REFERENCES tb_merchant_products(id) ON DELETE SET NULL,
  INDEX idx_tb_order_items_order (order_id)
) ENGINE=InnoDB;

-- Notifications support dashboard feed + snooze behaviour in Phase 1.
CREATE TABLE tb_notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NULL,
  merchant_id   INT NULL,
  title         VARCHAR(180) NOT NULL,
  message       TEXT NOT NULL,
  type          ENUM('INFO', 'SUCCESS', 'WARNING') NOT NULL DEFAULT 'INFO',
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  snooze_until  DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tb_notifications_user
    FOREIGN KEY (user_id) REFERENCES tb_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tb_notifications_merchant
    FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE,
  INDEX idx_tb_notifications_merchant (merchant_id),
  INDEX idx_tb_notifications_user (user_id)
) ENGINE=InnoDB;

-- Seed masterbrand.
INSERT INTO tb_masterbrand (id, name, code, description, is_active)
VALUES
  (1, 'Selo Masterbrand', 'SELO', 'Phase 1 demo masterbrand for inherited merchant catalogue.', 1);

-- Seed merchants.
INSERT INTO tb_merchants (id, masterbrand_id, name, code, slug, description, contact_email, phone, address, theme_color, is_active)
VALUES
  (100001, 1, 'Selo Fresh Gurgaon', 'SELO_GGN', 'selo-fresh-gurgaon', 'Fresh groceries and pantry essentials for Gurgaon customers.', 'gurgaon@selo.com', '+91-9876543210', 'Sector 45, Gurgaon', '#0f766e', 1),
  (100002, 1, 'Selo Express Noida', 'SELO_NOIDA', 'selo-express-noida', 'Quick commerce style demo merchant with inherited catalogue.', 'noida@selo.com', '+91-9988776655', 'Sector 62, Noida', '#b45309', 1);

-- Seed dashboard users.
INSERT INTO tb_users (id, masterbrand_id, merchant_id, name, email, password_hash, role, phone, is_active)
VALUES
  (1, 1, NULL, 'Selo Admin', 'admin@selo.com', '$2a$10$9ijV1ga6bhmDY6CZzz1XH.WV4c6cPlU5aiqMSBKDN74LzoAmOufO6', 'MASTERBRAND_ADMIN', '+91-9000000000', 1),
  (2, 1, 100001, 'Aman Merchant', 'merchant1@selo.com', '$2a$10$5ZgvxDEoRHT6xZx5cCEPVeXOVCmWqbO8ej0spFRrjXaFLqvVlHUGm', 'MERCHANT_ADMIN', '+91-9111111111', 1),
  (3, 1, 100002, 'Sara Merchant', 'merchant2@selo.com', '$2a$10$5ZgvxDEoRHT6xZx5cCEPVeXOVCmWqbO8ej0spFRrjXaFLqvVlHUGm', 'MERCHANT_ADMIN', '+91-9222222222', 1);

-- Seed root categories and subcategories.
INSERT INTO tb_categories (id, masterbrand_id, parent_id, name, slug, description, sort_order, is_active)
VALUES
  (1, 1, NULL, 'Fresh Produce', 'fresh-produce', 'Root category for fruits and vegetables.', 1, 1),
  (2, 1, 1, 'Citrus Fruits', 'citrus-fruits', 'Subcategory used for fresh citrus inventory.', 1, 1),
  (3, 1, NULL, 'Pantry Staples', 'pantry-staples', 'Everyday staples for routine household ordering.', 2, 1),
  (4, 1, 3, 'Healthy Snacks', 'healthy-snacks', 'Subcategory for grab-and-go snacks.', 1, 1),
  (5, 1, NULL, 'Beverages', 'beverages', 'Beverage catalogue root for the demo webapp.', 3, 1),
  (6, 1, 5, 'Sparkling Water', 'sparkling-water', 'Subcategory used to show nested filters.', 1, 1);

-- Seed universal masterbrand products.
INSERT INTO tb_products (id, masterbrand_id, category_id, sku, name, short_description, description, ai_description, price, stock_qty, image_url, sort_order, is_active)
VALUES
  (1, 1, 2, 'SEL-ORG-001', 'Sunrise Orange Box', '8 handpicked oranges in a ready-to-sell box.', 'Fresh oranges packed for quick retail fulfilment and clean shelf presentation.', 'Sunrise Orange Box is a fresh citrus pack designed for reliable daily demand. It gives merchants a bright, premium-looking fruit option with simple ordering and display value.', 199.00, 60, 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=800&q=80', 1, 1),
  (2, 1, 4, 'SEL-BAR-002', 'Protein Nut Bar', 'Balanced snack bar for busy customers.', 'Compact energy bar with mixed nuts, dates and a clean-label presentation.', 'Protein Nut Bar is a compact impulse-purchase snack that fits wellness-focused baskets. Its simple positioning makes it easy for merchants to merchandise in checkout and snack zones.', 75.00, 140, 'https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=800&q=80', 2, 1),
  (3, 1, 6, 'SEL-SPK-003', 'Lime Spark Water', 'Zero-sugar sparkling water with lime finish.', 'Light sparkling drink suited for combo baskets and quick commerce beverage ordering.', 'Lime Spark Water adds a premium beverage option to the catalogue with a crisp citrus profile. It works well for basket-building and for merchants who want a modern drinks shelf.', 49.00, 200, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80', 3, 1),
  (4, 1, 3, 'SEL-RIC-004', 'Daily Basmati Rice', '5kg family pack of basmati rice.', 'Staple pantry line built for repeat household ordering and merchant trust.', 'Daily Basmati Rice is a dependable pantry staple aimed at repeat grocery purchases. It helps merchants anchor larger baskets with a recognizable, practical household essential.', 499.00, 45, 'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=800&q=80', 4, 1),
  (5, 1, 4, 'SEL-TRM-005', 'Roasted Trail Mix', 'Crunchy nut and seed blend.', 'A premium snack mix useful for gift, office and wellness baskets.', 'Roasted Trail Mix brings a premium snack option with broad appeal across office and personal orders. It is positioned as a high-value add-on product for better cart conversion.', 165.00, 90, 'https://images.unsplash.com/photo-1515543904379-3d757afe72e1?auto=format&fit=crop&w=800&q=80', 5, 1);

-- Every active merchant inherits every active master product in the mini version.
INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available)
SELECT m.id, p.id, 'MASTER', 1
FROM tb_merchants m
JOIN tb_products p ON p.masterbrand_id = m.masterbrand_id;

-- Seed one delinked merchant product to demonstrate override behaviour immediately after setup.
INSERT INTO tb_merchant_products (
  id, merchant_id, source_product_id, category_id, sku, name, short_description, description,
  ai_description, price, stock_qty, image_url, is_active, is_delinked
)
VALUES
  (1, 100002, 1, 2, 'SEL-ORG-001', 'Sunrise Orange Box - Merchant Edit', 'Noida store override with adjusted price and stock.', 'This delinked copy demonstrates that merchant-specific edits live outside the masterbrand product table.', 'Sunrise Orange Box - Merchant Edit is a merchant-managed override that keeps local merchandising flexible. It proves the delink flow where a merchant gets its own editable catalogue row.', 219.00, 35, 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=800&q=80', 1, 1);

UPDATE tb_app_catalogue
SET override_product_id = 1, source_type = 'MERCHANT'
WHERE merchant_id = 100002 AND product_id = 1;

-- Seed demo orders for dashboard metrics and order management page.
INSERT INTO tb_orders (
  id, order_no, masterbrand_id, merchant_id, placed_by_user_id, customer_name, customer_phone, customer_email,
  customer_address, payment_method, payment_status, order_status, subtotal, total_amount, notes
)
VALUES
  (1, 'SEL-1001', 1, 100001, NULL, 'Ritika Sharma', '+91-9000011111', 'ritika@example.com', 'DLF Phase 4, Gurgaon', 'COD', 'PENDING', 'PLACED', 274.00, 274.00, 'Please ring the bell once.'),
  (2, 'SEL-1002', 1, 100002, NULL, 'Karan Verma', '+91-9000022222', 'karan@example.com', 'Sector 75, Noida', 'COD', 'COLLECTED', 'DELIVERED', 438.00, 438.00, 'Leave at reception if unreachable.');

INSERT INTO tb_order_items (
  order_id, source_product_id, merchant_product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total
)
VALUES
  (1, 1, NULL, 'Sunrise Orange Box', 'SEL-ORG-001', 1, 199.00, 199.00),
  (1, 2, NULL, 'Protein Nut Bar', 'SEL-BAR-002', 1, 75.00, 75.00),
  (2, 1, 1, 'Sunrise Orange Box - Merchant Edit', 'SEL-ORG-001', 2, 219.00, 438.00);

-- Seed notifications for overview and snooze testing.
INSERT INTO tb_notifications (user_id, merchant_id, title, message, type, is_read, snooze_until)
VALUES
  (1, NULL, 'Merchant onboarding complete', '2 demo merchants are ready for inherited catalogue testing.', 'SUCCESS', 0, NULL),
  (NULL, 100001, 'Catalogue sync ready', 'Your store is currently using the masterbrand catalogue without delinks.', 'INFO', 0, NULL),
  (NULL, 100002, '1 product delinked', 'Sunrise Orange Box was delinked for merchant-specific pricing and stock.', 'WARNING', 0, NULL),
  (2, 100001, 'New order placed', 'A COD order has landed in your dashboard queue.', 'INFO', 0, NULL);
