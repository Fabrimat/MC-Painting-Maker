export type SemVer = [number, number, number];

export type PackMeta = {
  name: string;
  description: string;
  namespace: string;
  semver: SemVer;
  minEngineVersion: SemVer;
  iconPngBase64: string | null;
  creativeGroupName: string;
};

export type PackUUIDs = {
  bpHeader: string;
  bpModule: string;
  bpScriptModule: string;
  rpHeader: string;
  rpModule: string;
};

export type Transform = {
  x16: number;
  y16: number;
  w16: number;
  h16: number;
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
};

export type Source = {
  pngBase64: string;
  naturalW: number;
  naturalH: number;
};

export type Density = 'auto' | 1 | 2 | 4 | 8 | 16 | 32 | 64;
export type Resampling = 'smooth' | 'pixelated';
export type Material = 'alphatest' | 'alphablend';

export type Painting = {
  id: string;
  name: string;
  // Stable internal slug, derived once from name+id at creation. Used for entity
  // identifiers, file names, geometry/render controller names. Renaming the
  // painting's display name does NOT change the slug.
  slug: string;
  canvasW16: number;
  canvasH16: number;
  source: Source | null;
  transform: Transform;
  resampling: Resampling;
  textureDensity: Density;
  material: Material;
};

export type ProjectState = {
  version: 1;
  pack: PackMeta;
  uuids: PackUUIDs;
  paintings: Painting[];
};
