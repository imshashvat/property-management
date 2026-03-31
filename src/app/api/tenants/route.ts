import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateCredentialId, generateRandomPassword } from '@/lib/auth';
import { success, error, requireAuth } from '@/lib/utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true } },
      assignments: {
        where: { isActive: true },
        include: { flat: { include: { property: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return success(tenants);
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
    const existing = await prisma.user.findUnique({ where: { email } });
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
    const tenantCount = await prisma.tenant.count();
    const year = new Date().getFullYear();
    const credentialId = generateCredentialId('PRP', year, tenantCount + 1);
    const tempPassword = generateRandomPassword();
    const hashedPwd = await hashPassword(tempPassword);

    // Create user + tenant in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPwd,
          name: `${firstName} ${lastName}`,
          role: 'TENANT',
          phone,
          mustResetPwd: true,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          credentialId,
          firstName,
          lastName,
          phone,
          emergencyContact: emergencyContact || null,
          idProofType,
          idProofNumber,
          idProofUrl,
          userId: user.id,
        },
      });

      return { user, tenant };
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

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(emergencyContact !== undefined && { emergencyContact }),
      },
    });

    // Also update user name
    if (firstName || lastName) {
      const t = await prisma.tenant.findUnique({ where: { id } });
      if (t) {
        await prisma.user.update({
          where: { id: t.userId },
          data: { name: `${firstName || t.firstName} ${lastName || t.lastName}` },
        });
      }
    }

    return success(tenant);
  } catch {
    return error('Failed to update tenant', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('Tenant ID is required');

  await prisma.tenant.update({ where: { id }, data: { isActive: false } });

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (tenant) {
    await prisma.user.update({ where: { id: tenant.userId }, data: { isActive: false } });
  }

  return success({ message: 'Tenant deactivated' });
}
