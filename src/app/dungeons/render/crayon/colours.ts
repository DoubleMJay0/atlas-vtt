import type { Material } from '../art/hand';

/**
 * The crayons: Dolmenwood's day terrain colours, which the Reprieve map is coloured in (forest,
 * farmland, hills, aquatic), and Nagwood's brick red for its roofs. Kept apart from the style's
 * palette, which holds only the paper, the graphite and the colours the scene reads.
 */
export const CRAYONS = {
  leaf: '#5c8a3f',
  shadeLeaf: '#3f6d4c',
  wood: '#b8813a',
  straw: '#c9a94f',
  brick: '#a85454',
  earth: '#93805d',
  slate: '#647064',
  water: '#5d94b8',
  deepWater: '#2e6b9e',
  ember: '#c9572d',
  flame: '#d8bc68',
  acid: '#96a63f',
} as const;

/** What a plant is filled with before its graphite: the paper with a little leaf green in it; plants are too small to show the crayon's strokes. */
export const PLANT_TINT = 0.4;

/** How a material is coloured in: its crayon, how much colour the hand leaves and in how many passes. */
export interface CrayonFill {
  colour: string;
  cover: number;
  passes: number;
}

/** Floors stay bare vellum: a large area coloured all over shows the hand's sections as bands. */
export const MATERIAL_CRAYONS: Readonly<Record<Material, CrayonFill | null>> = {
  floor: null,
  stone: { colour: CRAYONS.earth, cover: 0.8, passes: 2 },
  dressed: { colour: CRAYONS.earth, cover: 0.9, passes: 3 },
  rock: { colour: CRAYONS.slate, cover: 0.85, passes: 2 },
  raised: { colour: CRAYONS.earth, cover: 0.55, passes: 2 },
  wood: { colour: CRAYONS.wood, cover: 1, passes: 3 },
  rope: { colour: CRAYONS.straw, cover: 1, passes: 3 },
  metal: { colour: CRAYONS.slate, cover: 1, passes: 2 },
  cloth: { colour: CRAYONS.brick, cover: 1, passes: 3 },
  glass: { colour: CRAYONS.water, cover: 0.6, passes: 1 },
};
