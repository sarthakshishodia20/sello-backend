require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function init() {
  if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
    console.error('Error: DB_HOST is set to localhost. Please configure TiDB live credentials in .env first.');
    process.exit(1);
  }

  const maxRetries = 10;
  let attempts = 0;
  let connection;

  console.log('Connecting to TiDB Cloud Serverless (sys database) to initialize...');
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 4000,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'sys',
        ssl: { rejectUnauthorized: false }
      });
      console.log('Successfully connected to TiDB Cloud! 🎉');
      break;
    } catch (err) {
      console.log(`[Attempt ${attempts}/${maxRetries}] Connection failed: ${err.message}. Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (!connection) {
    console.error('Error: Could not connect to TiDB Cloud after multiple attempts.');
    process.exit(1);
  }

  try {
    console.log('Ensuring database "selo_db" exists on the cluster...');
    await connection.query('CREATE DATABASE IF NOT EXISTS selo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    console.log('Database "selo_db" is ready! Closing initial setup connection...');
    await connection.end();

    console.log('Connecting directly to "selo_db" to establish schema...');
    const mainConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'selo_db',
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    });

    console.log('Reading database/schema.sql...');
    let schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');

    // Remove the CREATE DATABASE and USE statements from the SQL file if present to run directly inside target
    schemaSql = schemaSql.replace(/CREATE DATABASE[\s\S]*?USE[\s\S]*?;/, '');

    console.log('Executing schema table creations...');
    await mainConnection.query(schemaSql);
    console.log('Database tables successfully created on TiDB Cloud! 🚀');
    await mainConnection.end();
  } catch (err) {
    console.error('Error during database initialization:', err);
    process.exit(1);
  }
}

init();
