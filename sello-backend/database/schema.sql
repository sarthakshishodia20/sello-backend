-- Selo Phase 1 Database Schema
-- Import this file to Aiven MySQL database to create structural tables
-- The schema models a single masterbrand, inherited merchant catalogues, delinked products, and COD orders.

CREATE DATABASE IF NOT EXISTS selo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE selo_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tb_order_items;
DROP TABLE IF EXISTS tb_orders;
DROP TABLE IF EXISTS tb_notification_received;
DROP TABLE IF EXISTS tb_notification_templates;
DROP TABLE IF EXISTS tb_masterbrand_activity;
DROP TABLE IF EXISTS tb_merchant_activity;
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
  settings      JSON DEFAULT (JSON_OBJECT('outOfStock', true, 'brandCustom', false, 'codEnabled', true)),
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
  image_url       VARCHAR(500) NULL,
  theme_color     VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  delivery_time   VARCHAR(50) NULL,
  delivery_mode   VARCHAR(50) NULL,
  city_name       VARCHAR(100) NULL,
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
  is_deleted      TINYINT(1) NOT NULL DEFAULT 0,
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
  is_deleted        TINYINT(1) NOT NULL DEFAULT 0,
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
  is_deleted        TINYINT(1) NOT NULL DEFAULT 0,
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

-- 1. Notification Templates (Terminology)
CREATE TABLE IF NOT EXISTS tb_notification_templates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NULL,
  merchant_id     INT NULL,
  event_type      VARCHAR(100) NOT NULL,
  title_template  TEXT NOT NULL,
  body_template   TEXT NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_templates_masterbrand FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  CONSTRAINT fk_templates_merchant FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. Notification Received (History)
CREATE TABLE IF NOT EXISTS tb_notification_received (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NULL,
  merchant_id     INT NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'INFO',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_received_user FOREIGN KEY (user_id) REFERENCES tb_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_received_merchant FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Masterbrand Activity Log
CREATE TABLE IF NOT EXISTS tb_masterbrand_activity (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NOT NULL,
  user_id         INT NOT NULL,
  action          VARCHAR(100) NOT NULL,
  endpoint        VARCHAR(255) NOT NULL,
  method          VARCHAR(10) NOT NULL,
  request_data    JSON,
  response_data   JSON,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mb_activity_masterbrand FOREIGN KEY (masterbrand_id) REFERENCES tb_masterbrand(id) ON DELETE CASCADE,
  CONSTRAINT fk_mb_activity_user FOREIGN KEY (user_id) REFERENCES tb_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Merchant Activity Log
CREATE TABLE IF NOT EXISTS tb_merchant_activity (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id     INT NOT NULL,
  user_id         INT NOT NULL,
  action          VARCHAR(100) NOT NULL,
  endpoint        VARCHAR(255) NOT NULL,
  method          VARCHAR(10) NOT NULL,
  request_data    JSON,
  response_data   JSON,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_merch_activity_merchant FOREIGN KEY (merchant_id) REFERENCES tb_merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_merch_activity_user FOREIGN KEY (user_id) REFERENCES tb_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
