import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateCredentialId, generateRandomPassword } from '@/lib/auth';
import { success, error, requireAuth } from '@/lib/utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import cuid from 'cuid';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const tenants = await db.fetchAll(`
      SELECT t.*, u.email, u.name as "userName", u."isActive" as "userActive"
      FROM "Tenant" t
      JOIN "User" u ON t."userId" = u.id
      WHERE t."isActive" = true
      ORDER BY t."createdAt" DESC
    `);

    const enrichedTenants = await Promise.all(tenants.map(async (t) => {
      const assignments = await db.fetchAll(`
        SELECT a.*, f."flatNumber", p.name as "propertyName"
        FROM "Assignment" a
        JOIN "Flat" f ON a."flatId" = f.id
        JOIN "Property" p ON f."propertyId" = p.id
        WHERE a."tenantId" = $1 AND a."isActive" = true
      `, [t.id]);

      return {
        ...t,
        user: { id: t.userId, email: t.email, name: t.userName, isActive: t.userActive },
        assignments: assignments.map(a => ({
          ...a,
          flat: { 
            flatNumber: a.flatNumber, 
            property: { name: a.propertyName } 
          }
        }))
      };
    }));

    return success(enrichedTenants);
  } catch (e) {
    console.error('Get tenants error:', e);
    return error('Failed to fetch tenants', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const emergencyContact = formData.get('emergencyContact') as string;
    const idProofType = formData.get('idProofType') as string;
    const idProofNumber = formData.get('idProofNumber') as string;
    const idProofFile = formData.get('idProof') as File | null;

    if (!firstName || !lastName || !email || !phone) {
      return error('First name, last name, email, and phone are required');
    }

    if (!idProofType || !idProofNumber) {
      return error('Government ID proof type and number are required');
    }

    // Check email uniqueness
    const existing = await db.fetchOne('SELECT id FROM "User" WHERE email = $1', [email]);
    if (existing) return error('Email already registered');

    // Handle ID proof upload
    let idProofUrl: string | null = null;
    if (idProofFile && idProofFile.size > 0) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'id-proofs');
      await mkdir(uploadsDir, { recursive: true });
      const ext = idProofFile.name.split('.').pop() || 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bytes = await idProofFile.arrayBuffer();
      await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
      idProofUrl = `/uploads/id-proofs/${filename}`;
    }

    // Generate credential ID
    const { count } = await db.fetchOne('SELECT COUNT(*)::int FROM "Tenant"');
    const year = new Date().getFullYear();
    const credentialId = generateCredentialId('PRP', year, count + 1);
    const tempPassword = generateRandomPassword();
    const hashedPwd = await hashPassword(tempPassword);

    const userId = cuid();
    const tenantId = cuid();
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const user = await tx.query(
        `INSERT INTO "User" (id, email, password, name, role, phone, "mustResetPwd", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [userId, email, hashedPwd, `${firstName} ${lastName}`, 'TENANT', phone, true, true, now, now]
      );

      const tenant = await tx.query(
        `INSERT INTO "Tenant" (id, "credentialId", "firstName", "lastName", phone, "emergencyContact", "idProofType", "idProofNumber", "idProofUrl", "userId", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [tenantId, credentialId, firstName, lastName, phone, emergencyContact || null, idProofType, idProofNumber, idProofUrl, userId, true, now, now]
      );

      return { user: user.rows[0], tenant: tenant.rows[0] };
    });

    return success({
      tenant: result.tenant,
      credentials: {
        credentialId,
        email,
        temporaryPassword: tempPassword,
      },
    }, 201);
  } catch (e) {
    console.error('Create tenant error:', e);
    return error('Failed to create tenant', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, firstName, lastName, phone, emergencyContact } = body;

    if (!id) return error('Tenant ID is required');

    const now = new Date();
    const tenant = await db.fetchOne(
      `UPDATE "Tenant" 
       SET "firstName" = COALESCE($1, "firstName"), 
           "lastName" = COALESCE($2, "lastName"), 
           phone = COALESCE($3, phone), 
           "emergencyContact" = $4, 
           "updatedAt" = $5 
       WHERE id = $6 
       RETURNING *`,
      [firstName, lastName, phone, emergencyContact, now, id]
    );

    if (!tenant) return error('Tenant not found', 404);

    // Also update user name if name changed
    if (firstName || lastName) {
      await db.query(
        'UPDATE "User" SET name = $1, "updatedAt" = $2 WHERE id = $3',
        [`${firstName || tenant.firstName} ${lastName || tenant.lastName}`, now, tenant.userId]
      );
    }

    return success(tenant);
  } catch (e) {
    console.error('Update tenant error:', e);
    return error('Failed to update tenant', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('Tenant ID is required');

  try {
    const tenant = await db.fetchOne('SELECT "userId" FROM "Tenant" WHERE id = $1', [id]);
    if (!tenant) return error('Tenant not found', 404);

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.query('UPDATE "Tenant" SET "isActive" = false, "updatedAt" = $1 WHERE id = $2', [now, id]);
      await tx.query('UPDATE "User" SET "isActive" = false, "updatedAt" = $1 WHERE id = $2', [now, tenant.userId]);
    });

    return success({ message: 'Tenant deactivated' });
  } catch (e) {
    console.error('Delete tenant error:', e);
    return error('Failed to delete tenant', 500);
  }
}
