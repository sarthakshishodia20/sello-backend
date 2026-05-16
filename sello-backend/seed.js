const mysql = require('mysql2/promise');

async function resetAndSeed() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'selo_db'
  });

  try {
    console.log('Cleaning up data...');
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

    console.log('Seeding Masterbrand & Merchant...');
    await connection.query(
      "INSERT INTO tb_masterbrand (id, name, code) VALUES (1, 'Selo Global', 'SELO_MAIN')"
    );
    await connection.query(
      "INSERT INTO tb_merchants (id, masterbrand_id, name, code, slug) VALUES (1, 1, 'Selo Fresh Store', 'SELO_M1', 'fresh-store')"
    );

    console.log('Seeding categories...');
    const categories = [
      ['Fresh Produce', 'fresh-produce', 'Farm fresh fruits and vegetables'],
      ['Dairy & Eggs', 'dairy-eggs', 'Milk, butter, and cheese'],
      ['Pantry Staples', 'pantry-staples', 'Grains, oils, and spices'],
      ['Healthy Snacks', 'healthy-snacks', 'Nuts, bars, and dried fruits'],
      ['Beverages', 'beverages', 'Juices, water, and sodas']
    ];

    for (let i = 0; i < categories.length; i++) {
      await connection.query(
        'INSERT INTO tb_categories (masterbrand_id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        [1, categories[i][0], categories[i][1], categories[i][2], i + 1]
      );
    }

    const [catRows] = await connection.query('SELECT id, name FROM tb_categories');
    const catMap = {};
    catRows.forEach(c => catMap[c.name] = c.id);

    console.log('Seeding products...');
    const products = [
      ['Apple', 'APP-001', 'Fresh red apples', 120.00, catMap['Fresh Produce']],
      ['Daily Basmati', 'BAS-001', 'Premium long grain rice', 450.00, catMap['Pantry Staples']],
      ['Milk 1L', 'MLK-001', 'Organic whole milk', 65.00, catMap['Dairy & Eggs']],
      ['Protein Nut Bar', 'SNK-001', 'High protein healthy snack', 45.00, catMap['Healthy Snacks']],
      ['Sparkling Water', 'BEV-001', 'Refreshing bubbly water', 30.00, catMap['Beverages']],
      ['Organic Eggs (Dozen)', 'EGG-001', 'Free-range brown eggs', 150.00, catMap['Dairy & Eggs']],
      ['Avocado', 'AVO-001', 'Ripe Hass avocado', 80.00, catMap['Fresh Produce']],
      ['Cold Pressed Orange Juice', 'JUC-001', 'No added sugar', 110.00, catMap['Beverages']],
      ['Roasted Trail Mix', 'SNK-002', 'Nuts and berries', 95.00, catMap['Healthy Snacks']],
      ['Virgin Olive Oil', 'OIL-001', 'Extra virgin first press', 850.00, catMap['Pantry Staples']]
    ];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const [res] = await connection.query(
        'INSERT INTO tb_products (masterbrand_id, category_id, sku, name, short_description, price, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [1, p[4], p[1], p[0], p[2], p[3], 100, i + 1]
      );

      // Auto-inherit for merchant 1
      await connection.query(
        'INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available) VALUES (?, ?, ?, ?)',
        [1, res.insertId, 'MASTER', 1]
      );
    }

    console.log('Seeding users...');
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
      [1, 1, 'Selo Merchant', 'merchant@selo.com', merchantHash]
    );

    console.log('Seeding complete! 🚀');
  } catch (err) {
    console.error('Error seeding:', err);
  } finally {
    await connection.end();
  }
}

resetAndSeed();
