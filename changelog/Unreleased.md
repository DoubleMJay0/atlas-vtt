## New
- The dungeon generator makes forests: clearings in the woods joined by narrow glades, drawn as one mass of treetops along every clearing, with lone trees that give cover, brooks, streams and broad rivers that wander or meander through meadows along their banks, widen where streams join them, part round gravel islands, now and then flow into a lake, and are bridged only where a road crosses them, their water on animated maps flowing round every bend; a cart road or footpath runs through the map's entrances from one edge to another, through the clearings and round the lakes, and now and then a footpath branches off it, joining it as a fork in a track does; every road and footpath runs off the map or into another road, never stopping in a clearing or at a river's bank. Every map style draws its own forest: a dark wood by lantern light, a burnt one in Ember, snowbound firs in Rime, autumn in Ochre, Umber and Oxblood, a bog in Cistern, a misty pine wood in Flint, each with its own trees, ground, roads and water, and caves on the levels below
- Generated dungeons, caves and manors have a new default style, Crayon: pencil lines and hatching on vellum, coloured in with wax crayon like the village map of the Lockwood Manor collection. Its water, lava and acid move as hand-drawn crayon strokes that fade in and out on their own
- Fog: Cloud reveal in the fog tool's menu shows players the fog as clouds in a colour you pick, which part over what you reveal and drift in over what you cover. While you paint or erase fog, players keep seeing the fog from before, and your changes reach them at once when you switch to another tool, at an online table too. Contributed by ISorokaI

## Improved
- Russian translation of the GM's side of online play: the online panel on the map, the online account, the table's commands and notices. Contributed by ISorokaI
- Russian translation of native statblocks: the statblock beside a note, creating statblocks, the template gallery, Fantasy Statblocks imports and the collection's Statblocks tab. Contributed by ISorokaI
- Russian translation of the statblock template editor. Contributed by ISorokaI
- Russian translation of random tables, campaigns, quests, recovery actions, initiative rules and dynamic lighting. Contributed by ISorokaI
- Russian translation of the dungeon generator, scene levels, stairs and openings, animated maps and multi-floor Universal VTT imports. Contributed by ISorokaI
- Russian translation of the dice lab, the initiative tracker's new options, the encounter builder, statblock counters and other newer texts. Contributed by ISorokaI
- Graphics settings, a page in the command palette (also behind Graphics settings… in the lighting tool's menu): the three quality presets as tabs, with what each draws on hover, and below them every choice a preset makes, so one thing can be set away from a preset: the lighting picture, its detail, bounced light, flames, shadow softness, how often water and lava move, and the lit map's resolution on a high-resolution screen. The settings page's Lighting row is gone
- Atlas asks the computer for its faster graphics chip where there are two, as Foundry and Owlbear Rodeo do
- Saver lighting quality draws each light from the area it lights instead of tracing it on the graphics card, so a lit map runs smoothly on weak and software graphics; shadows keep a soft edge
- A device without a lighting quality chosen in the settings starts on one picked for its graphics: Balanced on graphics built into the processor, Saver where WebGL draws on the CPU
- On Balanced and Saver lighting quality, a high-resolution screen draws the lit map at standard resolution, which takes the graphics less work; the edges of what players see never reach further
- Dice volume: set how loud dice are in Atlas' settings (Dice) or the command palette's dice settings, or slide it all the way down to turn their sounds off. It applies to thrown dice and to result cards. Contributed by ISorokaI

## Fixed
- Online play: room pins of a generated dungeon that you make readable by players now show on the players' page, so they can open the room's notes
- Create scenes from several selected maps at once: each map gets a scene of its own, named like the map. A deleted scene no longer comes back in the asset manager
- Online play: in a browser that cannot use WebGL, lit scenes stay hidden and players are told why, instead of showing and then vanishing once a magical darkness is placed
- Online play: what a player types into a table on their character sheet stays, also in a table they fill in for the first time; before, the cell went empty again once they confirmed it
- Generated caves and forests: every way up or down can be walked onto from its front, also when players move their own tokens online; before, its front could lie in a pocket reached only past the way's sides, or behind a lone tree
- Online play: players see the resource wheels beside a token that are shown to them, as Atlas's player window shows them; before, the browser drew only the bars
- Several lights together no longer wash the map out to white: the brightest light at a spot shows as it always did, and every further torch adds less and less
- Moving a token that carries a light no longer stutters as badly on large maps with many walls
- Dragging a token that sees no longer builds new graphics objects for its sight every frame, so each step of a drag costs less on large generated dungeons
- A pinned statblock scrolled down can be moved up again: it no longer stops at an invisible edge where its scrolled-away name would be. Contributed by ISorokaI
- Menus in Edit Token, such as Add sense, open at their button instead of at the top left of the window. Contributed by ISorokaI
- Online play: areas players have explored no longer black out now and then while they move on; what they have seen stays remembered until the GM forgets or erases it
