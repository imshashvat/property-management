import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  const status = searchParams.get('status');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const where: Record<string, unknown> = {};
  if (auth.session!.role === 'TENANT') {
    where.tenantId = auth.session!.tenantId;
  } else if (tenantId) {
    where.tenantId = tenantId;
  }
  if (status) where.status = status;
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: { select: { firstName: true, lastName: true, credentialId: true } },
      flat: { select: { flatNumber: true, property: { select: { name: true } } } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return success(payments);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const { tenantId, flatId, amount, month, year, dueDate } = await req.json();

    if (!tenantId || !flatId || !amount || !month || !year) {
      return error('Tenant, flat, amount, month, and year are required');
    }

    // Check for existing payment
    const existing = await prisma.payment.findFirst({
      where: { tenantId, flatId, month: parseInt(month), year: parseInt(year) },
    });
    if (existing) return error('Payment record already exists for this month');

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        flatId,
        amount: parseFloat(amount),
        month: parseInt(month),
        year: parseInt(year),
        dueDate: dueDate ? new Date(dueDate) : new Date(year, month - 1, 5), // Due 5th of month
      },
    });

    return success(payment, 201);
  } catch (e) {
    console.error('Create payment error:', e);
    return error('Failed to create payment', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, status, paymentMethod, transactionId, paidDate, notes, lateFee } = body;

    if (!id) return error('Payment ID is required');

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (transactionId) updateData.transactionId = transactionId;
    if (notes !== undefined) updateData.notes = notes;
    if (lateFee !== undefined) updateData.lateFee = parseFloat(lateFee);

    if (status === 'PAID') {
      updateData.paidDate = paidDate ? new Date(paidDate) : new Date();
    }

    const payment = await prisma.payment.update({ where: { id }, data: updateData });
    return success(payment);
  } catch {
    return error('Failed to update payment', 500);
  }
}

// Generate rent for all active assignments
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const { month, year } = await req.json();

    if (!month || !year) return error('Month and year are required');

    const activeAssignments = await prisma.assignment.findMany({
      where: { isActive: true },
      include: { tenant: true, flat: true },
    });

    let created = 0;
    let skipped = 0;

    for (const assignment of activeAssignments) {
      const existing = await prisma.payment.findFirst({
        where: {
          tenantId: assignment.tenantId,
          flatId: assignment.flatId,
          month: parseInt(month),
          year: parseInt(year),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.payment.create({
        data: {
          tenantId: assignment.tenantId,
          flatId: assignment.flatId,
          amount: assignment.rentAmount,
          month: parseInt(month),
          year: parseInt(year),
          dueDate: new Date(parseInt(year), parseInt(month) - 1, 5),
        },
      });
      created++;
    }

    return success({ created, skipped, total: activeAssignments.length });
  } catch (e) {
    console.error('Generate rent error:', e);
    return error('Failed to generate rent', 500);
  }
}
