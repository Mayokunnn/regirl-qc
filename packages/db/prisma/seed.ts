import { EvaluationType, PrismaClient, Severity, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Soft Siren — style nuance context (PRD §9.2)
// ---------------------------------------------------------------------------
const SOFT_SIREN_NUANCE_CONTEXT = `You are evaluating a Soft Siren wig — a 22-inch layered straight wig made with Light-Yaki synthetic fiber and a T-closure lace panel. Every single criterion must pass independently. A wig that excels in all areas but fails one is still a fail.

TEXTURE — Light-Yaki:
Light-Yaki sits between two bad extremes. Reject both:
- Too flat / plasticised: hair looks completely straight, stiff, and shiny like a doll — does not look natural.
- Too wavy / frizzy: visible waves, curls, or a frizz cloud around the hair.
The texture must look consistent from the crown all the way to the ends. If the top looks correct but the ends look wrong, it fails. If lighting makes texture impossible to assess reliably, return LOW confidence.

LAYERS — Front view only:
Layers are only assessed from the FRONT_FULL angle. Side profile angles do not show layers — from the side the hair appears as one continuous length, which is correct.
From the front, there must be at least 3 clearly visible steps graduating from approximately 8 inches at the top down to 22 inches at the bottom. These steps must be visible when the hair hangs naturally — not only when someone adjusts it. The transition between each step must be smooth, not choppy. Fail types:
- No layers: the front looks like one flat, even length with no layer tips visible.
- Insufficient layers: fewer than 3 visible steps.
- Too choppy: steps are harsh and unblended.
- Collapsed layers: layers exist but are invisible when hair hangs naturally.

LENGTH — Ruler-based:
The AI does not measure pixels. It compares where the hair hem falls against the ruler in the photo. The reference annotation specifies the exact ruler mark. Results:
- Hair ends above the mark (up to 1 inch longer): PASS.
- Hair ends exactly at the mark: PASS.
- Hair ends below the mark by any amount: FAIL — no exceptions.
Hair cannot be made longer, only shorter. Being too short is always a MAJOR fail.

END FINISH — Curled inward tips:
The ends must taper to a soft, thin point that curls slightly inward. Fail types:
- Blunt cut: all hairs end in a straight line across — like a wall. Needs tapering and feathering.
- Frayed / rough: fiber is damaged at the tips. May require cutting back (affects length).
- Split ends: individual hairs splitting at the tips. May require cutting back (affects length).
The CLOSEUP_ENDS photo is the primary source for this check. If it is missing or blurry, return LOW confidence even if side profiles look fine.

DARK FIBER:
Most Soft Siren color variants are dark (dark cherry or near-black). Dark hair absorbs light, making texture, edges, and volume harder to read. Look for three clues instead of direct texture:
1. Shine patterns — how light bounces off the surface (reveals texture and shape).
2. Clear edges — the line where hair ends and background begins (reveals silhouette and volume).
3. Shadow depth — darker areas within the hair mass (reveals layers and body).
If none of these clues are visible due to poor lighting or a dark backdrop, return LOW confidence. Inability to see something is not the same as it being acceptable.

SHINE:
The hair should have a soft, natural glow — not dull and not over-shiny.
- Dull / flat: likely product build-up on the surface.
- Over-shiny / plastic: likely heat damage to the fiber.
Compare against the reference image, not a fixed brightness value. This check is most sensitive to ring-light positioning — if the lighting setup appears incorrect, return LOW confidence rather than guessing.

FRIZZ AND FLYAWAYS:
- Frizz halo: a fuzzy, cloud-like edge all around the wig — FAIL.
- Flyaways: clumps of hair sticking out from the body in a direction — FAIL.
- A few single stray hairs: PASS — this is normal.
Assess the outer silhouette edge for disturbance.

VOLUME:
The wig should look full and three-dimensional, not flat against the mannequin head. Infer volume from shadow depth, silhouette thickness, and the curvature of the outer shape. Both sides must look even — a wig that appears full from the front but flat from the side or back still fails. Lopsided volume is a MAJOR fail.

LACE AND PARTING — checked independently:
Lace: must be flat against the head with no holes, fraying, lifting edges, or adhesive residue.
Parting: must be straight, centered, and consistent in width — not too wide, not too narrow.
A wig can have perfect lace but a bad parting, or vice versa. They are separate criteria.

TRACK VISIBILITY — zero tolerance:
If any wig tracks or stitching are visible through the hair in any photo, it is an automatic MAJOR fail. There is no minor category for this. Identify the exact location (e.g., front hairline, crown, back center) in the failure reason.

COLOUR NOTE:
Do not evaluate based on hair colour. Colour variations between the submission and reference are expected and intentional. Evaluate structure, texture, and style only.`;

// ---------------------------------------------------------------------------
// Capture angles (PRD §9.3) — sortOrder matches table order
// ---------------------------------------------------------------------------
const SOFT_SIREN_ANGLES = [
  {
    key: 'FRONT_FULL',
    label: 'Front — Full View',
    supervisorInstruction:
      'Stand directly in front of mannequin at face height. Wig fully visible crown to hem. Vertical ruler visible on one side.',
    sortOrder: 1
  },
  {
    key: 'LEFT_PROFILE',
    label: 'Left Profile',
    supervisorInstruction:
      'Stand directly to the left of the mannequin at face height. Full side profile visible. Vertical ruler visible.',
    sortOrder: 2
  },
  {
    key: 'RIGHT_PROFILE',
    label: 'Right Profile',
    supervisorInstruction:
      'Stand directly to the right of the mannequin at face height. Full side profile visible. Vertical ruler visible.',
    sortOrder: 3
  },
  {
    key: 'BACK_FULL',
    label: 'Back — Full View',
    supervisorInstruction:
      'Stand directly behind the mannequin at face height. Full back view visible. Vertical ruler visible.',
    sortOrder: 4
  },
  {
    key: 'TOP_DOWN',
    label: 'Top Down',
    supervisorInstruction:
      'Hold phone directly above mannequin head angled downward. Shows crown and parting area.',
    sortOrder: 5
  },
  {
    key: 'CLOSEUP_LACE',
    label: 'Close-up Lace',
    supervisorInstruction:
      'Camera 15–20cm from the T-closure lace area. Fills frame with lace/parting zone.',
    sortOrder: 6
  },
  {
    key: 'CLOSEUP_ENDS',
    label: 'Close-up Ends',
    supervisorInstruction:
      'Camera 15–20cm from the ends of the hair. Supervisor lifts a section to show ends clearly against a neutral background.',
    sortOrder: 7
  }
] as const;

// ---------------------------------------------------------------------------
// QC criteria (PRD §9.4) — key, label, description, acceptableStandard,
// severityIfFailed, evaluationType, and which angles are relevant
// ---------------------------------------------------------------------------
const SOFT_SIREN_CRITERIA = [
  {
    key: 'overall-length',
    label: 'Overall Length',
    description:
      'Using the vertical ruler as scale reference, check whether the hair hem aligns with the correct graduation mark as specified in the reference annotation. Hair must be at least 22 inches from cap base.',
    acceptableStandard: 'Hem aligns with reference ruler mark ± acceptable tolerance. Must never fall short of 22". May be up to 1" longer.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.positional,
    sortOrder: 1,
    angles: ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE', 'BACK_FULL']
  },
  {
    key: 'layer-graduation',
    label: 'Layer Graduation',
    description:
      'Assessed from the FRONT_FULL angle only — side profiles do not show layers. There must be at least 3 clearly visible steps graduating from approximately 8 inches at the top down to 22 inches at the bottom. Steps must be visible when the hair hangs naturally, not only when adjusted. Transitions between steps must be smooth.',
    acceptableStandard: 'At least 3 visible layer steps from the front, graduating 8–22 inches. Steps visible when hanging naturally. Smooth transitions, no choppy lines, no blunt single-length appearance.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.conformity,
    sortOrder: 2,
    angles: ['FRONT_FULL']
  },
  {
    key: 'end-finish',
    label: 'End Finish',
    description:
      'The tips of the hair must taper to a soft, thin point that curls slightly inward. Three distinct fail types: (1) blunt cut — all hairs end in a straight wall across; (2) frayed/rough — fiber is damaged at the tips; (3) split ends — individual hairs splitting. CLOSEUP_ENDS is the primary source; if it is missing or blurry return LOW confidence.',
    acceptableStandard: 'Ends taper to a soft, thin point with a slight inward curl. No blunt straight-across cut. No frayed, rough, or split tips visible in close-up.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.surface,
    sortOrder: 3,
    angles: ['LEFT_PROFILE', 'RIGHT_PROFILE', 'CLOSEUP_ENDS']
  },
  {
    key: 'texture-consistency',
    label: 'Texture Consistency',
    description:
      'Light-Yaki texture should be consistent throughout — subtle natural texture, not bone straight and not wavy/frizzy. Assess from crown to ends.',
    acceptableStandard: 'Texture is uniform crown to tip. No sections noticeably straighter (flat/plasticised) or wavier than the reference. Consistent natural movement.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.surface,
    sortOrder: 4,
    angles: ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE']
  },
  {
    key: 'volume-body',
    label: 'Volume and Body',
    description:
      'Hair should have natural body and movement, not flat or compressed. Volume should be distributed evenly and match the reference silhouette.',
    acceptableStandard: 'Volume is even across left and right. No flat sections. Silhouette matches reference shape from front and profile. Natural movement visible.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.conformity,
    sortOrder: 5,
    angles: ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE', 'BACK_FULL']
  },
  {
    key: 'left-right-symmetry',
    label: 'Left-Right Symmetry',
    description: 'Both sides should be even in length and volume when viewed from front and back.',
    acceptableStandard: 'Left and right sides match within visible tolerance. No side visibly longer or thicker than the other.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.conformity,
    sortOrder: 6,
    angles: ['FRONT_FULL', 'BACK_FULL']
  },
  {
    key: 't-closure-lace',
    label: 'T-Closure Lace Condition',
    description: 'The T-closure lace panel should be undamaged, flat, and clean.',
    acceptableStandard: 'No visible fraying, holes, or lifting at lace edges. Lace lies flat. No excess adhesive residue.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.surface,
    sortOrder: 7,
    angles: ['TOP_DOWN', 'CLOSEUP_LACE']
  },
  {
    key: 'parting-cleanliness',
    label: 'Parting Cleanliness',
    description: 'The part line should be clean, straight, and centered.',
    acceptableStandard: 'Part is straight and centered. No ragged or uneven parting. Consistent with reference.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.conformity,
    sortOrder: 8,
    angles: ['TOP_DOWN', 'CLOSEUP_LACE']
  },
  {
    key: 'surface-sheen',
    label: 'Surface Sheen',
    description: 'ReXI fiber should have a natural, soft sheen — not dull/flat and not over-glossy/plasticised.',
    acceptableStandard: 'Surface sheen matches reference. No sections appearing dull (product buildup) or over-shiny (heat damage).',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.surface,
    sortOrder: 9,
    angles: ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE']
  },
  {
    key: 'frizz-flyaways',
    label: 'Frizz and Flyaways',
    description:
      'Hair surface should be smooth with minimal frizz or flyaways. Soft Siren is a sleek style.',
    acceptableStandard: 'No visible halo frizz. No flyaway sections standing away from body of style. Minor single-strand flyaways acceptable; assess against reference.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.surface,
    sortOrder: 10,
    angles: ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE']
  },
  {
    key: 'weft-track-visibility',
    label: 'Weft/Track Visibility',
    description: 'No weft tracks or stitching lines should be visible through the hair from any angle.',
    acceptableStandard: 'No visible tracks or stitching lines in any angle. Any visible track is a MAJOR fail regardless of how small.',
    severityIfFailed: Severity.major,
    evaluationType: EvaluationType.conformity,
    sortOrder: 11,
    angles: ['FRONT_FULL', 'TOP_DOWN', 'BACK_FULL']
  },
  {
    key: 'back-hemline-evenness',
    label: 'Back Hemline Evenness',
    description: 'The hem across the back should be even — not diagonal or stepped.',
    acceptableStandard: 'Back hem falls evenly across the full width. No visible diagonal cut or stepped difference in length across the back.',
    severityIfFailed: Severity.minor,
    evaluationType: EvaluationType.conformity,
    sortOrder: 12,
    angles: ['BACK_FULL']
  }
] as const;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function main() {
  // Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@regirl.local' },
    update: { passwordHash: '$2a$10$YKRbe8ET9YqsE2K/uA0iQutjQi30QY/iG4cFb7MBEjQXOUs7H7htm' },
    create: {
      email: 'admin@regirl.local',
      passwordHash: '$2a$10$YKRbe8ET9YqsE2K/uA0iQutjQi30QY/iG4cFb7MBEjQXOUs7H7htm',
      role: UserRole.admin
    }
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@regirl.local' },
    update: { passwordHash: '$2a$10$YKRbe8ET9YqsE2K/uA0iQutjQi30QY/iG4cFb7MBEjQXOUs7H7htm' },
    create: {
      email: 'supervisor@regirl.local',
      passwordHash: '$2a$10$YKRbe8ET9YqsE2K/uA0iQutjQi30QY/iG4cFb7MBEjQXOUs7H7htm',
      role: UserRole.supervisor
    }
  });

  // Style — Soft Siren
  const style = await prisma.style.upsert({
    where: { code: 'SOFT_SIREN' },
    update: {
      name: 'Soft Siren',
      lengthInches: 22,
      laceType: 'T-Closure',
      textureType: 'Light-Yaki',
      styleNuanceContext: SOFT_SIREN_NUANCE_CONTEXT
    },
    create: {
      code: 'SOFT_SIREN',
      name: 'Soft Siren',
      lengthInches: 22,
      laceType: 'T-Closure',
      textureType: 'Light-Yaki',
      styleNuanceContext: SOFT_SIREN_NUANCE_CONTEXT
    }
  });

  // SKUs — 2 color variants (PRD §16)
  await prisma.sku.upsert({
    where: { code: 'SS-NAT-001' },
    update: { name: 'Soft Siren — Natural Color with Dark Cherry Tones' },
    create: {
      styleId: style.id,
      code: 'SS-NAT-001',
      name: 'Soft Siren — Natural Color with Dark Cherry Tones'
    }
  });

  await prisma.sku.upsert({
    where: { code: 'SS-DC-001' },
    update: { name: 'Soft Siren — Dark Cherry' },
    create: {
      styleId: style.id,
      code: 'SS-DC-001',
      name: 'Soft Siren — Dark Cherry'
    }
  });

  // Capture angles (7 for Soft Siren)
  for (const angle of SOFT_SIREN_ANGLES) {
    await prisma.captureAngle.upsert({
      where: { key: angle.key },
      update: {
        label: angle.label,
        supervisorInstruction: angle.supervisorInstruction,
        sortOrder: angle.sortOrder,
        isRequired: true
      },
      create: {
        key: angle.key,
        label: angle.label,
        supervisorInstruction: angle.supervisorInstruction,
        sortOrder: angle.sortOrder,
        isRequired: true
      }
    });
  }

  // Criteria (12 for Soft Siren) + CriterionAngle junction records
  for (const criterion of SOFT_SIREN_CRITERIA) {
    const { angles, ...criterionData } = criterion;

    const created = await prisma.criterion.upsert({
      where: { key: criterionData.key },
      update: {
        label: criterionData.label,
        description: criterionData.description,
        acceptableStandard: criterionData.acceptableStandard,
        severityIfFailed: criterionData.severityIfFailed,
        evaluationType: criterionData.evaluationType,
        sortOrder: criterionData.sortOrder
      },
      create: {
        key: criterionData.key,
        label: criterionData.label,
        description: criterionData.description,
        acceptableStandard: criterionData.acceptableStandard,
        severityIfFailed: criterionData.severityIfFailed,
        evaluationType: criterionData.evaluationType,
        sortOrder: criterionData.sortOrder
      }
    });

    // CriterionAngle junction records
    for (const angleKey of angles) {
      await prisma.criterionAngle.upsert({
        where: { criterionId_angleKey: { criterionId: created.id, angleKey } },
        update: {},
        create: { criterionId: created.id, angleKey }
      });
    }
  }

  // Reference set — v1 placeholder (actual images uploaded via admin panel)
  const referenceSet = await prisma.referenceSet.upsert({
    where: { styleId_version: { styleId: style.id, version: 1 } },
    update: { isActive: true },
    create: {
      styleId: style.id,
      version: 1,
      isActive: true,
      promptVersion: 'prompt-v1',
      createdByUserId: admin.id,
      description: 'Baseline Soft Siren reference set — upload reference images via admin panel before going live'
    }
  });

  // One placeholder reference image per angle, with instruction to replace
  for (const angle of SOFT_SIREN_ANGLES) {
    await prisma.referenceImage.upsert({
      where: { id: `${referenceSet.id}-${angle.key}` },
      update: {},
      create: {
        id: `${referenceSet.id}-${angle.key}`,
        referenceSetId: referenceSet.id,
        angleKey: angle.key,
        objectKey: `references/soft-siren/v1/${angle.key.toLowerCase()}.jpg`,
        annotationNote:
          angle.key === 'FRONT_FULL' || angle.key === 'LEFT_PROFILE' || angle.key === 'RIGHT_PROFILE' || angle.key === 'BACK_FULL'
            ? 'PLACEHOLDER — upload actual reference photo and update annotation. Expected: hair hem aligns with the 22-inch graduation on the ruler.'
            : 'PLACEHOLDER — upload actual reference photo via admin panel and add relevant annotation note.'
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log('  Style: Soft Siren (SOFT_SIREN)');
  // eslint-disable-next-line no-console
  console.log('  SKUs: SS-NAT-001, SS-DC-001');
  // eslint-disable-next-line no-console
  console.log('  Angles:', SOFT_SIREN_ANGLES.length);
  // eslint-disable-next-line no-console
  console.log('  Criteria:', SOFT_SIREN_CRITERIA.length);
  // eslint-disable-next-line no-console
  console.log('  ⚠️  Reference images are placeholders — upload real photos via admin panel before running live QC.');
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
