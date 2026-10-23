import type { DungeonModel } from '../../../dungeons/model';
import { roomShape, shapeDistance } from '../../../dungeons/render/geometry';
import type { MapLayout } from '../../../dungeons/render/layoutSize';
import { visibleFloor } from '../../../dungeons/render/visibleDungeon';
import type { DungeonView } from '../../../dungeons/style';

/** A point of the drawn map, in its pixels. */
export interface MapPoint {
  x: number;
  y: number;
}

/** The map pixel under a client point, for a map drawn `mapWidth` pixels wide into `frame`. */
export function mapPointOf(client: MapPoint, frame: Pick<DOMRect, 'left' | 'top' | 'width'>, mapWidth: number): MapPoint {
  const scale = frame.width > 0 ? mapWidth / frame.width : 1;
  return { x: (client.x - frame.left) * scale, y: (client.y - frame.top) * scale };
}

/** The shown room under a map pixel, or null. */
export function roomAt(model: DungeonModel, view: Pick<DungeonView, 'secrets'>, map: MapLayout, p: MapPoint): number | null {
  const x = p.x / map.pxPerCell + map.originCell.x;
  const y = p.y / map.pxPerCell + map.originCell.y;
  const room = visibleFloor(model, view).rooms.find((entry) => shapeDistance(roomShape(entry), x, y) <= 0);
  return room?.id ?? null;
}
