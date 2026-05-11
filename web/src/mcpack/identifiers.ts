export function sanitizeId(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '_');
}

export function paintingFileBase(uuid: string): string {
  return `painting_${sanitizeId(uuid)}`;
}

export function entityId(namespace: string, uuid: string): string {
  return `${namespace}:${paintingFileBase(uuid)}`;
}

export function spawnEggItemId(namespace: string, uuid: string): string {
  return `${entityId(namespace, uuid)}_spawn_egg`;
}

export function spawnEggTextureKey(uuid: string): string {
  return `${paintingFileBase(uuid)}_egg`;
}

export function geometryName(uuid: string): string {
  return `geometry.${paintingFileBase(uuid)}`;
}

export function renderControllerName(uuid: string): string {
  return `controller.render.${paintingFileBase(uuid)}`;
}
