import { z } from 'zod';

const SemVerSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

const NamespaceSchema = z.string()
  .regex(/^[a-z][a-z0-9_]{0,15}$/, 'namespace must match /^[a-z][a-z0-9_]{0,15}$/')
  .refine((v) => v !== 'minecraft', 'namespace cannot be "minecraft"');

export const PackMetaSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  namespace: NamespaceSchema,
  semver: SemVerSchema,
  minEngineVersion: SemVerSchema,
  iconPngBase64: z.string().nullable(),
  creativeGroupName: z.string().min(1),
  // Defaults to true so projects created before this field was introduced
  // adopt the new behavior on load. Users can opt out via the Pack drawer.
  autoBumpVersion: z.boolean().default(true),
});

// Each UUID slot is either an empty string (project has no identity yet - no images loaded)
// or a valid uuidv4. Identity is assigned lazily on the first image load.
const UuidOrEmpty = z.union([z.literal(''), z.string().uuid()]);

export const PackUUIDsSchema = z.object({
  bpHeader:        UuidOrEmpty,
  bpModule:        UuidOrEmpty,
  bpScriptModule:  UuidOrEmpty,
  rpHeader:        UuidOrEmpty,
  rpModule:        UuidOrEmpty,
});

export const TransformSchema = z.object({
  x16: z.number().int(),
  y16: z.number().int(),
  w16: z.number().int().nonnegative(),
  h16: z.number().int().nonnegative(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  flipX: z.boolean(),
  flipY: z.boolean(),
});

export const SourceSchema = z.object({
  pngBase64: z.string(),
  naturalW: z.number().int().positive(),
  naturalH: z.number().int().positive(),
});

export const PaintingSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string().min(1),
  slugVersion: z.number().int().positive(),
  slugLocked: z.boolean(),
  canvasW16: z.number().int().positive(),
  canvasH16: z.number().int().positive(),
  source: SourceSchema.nullable(),
  transform: TransformSchema,
  resampling: z.union([z.literal('smooth'), z.literal('pixelated')]),
  textureDensity: z.union([
    z.literal('auto'),
    z.literal(1), z.literal(2), z.literal(4), z.literal(8),
    z.literal(16), z.literal(32), z.literal(64),
  ]),
  material: z.union([z.literal('alphatest'), z.literal('alphablend')]),
});

export const ProjectSchema = z.object({
  version: z.literal(2),
  pack: PackMetaSchema,
  uuids: PackUUIDsSchema,
  paintings: z.array(PaintingSchema),
});

export type Project = z.infer<typeof ProjectSchema>;
