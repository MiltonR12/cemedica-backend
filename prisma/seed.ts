import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';

async function main() {
  const dbPath = './dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const doctorPassword = await bcrypt.hash('Doctor123!', 10);
  const recepcionPassword = await bcrypt.hash('Recepcion123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@cemedica.com' },
    update: {},
    create: {
      email: 'admin@cemedica.com',
      name: 'Administrador General',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'doctor@cemedica.com' },
    update: {},
    create: {
      email: 'doctor@cemedica.com',
      name: 'Dr. Juan Pérez',
      password: doctorPassword,
      role: 'DOCTOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'recepcion@cemedica.com' },
    update: {},
    create: {
      email: 'recepcion@cemedica.com',
      name: 'María López',
      password: recepcionPassword,
      role: 'RECEPCION',
    },
  });

  console.log('Database seeded successfully!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
