import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  const status = searchParams.get('status');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  let query = `
    SELECT p.*, t."firstName", t."lastName", t."credentialId", f."flatNumber", prop.name as "propertyName"
    FROM "Payment" p
    JOIN "Tenant" t ON p."tenantId" = t.id
    JOIN "Flat" f ON p."flatId" = f.id
    JOIN "Property" prop ON f."propertyId" = prop.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let i = 1;

  if (auth.session!.role === 'TENANT') {
    query += ` AND p."tenantId" = $${i++}`;
    params.push(auth.session!.tenantId);
  } else {
    // Admin sees only their own payments
    query += ` AND p."adminId" = $${i++}`;
    params.push(auth.session!.userId);
    if (tenantId) {
      query += ` AND p."tenantId" = $${i++}`;
      params.push(tenantId);
    }
  }

  if (status) {
    query += ` AND p.status = $${i++}`;
    params.push(status);
  }
  if (month) {
    query += ` AND p.month = $${i++}`;
    params.push(parseInt(month));
  }
  if (year) {
    query += ` AND p.year = $${i++}`;
    params.push(parseInt(year));
  }

  query += ` ORDER BY p.year DESC, p.month DESC`;

  try {
    const payments = await db.fetchAll(query, params);
    return success(payments.map(p => ({
      ...p,
      tenant: { firstName: p.firstName, lastName: p.lastName, credentialId: p.credentialId },
      flat: { flatNumber: p.flatNumber, property: { name: p.propertyName } }
    })));
  } catch (e) {
    console.error('Get rent error:', e);
    return error('Failed to fetch payments', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const { tenantId, flatId, amount, month, year, dueDate } = await req.json();

    if (!tenantId || !flatId || !amount || !month || !year) {
      return error('Tenant, flat, amount, month, and year are required');
    }

    // Verify tenant and flat belong to this admin
    const ownedTenant = await db.fetchOne('SELECT id FROM "Tenant" WHERE id = $1 AND "adminId" = $2', [tenantId, adminId]);
    if (!ownedTenant) return error('Tenant not found', 404);
    const ownedFlat = await db.fetchOne('SELECT id FROM "Flat" WHERE id = $1 AND "adminId" = $2', [flatId, adminId]);
    if (!ownedFlat) return error('Flat not found', 404);

    // Check for existing payment
    const existing = await db.fetchOne(
      'SELECT id FROM "Payment" WHERE "tenantId" = $1 AND "flatId" = $2 AND month = $3 AND year = $4',
      [tenantId, flatId, parseInt(month), parseInt(year)]
    );
    if (existing) return error('Payment record already exists for this month');

    const id = cuid();
    const now = new Date();
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
    const defaultDueDate = new Date(parsedYear, parsedMonth - 1, 5);

    const payment = await db.fetchOne(
      `INSERT INTO "Payment" (id, "tenantId", "flatId", amount, month, year, "dueDate", status, "adminId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id, tenantId, flatId, parseFloat(amount), parsedMonth, parsedYear,
        dueDate ? new Date(dueDate) : defaultDueDate, 'PENDING', adminId, now, now
      ]
    );

    return success(payment, 201);
  } catch (e) {
    console.error('Create payment error:', e);
    return error('Failed to create payment', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const body = await req.json();
    const { id, status, paymentMethod, transactionId, paidDate, notes, lateFee } = body;

    if (!id) return error('Payment ID is required');

    // Verify ownership
    const owned = await db.fetchOne('SELECT id FROM "Payment" WHERE id = $1 AND "adminId" = $2', [id, adminId]);
    if (!owned) return error('Payment not found', 404);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (status) {
      fields.push(`status = $${i++}`);
      values.push(status);
    }
    if (paymentMethod) {
      fields.push(`"paymentMethod" = $${i++}`);
      values.push(paymentMethod);
    }
    if (transactionId) {
      fields.push(`"transactionId" = $${i++}`);
      values.push(transactionId);
    }
    if (notes !== undefined) {
      fields.push(`notes = $${i++}`);
      values.push(notes);
    }
    if (lateFee !== undefined) {
      fields.push(`"lateFee" = $${i++}`);
      values.push(parseFloat(lateFee));
    }

    if (status === 'PAID') {
      fields.push(`"paidDate" = $${i++}`);
      values.push(paidDate ? new Date(paidDate) : new Date());
    }

    fields.push(`"updatedAt" = $${i++}`);
    values.push(new Date());
    values.push(id);

    const payment = await db.fetchOne(
      `UPDATE "Payment" SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(payment);
  } catch (e) {
    console.error('Update rent error:', e);
    return error('Failed to update payment', 500);
  }
}

// Generate rent for all active assignments belonging to this admin
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const { month, year } = await req.json();
    if (!month || !year) return error('Month and year are required');

    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);

    // Only get active assignments for this admin
    const activeAssignments = await db.fetchAll('SELECT * FROM "Assignment" WHERE "isActive" = true AND "adminId" = $1', [adminId]);

    let created = 0;
    let skipped = 0;

    for (const assignment of activeAssignments) {
      const existing = await db.fetchOne(
        'SELECT id FROM "Payment" WHERE "tenantId" = $1 AND "flatId" = $2 AND month = $3 AND year = $4',
        [assignment.tenantId, assignment.flatId, parsedMonth, parsedYear]
      );

      if (existing) {
        skipped++;
        continue;
      }

      const id = cuid();
      const now = new Date();
      const dueDate = new Date(parsedYear, parsedMonth - 1, 5);

      await db.query(
        `INSERT INTO "Payment" (id, "tenantId", "flatId", amount, month, year, "dueDate", status, "adminId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id, assignment.tenantId, assignment.flatId, assignment.rentAmount,
          parsedMonth, parsedYear, dueDate, 'PENDING', adminId, now, now
        ]
      );
      created++;
    }

    return success({ created, skipped, total: activeAssignments.length });
  } catch (e) {
    console.error('Generate rent error:', e);
    return error('Failed to generate rent', 500);
  }
}
