/**
 * Where loot lies. Every spot that names a prop, a pool or rubble marks it, so the room gets the
 * chest, the altar or the water the note talks about. Tags add their own spots: water pools,
 * coffins, altars, furniture, rubble, corpses and display cases.
 */

import { marked, type GrammarRules } from '../grammar';

export const LOOT_RULES: GrammarRules = {
  loot: [
    '#plainHaul.capitalize# #spot#.',
    '#plainHaul.capitalize# #spot#.',
    '#spot.capitalize#: #haul#.',
    '#spot.capitalize#: #haul#.',
    '#spot.capitalize#: #haul#.',
    'Someone has hidden #plainHaul# #spot#.',
    '#spot.capitalize#, someone has stashed #haul#.',
    'A pile of bones and rags; picked through, it yields #haul#.',
    marked('0.4?-A statue of a kneeling knight stands here, #item# in its stone hands.', 'statue'),
    marked('0.4?-A headless statue stands here, #item# at its feet.', 'statue'),
    marked('0.4?-A stuffed bear rears in the corner, #item# hung around its neck.', 'statue'),
    'DANGEROUS?-#corpse.capitalize#, #haul# still #corpseHold#.',
    'DANGEROUS?-#corpse.capitalize#, #haul# still #corpseHold#.',
    'TREASURE?-#showcase#',
    'TREASURE?-#showcase#',
  ],

  spot: [
    marked('in a rotting chest', 'chest'),
    marked('in an iron-banded chest', 'chest'),
    marked('in a chest {with a broken lock|under a mouldy blanket|carved with #symbol.s#}', 'chest'),
    marked('in a barrel of {sour wine|salted fish|rainwater}', 'barrel'),
    marked('behind a stack of empty barrels', 'barrel'),
    marked('in a crate {marked with #symbol.a#|nailed shut|half eaten by worms}', 'crate'),
    marked('under a heap of broken crates', 'crate'),
    'in a sack under a pile of rags',
    'on a shelf behind a loose stone',
    'under a loose flagstone',
    'in a niche in the wall',
    'wrapped in oilcloth inside a hollow beam',
    'at the bottom of a dry well shaft, reached by a rotten ladder',
    'in a bird\'s nest high on a ledge',
    marked('WET|FLOODED?-at the bottom of a shallow pool', 'water'),
    marked('WET|FLOODED?-at the bottom of a shallow pool', 'water'),
    marked('WET|FLOODED?-in the silt of a flooded alcove', 'water'),
    marked('WET|FLOODED?-glinting under a skin of stagnant water', 'water'),
    marked('TOMB?-in a sarcophagus {with its lid pushed aside|carved with #symbol.s#}', 'sarcophagus'),
    marked('TOMB?-in a stone coffin, among the bones', 'sarcophagus'),
    'TOMB?-in the wrappings of a mummified corpse',
    'TOMB?-in a funeral urn',
    marked('TEMPLE?-on an altar {stained with old wax|draped in rotten cloth|split down the middle}', 'altar'),
    marked('TEMPLE?-in an offering bowl at the foot of an altar', 'altar'),
    'TEMPLE?-inside a hollow idol',
    'DWELLING?-in a wardrobe with its doors torn off',
    'DWELLING?-under a broken bed',
    'DWELLING?-in the drawer of a smashed desk',
    'DWELLING?-on a table laid for a meal nobody ate',
    marked('CRUMBLING?-among the rubble on the floor', 'rubble'),
    marked('CRUMBLING?-half buried under fallen stones', 'rubble'),
    marked('CRUMBLING?-in a cavity the collapse broke open', 'rubble'),
    'TREASURE?-in a coffer lined with velvet',
    'TREASURE?-on a cushion on a marble pedestal',
  ],

  corpse: [
    'a dead #raider#',
    'a dead adventurer',
    'the skeleton of a knight pinned to the wall by a spear',
    'a body hanging from a hook',
    'a half-eaten corpse',
    'a dead treasure hunter, face down',
    'the mummified body of a thief caught in a trap',
    'a corpse in priest\'s robes',
  ],
  corpseHold: ['clutched in one hand', 'in a pouch at the belt', 'tucked under the body', 'in the pack beside it', 'sewn into the lining of the coat'],

  showcase: [
    '#haul# under a cracked glass display case.',
    'A row of display cases, all smashed but one; it holds #haul#.',
    'A glass cabinet with a silver lock holds #haul#.',
    'Velvet-lined display cases, mostly empty; one still holds #haul#.',
  ],
};
