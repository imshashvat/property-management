import { NextResponse } from 'next/server';
import { getSession } from './auth';

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function requireAuth(allowedRoles?: string[]) {
  const session = await getSession();
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
