import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const assignments = await prisma.assignment.findMany({
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, credentialId: true } },
      flat: {
        include: { property: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return success(assignments);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const { tenantId, flatId, startDate, endDate, rentAmount, deposit } = await req.json();

    if (!tenantId || !flatId || !startDate || !rentAmount) {
      return error('Tenant, flat, start date, and rent amount are required');
    }

    // Check if flat is available
    const flat = await prisma.flat.findUnique({ where: { id: flatId } });
    if (!flat) return error('Flat not found', 404);
    if (flat.status === 'OCCUPIED') return error('Flat is already occupied');

    const assignment = await prisma.$transaction(async (tx) => {
      const a = await tx.assignment.create({
        data: {
          tenantId,
          flatId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          rentAmount: parseFloat(rentAmount),
          deposit: deposit ? parseFloat(deposit) : 0,
        },
      });

      // Mark flat as occupied
      await tx.flat.update({
        where: { id: flatId },
        data: { status: 'OCCUPIED' },
      });

      // Set tenant move-in date
      await tx.tenant.update({
        where: { id: tenantId },
        data: { moveInDate: new Date(startDate) },
      });

      return a;
    });

    return success(assignment, 201);
  } catch (e) {
    console.error('Create assignment error:', e);
    return error('Failed to create assignment', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, status, endDate } = body;

    if (!id) return error('Assignment ID is required');

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return error('Assignment not found', 404);

    const updateData: Record<string, unknown> = {};
    if (endDate) updateData.endDate = new Date(endDate);

    if (status === 'TERMINATED' || status === 'EXPIRED') {
      updateData.status = status;
      updateData.isActive = false;

      // Free up the flat
      await prisma.flat.update({
        where: { id: assignment.flatId },
        data: { status: 'VACANT' },
      });
    }

    const updated = await prisma.assignment.update({ where: { id }, data: updateData });
    return success(updated);
  } catch {
    return error('Failed to update assignment', 500);
  }
}
