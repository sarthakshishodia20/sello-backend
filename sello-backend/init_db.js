require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function init() {
  if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
    console.error('Error: DB_HOST is set to localhost. Please configure Aiven live credentials in .env first.');
    process.exit(1);
  }

  const maxRetries = 30;
  let attempts = 0;
  let connection;

  console.log('Connecting to Aiven Cloud Database...');
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
      });
      console.log('Successfully connected to Aiven Cloud! 🎉');
      break;
    } catch (err) {
      if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.log(`[Attempt ${attempts}/${maxRetries}] Database is not online yet (Aiven is provisioning the server). Retrying in 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error('Unexpected connection error:', err);
        process.exit(1);
      }
    }
  }

  if (!connection) {
    console.error('Error: Could not connect to the database after 5 minutes. Please check your credentials.');
    process.exit(1);
  }

  try {
    console.log('Reading database/schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');

    console.log('Executing schema table creations...');
    await connection.query(schemaSql);
    console.log('Database tables successfully created on Aiven Cloud! 🚀');
  } catch (err) {
    console.error('Error during database initialization:', err);
  } finally {
    await connection.end();
  }
}

init();
