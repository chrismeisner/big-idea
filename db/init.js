// db/init.js
// Initialize PostgreSQL database schema

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function initDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema...');
    await pool.query(schema);

    console.log('Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
