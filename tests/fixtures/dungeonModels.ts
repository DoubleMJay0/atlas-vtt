import type { DoorKind, DungeonModel, DungeonRoom, PropKind } from '../../src/app/dungeons/model';
import { rngFrom, type Rng } from '../../src/app/dungeons/rng';
import { addDoor, addRoom, colonnade, emptyModel, pool, scatter } from './dungeonModelBuilder';

/**
 * Three dungeons to render against: a small one that holds every door kind, every prop, a
 * rotunda with a colonnade, water and a secret wing; a medium and a large one built by a loop.
 */

export function smallDungeon(): DungeonModel {
  const m = emptyModel(4242, 'Sunken Vault of the Grey Abbot', 'Long after the abbot drowned, the vault was sealed and forgotten. Now a band of goblins has dug its way in, and they say his silver reliquary still lies somewhere below the water.');
  const hall = addRoom(m, { x: -2, y: -5, w: 5, h: 5 });
  const rotunda = addRoom(m, { x: -2, y: -11, w: 5, h: 5, rotunda: true, colonnade: true, parent: 0 });
  const corridor = addRoom(m, { x: 4, y: -3, w: 4, h: 1, parent: 0, axis: { x: 1, y: 0 } });
  const junction = addRoom(m, { x: 9, y: -3, w: 1, h: 1, parent: 2, axis: { x: 1, y: 0 } });
  const pond = addRoom(m, { x: 7, y: -9, w: 5, h: 5, parent: 3 });
  const throne = addRoom(m, { x: 6, y: -1, w: 7, h: 6, parent: 3, ending: true, wing: 'culmination', colonnade: true, axis: { x: 0, y: 1 } });
  const secret = addRoom(m, { x: -7, y: -5, w: 4, h: 5, parent: 0, wing: 'secret', axis: { x: -1, y: 0 } });
  const store = addRoom(m, { x: -8, y: -11, w: 5, h: 5, parent: 1, axis: { x: -1, y: 0 } });
  const shrine = addRoom(m, { x: 4, y: -11, w: 2, h: 5, parent: 1, axis: { x: 1, y: 0 } });

  addDoor(m, 0, 0, { x: 0, y: -1 }, 'entrance', null, hall.id);
  addDoor(m, 0, -6, { x: 0, y: -1 }, 'door', hall.id, rotunda.id);
  addDoor(m, 3, -3, { x: 1, y: 0 }, 'doorway', hall.id, corridor.id);
  addDoor(m, 8, -3, { x: 1, y: 0 }, 'open', corridor.id, junction.id);
  addDoor(m, 9, -4, { x: 0, y: -1 }, 'portcullis', junction.id, pond.id);
  addDoor(m, 9, -2, { x: 0, y: 1 }, 'gate', junction.id, throne.id);
  addDoor(m, 9, 5, { x: 0, y: 1 }, 'stairs-down', throne.id, null);
  addDoor(m, -3, -3, { x: -1, y: 0 }, 'secret', hall.id, secret.id);
  addDoor(m, -3, -9, { x: -1, y: 0 }, 'door', rotunda.id, store.id);
  addDoor(m, 3, -9, { x: 1, y: 0 }, 'barricade', rotunda.id, shrine.id);
  addDoor(m, 6, -8, { x: 1, y: 0 }, 'steps', shrine.id, pond.id);

  m.columns.push(...colonnade(rotunda, 1 / 6), ...colonnade(throne, 1 / 6));
  m.columns[3] = { ...m.columns[3]!, shattered: true };
  const props: [PropKind, number, number, number, number, number][] = [
    ['fountain', 0.5, -2.5, 0, 1, hall.id],
    ['statue', 0.5, -8.5, 0, 1, rotunda.id],
    ['well', 8.5, -7.5, 0, 1, pond.id],
    ['dais', 9.5, 5, 0, 1, throne.id],
    ['throne', 9.5, 4.3, 0, 1, throne.id],
    ['chest', -5.5, -4.4, 0.3, 1, secret.id],
    ['sarcophagus', -4.5, -2, Math.PI / 2, 1, secret.id],
    ['barrel', -7.4, -10.4, 0, 1, store.id],
    ['barrel', -6.85, -10.6, 0, 1, store.id],
    ['barrel', -7.3, -9.85, 0, 1, store.id],
    ['crate', -7.3, -6.7, 0.2, 1, store.id],
    ['crate', -6.5, -6.75, -0.1, 1, store.id],
    ['tapestry', -5.5, -11, Math.PI, 1, store.id],
    ['altar', 5, -10.3, 0, 1, shrine.id],
  ];
  for (const [kind, x, y, rotation, scale, room] of props) m.props.push({ kind, x, y, rotation, scale, room });
  m.water.push(pool(rngFrom(7), 10.4, -5.8, 2.1, 1.7));
  scatter(m, hall, 11, 4, 2);
  scatter(m, store, 12, 3, 1);
  scatter(m, throne, 13, 5, 2);
  m.notes.push(
    { ref: '1', room: hall.id, text: 'A dry fountain, its basin full of copper coins.' },
    { ref: '2', room: store.id, text: 'Barrels of spoiled wine and two crates of lamp oil.' },
    { ref: '3', room: pond.id, text: 'A flooded cistern. A rusty key lies at the bottom of the pool.' },
    { ref: '4', room: secret.id, text: 'A hidden crypt: a locked chest beside the abbot\'s coffin.' },
    { ref: '5', room: throne.id, text: 'The grey abbot sits on a throne of drowned stone, waiting.' },
  );
  return m;
}

const CONNECTORS: readonly DoorKind[] = ['door', 'door', 'door', 'doorway', 'open', 'steps'];
const ROOM_PROPS: readonly PropKind[] = ['barrel', 'crate', 'chest', 'fountain', 'well', 'statue', 'sarcophagus', 'altar'];

/** Rooms on a grid, joined by corridors along a random spanning tree and a few loops. */
function gridDungeon(seed: number, cols: number, rows: number, title: string, story: string): DungeonModel {
  const rng = rngFrom(seed);
  const m = emptyModel(seed, title, story);
  const slot = 11;
  const grid: DungeonRoom[][] = [];
  for (let j = 0; j < rows; j++) {
    const row: DungeonRoom[] = [];
    for (let i = 0; i < cols; i++) {
      const w = 3 + 2 * Math.floor(rng() * 3);
      const square = rng() < 0.3;
      const h = square ? w : 3 + 2 * Math.floor(rng() * 3);
      const cx = i * slot;
      const cy = j * slot;
      const rotunda = square && w >= 5 && rng() < 0.5;
      const room = addRoom(m, { x: cx - (w - 1) / 2, y: cy - (h - 1) / 2, w, h, rotunda, colonnade: w >= 5 && h >= 5 && rng() < 0.3 });
      row.push(room);
    }
    grid.push(row);
  }
  grid[rows - 1]![cols - 1]!.ending = true;
  const linked = new Set<string>();
  for (const [a, b] of spanningLinks(rng, cols, rows)) connect(m, rng, linked, grid[a[1]]![a[0]]!, grid[b[1]]![b[0]]!, a[0] !== b[0]);
  const first = grid[0]![0]!;
  addDoor(m, first.x + (first.w - 1) / 2, first.y - 1, { x: 0, y: 1 }, 'entrance', null, first.id);
  const last = grid[rows - 1]![cols - 1]!;
  addDoor(m, last.x + (last.w - 1) / 2, last.y + last.h, { x: 0, y: 1 }, 'stairs-down', last.id, null);
  furnish(m, rng);
  return m;
}

function spanningLinks(rng: Rng, cols: number, rows: number): [[number, number], [number, number]][] {
  const seen = new Set<string>(['0,0']);
  const links: [[number, number], [number, number]][] = [];
  const frontier: [number, number][] = [[0, 0]];
  while (frontier.length) {
    const index = Math.floor(rng() * frontier.length);
    const [i, j] = frontier[index]!;
    const options = ([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as [number, number][])
      .filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !seen.has(`${a},${b}`));
    if (!options.length) {
      frontier.splice(index, 1);
      continue;
    }
    const next = options[Math.floor(rng() * options.length)]!;
    seen.add(`${next[0]},${next[1]}`);
    links.push([[i, j], next]);
    frontier.push(next);
  }
  for (let k = 0; k < Math.floor(cols * rows / 6); k++) {
    const i = Math.floor(rng() * (cols - 1));
    const j = Math.floor(rng() * rows);
    links.push([[i, j], [i + 1, j]]);
  }
  return links;
}

function connect(m: DungeonModel, rng: Rng, linked: Set<string>, a: DungeonRoom, b: DungeonRoom, horizontal: boolean): void {
  const [first, second] = (horizontal ? a.x < b.x : a.y < b.y) ? [a, b] : [b, a];
  const key = `${first.id}-${second.id}`;
  if (linked.has(key)) return;
  linked.add(key);
  const kindA = CONNECTORS[Math.floor(rng() * CONNECTORS.length)]!;
  const kindB = second.ending ? 'gate' : CONNECTORS[Math.floor(rng() * CONNECTORS.length)]!;
  if (horizontal) {
    const y = first.y + (first.h - 1) / 2;
    const start = first.x + first.w + 1;
    const end = second.x - 2;
    const corridor = addRoom(m, { x: start, y, w: end - start + 1, h: 1, parent: first.id, axis: { x: 1, y: 0 } });
    addDoor(m, start - 1, y, { x: 1, y: 0 }, kindA, first.id, corridor.id);
    addDoor(m, end + 1, y, { x: 1, y: 0 }, kindB, corridor.id, second.id);
  } else {
    const x = first.x + (first.w - 1) / 2;
    const start = first.y + first.h + 1;
    const end = second.y - 2;
    const corridor = addRoom(m, { x, y: start, w: 1, h: end - start + 1, parent: first.id, axis: { x: 0, y: 1 } });
    addDoor(m, x, start - 1, { x: 0, y: 1 }, kindA, first.id, corridor.id);
    addDoor(m, x, end + 1, { x: 0, y: 1 }, kindB, corridor.id, second.id);
  }
}

function furnish(m: DungeonModel, rng: Rng): void {
  const rooms = m.rooms.filter(r => r.kind === 'room');
  let ref = 1;
  for (const room of rooms) {
    if (room.colonnade) m.columns.push(...colonnade(room, 1 / 8 + rng() / 8, rng() < 0.25));
    if (!room.colonnade && rng() < 0.45) {
      const kind = ROOM_PROPS[Math.floor(rng() * ROOM_PROPS.length)]!;
      m.props.push({ kind, x: room.x + room.w / 2, y: room.y + room.h / 2, rotation: 0, scale: 1, room: room.id });
    }
    if (rng() < 0.2) m.water.push(pool(rng, room.x + rng() * room.w, room.y + rng() * room.h, 1 + rng() * 2, 1 + rng() * 2));
    scatter(m, room, Math.floor(rng() * 1e6), Math.floor(rng() * 4), rng() < 0.4 ? 1 : 0);
    if (rng() < 0.25) {
      m.notes.push({ ref: String(ref), room: room.id, text: NOTE_TEXTS[(ref - 1) % NOTE_TEXTS.length]! });
      ref++;
    }
  }
}

const NOTE_TEXTS = [
  'A rusted halberd and a handful of silver among the bones.',
  'A goblin sentry, asleep against the wall.',
  'Faded murals of a drowned city cover every wall.',
  'A brass key hangs from a hook above the door.',
  'Collapsed shelves; scrolls rot in the damp.',
  'An altar stained dark, with a dagger of black glass on it.',
  'Six empty cells. One still holds a skeleton in chains.',
  'A pool of still water reflects a sky that is not there.',
];

export function mediumDungeon(): DungeonModel {
  return gridDungeon(9001, 4, 3, 'Lower Halls of Varrow', 'The halls were cut by dwarves who never returned. Kobolds keep them now, and trade with whoever pays in iron.');
}

export function largeDungeon(): DungeonModel {
  return gridDungeon(31337, 8, 5, 'The Endless Undercroft of Saint Merrow', 'Beneath the ruined abbey the crypts run on for miles. Pilgrims went down to pray and did not come back up; the bells still ring at night.');
}

export const DUNGEON_FIXTURES = { small: smallDungeon, medium: mediumDungeon, large: largeDungeon } as const;
