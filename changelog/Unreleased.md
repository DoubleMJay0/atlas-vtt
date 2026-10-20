## New
- Search statblock text: type `text:` in the asset manager's search or the encounter builder's, such as `text:fire` or `text:pack tactics`, to find creatures whose statblock says it anywhere. Everything after `text:` up to the next filter counts as one phrase, so no quotes are needed. `-text:` leaves them out.
- Encounter builder: in the asset manager, + → Create Encounter shows every creature of the collection as its full statblock, side by side, with the Characters tab's search and filters above them. Dice in the statblocks roll as they do on the map. Add creatures and set how many of each, and the bar below shows how many there are, the span of their ratings and their hit points together. Save keeps it as an encounter of the collection.
- Statblock templates: a Value, Metric, Table or Labels and values tile can roll its numbers. Switch on Roll as a bonus in its Options, and a click on a number, such as a trait's 2, rolls +2 with the game's own dice.
- Statblocks: a number value can add to the next roll. Switch on Add to next roll in a value's Options, and the card shows a small switch after the number. Turn it on, and the next roll from that statblock adds the value under its own name, such as "d20 + 3 + 2 Proficiency", then the switch turns off. This works for a list of labels and values, so each Daggerheart Experience can have its own switch.
- Statblock templates: a Counters tile tracks anything with limited uses, such as spell slots per level, ki or a feature's uses per day. Each row shows its uses as pips.
- Recovery buttons: give a statblock template buttons such as Short rest and Long rest in the collection settings' Resources tab. Pick a value on the card and choose what each button does to it: back to full, back by a roll, half back, set to a number, or spent from something else, such as Hit Dice. The buttons sit on player characters' statblocks beside their notes and on their players' online sheets, and the GM approves a player's rest.
- Statblock templates: a number can be tracked, such as Luck, Ki, Hit Dice or Inspiration. Choose Tracked in its Options: the note holds its maximum, or another number does (Hit Dice up to Level), and the card shows what is left, such as 2 / 3. Recovery buttons can give it back, the DM screen steps it, and players step it on their online sheet.
- Online play: hand any item to your players, not only rolled ones. In a loot base, each item's name has a gift button. Its menu gives the item to one player or to all players at once, and sets how many copies, with − and + or by typing the number.
- Damage or heal several tokens at once: with tokens selected, right-click one and choose Change HP of N tokens…, then type the change, such as -8 or +5. It applies to every selected token that has HP, and one undo takes it back.
- Initiative: a combatant can delay its turn. It waits below the order until Act Now puts it right before the combatant whose turn it is.
- Initiative: Sit Out This Round now works in turn order too.
- Initiative: the tracker's ⋯ menu has an Auto sort switch.

## Improved
- Initiative: next and previous turn skip defeated combatants, and the players' list marks them with a skull.
- Initiative: combatants with the same number are ordered by their initiative modifier.
- Initiative: Clear initiative asks before it removes every combatant. It is in the tracker's ⋯ menu.
- Initiative tracker: click a combatant's number to type it on the card. Tab goes on to the next card and Shift+Tab back, so you can type a whole table's initiative in a row. A combatant with no number yet shows an empty slot.
- Initiative tracker: Show names in the tracker's ⋯ menu puts each combatant's name under its portrait, so two monsters of one kind can be told apart.
- Initiative tracker: click a card's hit point bar to type a new value, as on the map's bar.
- Deleted tokens no longer blink out. They shrink a little and fade, and tokens deleted together leave in a quick ripple from the middle outward.
- Atlas tells you when a new version is out, once per version, with Update and What's new. Update opens the plugin page, where Obsidian installs it. Settings → Updates shows whether you are up to date and has a switch to stop the check.
- Atlas' messages slide in at the top right with a light spring and lift away when they close, and the messages below them move up smoothly. They sit as far from the top as from the right edge, like the dice rolls.
- Online play: busy tables send far fewer messages. Cursors, lasers and measurements go out ten times a second and still move smoothly, and a changed quest or world map reaches players without their whole book being sent again.
- Random tables: rename a table or remove it from the list from its menu (⋯ or right-click) in the Random tables window, and undo a removal from the message that follows. A new name shows only in Atlas and leaves the note as it is; you can also set it in the collection settings. A table whose note was deleted can now be removed too.
- Type sums into a token's HP: -10-5 takes 15, -9/2 takes half of 9 rounded down, and -9*2 takes 18 (#495, #396).
- Initiative modifiers are found more easily. The modifier field matches statblock fields in any capitalisation and by their name in the template, reads numbers written as +3, +3 (13), 16 (+3) or Perception +12, and reads statblocks from Fantasy Statblocks too: its own initiative modifier, a Pathfinder import's Perception and the six 5e scores (type dex). The field's suggestions show what a statblock holds, and the settings say how many statblocks the field reads a modifier from.
- When a roll finds no modifier for some combatants, a notice says how many, which field was looked for and where to choose it.
- The initiative tracker's buttons, card menu and sides, and the collection's initiative settings are now available in Russian.
- The collection settings' Resources tab is now available in Russian.
- Senses are now available in Russian: the sense editors in Edit Token and the collection settings' Vision tab, and the conditions' effect on sight.
- The dice settings, the dice tray, the roll panel and part of the dice lab are now available in Russian.
- The toolbar editor and links to scenes and encounters in notes are now available in Russian.

## Fixed

- Initiative tracker: clicking a card selects its token, so its bars and their controls show, and brings it into view without zooming in further than needed.
- The players' initiative list shows the number that tells look-alike monsters apart, as their badges on the map do.
- With a pinned note open, an initiative card no longer shows its statblock without Ctrl (Cmd on macOS), and the statblock closes when the key is released or the pointer leaves the card.
- Right-click menus on the map stay inside the map's pane and scroll when they are long, instead of running past its edge or moving while you point at their options. Submenus of a map in its own window open in that window. A menu closes when the window or pane is resized. Contributed by aecorn.
- The token art panel no longer flickers in a short window or while the window is resized. Contributed by aecorn.
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
- A statblock in a note's statblock block now wins over the note's own properties of the same name when its values are read.
- Initiative: rolling one combatant sorts the order again while Auto sort is on. Contributed by young-george.
- Initiative: stepping back to an earlier round brings back who sat that round out.
