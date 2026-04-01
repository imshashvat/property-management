import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Reading schema.sql...');
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema initialization...');
    await client.query(sql);
    
    console.log('Database schema created successfully!');
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
