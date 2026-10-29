## New
- The dungeon generator makes forests: clearings in the woods joined by trails, drawn as one mass of treetops along every clearing, with lone trees that give cover, brooks, streams and broad rivers that wander or meander through meadows along their banks, widen where streams join them, part round gravel islands, now and then flow into a lake, and are bridged only where a road crosses them, their water on animated maps flowing round every bend; a cart road or footpath runs through the map's entrances from one edge to another, through the clearings and round the lakes, and now and then a footpath branches off it. Every map style draws its own forest: a dark wood by lantern light, a burnt one in Ember, snowbound firs in Rime, autumn in Ochre, Umber and Oxblood, a bog in Cistern, a misty pine wood in Flint, each with its own trees, ground, roads and water, and caves on the levels below
- Generated dungeons, caves and manors have a new default style, Crayon: pencil lines and hatching on vellum, coloured in with wax crayon like the village map of the Lockwood Manor collection. Its water, lava and acid move as hand-drawn crayon strokes that fade in and out on their own

## Improved
- Graphics settings, a page in the command palette (also behind Graphics settings… in the lighting tool's menu): the three quality presets as tabs, with what each draws on hover, and below them every choice a preset makes, so one thing can be set away from a preset: the lighting picture, its detail, bounced light, flames, shadow softness, how often water and lava move, and the lit map's resolution on a high-resolution screen. The settings page's Lighting row is gone
- Atlas asks the computer for its faster graphics chip where there are two, as Foundry and Owlbear Rodeo do
- Saver lighting quality draws each light from the area it lights instead of tracing it on the graphics card, so a lit map runs smoothly on weak and software graphics; shadows keep a soft edge
- A device without a lighting quality chosen in the settings starts on one picked for its graphics: Balanced on graphics built into the processor, Saver where WebGL draws on the CPU
- On Balanced and Saver lighting quality, a high-resolution screen draws the lit map at standard resolution, which takes the graphics less work; the edges of what players see never reach further

## Fixed
- Online play: players see the resource wheels beside a token that are shown to them, as Atlas's player window shows them; before, the browser drew only the bars
- Several lights together no longer wash the map out to white: the brightest light at a spot shows as it always did, and every further torch adds less and less
- Moving a token that carries a light no longer stutters as badly on large maps with many walls
- Dragging a token that sees no longer builds new graphics objects for its sight every frame, so each step of a drag costs less on large generated dungeons
