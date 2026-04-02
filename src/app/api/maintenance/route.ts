import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');

  let query = `
    SELECT m.*, t."firstName", t."lastName", t."credentialId", f."flatNumber", p.name as "propertyName"
    FROM "MaintenanceRequest" m
    JOIN "Tenant" t ON m."tenantId" = t.id
    JOIN "Flat" f ON m."flatId" = f.id
    JOIN "Property" p ON f."propertyId" = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let i = 1;

  if (auth.session!.role === 'TENANT') {
    query += ` AND m."tenantId" = $${i++}`;
    params.push(auth.session!.tenantId);
  } else {
    // Admin sees only their own maintenance requests
    query += ` AND m."adminId" = $${i++}`;
    params.push(auth.session!.userId);
  }
  if (status) {
    query += ` AND m.status = $${i++}`;
    params.push(status);
  }
  if (priority) {
    query += ` AND m.priority = $${i++}`;
    params.push(priority);
  }

  query += ` ORDER BY m."createdAt" DESC`;

  try {
    const requests = await db.fetchAll(query, params);
    return success(requests.map(r => ({
      ...r,
      tenant: { firstName: r.firstName, lastName: r.lastName, credentialId: r.credentialId },
      flat: { flatNumber: r.flatNumber, property: { name: r.propertyName } }
    })));
  } catch (e) {
    console.error('Get maintenance error:', e);
    return error('Failed to fetch maintenance requests', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { title, description, category, priority, flatId, tenantId } = body;

    if (!title || !description) {
      return error('Title and description are required');
    }

    // For tenant submissions, use their own IDs
    let resolvedTenantId = tenantId;
    let resolvedFlatId = flatId;
    let resolvedAdminId: string | null = null;

    if (auth.session!.role === 'TENANT') {
      resolvedTenantId = auth.session!.tenantId;
      // Get tenant's active assignment flat
      const assignment = await db.fetchOne(
        'SELECT "flatId" FROM "Assignment" WHERE "tenantId" = $1 AND "isActive" = true',
        [resolvedTenantId]
      );
      if (!assignment) return error('No active flat assignment found');
      resolvedFlatId = assignment.flatId;

      // Look up which admin manages this tenant
      const tenantData = await db.fetchOne(
        'SELECT "adminId" FROM "Tenant" WHERE id = $1',
        [resolvedTenantId]
      );
      resolvedAdminId = tenantData?.adminId || null;
    } else {
      // Admin creating on behalf — use their own adminId
      resolvedAdminId = auth.session!.userId;
    }

    if (!resolvedTenantId || !resolvedFlatId) {
      return error('Tenant and flat are required');
    }

    const id = cuid();
    const now = new Date();

    const request = await db.fetchOne(
      `INSERT INTO "MaintenanceRequest" (id, title, description, category, priority, status, "tenantId", "flatId", "adminId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id, title, description, category || 'GENERAL', 
        priority || 'MEDIUM', 'OPEN', resolvedTenantId, 
        resolvedFlatId, resolvedAdminId, now, now
      ]
    );

    return success(request, 201);
  } catch (e) {
    console.error('Create maintenance error:', e);
    return error('Failed to create maintenance request', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const body = await req.json();
    const { id, status, resolution, priority } = body;

    if (!id) return error('Request ID is required');

    // Verify ownership
    const owned = await db.fetchOne('SELECT id FROM "MaintenanceRequest" WHERE id = $1 AND "adminId" = $2', [id, adminId]);
    if (!owned) return error('Maintenance request not found', 404);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (status) {
      fields.push(`status = $${i++}`);
      values.push(status);
    }
    if (resolution) {
      fields.push(`resolution = $${i++}`);
      values.push(resolution);
    }
    if (priority) {
      fields.push(`priority = $${i++}`);
      values.push(priority);
    }

    if (status === 'RESOLVED' || status === 'CLOSED') {
      fields.push(`"resolvedAt" = $${i++}`);
      values.push(new Date());
    }

    fields.push(`"updatedAt" = $${i++}`);
    values.push(new Date());
    values.push(id);

    const request = await db.fetchOne(
      `UPDATE "MaintenanceRequest" SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(request);
  } catch (e) {
    console.error('Update maintenance error:', e);
    return error('Failed to update maintenance request', 500);
  }
}
