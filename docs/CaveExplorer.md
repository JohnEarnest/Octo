Inside Cave Explorer
====================
The title sequence is made using several full-screen bitmap images. In earlier games I've constructed images by carefully splitting them apart into 8x15 chunks, but this is clumsy and artistically limiting. Instead, I simply wrote a small program to process 1-bit images and convert them into a sequence of hex literals I can paste into Octo. The drawing routine that consumes them looks like this:

	: draw-bitmap
		clear
		v0 := 0 # x
		v1 := 0 # y
		v2 := 0 # byte
		v3 := 1 # constant
		loop
			sprite v0 v1 1
			i  += v3
			v2 += 1
			v0 += 8
			if v0 == 64 then v1 += 1
			if v0 == 64 then v0 := 0
			if v1 != 32 then
		again
	;

Since I don't have to do any load or store operations in the loop, I can just steadily increment `i`. Each byte is drawn as an 8x1 sprite, with 8 such sprites per row. I liked the vertical wipe animation this approach produces, but if I wanted to draw as fast as possible I would probably rearrange the data so that I can draw columns as 2 8x15 slices and an 8x2 slice (if necessary), or for maximum uniformity draw columns of 8x8 tiles. It's possible to produce a variety of simple transition effects by drawing portions of the screen in different orders.

_note: I later refined this image packing utility into ImagePack, found in the tools directory._

Note that bitmaps like this are expensive! A single 32x64 pixel image will take up more than 1/16th your total supply of RAM. Since I only display the title sequence once at the beginning of the game, I reused that memory for scratch buffers in the main game engine. The platformer sequences modify level data in-place, but I need to be able to reset levels if the player makes a mistake. Thus, I start by making a copy of the level data, overwriting part of the title sequence:


	: copy-level
		v8 := 0
		loop
			# set i to base of current level
			...
			i += v8
			load v7

			i := level-buffer # overlaid with 'title2'
			i += v8
			save v7

			v8 += 8
			if v8 != 32 then
		again
	;

The first time I wrote this routine it was unpleasantly slow, but there was an easy way to speed it up- using load and store to do block copies through the 8 lowest registers. If we're going to put up with the oddities of Chip8 memory operations at least we can find places they actually work to our advantage from time to time! Incidentally if we harness this and the fact that load and store increment `i` automatically we can write a very tight loop for initializing memory:

	: zero-buffer
		i  := buffer
		v8 := 0
		loop
			save v7 # 'stamp' with v0-v7
			v8 += 8
			if v8 != BUFFER_SIZE then # assume the size is a multiple of 8
		again
	;

Finally, I used a rather unsavory trick for my text-drawing routine. The string data indexes into the sprite data (for compactness), so I have to juggle `i` between two locations. `i` can't be backed up and won't fit in a V-register, so we're stuck. Or are we?

	: draw-text
		v1 := 2 # x
		v2 := 1 # y
		v3 := 0 # byte
		# v4 contains length
		loop
			: text-addr i := 0 # self-modify to alter
			i += v3
			load v0
			i := font
			i += v0
			sprite v1 v2 5
			v1 += 5
			if v1 == 62 then v2 += 6
			if v1 == 62 then v1 := 2
			v3 += 1
			if v3 != v4 then
		again
	;

Code to call this routine looks like this:

	v0 := 0xA3
	v1 := 0x78
	i  := text-addr
	save v1
	v4 := 19
	draw-text
	
I stuff the halves of an `i := XXX` instruction into `v0` and `v1` and clobber those two words of the routine's code before calling it. Remember, folks- the only difference between machine code and a data structure is your frame of mind. Calculating these constant payloads by hand is a bit tedious and I may look into providing Octo with some syntactic sugar.

_note: this lead to the addition of :unpack and :next._

Most of the rest of the game implementation is fairly mundane. Like with the bitmap images and string/font preparation I discussed earlier I made use of a number of small utility programs to prepare data for consumption by the game engine. Overworld boards were drawn as bitmaps like this (blown up 4x):

![Overworld Single](http://i.imgur.com/ko6H0Vw.png)

And then converted into a sequence of bytes representing columns of 8 4x4 passable or impassable tiles:

	: board0
		0x28 0xEB 0x0A 0x7A 0x02 0xEF 0x28 0x2A 
		0x6A 0x4A 0x5A 0x42 0x7A 0x0A 0x6E 0x28

A series of 4 tables keep track of which board is adjacent in each cardinal direction from the current one. Here's what the whole game map might look like if it was mashed together onto a grid sequentially:

![Overworld Complete](http://i.imgur.com/dLeTyQw.png)

Hopefully that provides some interesting food for thought.
