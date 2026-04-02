import { db } from '@/lib/db';
import { success, error } from '@/lib/utils';

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

    // Check if any admin exists
    const adminCheck = await db.fetchOne(
      'SELECT id, email FROM "User" WHERE role = $1 AND "isActive" = true LIMIT 1',
      ['ADMIN']
    );

    return success({ 
      initialized: true, 
      hasAdmin: !!adminCheck, 
      message: adminCheck ? 'System is ready' : 'No admin accounts yet. Please sign up to create one.',
    });
  } catch (e) {
    console.error('Init error:', e);
    return success({ initialized: false, hasAdmin: false });
  }
}
