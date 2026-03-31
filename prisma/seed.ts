import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@propmanager.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hashed = await bcrypt.hash('Admin@123', 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashed,
        name: 'Super Admin',
        role: 'ADMIN',
        mustResetPwd: false,
      },
    });
    console.log('✅ Admin user created (admin@propmanager.com / Admin@123)');
  } else {
    console.log('✅ Admin user already exists');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
