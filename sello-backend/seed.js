require('dotenv').config();
const mysql = require('mysql2/promise');

async function resetAndSeed() {
  // Read credentials dynamically from .env or default to localhost
  const isCloud = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'selo_db',
    ssl: isCloud ? { rejectUnauthorized: false } : undefined
  });

  try {
    console.log('Cleaning up existing data...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE tb_order_items');
    await connection.query('TRUNCATE TABLE tb_orders');
    await connection.query('TRUNCATE TABLE tb_app_catalogue');
    await connection.query('TRUNCATE TABLE tb_merchant_products');
    await connection.query('TRUNCATE TABLE tb_products');
    await connection.query('TRUNCATE TABLE tb_categories');
    await connection.query('TRUNCATE TABLE tb_users');
    await connection.query('TRUNCATE TABLE tb_merchants');
    await connection.query('TRUNCATE TABLE tb_masterbrand');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Seeding Essential Masterbrand & Merchant Shell (no dummy items)...');
    await connection.query(
      "INSERT INTO tb_masterbrand (id, name, code) VALUES (1, 'Selo Global', 'SELO_MAIN')"
    );
    await connection.query(
      "INSERT INTO tb_merchants (id, masterbrand_id, name, code, slug, city_name) VALUES (100001, 1, 'My New Store', 'SELO_M1', 'new-store', 'Delhi')"
    );

    console.log('Seeding Master Admin & Merchant credentials...');
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const merchantHash = await bcrypt.hash('Merchant@123', 10);

    // 1. Masterbrand User (Admin)
    await connection.query(
      `INSERT INTO tb_users (masterbrand_id, name, email, password_hash, role) 
       VALUES (?, ?, ?, ?, 'MASTERBRAND_ADMIN')`,
      [1, 'Selo Admin', 'admin@selo.com', adminHash]
    );

    // 2. Merchant User
    await connection.query(
      `INSERT INTO tb_users (masterbrand_id, merchant_id, name, email, password_hash, role) 
       VALUES (?, ?, ?, ?, ?, 'MERCHANT_ADMIN')`,
      [1, 100001, 'Selo Merchant', 'merchant@selo.com', merchantHash]
    );

    console.log('Production Slate Seed Complete! 🚀 (Your Sello live platform is 100% clean and ready!)');
  } catch (err) {
    console.error('Error seeding production slate:', err);
  } finally {
    await connection.end();
  }
}

resetAndSeed();
