import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { readTags } from '../../../src/app/dungeons/tags';
import { pickTheme, themedTags } from '../../../src/app/dungeons/themes/themes';
import type { ThemeId } from '../../../src/app/dungeons/themes/themeTypes';

const SEEDS = Array.from({ length: 200 }, (_, k) => k + 1);

describe('themes', () => {
  it('picks the chosen theme', () => {
    expect(pickTheme(7, 'mansion', [])).toBe('mansion');
  });

  it('Any picks a theme that takes the chosen tags', () => {
    for (const seed of SEEDS) {
      expect(pickTheme(seed, 'any', ['lava'])).toBe('cavern');
      expect(pickTheme(seed, 'any', ['ruined'])).not.toBe('cavern');
      expect(pickTheme(seed, 'any', ['ruined'])).toBe(pickTheme(seed, 'any', ['ruined']));
    }
    expect(new Set(SEEDS.map((seed) => pickTheme(seed, 'any', ['lava', 'ruined'])))).toEqual(new Set<ThemeId>(['fortress', 'mansion', 'cavern']));
  });

  it('Any spreads over the three themes', () => {
    const counts = new Map<ThemeId, number>();
    for (let seed = 1; seed <= 600; seed++) {
      const theme = pickTheme(seed, 'any', []);
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
    for (const theme of ['fortress', 'mansion', 'cavern'] as const) {
      expect((counts.get(theme) ?? 0) / 600, theme).toBeGreaterThanOrEqual(0.25);
      expect((counts.get(theme) ?? 0) / 600, theme).toBeLessThanOrEqual(0.42);
    }
  });

  it('lets every theme take the inhabited tag, ruined too', () => {
    for (const theme of ['fortress', 'mansion', 'cavern'] as const) expect(themedTags(theme, ['inhabited'])).toEqual(['inhabited']);
    expect(readTags(['inhabited', 'ruined']).sort()).toEqual(['inhabited', 'ruined']);
    expect(themedTags('fortress', ['ruined', 'inhabited'])).toEqual(['ruined', 'inhabited']);
    expect(generateDungeon({ seed: 4, tags: ['inhabited'], floors: 1, theme: 'cavern' }).tags).toContain('inhabited');
  });

  it('ignores the tags a theme refuses', () => {
    expect(themedTags('mansion', ['lava', 'wet', 'flooded'])).toEqual(['wet']);
  });

  it('drops the retired theme tags', () => {
    expect(readTags(['temple', 'tomb', 'dwelling', 'wet'])).toEqual(['wet']);
  });

  it('seats nothing on a Cavern arena and holds no throne there', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const model = generateDungeon({ seed, theme: 'cavern', tags: [], floors: 1 + (seed % 3) });
      for (const floor of model.floors) expect(floor.props.some((p) => p.kind === 'throne'), `seed ${seed}`).toBe(false);
    }
  });

  it('builds a dungeon of the chosen theme', () => {
    const model = generateDungeon({ seed: 3, tags: [], floors: 1, theme: 'fortress' });
    expect(model.theme).toBe('fortress');
    expect(model.version).toBe(3);
  });
});
