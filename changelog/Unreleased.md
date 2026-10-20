## New
- Encounter builder: in the asset manager, + → Create Encounter shows every creature of the collection as its full statblock, side by side, with the Characters tab's search and filters above them. Dice in the statblocks roll as they do on the map. Add creatures and set how many of each, and the bar below shows how many there are, the span of their ratings and their hit points together. Save keeps it as an encounter of the collection.
- Statblock templates: a Value, Metric, Table or Labels and values tile can roll its numbers. Switch on Roll as a bonus in its Options, and a click on a number, such as a trait's 2, rolls +2 with the game's own dice.
- Statblocks: a number value can add to the next roll. Switch on Add to next roll in a value's Options, and the card shows a small switch after the number. Turn it on, and the next roll from that statblock adds the value under its own name, such as "d20 + 3 + 2 Proficiency", then the switch turns off. This works for a list of labels and values, so each Daggerheart Experience can have its own switch.
- Statblock templates: a Counters tile tracks anything with limited uses, such as spell slots per level, ki or a feature's uses per day. Each row shows its uses as pips.
- Recovery buttons: give a statblock template buttons such as Short rest and Long rest in the collection settings' Resources tab. Pick a value on the card and choose what each button does to it: back to full, back by a roll, half back, set to a number, or spent from something else, such as Hit Dice. The buttons sit on player characters' statblocks beside their notes and on their players' online sheets, and the GM approves a player's rest.
- Statblock templates: a number can be tracked, such as Luck, Ki, Hit Dice or Inspiration. Choose Tracked in its Options: the note holds its maximum, or another number does (Hit Dice up to Level), and the card shows what is left, such as 2 / 3. Recovery buttons can give it back, the DM screen steps it, and players step it on their online sheet.
- Online play: hand any item to your players, not only rolled ones. In a loot base, each item's name has a gift button. Its menu gives the item to one player or to all players at once, and sets how many copies, with − and + or by typing the number.

## Improved
- Deleted tokens no longer blink out. They shrink a little and fade, and tokens deleted together leave in a quick ripple from the middle outward.
- Atlas tells you when a new version is out, once per version, with Update and What's new. Update opens the plugin page, where Obsidian installs it. Settings → Updates shows whether you are up to date and has a switch to stop the check.
- Atlas' messages slide in at the top right with a light spring and lift away when they close, and the messages below them move up smoothly. They sit as far from the top as from the right edge, like the dice rolls.
- Online play: busy tables send far fewer messages. Cursors, lasers and measurements go out ten times a second and still move smoothly, and a changed quest or world map reaches players without their whole book being sent again.
- Random tables: rename a table or remove it from the list from its menu (⋯ or right-click) in the Random tables window, and undo a removal from the message that follows. A new name shows only in Atlas and leaves the note as it is; you can also set it in the collection settings. A table whose note was deleted can now be removed too.

## Fixed

- The line that measures a dragged token's path is no longer darkened by dynamic lighting, and it now stops at the token's edge.
- A player character dragged through the dark is shown exactly where it is drawn. Before, the lit circle around it trailed behind the token.
- Dynamic lighting only gives the graphics card as much work as it keeps up with. On laptops with integrated graphics, placing or carrying a light or opening a scene with many lights could make the graphics driver reset, turning the map white until Obsidian was restarted. There, a scene's lights now appear over a few frames. The Balanced and Saver lighting qualities also make each light cheaper, with rougher soft shadow edges.
- Explicit rolls can keep a matching dice set’s names and colours while preserving their dice and bonuses.
- Dice rolls use the character sheet’s default dice before the map’s defaults and keep custom die names and colours. Explicit dice keep their written formula.
- Online play: players keep control of their characters when you change scenes. Giving a token to a player gives them the character it was placed from, so every token of that character is theirs on every scene.
- Online play: a player with several tokens now sees the inventory and sheet of the token picked in the token menu, and switching back works.
- Online play: a player's menu in the online panel can release the token they are shown by on its own, so their other tokens stay theirs.
- Online play: player tokens, and tokens given to players that were not placed from the library, are now kept in the campaign's folder. They sync with the vault, so they are the same on every device you host from.
- Online play: the movement line of a dragged token shows for everyone at the table who sees the token, when the GM drags it and when a player does.
- Statblocks from TTRPG Convert CLI import as tokens with their image. Atlas now reads image paths with encoded spaces, such as `/2.%20Mechanics/token.png`.
- The grid settings set the unit of measurement where it applies, in the played campaign's game system too, and a collection's settings say when a played campaign's rules replace them.
