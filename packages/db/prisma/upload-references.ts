/**
 * One-off script: copies local reference images into .local-storage and
 * updates the DB ReferenceImage rows to remove the PLACEHOLDER annotation.
 *
 * Run from repo root:
 *   pnpm --filter @regirl/db upload-references
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
// Prisma Client auto-loads packages/db/.env (symlink → repo root .env)
import { PrismaClient } from '@prisma/client';

const SOURCE_DIR = '/Users/admin/Downloads/Work/Regirl/Pictures';
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH ?? '.local-storage';
const STORAGE_BASE = resolve(process.cwd(), LOCAL_STORAGE_PATH);

// Maps DB angleKey → source filename (without extension)
const ANGLE_FILES: Record<string, string> = {
  FRONT_FULL:    'FRONT_FULL',
  LEFT_PROFILE:  'LEFT_PROFILE',
  RIGHT_PROFILE: 'RIGHT_PROFILE',
  BACK_FULL:     'BACK_FULL',
  TOP_DOWN:      'TOP_DOWN',
  CLOSEUP_LACE:  'CLOSEUP_LACE',
  CLOSEUP_ENDS:  'CLOSEUP_ENDS',
};

// Annotation notes per angle — edit these to describe what the reference shows
const ANNOTATIONS: Record<string, string> = {
  FRONT_FULL:    'Hair hem aligns with the 22-inch graduation on the ruler. At least 3 layer steps visible from crown to hem.',
  LEFT_PROFILE:  'Hair hem aligns with the 22-inch graduation on the ruler. End finish shows soft inward curl.',
  RIGHT_PROFILE: 'Hair hem aligns with the 22-inch graduation on the ruler. End finish shows soft inward curl.',
  BACK_FULL:     'Hair hem aligns with the 22-inch graduation on the ruler. Back hemline is even across full width.',
  TOP_DOWN:      'T-closure lace lies flat. Part is straight, centered, and consistent in width.',
  CLOSEUP_LACE:  'Lace is undamaged, no fraying, holes, lifting, or adhesive residue.',
  CLOSEUP_ENDS:  'Ends taper to a soft thin point with a slight inward curl. No blunt cut or split ends visible.',
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const style = await prisma.style.findUnique({ where: { code: 'SOFT_SIREN' } });
    if (!style) throw new Error('SOFT_SIREN style not found — run db:seed first.');

    const refSet = await prisma.referenceSet.findFirst({
      where: { styleId: style.id, isActive: true },
      include: { images: true },
    });
    if (!refSet) throw new Error('No active ReferenceSet found — run db:seed first.');

    console.log(`Found ReferenceSet v${refSet.version} (${refSet.id})\n`);

    for (const image of refSet.images) {
      const angleKey = image.angleKey;
      const sourceFile = ANGLE_FILES[angleKey];
      if (!sourceFile) {
        console.warn(`  SKIP ${angleKey} — no source file mapping defined`);
        continue;
      }

      const srcPath = join(SOURCE_DIR, `${sourceFile}.jpeg`);
      const destRelative = `references/soft-siren/v1/${angleKey.toLowerCase()}.jpg`;
      const destAbs = join(STORAGE_BASE, destRelative);

      await mkdir(join(destAbs, '..'), { recursive: true });
      await copyFile(srcPath, destAbs);
      console.log(`  COPIED ${angleKey} → ${destRelative}`);

      await prisma.referenceImage.update({
        where: { id: image.id },
        data: {
          objectKey: destRelative,
          annotationNote: ANNOTATIONS[angleKey] ?? image.annotationNote,
        },
      });
      console.log(`  UPDATED DB annotation for ${angleKey}`);
    }

    console.log('\nDone. Reference images are live.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
