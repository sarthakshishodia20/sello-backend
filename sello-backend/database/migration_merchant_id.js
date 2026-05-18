const db = require('./mysqlLib');

async function run() {
  db.initialize();
  console.log('[Migration] Starting merchant ID migration to 6-digit IDs...');

  try {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('[Migration] Foreign key checks disabled.');

    // Update tb_merchants
    await db.query('UPDATE tb_merchants SET id = 100001 WHERE id = 1');
    await db.query('UPDATE tb_merchants SET id = 100002 WHERE id = 2');
    console.log('[Migration] Updated tb_merchants IDs.');

    // Update tb_users
    await db.query('UPDATE tb_users SET merchant_id = 100001 WHERE merchant_id = 1');
    await db.query('UPDATE tb_users SET merchant_id = 100002 WHERE merchant_id = 2');
    console.log('[Migration] Updated tb_users references.');

    // Update tb_merchant_products
    await db.query('UPDATE tb_merchant_products SET merchant_id = 100001 WHERE merchant_id = 1');
    await db.query('UPDATE tb_merchant_products SET merchant_id = 100002 WHERE merchant_id = 2');
    console.log('[Migration] Updated tb_merchant_products references.');

    // Update tb_app_catalogue
    await db.query('UPDATE tb_app_catalogue SET merchant_id = 100001 WHERE merchant_id = 1');
    await db.query('UPDATE tb_app_catalogue SET merchant_id = 100002 WHERE merchant_id = 2');
    console.log('[Migration] Updated tb_app_catalogue references.');

    // Update tb_orders
    await db.query('UPDATE tb_orders SET merchant_id = 100001 WHERE merchant_id = 1');
    await db.query('UPDATE tb_orders SET merchant_id = 100002 WHERE merchant_id = 2');
    console.log('[Migration] Updated tb_orders references.');

    // Update tb_notifications
    await db.query('UPDATE tb_notifications SET merchant_id = 100001 WHERE merchant_id = 1');
    await db.query('UPDATE tb_notifications SET merchant_id = 100002 WHERE merchant_id = 2');
    console.log('[Migration] Updated tb_notifications references.');

    // Alter Auto Increment
    await db.query('ALTER TABLE tb_merchants AUTO_INCREMENT = 100003');
    console.log('[Migration] Set tb_merchants AUTO_INCREMENT to 100003.');

    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[Migration] Foreign key checks re-enabled.');
    console.log('[Migration] ✅ Migration successfully completed!');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Migration failed with error:', error);
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    process.exit(1);
  }
}

run();
