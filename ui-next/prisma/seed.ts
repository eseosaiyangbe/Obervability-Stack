import { UserRole, UserStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma-server'

async function main() {
  // Create demo admin user
  const adminPassword = await bcrypt.hash('admin@123', 12)

  await prisma.user.deleteMany({
    where: {
      email: 'demo@example.com',
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Demo Admin',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'admin@example.com',
      name: 'Demo Admin',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    }
  })

  // Create demo viewer user
  const viewerPassword = await bcrypt.hash('viewer123', 12)
  
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {
      name: 'Demo Viewer',
      password: viewerPassword,
      role: UserRole.VIEWER,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'viewer@example.com',
      name: 'Demo Viewer',
      password: viewerPassword,
      role: UserRole.VIEWER,
      status: UserStatus.ACTIVE,
    }
  })

  // Create demo editor user
  const editorPassword = await bcrypt.hash('editor123', 12)
  
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@example.com' },
    update: {
      name: 'Demo Editor',
      password: editorPassword,
      role: UserRole.EDITOR,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'editor@example.com',
      name: 'Demo Editor',
      password: editorPassword,
      role: UserRole.EDITOR,
      status: UserStatus.ACTIVE,
    }
  })

  console.log('Demo users created:')
  console.log('- Admin: admin@example.com / admin@123')
  console.log('- Viewer: viewer@example.com / viewer123')
  console.log('- Editor: editor@example.com / editor123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
