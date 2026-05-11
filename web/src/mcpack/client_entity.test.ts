import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildClientEntity } from './client_entity';
import { paintingFileBase } from './identifiers';

describe('buildClientEntity', () => {
  it('maps geometry, texture, render controller, spawn egg', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildClientEntity(proj, p);
    const d = j['minecraft:client_entity'].description;
    const fb = paintingFileBase(p.id);
    expect(d.identifier).toBe(`paintings:${fb}`);
    expect(d.materials.default).toBe('entity_alphatest');
    expect(d.textures.default).toBe(`textures/entity/${fb}`);
    expect(d.geometry.default).toBe(`geometry.${fb}`);
    expect(d.render_controllers).toEqual([`controller.render.${fb}`]);
    expect(d.spawn_egg.texture).toBe(`${fb}_egg`);
    expect(d.spawn_egg.texture_index).toBe(0);
  });

  it('uses entity_alphablend when material is alphablend', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.material = 'alphablend';
    proj.paintings.push(p);
    const j = buildClientEntity(proj, p);
    expect(j['minecraft:client_entity'].description.materials.default).toBe('entity_alphablend');
  });
});
