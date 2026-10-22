/**
 * The italic paragraph under the title: how the place came to be empty, who lives there now, and
 * sometimes what is said to be waiting inside.
 */

import type { GrammarRules } from '../grammar';

export const STORY_RULES: GrammarRules = {
  story: ['#intro# #inhabitants#', '#intro# #inhabitants# #reward#', '#intro# #inhabitants# #reward#'],

  /** With a boss, a story that opens without one names the boss before it ends. */
  'BOSS?-story': [
    '#bossPast# #inhabitants#',
    '#bossPast# #inhabitants# #reward#',
    '#abandonment# #inhabitants# #bossNow#',
    '#abandonment# #bossNow# #reward#',
    '#location# #inhabitants# #bossNow#',
    '#location# #bossNow# #reward#',
  ],

  intro: ['#abandonment#', '#location#'],

  bossPast: [
    '#boss# built the #place# as a refuge from the world, and was never seen outside #it# again.',
    '#boss# held court in the #place# until the night #its# doors were barred from outside.',
    'When #boss# died, the servants left the body where it fell and fled the #place# before dawn.',
    '#boss# came to the #place# a century ago to dig for something buried beneath #it#, and found it.',
    'Every generation or so #boss# stirs, and the villages near the #place# lose a child or two.',
    'The #place.was# walled up with #boss# still inside, and the masons were paid to forget it.',
    'No one remembers what #boss# did to earn a grave so deep, only that the #place# was dug to hold it.',
    'Long after #boss# was thought dead, lights still burned in the #place# on moonless nights.',
    'P_TEMPLE?-Pilgrims once brought gifts to #boss# here; the last of them came a generation ago, and did not leave.',
    'P_TOMB?-#boss# was laid to rest in the #place# with a fortune in grave goods, and rested badly.',
    'P_FORT?-#boss# held the #place# through a siege of seven winters, and the siege was never lifted from inside.',
    'P_HOUSE?-#boss# threw the last feast in the #place# forty years ago; the guests are said to be there still.',
    'P_LORE?-#boss# gathered forbidden books in the #place# until the books began to answer back.',
    'P_PRISON?-#boss# was the last prisoner of the #place#, and outlived every one of #its# gaolers.',
  ],

  abandonment: [
    'For three generations nobody has gone into the #place# and come back out.',
    'The #place.was# emptied in a single night; the tables were still laid when the first looters arrived.',
    'Plague closed the #place# a century ago, and no one has opened #it# since.',
    'The #place.was# sealed after the {great flood|earthquake|fire of the long summer} and left off every map.',
    'A curse is laid on anyone who takes so much as a stone from the #place#, or so the old folk say.',
    '#its.capitalize# builders are forgotten, and the #place# has outlasted three kingdoms that claimed #it#.',
    'P_TEMPLE?-The order that kept the #place# dwindled to a single old warden, and then to none.',
    'P_TOMB?-The last burial in the #place# was so long ago that nobody remembers the family who paid for it.',
    'P_FORT?-The garrison of the #place# marched out to a war it never came back from.',
    'P_HOUSE?-The family that lived in the #place# died out, and the heirs never came to claim it.',
    'P_LAIR?-Whatever dug the #place# has not been seen in living memory.',
    'P_MINE?-The miners dug too deep, and one morning none of them came up.',
    'P_WATER?-The #place# once fed a city that is now only grass and foundations; #its# channels still fill when it rains.',
    'P_LORE?-#its.capitalize# scholars burned their own books before they left, all but a few.',
    'P_PRISON?-When the guards left the #place#, nobody thought to unlock the cells.',
    'P_CAVE?-Shepherds keep their flocks well away from the #place#; their grandfathers told them why, but they have forgotten.',
    'P_WORKS?-The fires of the #place# went out when the last master smith died, and nobody could light them again.',
  ],

  location: [
    'The #place.lies# beneath #landmark#, a day\'s walk from the nearest village.',
    'The way into the #place# is hidden in #wild#, far from any road.',
    'The #place.was# cut into the flank of #landmark#, where the old road ends.',
    'Only a doorway of weathered stone in #wild# marks the entrance to the #place#.',
    'Hunters who cross #wild# give the mouth of the #place# a wide berth.',
    'The #place.lies# under #landmark#; #its# entrance shows only when the bracken dies back in autumn.',
    'WET|FLOODED?-The entrance to the #place# lies in #wild#, half under black water.',
    'DRY?-#its.capitalize# entrance is a crack in the sun-baked rock of #wild#.',
  ],

  bossNow: [
    'Deep inside, #boss# waits for whoever comes looking.',
    'The few who came back speak of #boss#, waiting in the innermost hall.',
    'Whatever else lives there answers to #boss#, who keeps the deepest room.',
    'Those who still tell the old tales say #boss# has never left.',
    'Something there has a name, and the name is #boss#.',
    'At the far end of #it#, #boss# keeps watch over what is left.',
  ],

  inhabitants: ['RAIDERS?-#raiders#', 'VERMIN?-#vermins#', 'BEAST?-#beastNow#'],

  raiders: [
    'A band of #raider.s# found #it# {last spring|a few years ago|this winter} and have made #it# their {camp|hideout|stronghold}.',
    'Lately #raider.s# have moved in, and they do not mean to share it.',
    'Now #raider.s# store what they steal from the roads in #its# halls.',
    'A war band of #raider.s# camps inside now, and their fires can be seen at night.',
    '#raider.s.capitalize# have claimed #it#, and they pay a toll to something that lives deeper down.',
    'Now #itIs# the den of #raider.s#, who drag their captives inside and bring nothing out.',
  ],

  vermins: [
    'Now #vermin.s# swarm through #its# halls, and the walls hum with them.',
    '#vermin.s.capitalize# have bred in the dark for years and grown large and bold.',
    'Nothing lives there now but #vermin.s#, more of them every year.',
    '#its.capitalize# rooms seethe with #vermin.s#; the floors move when a torch comes near.',
    'A plague of #vermin.s# has hollowed out what the years left of #it#.',
  ],

  beastNow: [
    '#beast.a.capitalize# has made the #place# its den.',
    'Travellers say #beast.a# hunts #its# halls and drags back whatever it catches.',
    'Now #beast.a# sleeps in #its# deepest room, and nothing else dares to stay.',
    'Something has made its lair inside: #beast.a#, by the tracks.',
    'Sheep have been going missing for a year, and the trail of bones leads to #beast.a# in the #place#.',
  ],

  reward: [
    'Rumour has it that #artefact# lies somewhere in #its# depths.',
    'They say #artefact# was hidden there and never found.',
    'Treasure hunters still speak of #artefact#, last seen in the #place#.',
    'A scholar in the city will pay well for #artefact#, which the old records place inside.',
    'An old song claims #artefact# is buried with the #place#\'s dead.',
    'TREASURE?-Tales of #its# hoard bring a fool or two every year: coin, silverware and #artefact#.',
    'BOSS?-#boss# is said to keep #artefact# close, and to wake when anyone touches it.',
    'A {pale|blue|night-black} orchid grows in #its# deepest room; an apothecary would pay a fortune for a single bloom.',
    'WET|FLOODED?-Pearls the size of thumbnails grow in #its# flooded halls, if anyone dares to dive for them.',
  ],
};
