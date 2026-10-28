## New
- Generated dungeons, caves and manors have a new default style, Crayon: pencil lines and hatching on vellum, coloured in with wax crayon like the village map of the Lockwood Manor collection. Its water, lava and acid move as hand-drawn crayon strokes that fade in and out on their own

## Improved
- Atlas asks the computer for its faster graphics chip where there are two, as Foundry and Owlbear Rodeo do
- Saver lighting quality draws each light from the area it lights instead of tracing it on the graphics card, so a lit map runs smoothly on weak and software graphics; shadows keep a soft edge
- A device without a lighting quality chosen in the settings starts on one picked for its graphics: Balanced on graphics built into the processor, Saver where WebGL draws on the CPU
- On Balanced and Saver lighting quality, a high-resolution screen draws the lit map at standard resolution, which takes the graphics less work; the edges of what players see never reach further

## Fixed
- Several lights together no longer wash the map out to white: the brightest light at a spot shows as it always did, and every further torch adds less and less
- Moving a token that carries a light no longer stutters as badly on large maps with many walls
- Dragging a token that sees no longer builds new graphics objects for its sight every frame, so each step of a drag costs less on large generated dungeons
