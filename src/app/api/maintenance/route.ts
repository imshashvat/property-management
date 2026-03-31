import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');

  const where: Record<string, unknown> = {};

  if (auth.session!.role === 'TENANT') {
    where.tenantId = auth.session!.tenantId;
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const requests = await prisma.maintenanceRequest.findMany({
    where,
    include: {
      tenant: { select: { firstName: true, lastName: true, credentialId: true } },
      flat: { select: { flatNumber: true, property: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return success(requests);
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

    if (auth.session!.role === 'TENANT') {
      resolvedTenantId = auth.session!.tenantId;
      // Get tenant's active assignment flat
      const assignment = await prisma.assignment.findFirst({
        where: { tenantId: resolvedTenantId, isActive: true },
      });
      if (!assignment) return error('No active flat assignment found');
      resolvedFlatId = assignment.flatId;
    }

    if (!resolvedTenantId || !resolvedFlatId) {
      return error('Tenant and flat are required');
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        title,
        description,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        tenantId: resolvedTenantId,
        flatId: resolvedFlatId,
      },
    });

    return success(request, 201);
  } catch (e) {
    console.error('Create maintenance error:', e);
    return error('Failed to create maintenance request', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, status, resolution, priority } = body;

    if (!id) return error('Request ID is required');

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (resolution) updateData.resolution = resolution;
    if (priority) updateData.priority = priority;

    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const request = await prisma.maintenanceRequest.update({ where: { id }, data: updateData });
    return success(request);
  } catch {
    return error('Failed to update maintenance request', 500);
  }
}
