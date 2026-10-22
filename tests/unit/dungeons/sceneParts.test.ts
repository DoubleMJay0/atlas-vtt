import { describe, expect, it } from 'vitest';
import { mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { DUNGEON_PROPERTY, dungeonNoteText, dungeonPins } from '../../../src/app/dungeons/scene/dungeonNote';
import { dungeonScene } from '../../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../../src/app/dungeons/style';
import { pinNoteLink } from '../../../src/app/tools/pinNoteLink';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { parseNoteYaml } from '../../../src/app/services/noteYaml';

const STYLE = STYLE_PRESETS.parchment;
const NOTE = 'atlas-vtt/collections/Dungeons/scenes/Vault.md';

function placement(pxPerCell = 100): { originCell: { x: number; y: number }; pxPerCell: number } {
  const { originCell } = mapLayout(smallDungeon(), pxPerCell, DEFAULT_VIEW);
  return { originCell, pxPerCell };
}

describe('a dungeon scene', () => {
  it('has the dungeon\'s cells for its grid, no lights and dynamic lighting in daylight', () => {
    const layout = mapLayout(smallDungeon(), 100, DEFAULT_VIEW);
    const parts = dungeonScene(smallDungeon(), STYLE, DEFAULT_VIEW, placement(), { width: layout.widthPx, height: layout.heightPx })!;
    expect(parts.scene.grid).toEqual({ size: 100, offsetX: 0, offsetY: 0 });
    expect(parts.scene.lights).toEqual({});
    expect(parts.scene.lighting).toEqual({ enabled: true, ambient: 1 });
    expect(parts.doors).toEqual({ door: 2, gate: 1, barricade: 1, secret: 1 });
    // The map's corner is a cell corner, so every wall of a square room lies a whole number of cells plus half a wall from it
    const half = (STYLE.strokes.thick / 30 / 2) * 100;
    const xs = Object.values(parts.scene.walls).filter(w => w.type === 'solid' && w.p1.x === w.p2.x).map(w => w.p1.x);
    const offGrid = (x: number): number => Math.min(...[x + half, x - half].map(v => Math.abs(v - Math.round(v / 100) * 100)));
    expect(xs.length).toBeGreaterThan(10);
    expect(xs.filter(x => offGrid(x) > 0.1)).toEqual([]);
  });
});

describe('a dungeon note', () => {
  it('holds what rebuilds the dungeon, its title, story and one heading per numbered room', () => {
    const model = { ...smallDungeon(), tags: ['wet', 'a "quoted" tag'] };
    const text = dungeonNoteText(model, DEFAULT_VIEW);
    const yaml = text.split('---')[1]!;
    expect(parseNoteYaml(yaml)).toEqual({ [DUNGEON_PROPERTY]: { version: model.version, seed: model.seed, tags: ['wet', 'a "quoted" tag'] } });
    expect(text).toContain(`\n# ${model.title}\n`);
    expect(text).toContain(`\n*${model.story}*\n`);
    expect(text.match(/^## .+$/gm)).toEqual(['## 1', '## 2', '## 3', '## 4', '## 5']);
    expect(text).toContain('## 3\n\nA flooded cistern.');
  });

  it('escapes emphasis in the story and leaves out the rooms a view hides', () => {
    const model = { ...smallDungeon(), story: 'A *bold*\nclaim_here.' };
    const text = dungeonNoteText(model, { secrets: false });
    expect(text).toContain('*A \\*bold\\* claim\\_here.*');
    expect(text).not.toContain('## 4');
  });

  it('pins every numbered room at its middle, linking its heading', () => {
    const model = smallDungeon();
    const at = placement(70);
    const pins = Object.values(dungeonPins(model, DEFAULT_VIEW, at, NOTE));
    expect(pins).toHaveLength(5);
    const hall = model.rooms[0]!;
    const first = pins.find(p => p.label === '1')!;
    expect(first).toMatchObject({
      kind: 'pin',
      x: (hall.x + hall.w / 2 - at.originCell.x) * 70,
      y: (hall.y + hall.h / 2 - at.originCell.y) * 70,
      icon: 'number',
      gmOnly: true,
    });
    expect(pinNoteLink(first.notePath)).toEqual({ linkpath: NOTE, heading: '1' });
  });
});
