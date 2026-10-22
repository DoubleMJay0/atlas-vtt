/**
 * Who waits in a room: the boss in the last room, else the master of whoever lives here, and
 * guards on the way there.
 */

import { marked, type GrammarRules } from '../grammar';

export const ENEMY_RULES: GrammarRules = {
  'BOSS&ENDING?-enemy': ['#bossScene#'],
  'ENDING?-enemy': ['#lairScene#'],
  enemy: ['#guards#'],

  bossScene: [
    marked('#boss# sits on a throne of #throneStuff#, waiting.', 'throne'),
    marked('#boss# lounges on a high-backed throne, idly turning #artefact# in one hand.', 'throne'),
    marked('#boss# stands on a dais at the far end, surrounded by #raider# bodyguards.', 'dais'),
    marked('#boss# kneels before an altar, murmuring to something that answers.', 'altar'),
    '#boss# paces among heaps of bones, talking to them by name.',
    '#boss# sits at a long table set for guests who will never arrive.',
    '#boss# hangs in a cage from the ceiling, and offers a bargain to anyone who will open it.',
    '#boss# sleeps upright against the far wall, eyes open.',
    marked('TOMB?-#boss# lies in an open sarcophagus, not quite asleep.', 'sarcophagus'),
    marked('TEMPLE?-#boss# presides from a dais over a congregation of the dead.', 'dais'),
    marked('WET|FLOODED?-#boss# waits waist-deep in a black pool, humming to the water.', 'water'),
    marked('DWELLING?-#boss# holds court from a gilded throne amid the wreck of a banquet.', 'throne'),
    'DANGEROUS?-#boss# is busy at a butcher\'s table, and does not like to be interrupted.',
  ],
  throneStuff: ['bones', 'rusted swords', 'black oak', 'cold iron', 'carved basalt', 'antlers and skulls', 'TREASURE?-gold and teeth'],

  lairScene: [
    'RAIDERS?-The #raider# chieftain holds court here among #raider# warriors and stolen goods.',
    marked('RAIDERS?-The #raider# chief sprawls on a heap of furs on a crude dais, a greataxe within reach.', 'dais'),
    'RAIDERS?-#raider.s.capitalize# crowd around a bonfire, where their shaman reads the bones.',
    'VERMIN?-The #vermin# queen, bloated to the size of a cart, pulses in a nest of filth.',
    'VERMIN?-A writhing mass of #vermin.s# covers the floor here, thickest around a heap of bones.',
    'BEAST?-#beast.a.capitalize# sleeps on a heap of gnawed bones and rusted armour.',
    'BEAST?-#beast.a.capitalize# guards its young in a nest of rags and branches.',
    'BEAST?-#beast.a.capitalize# crouches in the dark, waiting for whatever comes through the door.',
  ],

  guards: [
    'RAIDERS?-#count# #raider.s# {play dice|sharpen their blades|argue over a stolen ham|sleep off a feast} by a {smoky fire|guttering lantern}.',
    'RAIDERS?-#count# #raider.s# keep watch here, though not very well.',
    'RAIDERS?-#raider.a.capitalize# sentry dozes on a stool, a horn hanging from a belt.',
    'RAIDERS?-#count# #raider.s# are questioning a captive here, none too gently.',
    'RAIDERS&CRUMBLING?-#count# #raider.s# dig through the rubble for anything of value.',
    'RAIDERS&DANGEROUS?-A pit trap lies under a rotten rug, and #raider.s# wait nearby for the screams.',
    'VERMIN?-A swarm of #vermin.s# boils out of a crack in the floor.',
    'VERMIN?-#vermin.s.capitalize# crawl over every surface, thickest around the doors.',
    'VERMIN?-A nest of #vermin.s# fills one corner, and they do not like to be disturbed.',
    'BEAST?-Fresh claw marks score the walls; #beast.a# lurks nearby.',
    'BEAST?-The half-eaten carcass of a deer lies here, and #beast.a# returns for it at dusk.',
    'A pack of feral dogs, lean and silent, has made its den here.',
    'An empty suit of armour stands in an alcove and steps out at the first sound.',
    'A starving {hound|bear|boar|wolf}, chained to the wall, lunges at anyone who comes close.',
    'A giant spider has strung the doorway with webs and waits above it.',
    'A grey ooze clings to the ceiling, waiting to drop.',
    'TOMB?-Skeletal sentries stand in the alcoves and turn their heads as one.',
    'TOMB?-#count# ghouls crouch over an opened coffin, feeding.',
    'TEMPLE?-#count# hooded zealots chant before a defaced idol and fall silent as one.',
    marked('WET|FLOODED?-Something large moves beneath the surface of a dark pool.', 'water'),
    'DWELLING?-Servants long dead still lay the table, and grow angry when it is disturbed.',
  ],
  count: ['Two', 'Three', 'Four', 'Five', 'Six'],
};
