Chip8 Programming Techniques
============================

This article is meant to address some of the practical implications of the Chip8 instruction set and how it can be applied to writing games. Examples will be given using Octo assembler, but should be easy to translate into the assembler of your choice or raw Chip8 bytecode.

Framerate
---------
The Chip8 specification doesn't say how fast programs should run. Experimentally, you may find that various games seem intended to run at different speed. Pong.ch8, for example, is pretty playable when the game runs at about 7 chip8 cycles per frame and a framerate of 60fps. Many interpreters make it possible to adjust their speed for each game. This is less than ideal, however, as it requires players to experiment. Let's consider a very simple program which moves a sprite on the screen at a fixed rate:

	:data box
		0b11110000
		0b10010000
		0b10010000
		0b11110000

	: main
		i  := box
		v0 := 10   # x position
		v1 := 10   # y position
		loop
			clear
			sprite v0 v1 4
			v0 += 1
		again

Since we know the delay timer counts down at 60hz, we can use it to precisely time an interframe delay. Take a look at this modified program and note that animation will run at a consistent speed even if your interpreter is cranked up really fast:

	:data box
		0b11110000
		0b10010000
		0b10010000
		0b11110000

	: sync
		# delay for up to 1/60th of a second
		# using the fixed-rate delay timer
		v2 := 1
		delay := v2
		loop
			v2 := delay

			# note the use of 'if-then' immediately before 'again'
			# to efficiently break out of a loop, an octo-specific idiom.
			if v2 != 0 then
		again
	;

	: main
		i  := box
		v0 := 10   # x position
		v1 := 10   # y position
		loop
			clear
			sprite v0 v1 4
			v0 += 1
			sync
		again

Consider making use of a routine like 'sync' in your own programs to ensure a consistent gameplay experience on different interpreters.

Keeping Score
-------------
Whether it's counting down the number of missiles stored in your gigantic mech or telling you how many human skulls you've crushed beneath the treads of your tank, video games frequently involve displaying numbers on screen. Fortunately, Chip8 provides some instructions specially for this purpose.

To display a single digit from a register, we can make use of the 'hex' operation to load the address of a (built-in) hexadecimal character into i. Then it's just a matter of using 'sprite' to display it:

	: main
		v0 := 7        # some one-digit number
		i  := hex v0   # load the address of a character
		sprite v0 v0 5 # built in characters are 5 pixels tall
		loop again

There are two caveats here: the number displayed is in hexadecimal and we can only display a single digit. How do we display larger numbers? That's where 'bcd' comes in. It'll take a number in a register, split it into hundreds, tens and ones and then store those into sequential addresses in memory. Then we use 'load' to scoop those values into the bottom three registers and use 'hex' like before to display them.

	# temporary storage for hundreds, tens and ones:
	:data digits 0 0 0

	: main
		v0 := 137      # some number 0-255
		i  := digits   # the destination for bcd
		bcd v0         # unpack digits in v0

		va := 10       # x position of first digit
		vb := 20       # y position of first digit
		i := digits
		load v2        # load digits into v0-v2
	
		i := hex v0    # hundreds digit
		sprite va vb 5
		va += 5
	
		i := hex v1    # tens digit
		sprite va vb 5
		va += 5

		i := hex v2    # ones digit
		sprite va vb 5

		loop again

You can also use 'bcd' as a way of dividing numbers by 10 or 100, but it's a little fiddly for this purpose.

Tile-based Movement
-------------------
Say you want to make a turn-based game where a player moves an 8x8 tile at a time. We can use 'key' to wait for key input and then move the player based on the value we get. In this example I will represent the player's horizontal and vertical position using a single "tile" coordinate system which numbers each 8x8 region on the screen left to right, top to bottom. Later on, this system would make it easy to add obstacles and tiles which do special things when a player walks on them.

	:data darwinian
		0b00000000
		0b00010000
		0b00010000
		0b01111100
		0b00010000
		0b00111000
		0b00101000
		0b00101000

	: draw-player
		va := v0
		vc := 0b00111 # low 3 bits of v0 are the x coordinate
		va &= vc      # mask them off
		va <<= va     # multiply by 8 to get pixels
		va <<= va
		va <<= va

		vb := v0
		vc := 0b11000 # high 2 bits of v0 are the y coordinate
		vb &= vc      # mask them off
					  # and they're already in pixels!

		i := darwinian
		sprite va vb 8
	;

	: main
		v0 := 12 # the player's position in tiles
		loop
			draw-player
			v1 := key     # wait for a keypress
			v2 := 1       # horizontal stride
			v3 := 8       # vertical stride
			draw-player   # erase the player before moving

			# assuming a default keyboard layout,
			# these numbers will map to ASWD:

			if v1 == 7 then v0 -= v2 # move left 
			if v1 == 9 then v0 += v2 # move right
			if v1 == 5 then v0 -= v3 # move up
			if v1 == 8 then v0 += v3 # move down
		again

Note that since we do no boundary checking the player can wrap around the edges of the screen. You could add additional logic to prevent this, or you could take advantage of it as a game mechanic.

On the other hand, perhaps the tile coordinate system is unnecessary overhead for your game. Here's a similar program which uses discrete x and y position registers. A jump table based on jump0 (which jumps to an address + the contents of v0) is used to decode keypresses. The 'launch' routine is a subroutine so that after the jump0 and second jump into the body of each handler we can 'return' to the caller of 'launch'.

Movement is constrained to avoid having the player wrap around the edges of the screen. Finally, we avoid using subtraction instructions when moving the player by using immediate adds which will wrap around to the desired value.

	:data darwinian
		0b00000000
		0b00010000
		0b00010000
		0b01111100
		0b00010000
		0b00111000
		0b00101000
		0b00101000

	: no ; # a no-op stub for unused entries
	: lf  if va !=  0 then va += 248 ;
	: rt  if va != 56 then va +=   8 ;
	: up  if vb !=  0 then vb += 248 ;
	: dn  if vb != 24 then vb +=   8 ;

	: code  jump no jump no jump no jump no
	        jump no jump up jump no jump lf
	        jump dn jump rt jump no jump no
	        jump no jump no jump no jump no

	: launch
		# launch is a sub so that jump
		# entries can return to the caller.
		# jump table entries are
		# 2 bytes, so double the key code:
		v0 <<= v0
		jump0 code

	: main
		va := 16 # x position
		vb :=  8 # y position
		i := darwinian
		loop
			sprite va vb 8 # draw sprite
			v0 := key      # wait for key
			sprite va vb 8 # erase sprite
			launch
		again

The jump0 instruction can be very useful for eliminating complex nests of branches and conditionals. Remember that if your jump table entries are 2 bytes long you can only have 128 in a table (such as if they are jumps) and if they are 4 bytes long you can only have 64 (such as if they are a sub call followed by a return).

Tiles and Indirection
---------------------
Say you want to make a game that draws a series of 'tiles' to fill the screen as in an RPG overworld. We can start by declaring the tile data the rest of our experiments will use.

	# 8x8 tiles for a simple RPG-like overworld
	:data ground  0b11101111 0b10111101 0b11110111 0b11011110
				  0b11110111 0b10111101 0b11101111 0b01111011
	:data water   0b00000000 0b00000000 0b11001100 0b00110000
				  0b00000000 0b10000110 0b00011000 0b00000000
	:data tree    0b11000011 0b10101001 0b01010101 0b00101010
				  0b01010100 0b10000001 0b11100111 0b11000011
	:data house   0b11111111 0b11100111 0b10011001 0b01111110
				  0b00000000 0b10111101 0b10100101 0b10100101

First, let's try writing some simple loops that cover the entire display with tree tiles. Since the Chip8 display is 64x32 and our tiles are 8x8 we'll draw four rows of 8 tiles:

	: main	
		v0 := 0 # x position
		v1 := 0 # y position
		i  := tree
		loop
			loop
				sprite v0 v1 8
				v0 += 8
				if v0 != 64 then
			again
			v0 := 0
			v1 += 8
			if v1 != 32 then
		again
		loop again

Now we want to extend this program to randomly scatter tiles. Let's generate a tile offset in v2 by using 'random' and a mask which will select random numbers spaced 8 bytes apart. This process is made very convenient because both the size and number of tiles are powers of two.

	: get-tile
		v2 := random 0b11000 # { 0, 8, 16, 24 }
		i  := ground         # the base of the tileset
		i  += v2             # add the tile in
	;

	: main	
		v0 := 0 # x position
		v1 := 0 # y position
		loop
			loop
				get-tile
				sprite v0 v1 8
				v0 += 8
				if v0 != 64 then
			again
			v0 := 0
			v1 += 8
			if v1 != 32 then
		again
		loop again

What if instead of picking tiles randomly we had static data defining a level? There are many ways we might store the level data with varying degrees of compactness. For simplicity and ease of editing, let's represent each tile in the map with a byte, 0-3. Data will be stored a row at a time to correspond to the way we draw the level. I've rearranged our registers a bit because we need low registers free to be able to use 'load'.

	:data map
		1 1 1 1 1 2 2 2
		1 1 1 1 0 0 0 2
		2 0 0 0 0 0 2 2
		0 3 0 0 0 2 2 2

	: get-tile
		i := map # load the tile into v0
		i += vc
		load v0

		v0 <<= v0 # multiply v0 by 8
		v0 <<= v0
		v0 <<= v0
		i := ground
		i += v0
	;

	: main	
		va := 0 # x position
		vb := 0 # y position
		vc := 0 # tile index
		loop
			loop
				get-tile
				sprite va vb 8
				va += 8
				vc += 1
				if va != 64 then
			again
			va := 0
			vb += 8
			if vb != 32 then
		again
		loop again

Naturally we could simplify our 'get-tile' routine a bit if we stored tiles in multiples of 8 to begin with. Perhaps we could use the lower-order bits to store other information and mask them off with a simple AND before using them to index into the tile sheet. This approach can support up to 32 8x8 tiles before v0 will wrap around while computing an offset for i. If we wanted more tiles, we would need to add to i in multiple smaller steps.

( to be continued. )
