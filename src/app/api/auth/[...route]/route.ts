import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createAccessToken, createRefreshToken, verifyRefreshToken, hashPassword, verifyAccessToken } from '@/lib/auth';
import { success, error } from '@/lib/utils';
import { cookies } from 'next/headers';
import cuid from 'cuid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  const action = route[0];

  if (action === 'login') {
    try {
      const { email, password } = await req.json();

      if (!email || !password) {
        return error('Email and password are required');
      }

      // Try finding by email or credential ID
      let user = await db.fetchOne(
        'SELECT * FROM "User" WHERE "email" = $1',
        [email]
      );

      if (!user) {
        // Try credential ID lookup
        const tenant = await db.fetchOne(
          `SELECT t.*, u.id as user_id, u.email as user_email, u.password as user_password, 
                  u.name as user_name, u.role as user_role, u."isActive" as user_active
           FROM "Tenant" t 
           JOIN "User" u ON t."userId" = u.id 
           WHERE t."credentialId" = $1`,
          [email]
        );
        
        if (tenant) {
          user = {
            id: tenant.user_id,
            email: tenant.user_email,
            password: tenant.user_password,
            name: tenant.user_name,
            role: tenant.user_role,
            isActive: tenant.user_active
          };
        }
      }

      if (!user || !user.isActive) {
        return error('Invalid credentials', 401);
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return error('Invalid credentials', 401);
      }

      // Get tenant info if applicable
      let tenantId: string | undefined;
      if (user.role === 'TENANT') {
        const tenant = await db.fetchOne(
          'SELECT id FROM "Tenant" WHERE "userId" = $1',
          [user.id]
        );
        tenantId = tenant?.id;
      }

      const payload = { userId: user.id, email: user.email, role: user.role, tenantId };
      const accessToken = await createAccessToken(payload);
      const refreshToken = await createRefreshToken(payload);

      const cookieStore = await cookies();
      cookieStore.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/',
      });
      cookieStore.set('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return success({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        mustResetPwd: user.mustResetPwd,
        role: user.role,
      });
    } catch (e: any) {
      console.error('Login error:', e);
      return error(e.message || 'Internal server error', 500);
    }
  }

  if (action === 'refresh') {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('refresh_token')?.value;
      if (!token) return error('No refresh token', 401);

      const payload = await verifyRefreshToken(token);
      if (!payload) return error('Invalid refresh token', 401);

      const accessToken = await createAccessToken(payload);
      cookieStore.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/',
      });

      return success({ message: 'Token refreshed' });
    } catch (e: any) {
      return error(e.message || 'Internal server error', 500);
    }
  }

  if (action === 'logout') {
    const cookieStore = await cookies();
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
    return success({ message: 'Logged out' });
  }

  if (action === 'me') {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('access_token')?.value;
      if (!token) return error('Not authenticated', 401);

      const payload = await verifyAccessToken(token);
      if (!payload) return error('Invalid token', 401);

      const user = await db.fetchOne(
        `SELECT id, email, name, role, phone, avatar FROM "User" WHERE id = $1`,
        [payload.userId]
      );

      if (!user) return error('User not found', 404);

      let tenant = null;
      if (user.role === 'TENANT') {
        const tenantData = await db.fetchOne(
          'SELECT * FROM "Tenant" WHERE "userId" = $1',
          [user.id]
        );
        
        if (tenantData) {
          const assignments = await db.fetchAll(
            `SELECT a.*, f."flatNumber", p.name as "propertyName", p.id as "propertyId" 
             FROM "Assignment" a
             JOIN "Flat" f ON a."flatId" = f.id
             JOIN "Property" p ON f."propertyId" = p.id
             WHERE a."tenantId" = $1 AND a."isActive" = true`,
            [tenantData.id]
          );
          
          tenant = {
            ...tenantData,
            assignments: assignments.map(a => ({
              ...a,
              flat: {
                flatNumber: a.flatNumber,
                property: { id: a.propertyId, name: a.propertyName }
              }
            }))
          };
        }
      }

      return success({ ...user, tenant });
    } catch (e: any) {
      console.error('Me error:', e);
      return error(e.message || 'Internal server error', 500);
    }
  }

  if (action === 'reset-password') {
    try {
      const { userId, currentPassword, newPassword } = await req.json();
      const user = await db.fetchOne(
        'SELECT * FROM "User" WHERE id = $1',
        [userId]
      );
      if (!user) return error('User not found', 404);

      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return error('Current password is incorrect', 400);

      const hashed = await hashPassword(newPassword);
      await db.query(
        'UPDATE "User" SET "password" = $1, "mustResetPwd" = false WHERE id = $2',
        [hashed, userId]
      );

      return success({ message: 'Password updated' });
    } catch (e: any) {
      return error(e.message || 'Internal server error', 500);
    }
  }

  if (action === 'register') {
    try {
      // Guarantee tables exist before user query
      await db.initSchema();

      const { name, email, password } = await req.json();

      if (!name || !email || !password) {
        return error('Name, email, and password are required');
      }

      if (password.length < 6) {
        return error('Password must be at least 6 characters');
      }

      // Check if any admin exists already
      const existingAdmin = await db.fetchOne(
        'SELECT id FROM "User" WHERE role = $1 AND "isActive" = true LIMIT 1',
        ['ADMIN']
      );

      // If admin exists, only allow authenticated admins to create more admins
      if (existingAdmin) {
        const cookieStore = await cookies();
        const token = cookieStore.get('access_token')?.value;
        if (!token) return error('Admin already exists. Please login first.', 403);
        
        const payload = await verifyAccessToken(token);
        if (!payload || payload.role !== 'ADMIN') {
          return error('Only existing admins can create new admin accounts', 403);
        }
      }

      // Check email uniqueness
      const existingUser = await db.fetchOne('SELECT id FROM "User" WHERE email = $1', [email]);
      if (existingUser) return error('Email already registered');

      const id = cuid();
      const hashedPwd = await hashPassword(password);
      const now = new Date();

      await db.query(
        `INSERT INTO "User" (id, email, password, name, role, "isActive", "mustResetPwd", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, email, hashedPwd, name, 'ADMIN', true, false, now, now]
      );

      return success({
        message: 'Admin account created successfully',
        user: { id, email, name, role: 'ADMIN' }
      }, 201);
    } catch (e: any) {
      console.error('Register error:', e);
      return error(e.message || 'Failed to create account', 500);
    }
  }

  return error('Not found', 404);
}
