import { db } from '@/lib/db';
import { success, error } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await db.initSchema();
    return success({ message: 'Database schema initialized successfully' });
  } catch (e) {
    console.error('Init POST error:', e);
    return error('Failed to POST init schema', 500);
  }
}

export async function GET() {
  try {
    // Check if schema exists
    const tableCheck = await db.fetchOne(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'User') as exists`
    );

    if (!tableCheck?.exists) {
      await db.initSchema(); // Auto-initialize on GET if missing
    }

    // Now check if any admin exists
    const adminCheck = await db.fetchOne(
      'SELECT id, email FROM "User" WHERE role = $1 AND "isActive" = true LIMIT 1',
      ['ADMIN']
    );

    if (!adminCheck) {
      // Create default admin account since it doesn't exist
      const id = cuid();
      const adminEmail = 'admin@propmanager.com';
      const hashedPassword = await hashPassword('Admin@123');
      const now = new Date();

      await db.query(
        `INSERT INTO "User" (id, email, password, name, role, "isActive", "mustResetPwd", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, adminEmail, hashedPassword, 'System Administrator', 'ADMIN', true, false, now, now]
      );

      return success({ 
        initialized: true, 
        hasAdmin: true, 
        message: 'Database initialized and default Admin account created.',
        adminEmail: 'admin@propmanager.com',
        adminPassword: 'Admin@123'
      });
    }

    return success({ 
      initialized: true, 
      hasAdmin: true, 
      message: 'System is ready',
      adminEmail: adminCheck.email
    });
  } catch (e) {
    console.error('Init error:', e);
    return success({ initialized: false, hasAdmin: false });
  }
}
