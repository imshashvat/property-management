import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import cuid from 'cuid';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
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
    await client.connect();
    
    // Check if admin already exists
    const adminEmail = 'admin@propmanager.com';
    const check = await client.query('SELECT id FROM "User" WHERE email = $1', [adminEmail]);
    
    if (check.rowCount! > 0) {
      console.log('Admin user already exists. Skipping seed.');
      return;
    }

    console.log('Creating initial admin user...');
    const id = cuid();
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    const now = new Date();

    await client.query(
      `INSERT INTO "User" (id, email, password, name, role, "isActive", "mustResetPwd", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, adminEmail, hashedPassword, 'System Admin', 'ADMIN', true, true, now, now]
    );

    console.log('--------------------------------------------------');
    console.log('Admin user created successfully!');
    console.log('Email: ', adminEmail);
    console.log('Temp Password: ', 'Admin@123');
    console.log('--------------------------------------------------');
    console.log('IMPORTANT: Change your password on first login.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedAdmin();
