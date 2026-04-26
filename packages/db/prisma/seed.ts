import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@regirl.local' },
    update: {},
    create: {
      email: 'admin@regirl.local',
      passwordHash: '$2b$10$teP6hJCYz9x2ztCQXxQ1f.18Jfq6Yq9Y4fPQLqR4xvym4Lx1VSjO.',
      role: UserRole.admin
    }
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@regirl.local' },
    update: {},
    create: {
      email: 'supervisor@regirl.local',
      passwordHash: '$2b$10$teP6hJCYz9x2ztCQXxQ1f.18Jfq6Yq9Y4fPQLqR4xvym4Lx1VSjO.',
      role: UserRole.supervisor
    }
  });

  const style = await prisma.style.upsert({
    where: { code: 'SOFT_SIREN' },
    update: {},
    create: {
      code: 'SOFT_SIREN',
      name: 'Soft Siren'
    }
  });

  await prisma.sku.upsert({
    where: { code: 'SS-001-BLK' },
    update: {},
    create: {
      styleId: style.id,
      code: 'SS-001-BLK',
      name: 'Soft Siren Black'
    }
  });

  await prisma.sku.upsert({
    where: { code: 'SS-001-WHT' },
    update: {},
    create: {
      styleId: style.id,
      code: 'SS-001-WHT',
      name: 'Soft Siren White'
    }
  });

  const angles = [
    { key: 'front', label: 'Front' },
    { key: 'left', label: 'Left Side' },
    { key: 'right', label: 'Right Side' },
    { key: 'back', label: 'Back' }
  ];

  for (const angle of angles) {
    await prisma.captureAngle.upsert({
      where: { key: angle.key },
      update: { label: angle.label },
      create: { ...angle, isRequired: true }
    });
  }

  const criteria = [
    { key: 'stitching', label: 'Stitching quality' },
    { key: 'fit', label: 'Fit and drape' },
    { key: 'symmetry', label: 'Panel symmetry' }
  ];

  for (const criterion of criteria) {
    await prisma.criterion.upsert({
      where: { key: criterion.key },
      update: { label: criterion.label },
      create: criterion
    });
  }

  const referenceSet = await prisma.referenceSet.upsert({
    where: { styleId_version: { styleId: style.id, version: 1 } },
    update: { isActive: true },
    create: {
      styleId: style.id,
      version: 1,
      isActive: true,
      promptVersion: 'prompt-v1',
      createdByUserId: admin.id,
      description: 'Baseline Soft Siren references'
    }
  });

  for (const angle of angles) {
    await prisma.referenceImage.upsert({
      where: { id: `${referenceSet.id}-${angle.key}` },
      update: {},
      create: {
        id: `${referenceSet.id}-${angle.key}`,
        referenceSetId: referenceSet.id,
        angleKey: angle.key,
        objectKey: `references/soft-siren/v1/${angle.key}.jpg`
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
