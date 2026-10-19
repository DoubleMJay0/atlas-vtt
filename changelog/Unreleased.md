## New
- Statblock templates: a Value, Metric, Table or Labels and values tile can roll its numbers. Switch on Roll as a bonus in its Options, and a click on a number, such as a trait's 2, rolls +2 with the game's own dice.
- Statblocks: a number value can add to the next roll. Switch on Add to next roll in a value's Options, and the card shows a small switch after the number. Turn it on, and the next roll from that statblock adds the value under its own name, such as "d20 + 3 + 2 Proficiency", then the switch turns off. This works for a list of labels and values, so each Daggerheart Experience can have its own switch.
- Statblock templates: a Counters tile tracks anything with limited uses, such as spell slots per level, ki or a feature's uses per day. Each row shows its uses as pips. The template names its own refills, such as a rest, dawn or a new session, and a row can get back all of its uses or a rolled number, such as 1d6+1. Beside the note, one button for each refill gives the uses back across the whole sheet.

## Improved
- Deleted tokens no longer blink out. They shrink a little and fade, and tokens deleted together leave in a quick ripple from the middle outward.
- Atlas tells you when a new version is out, once per version, with Update and What's new. Update opens the plugin page, where Obsidian installs it. Settings → Updates shows whether you are up to date and has a switch to stop the check.
- Online play: busy tables send far fewer messages. Cursors, lasers and measurements go out ten times a second and still move smoothly, and a changed quest or world map reaches players without their whole book being sent again.
- Random tables: rename a table or remove it from the list from its menu (⋯ or right-click) in the Random tables window, and undo a removal from the message that follows. A new name shows only in Atlas and leaves the note as it is; you can also set it in the collection settings. A table whose note was deleted can now be removed too.

## Fixed

- Dynamic lighting only gives the graphics card as much work as it keeps up with. On laptops with integrated graphics, placing or carrying a light or opening a scene with many lights could make the graphics driver reset, turning the map white until Obsidian was restarted. There, a scene's lights now appear over a few frames. The Balanced and Saver lighting qualities also make each light cheaper, with rougher soft shadow edges.
- Explicit rolls can keep a matching dice set’s names and colours while preserving their dice and bonuses.
- Dice rolls use the character sheet’s default dice before the map’s defaults and keep custom die names and colours. Explicit dice keep their written formula.
- Online play: players keep control of their characters when you change scenes. Giving a token to a player gives them the character it was placed from, so every token of that character is theirs on every scene.
- Online play: a player with several tokens now sees the inventory and sheet of the token picked in the token menu, and switching back works.
- Online play: a player's menu in the online panel can release the token they are shown by on its own, so their other tokens stay theirs.
- Online play: the movement line of a dragged token shows for everyone at the table who sees the token, when the GM drags it and when a player does.
- Statblocks from TTRPG Convert CLI import as tokens with their image. Atlas now reads image paths with encoded spaces, such as `/2.%20Mechanics/token.png`.
- The grid settings set the unit of measurement where it applies, in the played campaign's game system too, and a collection's settings say when a played campaign's rules replace them.
