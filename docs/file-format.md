# Parabox level `.txt` format

## Overview

- Plain text, one object per line.
- Header lines come first; a single line containing `#` ends the header.
- After `#`, the file is a tree: tab indentation (`\t`) means “child of the previous Block at that depth”.
- Booleans are written as `0` / `1`.

Example:

```
version 4
#
Block -1 -1 0 9 9 0.6 0.8 1 1 0 0 0 0 0 0 0
	Ref 3 3 0 1 0 0 0 0 -1 0 0 0 0 0 0
	Ref 3 5 0 0 0 0 0 0 -1 0 0 0 0 0 0
	Wall 3 7 0 0 0
	Wall 4 1 0 0 0
	Wall 4 7 0 0 0
	Wall 5 7 0 0 0
	Block 5 3 1 3 3 0.4 0.8 1 1 0 0 0 0 0 0 0
		Ref 1 1 1 1 0 0 0 0 -1 0 0 0 0 0 0
		Floor 1 0 PlayerButton
		Floor 2 0 Button
	Block 5 5 2 5 5 0.9 1 0.7 1 1 1 1 0 0 0 0
```

![Level Preview](level-preview.png)

## Header (lines before `#`)

The header is all lines before "#". "version" is the only required item. Here are all available items, and comments in parentheses:

- `version 4` (only required item)
- `attempt_order push,enter,eat,possess` (used in Priority area in-game with value "enter,eat,push,possess".)
- `shed` (enables Shed area behavior)
- `inner_push` (enables Inner Push area behavior)
- `draw_style tui` (Text graphics)
- `draw_style grid` (Like tui, but with blocks instead of text)
- `draw_style oldstyle` (Gallery area development graphics)
- `custom_level_music -1` (-1 means no music)
- `custom_level_palette -1` (-1 means no palette is applied)

## Objects

After the # line, objects are listed. Tab indentation indicates block children.

- `Block x y id width height hue sat val zoomfactor fillwithwalls player possessable playerorder fliph floatinspace specialeffect`
A block, which has children objects.
    - `x` x position
    - `y` y position
    - `id` block ID number
    - `hue`, `sat`, `val` color
    - `zoomfactor` camera zoom when in this block, 1 is normal
    - `fillwithwalls` if 1, this block gets turned into a 1x1 with a wall inside it
    - `player` if 1, this block is a player
    - `possessable` if 1, this block is possessable
    - `playerorder` if player is set, this number is the order in which this player moves, if there are multiple players
    - `fliph` if 1, this block is flipped
    - `floatinspace` if 1, this block will not actually be at this x,y position. instead, it will have no parent, and will "float in space". this property exists as a hack so that you can make levels with these kinds of blocks, while keeping the level structure in the editor just 1 tree, instead of 2 or more trees
    - `specialeffect` magic number used to flag blocks in various situations
- `Ref x y id exitblock infexit infexitnum infenter infenternum infenterid player posssessable playerorder fliph floatinspace specialeffect`
A reference to a Block that is defined elsewhere in the file.
    - `id` block this is a reference to
    - `exitblock` if 1, this is the exit block for this level
    - `infexit` if 1, this is an infexit block for this level
    - `infexitnum` degree of infexit, if that is set
    - `infenter` if 1, this is an infenter block for some level
    - `infenternum` degree of infenter, if that is set
    - `infenterid` which level is infenter, if that is set
- `Wall x y player possessable playerorder`
Defines a Wall.
    - `player` if 1, this wall is a player
    - `possessable` if 1, this wall is possessable (can become a player)
    - `playerorder` if player is set, this number is the order in which this player moves, if there are multiple players
- `Floor x y type`
Defines a Floor Tile.
    - `type` the type of the floor. can be:
        - `Button` the target floor for any box
        - `PlayerButton` the target floor for the player
        - `Portal <sceneName>` transports player to another scene
        - `Info <text>` (spaces are saved as `_`), displays text when player enters block
        - `Break` (to be determined)
        - `FastTravel` transports player to another FastTravel floor, used for hub selection
        - `Gallery` (possibly useless in custom levels) show gallery
        - `DemoEnd` (possibly useless in custom levels) show ending animation
