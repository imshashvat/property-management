import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';
import cuid from 'cuid';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const assignments = await db.fetchAll(`
      SELECT a.*, t."firstName", t."lastName", t."credentialId", f."flatNumber", p.name as "propertyName", p.id as "propertyId"
      FROM "Assignment" a
      JOIN "Tenant" t ON a."tenantId" = t.id
      JOIN "Flat" f ON a."flatId" = f.id
      JOIN "Property" p ON f."propertyId" = p.id
      ORDER BY a."createdAt" DESC
    `);

    return success(assignments.map(a => ({
      ...a,
      tenant: { id: a.tenantId, firstName: a.firstName, lastName: a.lastName, credentialId: a.credentialId },
      flat: { 
        id: a.flatId, 
        flatNumber: a.flatNumber, 
        property: { id: a.propertyId, name: a.propertyName } 
      }
    })));
  } catch (e) {
    console.error('Get assignments error:', e);
    return error('Failed to fetch assignments', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const { tenantId, flatId, startDate, endDate, rentAmount, deposit } = await req.json();

    if (!tenantId || !flatId || !startDate || !rentAmount) {
      return error('Tenant, flat, start date, and rent amount are required');
    }

    // Check if flat is available
    const flat = await db.fetchOne('SELECT status FROM "Flat" WHERE id = $1 AND "isActive" = true', [flatId]);
    if (!flat) return error('Flat not found', 404);
    if (flat.status === 'OCCUPIED') return error('Flat is already occupied');

    const id = cuid();
    const now = new Date();

    const assignment = await db.transaction(async (tx) => {
      const a = await tx.query(
        `INSERT INTO "Assignment" (id, "tenantId", "flatId", "startDate", "endDate", "rentAmount", deposit, "isActive", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          id, tenantId, flatId, new Date(startDate), 
          endDate ? new Date(endDate) : null, parseFloat(rentAmount), 
          deposit ? parseFloat(deposit) : 0, true, 'ACTIVE', now, now
        ]
      );

      // Mark flat as occupied
      await tx.query('UPDATE "Flat" SET status = $1, "updatedAt" = $2 WHERE id = $3', ['OCCUPIED', now, flatId]);

      // Set tenant move-in date
      await tx.query('UPDATE "Tenant" SET "moveInDate" = $1, "updatedAt" = $2 WHERE id = $3', [new Date(startDate), now, tenantId]);

      return a.rows[0];
    });

    return success(assignment, 201);
  } catch (e) {
    console.error('Create assignment error:', e);
    return error('Failed to create assignment', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, status, endDate } = body;

    if (!id) return error('Assignment ID is required');

    const assignment = await db.fetchOne('SELECT * FROM "Assignment" WHERE id = $1', [id]);
    if (!assignment) return error('Assignment not found', 404);

    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (endDate) {
        fields.push(`"endDate" = $${i++}`);
        values.push(new Date(endDate));
      }

      if (status === 'TERMINATED' || status === 'EXPIRED') {
        fields.push(`status = $${i++}`);
        values.push(status);
        fields.push(`"isActive" = $${i++}`);
        values.push(false);

        // Free up the flat
        await tx.query('UPDATE "Flat" SET status = $1, "updatedAt" = $2 WHERE id = $3', ['VACANT', now, assignment.flatId]);
      }

      fields.push(`"updatedAt" = $${i++}`);
      values.push(now);
      values.push(id);

      const res = await tx.query(
        `UPDATE "Assignment" SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
      return res.rows[0];
    });

    return success(updated);
  } catch (e) {
    console.error('Update assignment error:', e);
    return error('Failed to update assignment', 500);
  }
}
