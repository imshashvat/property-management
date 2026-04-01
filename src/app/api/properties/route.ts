import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const properties = await db.fetchAll(`
      SELECT p.*, (SELECT COUNT(*)::int FROM "Flat" f WHERE f."propertyId" = p.id AND f."isActive" = true) as "flatCount"
      FROM "Property" p
      WHERE p."isActive" = true
      ORDER BY p."createdAt" DESC
    `);

    return success(properties.map(p => ({
      ...p,
      _count: { flats: p.flatCount }
    })));
  } catch (e) {
    console.error('Get properties error:', e);
    return error('Failed to fetch properties', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { name, address, city, state, zipCode, type, description, amenities } = body;

    if (!name || !address || !city || !state || !zipCode) {
      return error('Name, address, city, state, and zip code are required');
    }

    const id = cuid();
    const now = new Date();

    const property = await db.fetchOne(
      `INSERT INTO "Property" (id, name, address, city, state, "zipCode", type, description, amenities, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id, name, address, city, state, zipCode, 
        type || 'APARTMENT', description || null, 
        amenities ? JSON.stringify(amenities) : null,
        true, now, now
      ]
    );

    return success(property, 201);
  } catch (e) {
    console.error('Create property error:', e);
    return error('Failed to create property', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return error('Property ID is required');

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(data)) {
      let val = value;
      if (key === 'amenities' && value && typeof value !== 'string') {
        val = JSON.stringify(value);
      }
      fields.push(`"${key}" = $${i++}`);
      values.push(val);
    }

    fields.push(`"updatedAt" = $${i++}`);
    values.push(new Date());
    values.push(id);

    const property = await db.fetchOne(
      `UPDATE "Property" SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(property);
  } catch (e) {
    console.error('Update property error:', e);
    return error('Failed to update property', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return error('Property ID is required');

  await db.query(
    'UPDATE "Property" SET "isActive" = false, "updatedAt" = $2 WHERE id = $1',
    [id, new Date()]
  );

  return success({ message: 'Property deleted' });
}
