import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createAccessToken, createRefreshToken, verifyRefreshToken, hashPassword } from '@/lib/auth';
import { success, error } from '@/lib/utils';
import { cookies } from 'next/headers';

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
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Try credential ID lookup
        const tenant = await prisma.tenant.findUnique({
          where: { credentialId: email },
          include: { user: true },
        });
        if (tenant) user = tenant.user;
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
        const tenant = await prisma.tenant.findUnique({ where: { userId: user.id } });
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
    } catch (e) {
      console.error('Login error:', e);
      return error('Internal server error', 500);
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
    } catch {
      return error('Internal server error', 500);
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

      const { verifyAccessToken } = await import('@/lib/auth');
      const payload = await verifyAccessToken(token);
      if (!payload) return error('Invalid token', 401);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, role: true, phone: true, avatar: true },
      });

      if (!user) return error('User not found', 404);

      let tenant = null;
      if (user.role === 'TENANT') {
        tenant = await prisma.tenant.findUnique({
          where: { userId: user.id },
          include: {
            assignments: {
              where: { isActive: true },
              include: { flat: { include: { property: true } } },
            },
          },
        });
      }

      return success({ ...user, tenant });
    } catch {
      return error('Internal server error', 500);
    }
  }

  if (action === 'reset-password') {
    try {
      const { userId, currentPassword, newPassword } = await req.json();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return error('User not found', 404);

      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return error('Current password is incorrect', 400);

      const hashed = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashed, mustResetPwd: false },
      });

      return success({ message: 'Password updated' });
    } catch {
      return error('Internal server error', 500);
    }
  }

  return error('Not found', 404);
}
