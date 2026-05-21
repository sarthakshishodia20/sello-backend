const bcrypt = require('bcryptjs');
const db = require('../../../database/mysqlLib');
const { signToken } = require('../../../utilities/jwtUtil');
const logger = require('../../../utilities/loggingUtil');
const { toCode, toSlug } = require('../../../utilities/slugUtil');

const MODULE = 'AuthService';

/**
 * Lookup used by both admin and merchant login flows.
 * Only active users can access the dashboard.
 */
async function findUserByEmail(email) {
  const rows = await db.query(
    'SELECT * FROM tb_users WHERE email = ? AND is_active = 1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

/**
 * Password helpers stay isolated here so controllers remain thin.
 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/**
 * Common profile query that enriches JWT payload and frontend session state.
 */
async function getUserProfile(userId) {
  const rows = await db.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.phone,
      u.theme_preference AS themePreference,
      u.masterbrand_id AS masterbrandId,
      u.merchant_id AS merchantId,
      u.is_active AS isActive,
      mb.name AS masterbrandName,
      m.name AS merchantName,
      m.slug AS merchantSlug,
      m.theme_color AS merchantThemeColor,
      m.is_active AS merchantActive
    FROM tb_users u
    LEFT JOIN tb_masterbrand mb ON mb.id = u.masterbrand_id
    LEFT JOIN tb_merchants m ON m.id = u.merchant_id
    WHERE u.id = ?
    LIMIT 1
  `, [userId]);

  return rows[0] || null;
}

/**
 * JWT payload is intentionally compact but still carries the scope the frontend needs.
 */
async function buildTokenForUser(user) {
  const profile = await getUserProfile(user.id);

  const sessionUser = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    phone: profile.phone,
    themePreference: profile.themePreference,
    masterbrandId: profile.masterbrandId,
    masterbrandName: profile.masterbrandName,
    merchantId: profile.merchantId,
    merchantName: profile.merchantName,
    merchantSlug: profile.merchantSlug,
    merchantThemeColor: profile.merchantThemeColor,
    merchantActive: profile.merchantActive,
    isActive: profile.isActive
  };

  const token = signToken(sessionUser);
  return { token, user: sessionUser };
}

/**
 * Helper for merchant signup: the mini version uses a single default masterbrand row.
 */
async function getDefaultMasterbrand(queryFn = db.query) {
  const rows = await queryFn(
    'SELECT id, name FROM tb_masterbrand WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
  );
  return rows[0] || null;
}

/**
 * When a new merchant is created, all active master products are inherited into tb_app_catalogue.
 */
async function assignMasterCatalogueToMerchant(queryFn, merchantId, masterbrandId) {
  await queryFn(
    `INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available)
     SELECT ?, p.id, 'MASTER', 1
     FROM tb_products p
     WHERE p.masterbrand_id = ? AND p.is_active = 1`,
    [merchantId, masterbrandId]
  );
}

/**
 * Merchant signup seeds the merchant row, dashboard user row, default catalogue inheritance,
 * and a welcome notification in one transaction.
 */
async function createAdminAccount({ name, email, password, phone, masterbrand_name }) {
  const passwordHash = await hashPassword(password);
  const uniqueSuffix = Date.now().toString(36).toUpperCase();

  return db.transaction(async (query) => {
    // 1. Create a new Masterbrand
    const mbResult = await query(
      `INSERT INTO tb_masterbrand (name, code, description) VALUES (?, ?, ?)`,
      [
        masterbrand_name || `${name}'s Masterbrand`,
        `MB_${uniqueSuffix}`,
        `Masterbrand created for admin ${name}`
      ]
    );
    const masterbrandId = mbResult.insertId;

    // 2. Create the Admin user
    const userResult = await query(
      `INSERT INTO tb_users (masterbrand_id, name, email, password_hash, role, phone)
       VALUES (?, ?, ?, ?, 'MASTERBRAND_ADMIN', ?)`,
      [masterbrandId, name, email, passwordHash, phone || null]
    );

    return {
      userId: userResult.insertId,
      masterbrandId
    };
  });
}

/**
 * Merchant signup seeds the merchant row, dashboard user row, default catalogue inheritance,
 * and a welcome notification in one transaction.
 */
async function createMerchantAccount({ owner_name, merchant_name, email, password, phone, address, masterbrand_id = null }) {
  const passwordHash = await hashPassword(password);

  return db.transaction(async (query) => {
    let mbId = masterbrand_id;

    if (!mbId) {
      const masterbrand = await getDefaultMasterbrand(query);
      if (!masterbrand) {
        throw new Error('No active masterbrand found. Please seed tb_masterbrand first.');
      }
      mbId = masterbrand.id;
    }

    const baseSlug = toSlug(merchant_name) || 'selo-merchant';
    const uniqueSuffix = Date.now().toString(36);
    const slug = `${baseSlug}-${uniqueSuffix}`;
    const code = `${toCode(merchant_name) || 'SELO_MERCHANT'}_${uniqueSuffix.toUpperCase()}`.slice(0, 80);

    const merchantResult = await query(
      `INSERT INTO tb_merchants
        (masterbrand_id, name, code, slug, description, contact_email, phone, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mbId,
        merchant_name,
        code,
        slug,
        'Merchant created from the Selo Phase 1 signup flow.',
        email,
        phone || null,
        address || null
      ]
    );

    const merchantId = merchantResult.insertId;

    const userResult = await query(
      `INSERT INTO tb_users
        (masterbrand_id, merchant_id, name, email, password_hash, role, phone)
       VALUES (?, ?, ?, ?, ?, 'MERCHANT_ADMIN', ?)`,
      [mbId, merchantId, owner_name, email, passwordHash, phone || null]
    );

    await assignMasterCatalogueToMerchant(query, merchantId, mbId);

    await query(
      `INSERT INTO tb_notifications (masterbrand_id, user_id, merchant_id, title, message, type)
       VALUES (?, ?, ?, ?, ?, 'SUCCESS')`,
      [
        mbId,
        userResult.insertId,
        merchantId,
        'Welcome to Selo',
        'Your merchant dashboard is ready. Start by reviewing inherited products and delinking only the items you need to customize.'
      ]
    );

    return {
      userId: userResult.insertId,
      merchantId,
      merchantSlug: slug,
      masterbrandId: mbId
    };
  });
}

/**
 * Customers are scoped to the system (or eventually masterbrands).
 */
async function createCustomerAccount({ name, email, password, phone }) {
  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO tb_users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'CUSTOMER', ?)`,
    [name, email, hash, phone]
  );
  return { userId: result.insertId };
}

async function updateUserProfile(userId, { name, email, phone }) {
  return db.query(
    'UPDATE tb_users SET name = ?, email = ?, phone = ? WHERE id = ?',
    [name, email, phone || null, userId]
  );
}

async function updateThemePreference(userId, themePreference) {
  return db.query(
    'UPDATE tb_users SET theme_preference = ? WHERE id = ?',
    [themePreference, userId]
  );
}

async function getCustomers(user, { search = '', date = '' } = {}) {
  const params = [];
  let whereSql = "WHERE role = 'CUSTOMER'";

  if (search) {
    whereSql += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (date) {
    whereSql += " AND DATE(created_at) = ?";
    params.push(date);
  }

  const rows = await db.query(
    `SELECT 
       id, 
       name, 
       email, 
       phone, 
       created_at, 
       'Web' as last_used_platform, 
       'PLATFORM' as signup_platform
     FROM tb_users 
     ${whereSql}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

async function updateCustomer(id, data) {
  const { name, email, phone } = data;
  return db.query(
    'UPDATE tb_users SET name = ?, email = ?, phone = ? WHERE id = ? AND role = "CUSTOMER"',
    [name, email, phone || null, id]
  );
}

async function deleteCustomer(id) {
  return db.query('DELETE FROM tb_users WHERE id = ? AND role = "CUSTOMER"', [id]);
}

async function getMasterbrands() {
  return db.query('SELECT id, name FROM tb_masterbrand WHERE is_active = 1 ORDER BY name ASC');
}

module.exports = {
  findUserByEmail,
  verifyPassword,
  hashPassword,
  buildTokenForUser,
  getUserProfile,
  getDefaultMasterbrand,
  createMerchantAccount,
  createAdminAccount,
  updateUserProfile,
  updateThemePreference,
  createCustomerAccount,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getMasterbrands
};
