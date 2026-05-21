const mysql2 = require('mysql2');
require('dotenv').config();
const logger = require('../utilities/loggingUtil');

let pool = null;

/**
 * Initialize MySQL connection pool
 */
function initialize() {
  const isCloud = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';
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
    charset           : 'utf8mb4',
    ssl               : isCloud ? { rejectUnauthorized: false } : undefined
  };

  pool = mysql2.createPool(config);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('[Sello DB] ❌ MySQL connection failed:', err.message);
      console.error('[Sello DB] Make sure MySQL is running and credentials in .env are correct.');
      process.exit(1);
    }
    console.log('[Sello DB] ✅ MySQL pool connected to', config.database, '@', config.host);

    const createErrorsTableSql = `
      CREATE TABLE IF NOT EXISTS tb_errors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        error_message TEXT NOT NULL,
        error_stack TEXT NULL,
        endpoint VARCHAR(255) NULL,
        method VARCHAR(10) NULL,
        user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `;
    connection.query(createErrorsTableSql, (tableErr) => {
      if (tableErr) {
        console.error('[Sello DB] ❌ Failed to ensure tb_errors table:', tableErr.message);
      } else {
        console.log('[Sello DB] ✅ Table tb_errors verified successfully.');
      }

      // Check and add is_sponsored column to tb_merchants
      connection.query(`SHOW COLUMNS FROM tb_merchants LIKE 'is_sponsored'`, (colErr, results) => {
        if (!colErr && results.length === 0) {
          connection.query(`ALTER TABLE tb_merchants ADD COLUMN is_sponsored TINYINT(1) DEFAULT 0`, (alterErr) => {
            if (alterErr) {
              console.error('[Sello DB] ❌ Failed to add is_sponsored column to tb_merchants:', alterErr.message);
            } else {
              console.log('[Sello DB] ✅ Column is_sponsored added to tb_merchants successfully.');
            }
          });
        }
      });

      // Check and add is_top_selling column to tb_products
      connection.query(`SHOW COLUMNS FROM tb_products LIKE 'is_top_selling'`, (colErr2, results2) => {
        if (!colErr2 && results2.length === 0) {
          connection.query(`ALTER TABLE tb_products ADD COLUMN is_top_selling TINYINT(1) DEFAULT 0`, (alterErr2) => {
            if (alterErr2) {
              console.error('[Sello DB] ❌ Failed to add is_top_selling column to tb_products:', alterErr2.message);
            } else {
              console.log('[Sello DB] ✅ Column is_top_selling added to tb_products successfully.');
            }
          });
        }
      });

      // Check and add is_top_selling column to tb_app_catalogue
      connection.query(`SHOW COLUMNS FROM tb_app_catalogue LIKE 'is_top_selling'`, (colErr3, results3) => {
        if (!colErr3 && results3.length === 0) {
          connection.query(`ALTER TABLE tb_app_catalogue ADD COLUMN is_top_selling TINYINT(1) DEFAULT 0`, (alterErr3) => {
            if (alterErr3) {
              console.error('[Sello DB] ❌ Failed to add is_top_selling column to tb_app_catalogue:', alterErr3.message);
            } else {
              console.log('[Sello DB] ✅ Column is_top_selling added to tb_app_catalogue successfully.');
            }
          });
        }
      });

      // Check and add theme_preference column to tb_users
      connection.query(`SHOW COLUMNS FROM tb_users LIKE 'theme_preference'`, (colErr4, results4) => {
        if (!colErr4 && results4.length === 0) {
          connection.query(`ALTER TABLE tb_users ADD COLUMN theme_preference VARCHAR(20) DEFAULT 'light'`, (alterErr4) => {
            if (alterErr4) {
              console.error('[Sello DB] ❌ Failed to add theme_preference column to tb_users:', alterErr4.message);
            } else {
              console.log('[Sello DB] ✅ Column theme_preference added to tb_users successfully.');
            }
          });
        }
      });

      connection.release();
    });
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

    const store = logger.getStore() || {};
    logger.info('Database', 'QUERY_EXECUTE', {
      reqId: store.reqId,
      sql,
      params
    });

    pool.query(sql, params, (err, results) => {
      if (err) {
        logger.error('Database', 'QUERY_ERROR', {
          reqId: store.reqId,
          sql,
          params,
          error: err.message
        });
        return reject(err);
      }

      logger.info('Database', 'QUERY_SUCCESS', {
        reqId: store.reqId,
        sql,
        results: results
      });

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
            const store = logger.getStore() || {};
            logger.info('Database', 'TRANSACTION_QUERY_EXECUTE', {
              reqId: store.reqId,
              sql,
              params
            });

            connection.query(sql, params, (qErr, results) => {
              if (qErr) {
                logger.error('Database', 'TRANSACTION_QUERY_ERROR', {
                  reqId: store.reqId,
                  sql,
                  params,
                  error: qErr.message
                });
                return rej(qErr);
              }

              logger.info('Database', 'TRANSACTION_QUERY_SUCCESS', {
                reqId: store.reqId,
                sql,
                results: results
              });

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
