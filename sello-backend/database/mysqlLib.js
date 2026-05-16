const mysql2 = require('mysql2');
require('dotenv').config();

let pool = null;

/**
 * Initialize MySQL connection pool
 */
function initialize() {
  const config = {
    host              : process.env.DB_HOST     || 'localhost',
    port              : parseInt(process.env.DB_PORT) || 3306,
    user              : process.env.DB_USER     || 'root',
    password          : process.env.DB_PASSWORD || '',
    database          : process.env.DB_NAME     || 'selo_db',
    waitForConnections: true,
    connectionLimit   : 10,
    queueLimit        : 0,
    timezone          : 'Z',
    charset           : 'utf8mb4'
  };

  pool = mysql2.createPool(config);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('[Sello DB] ❌ MySQL connection failed:', err.message);
      console.error('[Sello DB] Make sure MySQL is running and credentials in .env are correct.');
      process.exit(1);
    }
    console.log('[Sello DB] ✅ MySQL pool connected to', config.database, '@', config.host);
    connection.release();
  });

  return pool;
}

/**
 * Execute a MySQL query and return a Promise
 * @param {string} sql   - SQL query string
 * @param {Array}  params - Query parameters
 * @returns {Promise}
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!pool) {
      return reject(new Error('[Sello DB] Pool not initialized. Call initialize() first.'));
    }
    pool.query(sql, params, (err, results) => {
      if (err) {
        console.error('[Sello DB] Query error:', err.message, '\nSQL:', sql);
        return reject(err);
      }
      return resolve(results);
    });
  });
}

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - async function receiving a connection
 * @returns {Promise}
 */
async function transaction(callback) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.beginTransaction(async (txErr) => {
        if (txErr) {
          connection.release();
          return reject(txErr);
        }

        const queryFn = (sql, params = []) =>
          new Promise((res, rej) => {
            connection.query(sql, params, (qErr, results) => {
              if (qErr) return rej(qErr);
              return res(results);
            });
          });

        try {
          const result = await callback(queryFn);
          connection.commit((commitErr) => {
            connection.release();
            if (commitErr) return reject(commitErr);
            return resolve(result);
          });
        } catch (error) {
          connection.rollback(() => {
            connection.release();
            reject(error);
          });
        }
      });
    });
  });
}

module.exports = { initialize, query, transaction };
