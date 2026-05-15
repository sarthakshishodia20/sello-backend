-- Selo Settings & Activity Logs Schema Extensions

USE selo_db;

-- 1. Notification Templates (Terminology)
CREATE TABLE IF NOT EXISTS tb_notification_templates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  masterbrand_id  INT NULL,
  merchant_id     INT NULL,
  event_type      VARCHAR(100) NOT NULL, -- e.g., 'ORDER_PLACED', 'STOCK_LOW', 'MERCHANT_SIGNUP'
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

-- Seed some default templates
INSERT IGNORE INTO tb_notification_templates (event_type, title_template, body_template)
VALUES 
('ORDER_PLACED', 'New Order Received!', 'Hello, a new order #{{order_no}} has been placed by {{customer_name}}.'),
('STOCK_LOW', 'Low Stock Alert', 'The product {{product_name}} is running low on stock ({{stock_qty}} remaining).'),
('MERCHANT_SIGNUP', 'New Merchant Registered', 'A new merchant {{merchant_name}} has joined the platform.');
