/**
 * The locked gate, its keys, the back way in and the stairs down. Directions come from pushed
 * symbols: `side` ("north"), `sideAdj` ("northern") and `room` (the room word); `keyCount` is the
 * gate's number of keyholes in words, and the flags K0 and K1 pick the phrasing for none and one.
 */

import { marked, type GrammarRules } from '../grammar';

export const PASSAGE_RULES: GrammarRules = {
  gate: [
    '#gateDoor.a.capitalize# #gateWhere#, #holes#.',
    '#gateDoor.a.capitalize# #gateWhere#, #holes#.',
    '#gateWhere.capitalize# stands #gateDoor.a#, #holes#.',
  ],
  gateDoor: [
    'heavy iron door',
    'round stone door',
    'bronze double door',
    'door of black oak bound in iron',
    'great stone slab carved with #symbol.s#',
    'pair of tall doors sheathed in copper',
    'iron gate wrought in the shape of a snarling face',
    'door of dark wood studded with nails',
    'massive lead-sealed door',
    'TREASURE?-lavishly gilded door',
    'TOMB?-door of carved bone',
    'TEMPLE?-bronze door embossed with #symbol.a#',
    'WET|FLOODED?-door rusted orange by the damp',
    'CRUMBLING?-cracked stone door that still holds fast',
  ],
  'K0?-holes': [
    'with no keyhole or handle, its face worn smooth by many hands',
    'without keyhole or latch, as if it opens only from the other side',
    'with no lock at all, yet it will not move',
  ],
  'K1?-holes': ['with a single keyhole', 'with one keyhole', 'with one keyhole shaped like #symbol.a#'],
  holes: ['with #keyCount# keyholes', 'with #keyCount# keyholes in a row', 'with #keyCount# keyholes set around #symbol.a#'],
  gateWhere: [
    'to the #side#',
    'in the #side# wall',
    'on the #sideAdj# wall of the #room#',
    'at the #side# end of the #room#',
  ],

  key: ['#keyFind#', '#keyFind#', '#keyHide#'],
  keyFind: [
    '#keyLook.a.capitalize# key hangs from a nail by the door.',
    '#keyLook.a.capitalize# key lies forgotten in a corner, under dust.',
    '#keyLook.a.capitalize# key is tied to a ribbon around the neck of a dead dog.',
    '#keyLook.a.capitalize# key is wedged between two stones of the wall.',
    '#keyLook.a.capitalize# key dangles from the belt of a skeleton slumped against the wall.',
    marked('#keyLook.a.capitalize# key sits on the lid of a locked chest; the chest is empty.', 'chest'),
    marked('#keyLook.a.capitalize# key rests in the cupped hands of a statue.', 'statue'),
    marked('WET|FLOODED?-#keyLook.a.capitalize# key glints at the bottom of a pool.', 'water'),
    marked('CRUMBLING?-#keyLook.a.capitalize# key glints among the rubble.', 'rubble'),
    marked('TEMPLE?-#keyLook.a.capitalize# key lies on an altar as an offering.', 'altar'),
    'DANGEROUS?-#keyLook.a.capitalize# key is clutched in the hand of a dead #raider#.',
    'RAIDERS?-#keyLook.a.capitalize# key hangs on a thong around the neck of the #raider# leader.',
  ],
  keyHide: [
    marked('In #keyBox#: #keyLook.a# key{ and #coins#}.', 'chest'),
    marked('In a barrel of {nails|rotten apples|tar}: #keyLook.a# key.', 'barrel'),
    'Under a loose flagstone: #keyLook.a# key wrapped in a rag.',
    marked('TOMB?-In a coffin, on the chest of the dead: #keyLook.a# key.', 'sarcophagus'),
    'DWELLING?-In a jewellery box on a dressing table: #keyLook.a# key.',
  ],
  keyBox: ['a small iron chest', 'a lacquered box', 'a chest {with a rusted lock|full of mouldy linen}', 'a strongbox bolted to the floor'],

  backdoor: [
    'A narrow crack in the #side# wall opens to the outside: a back way into the #place#.',
    'A hidden door in the #side# wall leads out under the open sky, a way in that few know.',
    'Rough steps cut into the #side# wall climb to daylight: another way into the #place#.',
    'Part of the #side# wall has fallen, letting in grey daylight and the smell of wet earth: a rear entrance to the #place#.',
    'A tunnel to the #side# winds up to a thicket outside, an old escape route from the #place#.',
    'A low passage to the #side# ends in a door of rotten planks and, beyond it, the open air.',
    'P_FORT?-A sally port in the #side# wall, barred from within, opens onto the slope outside.',
    'P_WATER|WET|FLOODED?-A drainage culvert to the #side# leads out of the #place#, wide enough to crawl through.',
    'P_MINE|P_CAVE?-A rough shaft to the #side# climbs to the surface, a second way into the #place#.',
  ],

  stairsDown: [
    'Stairs in the far wall lead down into darkness, to a level below.',
    'A spiral stair winds down to the deeper levels of the #place#.',
    'Worn steps descend to a lower level; warm air rises from below.',
    'A shaft with iron rungs drops to the floor beneath.',
    'A broad stair, its treads cracked, goes down to where the #place# continues.',
    'Steps carved with #symbol.s# lead down to a level nobody has mapped.',
    marked('WET|FLOODED?-Steps lead down into black water; the level below is half flooded.', 'water'),
  ],
};
