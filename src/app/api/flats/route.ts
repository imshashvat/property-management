import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('propertyId');
  const status = searchParams.get('status');

  let query = `
    SELECT f.*, p.name as "propertyName", p.id as "propertyId"
    FROM "Flat" f
    JOIN "Property" p ON f."propertyId" = p.id
    WHERE f."isActive" = true AND f."adminId" = $1
  `;
  const params: any[] = [adminId];
  let i = 2;

  if (propertyId) {
    query += ` AND f."propertyId" = $${i++}`;
    params.push(propertyId);
  }
  if (status) {
    query += ` AND f.status = $${i++}`;
    params.push(status);
  }

  query += ` ORDER BY f."flatNumber" ASC`;

  try {
    const flats = await db.fetchAll(query, params);
    
    // Fetch active assignments for each flat
    const enrichedFlats = await Promise.all(flats.map(async (f) => {
      const assignments = await db.fetchAll(
        `SELECT a.*, t."firstName", t."lastName", t."credentialId"
         FROM "Assignment" a
         JOIN "Tenant" t ON a."tenantId" = t.id
         WHERE a."flatId" = $1 AND a."isActive" = true`,
        [f.id]
      );
      
      return {
        ...f,
        property: { id: f.propertyId, name: f.propertyName },
        assignments: assignments.map(a => ({
          ...a,
          tenant: { id: a.tenantId, firstName: a.firstName, lastName: a.lastName, credentialId: a.credentialId }
        }))
      };
    }));

    return success(enrichedFlats);
  } catch (e) {
    console.error('Get flats error:', e);
    return error('Failed to fetch flats', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const body = await req.json();
    const { propertyId, flatNumber, floor, bedrooms, bathrooms, area, rentAmount, depositAmount, furnishing, description } = body;

    if (!propertyId || !flatNumber || !rentAmount) {
      return error('Property, flat number, and rent amount are required');
    }

    // Verify property belongs to this admin
    const owned = await db.fetchOne('SELECT id FROM "Property" WHERE id = $1 AND "adminId" = $2', [propertyId, adminId]);
    if (!owned) return error('Property not found', 404);

    // Check for existing flat
    const existing = await db.fetchOne(
      'SELECT id FROM "Flat" WHERE "propertyId" = $1 AND "flatNumber" = $2 AND "isActive" = true',
      [propertyId, flatNumber]
    );
    if (existing) {
      return error('A flat with this number already exists in this property');
    }

    const id = cuid();
    const now = new Date();

    const flat = await db.transaction(async (tx) => {
      const f = await tx.query(
        `INSERT INTO "Flat" (id, "propertyId", "flatNumber", floor, bedrooms, bathrooms, area, "rentAmount", "depositAmount", furnishing, description, "isActive", "adminId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          id, propertyId, flatNumber, floor || 0,
          bedrooms || 1, bathrooms || 1, area || null,
          parseFloat(rentAmount), depositAmount ? parseFloat(depositAmount) : null,
          furnishing || 'UNFURNISHED', description || null,
          true, adminId, now, now
        ]
      );

      // Update property total flats count
      await tx.query(
        'UPDATE "Property" SET "totalFlats" = "totalFlats" + 1 WHERE id = $1',
        [propertyId]
      );

      return f.rows[0];
    });

    return success(flat, 201);
  } catch (e) {
    console.error('Create flat error:', e);
    return error('Failed to create flat', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return error('Flat ID is required');

    // Verify ownership
    const owned = await db.fetchOne('SELECT id FROM "Flat" WHERE id = $1 AND "adminId" = $2', [id, adminId]);
    if (!owned) return error('Flat not found', 404);

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(data)) {
      let val = value;
      if (['rentAmount', 'depositAmount', 'area'].includes(key) && value) {
        val = parseFloat(value as string);
      } else if (['floor', 'bedrooms', 'bathrooms'].includes(key) && value) {
        val = parseInt(value as string);
      }
      fields.push(`"${key}" = $${i++}`);
      values.push(val);
    }

    fields.push(`"updatedAt" = $${i++}`);
    values.push(new Date());
    values.push(id);

    const flat = await db.fetchOne(
      `UPDATE "Flat" SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(flat);
  } catch (e) {
    console.error('Update flat error:', e);
    return error('Failed to update flat', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const adminId = auth.session!.userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('Flat ID is required');

  try {
    const flat = await db.fetchOne('SELECT "propertyId" FROM "Flat" WHERE id = $1 AND "adminId" = $2', [id, adminId]);
    if (!flat) return error('Flat not found', 404);

    await db.transaction(async (tx) => {
      await tx.query(
        'UPDATE "Flat" SET "isActive" = false, "updatedAt" = $2 WHERE id = $1',
        [id, new Date()]
      );
      await tx.query(
        'UPDATE "Property" SET "totalFlats" = "totalFlats" - 1 WHERE id = $1',
        [flat.propertyId]
      );
    });

    return success({ message: 'Flat deleted' });
  } catch (e) {
    console.error('Delete flat error:', e);
    return error('Failed to delete flat', 500);
  }
}
