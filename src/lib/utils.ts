import { NextResponse } from 'next/server';
import { getSession, verifyRefreshToken, createAccessToken, JWTPayload } from './auth';
import { cookies } from 'next/headers';

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Try to get a session from the access_token.
 * If expired, attempt to refresh using the refresh_token.
 */
async function getSessionWithRefresh(): Promise<JWTPayload | null> {
  // First try the access token
  let session = await getSession();
  if (session) return session;

  // Access token missing or expired — try refresh token
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) return null;

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) return null;

    // Create a new access token from the refresh token payload
    const newPayload: JWTPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
    const newAccessToken = await createAccessToken(newPayload);

    // Set the new access token cookie
    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    return newPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(allowedRoles?: string[]) {
  const session = await getSessionWithRefresh();
  if (!session) {
    return { error: error('Unauthorized', 401), session: null };
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { error: error('Forbidden', 403), session: null };
  }
  return { error: null, session };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1] || '';
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
