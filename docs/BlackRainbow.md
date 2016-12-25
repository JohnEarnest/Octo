Inside Black Rainbow
====================
Black Rainbow was a fairly ambitious project. Building on my earlier work with _Cave Explorer_ and _Eaty the Alien_, I set out to try to create a sprawling procedurally generated roguelike adventure game within authentic instruction set and speed limitations of the HP-48 SCHIP interpreter.

Goals and Constraints
---------------------
I wanted to make an action game that could run at a 20 cycles/frame emulation rate, which meant that from the very beginning I would be fighting an uphill battle against complexity. Building the game to run on the buggy SCHIP interpreter was easy enough: I refrained from taking advantage of auto-incrementing `load` and `save` instructions, restricted myself to shifts of the form `vx <<= vx` and `vx >>= vx`, and avoided my beloved `jump0` instruction. In each instance, I had to abandon some of my usual tricks, but it didn't seem to cost me all that many cycles or bytes.

World Representation
--------------------
My plan for the game involved having static screens on which a player can walk off one edge to travel to another "room", with a large grid of such rooms comprising the game world. Initial experiments showed that 8x8 tiles gave me a fair degree of flexibility for defining the appearance of rooms, so at SuperChip resolution (128x64 pixels) I was left with rooms of 16x8 tiles. Moving between rooms needed to be fairly quick, so I first used careful profiling to determine the ideal balance of speed and code size. Loading columns of 8 tiles at a time in an unrolled loop worked very nicely- this naturally leads to storing the room in a "flipped and mirrored" manner:

	: board # 16x8 tiles, 128 bytes:
		16 16 16 16  8  0  8 16
		16  0  0  0  0  0  0 16
		16  0  0  0  0  0  0 16
		16  0  0  8  8  8  0 16
		16  0  0  0  0  0  0 16
		16  0  0  0  0  0  0 16
		 8  0  0  0  0  0  0  8
		 0  0  0  0  0  0  0  0
		 8  0  0  0 24  0  0  8
		16  0  0  0  0  0  0 16
		 8  0  8  0 24  0  0  8
		0   0  8  0  0  0  0  0
		 8  0  8  0 24  0  0  8
		16  0  0  0  0  0  0 16
		16  0  0  0  0  0  0 16
		16 16 16 16  8  0  8 16

Here's a simplified version of the board-drawing code:

	draw-x := 0
	loop
		draw-y := -8 
		i := board
		i += draw-x

		load v7    draw-tile
		v0 := v1   draw-tile
		v0 := v2   draw-tile
		v0 := v3   draw-tile
		v0 := v4   draw-tile
		v0 := v5   draw-tile
		v0 := v6   draw-tile
		v0 := v7   draw-tile

		draw-x += tile-size
		if draw-x != screen-w then
	again

	...

	: draw-tile
		draw-y += tile-size
		if v0 == 0 then return
		i := tiles
		i += v0
		sprite draw-x draw-y tile-size
	;

Note how in `draw-tile` there's an opt-out branch which avoids drawing empty tiles- experimentation showed that in mostly-empty rooms this had a significant impact with very little added complexity.

For a game with a static, pregenerated world, it would be easy to rewrite the `i := board` instruction in the drawing loop to point to some other buffer of map data with no appreciable performance overhead. Black Rainbow instead uses a dynamically generated world which is "decompressed" a room at a time into the "board" array, and then rendered from that temporary buffer. Unpacking the room in this fashion makes it much easier to draw it and perform collision detection against it later.

In the compressed format, every room is stored in just two bytes:

	# 0: [ 4-bit layout ][ 4-bit doors ] layout
	# 1: [ 4-bit NPC 2  ][ 4-bit NPC 1 ] npcs

	:const door-right-1 0b00000001
	:const door-right-2 0b00000010
	:const door-down-1  0b00000100
	:const door-down-2  0b00001000

	: world
		0xAF 0x70  0x00 0x00  0x00 0x00  0x00 0x00  0x01 0xFF
		0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00
		0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00
		0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00
		0x0F 0x00  0x00 0x00  0x00 0x00  0x00 0x00  0x00 0x00

Black Rainbow's world consists of a 5x5 grid of rooms, as a mostly arbitrary limit. Each room contains bitflags that indicate whether it is connected via a door to the room immediately below or to the right of it (wrapping around the world toroid), the base background pattern and fields which identify the entities that are present in a given room. More on these later. By using a "dense" representation in which every bit pattern decodes to a valid room, we can generate a world by simply filling the `world` array with random bytes and then performing some fixups to ensure the result is solvable. In particular the door connection approach, while restricting the engine to rooms connected within a regular grid, was very helpful for keeping connections internally consistent.

Tricks of the Trade
-------------------
Writing this game engine involved a number of the usual Chip-8 tricks, but several techniques deserve at least a brief mention.

The "hot" game loop- instructions which must execute on every update tick- needed to be extremely tight. One way I shaved cycles off was to devote a large number of registers to storing constants needed at various points in this loop:

	:alias r-x-coord v8 # constant mask for board coords
	:alias r-y-coord vb # constant mask for board coords (overlapped)
	:alias key-up    v9 # constant 5 for movement input
	:alias key-dn    va # constant 8 for movement input
	:alias key-lf    vb # constant 7 for movement input
	:alias key-rt    vc # constant 9 for movement input

I use the term "Entities" to refer to objects in games which have autonomous behaviors and exist in some physical space. Each room in Black Rainbow can contain 2 entities which are specified via a 4-bit ID. Each of the two "slots" has its own roster of possible entity types, so the system permits up to 32 distinct entities or more if combined patterns are reserved, as this system does for the "motherlode" goal.

The most obvious way to execute entity code based on the loaded ID types would be to use a jump table or a series of branches, but `jump0` is broken on the real SCHIP and either of these techniques would be far too expensive for the hot loop. Instead, the hot loop contains 4 bytes of NOPs which can be rewritten by the room unpacking routines to branch directly into the relevant entity logic:

	# update any mobs for this room:
	: mob-run-slot-1 v0 := v0 # nop
	: mob-run-slot-2 v0 := v0 # nop

	...

	v0 := room-contents
	v1 := 0x0F
	v1 &= v0
	v1 <<= v1
	v1 <<= v1 # low nybble * 4
	i := mob-table-1
	i += v1
	load v3
	i := mob-init-slot-1
	save v1
	v0 := v2
	v1 := v3
	i := mob-run-slot-1
	save v1

	...

Entities are written in two pieces: init code which is run once at board setup time and a main body which fires on every cycle of the main loop. They only have one register for persistent state to themseves, so they must be very carefully written. Often their logic piggybacks on the global countdown register used for timing the game. Here's an example:

	# horizontal slicer 1: left to right
	: mob-1-hslice-init
		mob-1 := 16
		v0 := 16
		i := mob-danger-sprite
		sprite mob-1 v0 8
	;
	: mob-1-hslice
		v0 := 16
		i := mob-danger-sprite
		sprite mob-1 v0 8
		mob-1 += 2
		if mob-1 == 106 then mob-1 := 16
		sprite mob-1 v0 8
		if vf == 0 then return
		draw-player
		i := mob-danger-sprite
		sprite mob-1 v0 8
		sprite mob-1 v0 8
		if vf != 0 then jump draw-player
		jump scramble

Conclusions
-----------
Black Rainbow was a moderate success. I didn't have enough time to complete all the features I had in mind and I left several hundred bytes of RAM unused, but the game ran flawlessly on a real SCHIP interpreter and players generally said they found it atmospheric, varied and interesting. Slowdown from collision logic while moving diagonally was a bit annoying, and it was less effective as an action game than I had hoped for.

Next year I would like to iterate on some of these ideas, and try creating another similar experience with more content and a greater emphasis on exploration and visuals than action from the beginning. To this end I think I'll try developing some custom tooling. Simple run-length encoding schemes for storing level data seem very promising and could even speed up rendering- repeatedly drawing the same tile doesn't require me to re-calculate `i` offsets between `sprite` instructions.

The self-modifying-code-based entity dispatch system used in Black Rainbow was an elegant solution. However, some entities were rather expensive to update. In practice I found that most entities only needed to be updated every 2 to 4 game cycles (or in some cases even less frequently), which suggests that I could improve performance without degrading gameplay by unrolling my main loop and only calling entity updates on a 50% duty cycle.
