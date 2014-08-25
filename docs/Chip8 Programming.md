---
title: Chip8 Programming Techniques
---

Chip8 Programming Techniques
============================

This article is meant to address some of the practical implications of the Chip8 instruction set and how it can be applied to writing games. Examples will be given using Octo assembler, but should be easy to translate into the assembler of your choice or raw Chip8 bytecode.

Framerate
---------
The Chip8 specification doesn't say how fast programs should run. Experimentally, you may find that various games seem intended to run at different speeds. Pong.ch8, for example, is pretty playable when the game runs at about 7 chip8 cycles per frame and a framerate of 60fps. Many interpreters make it possible to adjust their speed for each game. This is less than ideal, however, as it requires players to experiment. Let's consider a very simple program which moves a sprite on the screen at a fixed rate:

	: box
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

Since we know the `delay` timer counts down at 60hz, we can use it to precisely time an interframe delay. Take a look at this modified program and note that animation will run at a consistent speed even if your interpreter is cranked up really fast:

	: box
		0b11110000
		0b10010000
		0b10010000
		0b11110000

	: sync
		loop
			vf := delay
			if vf != 0 then
		again

		# delay for up to 1/60th of a second
		# using the fixed-rate delay timer
		vf := 1
		delay := vf
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

Consider making use of a routine like `sync` in your own programs to ensure a consistent gameplay experience on different interpreters.

Keeping Score
-------------
Whether it's counting down the number of missiles stored in your gigantic mech or telling you how many human skulls you've crushed beneath the treads of your tank, video games frequently involve displaying numbers on screen. Fortunately, Chip8 provides some instructions specially for this purpose.

To display a single digit from a register, we can make use of the `hex` statement to load the address of a (built-in) hexadecimal character into `i`. Then it's just a matter of using `sprite` to display it:

	: main
		v0 := 7        # some one-digit number
		i  := hex v0   # load the address of a character
		sprite v0 v0 5 # built in characters are 5 pixels tall
		loop again

There are two caveats here: the number displayed is in hexadecimal and we can only display a single digit. How do we display larger numbers? That's where `bcd` comes in. It'll take a number in a register, split it into hundreds, tens and ones and then store those into sequential addresses in memory. Then we use `load` to scoop those values into the bottom three registers and use `hex` like before to display them.

	# temporary storage for hundreds, tens and ones:
	: digits 0 0 0

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

You can also use `bcd` as a way of dividing numbers by 10 or 100, but it's a little fiddly for this purpose.

Moving Slowly
-------------
It's easy to make objects move in whole numbers of pixels per second- just store a speed in a register and add that speed to the object's position every time you update the display. What may be less obvious is how you move objects slower than 1 pixel per frame.

One technique for accomplishing this is to use fixed-point and the flag (`vf`) register. You'll store a fractional position in one register, accumulating your speed into it and incrementing the real position whenever the result sets the carry register- that is, whenever the result wraps around.

	: ball
		0b0110000
		0b1001000
		0b1001000
		0b0110000

	: main
		i := ball
		va :=  1 # x position of ball 1 (pixels)
		vb :=  1 # x position of ball 2 (pixels)
		v0 :=  0 # x position of ball 1 (fractional)
		v1 :=  0 # x position of ball 2 (fractional)
		v2 := 10 # x velocity of ball 1
		v3 :=  5 # x velocity of ball 2

		loop
			vc := 4
			sprite va vc 4
			vc := 12
			sprite vb vc 4
		
			v0 += v2
			va += vf

			v1 += v3
			vb += vf

			clear
		again

Note that immediate adds (adding a constant) do not set `vf` on overflow; we must store the velocity of the balls in registers, at least temporarily.

Tile-based Movement
-------------------
Say you want to make a turn-based game where a player moves an 8x8 tile at a time. We can use `key` to wait for key input and then move the player based on the value we get. In this example I will represent the player's horizontal and vertical position using a single "tile" coordinate system which numbers each 8x8 region on the screen left to right, top to bottom. Later on, this system would make it easy to add obstacles and tiles which do special things when a player walks on them.

	: darwinian
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

On the other hand, perhaps the tile coordinate system is unnecessary overhead for your game. Here's a similar program which uses discrete x and y position registers. A jump table based on `jump0` (which jumps to an address + the contents of `v0`) is used to decode keypresses. The `launch` routine is a subroutine so that after the jump0 and second jump into the body of each handler we can `return` to the caller of `launch`.

Movement is constrained to avoid having the player wrap around the edges of the screen. Finally, we avoid using subtraction instructions when moving the player by using immediate adds which will wrap around to the desired value.

	: darwinian
		0b00000000
		0b00010000
		0b00010000
		0b01111100
		0b00010000
		0b00111000
		0b00101000
		0b00101000

	: lf  if va !=  0 then va += 248 ;
	: rt  if va != 56 then va +=   8 ;
	: up  if vb !=  0 then vb += 248 ;
	: dn  if vb != 24 then vb +=   8 ;

	: code  return  return  return  return
	        return  jump up return  jump lf
	        jump dn jump rt return  return
	        return  return  return  return

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

The `jump0` instruction can be very useful for eliminating complex nests of branches and conditionals. Remember that if your jump table entries are 2 bytes long you can only have 128 in a table (such as if they are `jump`s) and if they are 4 bytes long you can only have 64 (such as if they are a subroutine `call` followed by a `return`).

Tiles and Indirection
---------------------
Say you want to make a game that draws a series of "tiles" to fill the screen as in an RPG overworld. We can start by declaring the tile data the rest of our experiments will use.

	# 8x8 tiles for a simple RPG-like overworld
	: ground  0b11101111 0b10111101 0b11110111 0b11011110
	          0b11110111 0b10111101 0b11101111 0b01111011
	: water   0b00000000 0b00000000 0b11001100 0b00110000
	          0b00000000 0b10000110 0b00011000 0b00000000
	: tree    0b11000011 0b10101001 0b01010101 0b00101010
	          0b01010100 0b10000001 0b11100111 0b11000011
	: house   0b11111111 0b11100111 0b10011001 0b01111110
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

Now we want to extend this program to randomly scatter tiles. Let's generate a tile offset in v2 by using `random` and a mask which will select random numbers spaced 8 bytes apart. This process is made very convenient because both the size and number of tiles are powers of two.

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

What if instead of picking tiles randomly we had static data defining a level? There are many ways we might store the level data with varying degrees of compactness. For simplicity and ease of editing, let's represent each tile in the map with a byte, 0-3. Data will be stored a row at a time to correspond to the way we draw the level. I've rearranged our registers a bit because we need low registers free to be able to use `load`.

	: map
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

Naturally we could simplify our `get-tile` routine a bit if we stored tiles in multiples of 8 to begin with. Perhaps we could use the lower-order bits to store other information and mask them off with a simple `and` before using them to index into the tile sheet. This approach can support up to 32 8x8 tiles before `v0` will wrap around while computing an offset for `i`. If we wanted more tiles, we would need to add to `i` in multiple smaller steps.

Multiple Indirection
--------------------
In everyday programming, it is not unusual to want to dereference more than one pointer in sequence- imagine indexing a "jagged" 2d array or traversing a linked list. Unfortunately, it is difficult to do something like this in the Chip8 instruction set.

We can only load data from memory through the 16-bit `i` register, and and we can only load into an 8 bit ordinary register. `i` can be initialized to a constant or we can add an 8 bit value to it. How can we load an arbitrary value in normal registers into `i`?

One approach would be to use repeated addition into `i`:

	v0 :=   2 # high 4 bits of desired i
	v1 :=  37 # low 8 bits of desired i
	v2 := 128 # constant

	i := 0
	i += v1
	loop
		while v0 != 0
		i += v2   # we can't add 256 at once,
		i += v2   # so we do it in two steps.
		v0 += 255 # equivalent to subtracting 1
	again

Another approach would be to use self-modifying code to place an `i := NNN` instruction in memory before executing it. This looks like "0xANNN" in memory, so we can `or` our high nybble with `0xA0`.

	: trampoline
		0 0 # destination for i := NNN
	;

	: code
		v0 :=    2 # high 4 bits of desired i
		v1 :=   37 # low 8 bits of desired i
		v2 := 0xA0 # constant

		v0 |= v2        # now v0-v1 contain our instruction
		i := trampoline # select destination for instruction
		save v1         # write the instruction
		trampoline      # execute our instruction, setting i.

If you want to generate an `i :=` instruction pointing to a label known at assembly time, you can use Octo's `:unpack` statement to achieve the same trick:

	: code
		:unpack 0xA some-label # store address in v0-v1
		i := trampoline        # select destination for instruction
		save v1                # write the instruction
		: trampoline 0 0       # execute our instruction, setting i.

And another approach could be to use a jump table. This doesn't allow us to store completely arbitrary values into `i`, but it does allow us to select an `i` based on the contents of a register. Since the jump table entries are 4 bytes each and are indexed by `v0`, we can have at most 64 such entries in a table.

	: table
		i := 0x123 ;
		i := 0x456 ;
		i := 0x789 ;
		i := 0xABC ;
		i := 0xDEF ;

	: get-i
		# assume get-i is called as a subroutine,
		# and v0 contains the table index.

		v0 <<= v0 # multiply by 4, the table entry size
		v0 <<= v0
		jump0 table

Scrolling
---------
Basic Chip8 doesn't have any instructions for scrolling the screen, but since sprites occupy small regions of memory it's fairly easy to scroll their images directly. We must remain aware that the `load` and `save` statements both increment `i` to the address immediately after the region of memory they operate upon, which unfortunately is not very useful most of the time.

Let's begin with a byte-wise scroll upwards of an 8 pixel tall sprite:

	: letter  0x18 0x18 0x34 0x24 0x7C 0x62 0xC2 0xE7

	: main
		loop
			v1 := 7 # memory offset
			i := letter
			load v0
			v2 := v0 # prime v2 with the first row for wraparound

			loop
				i := letter
				i += v1
				load v0     # fetch the current row

				v3 := v0    # stash current row in v3

				v0 := v2
				i := letter
				i += v1
				save v0     # write the previous row to the current

				v2 := v3    # current becomes previous

				v1 += -1
				if v1 != -1 then
			again

			v0 := 10
			i := letter
			clear
			sprite v0 v0 8
		again

This is pretty slow. Since our sprite is small and registers are not at a premium, we might try shuffling data around in larger chunks:

	: letter  0x18 0x18 0x34 0x24 0x7C 0x62 0xC2 0xE7

	: main
		loop
			i := letter
			load v0
			v7 := v0 # fetch the top row and move it to v7
			load v6  # fetch the remainder of the sprite into v0-v6
			i := letter
			save v7  # write them all back

			v0 := 10
			i := letter
			clear
			sprite v0 v0 8
		again

Nice! Unfortunately, this technique uses 8 registers for temporary storage, so you are likely to need to spill some data before employing it.

On the other hand, we might save ourselves quite a bit of grief by repeating our sprite data twice and indexing into it based on a rolling offset, essentially producing a "sliding window" into the underlying sprite data. This approach can be used for other kinds of animation, too:

	: letter
		0x18 0x18 0x34 0x24 0x7C 0x62 0xC2 0xE7
		0x18 0x18 0x34 0x24 0x7C 0x62 0xC2 0xE7

	: main
		v1 := 0 # window offset
		loop
			v0 := 10
			i := letter
			i += v1
			clear
			sprite v0 v0 8
			
			v1 += 1 # increment v1 modulo 8
			v0 := 0b111 
			v1 &= v0
		again

Scrolling horizontally requires bitshifts. Both shift instructions leave `vf` with the bit that was shifted out. Rotating a byte left is easy, since we can simply `or` `vf` into the result of the shift:

	v0 <<= v0 # shift most significant bit out left
	v0 |= vF  # OR it back in as the new least significant bit

Rotating right is slightly more complicated because we need to mask `vf`'s 1 or 0 value into the most significant bit of the result.

	v0 >>= v0 # shift the least significant bit out right
	if vF == 1 then vF := 128
	v0 |= vF  # OR it back in as the new most significant bit

If we use an unrolled loop, we can employ both operations for an interesting effect:

	: letter  0x18 0x18 0x34 0x24 0x7C 0x62 0xC2 0xE7

	: main
		loop
			v2 := 0 # memory offset
			loop
				i := letter
				i += v2
				load v1    # read in two bytes

				v0 <<= v0 
				v0 |= vF   # rotate left

				v1 >>= v1
				if vF == 1 then vF := 128
				v1 |= vF   # rotate right

				i := letter
				i += v2
				save v1    # write back two bytes

				v2 += 2
				if v2 != 8 then
			again

			clear
			v0 := 10
			i := letter
			sprite v0 v0 8
		again

As demonstrated here, if you have enough registers to spare you can very conveniently operate on chunks of memory at once. An entire sprite can often fit in the Chip8 register file, but you may need to spill and restore your working registers. While it may seem unintuitive coming from other architectures, consider copying sprite data from place to place for animation as an alternative to using frame offsets.

Bitwise Arithmetic
------------------
Taking full advantage of the limited set of arithmetic operations available in Chip8 is extremely important for writing efficient programs. Let's look at some applications of operators which may not be immediately obvious.

If we `xor` a register with `0xFF` it inverts all the bits in the original register- this is how you perform a `not`:

	vf := 0xFF
	v0 ^= vf

Any number is 0 if you `xor` it with itself, so `xor` is often used as an equal-to operator in assembly language. Since the conditional branches in Chip8 can test if a register is equal to a constant or register this use of `xor` is not often necessary.

Shifts leave the shifted out bit in `vf`. Thus, we can use a left or right shift to obtain the most or least significant bit of a byte, respectively. We can apply this idea to count the number of 1 bits in a byte:

	v0 := 0xF3 # number to examine
	v1 := 0x00 # the count
	loop
		while v0 != 0
		v0 >>= v0
		v1 +=  vf
	again

Of course, if speed was important this could be calculated using a 256-entry lookup table or an unrolled loop.

Sometimes it is useful to obtain the value (1 << N); that is, a particular single-bit vector for masking or setting bits in a register. There is no Chip8 instruction for doing multiple shifts at once, so like many operations the most efficient strategy ends up being to use a lookup table:

	: bits 1 2 4 8 16 32 64 128
	...
	i := bits
	i += v0   # index N
	load v0   # result

Taking the bitwise `or` of N with N+1 will have the effect of setting the least significant (or rightmost) zero bit in the byte:

	v1 := v0 # use v1 as a temporary copy
	v0 += 1
	v0 |= v1

Similarly, the bitwise `and` of N with N-1 will clear the least significant (or rightmost) one bit in the byte:

	v1 := v0
	v0 += -1
	v0 &= v1

If a (nonzero) number becomes zero after performing this operation you know it had exactly one bit set and was thus a power of two.

Random Bit Vector Permutations
------------------------------
Let's consider a problem which is at the heart of a number of types of puzzle and strategy games: Given N objects, how do we randomly distribute them over M locations without placing any two at the same location? For example, consider the placement of mines in a game of Minesweeper. We can represent the locations as a bit vector where 1 bits are objects.

The simplest approach is to pregenerate a selection of appropriate vectors and index randomly into a table. Here's a table with 32 of the 60 possible 8-bit vectors containing 4 set bits and appropriate code for fetching one into v0:

	: bit-vectors
		0xCC 0x39 0x53 0x78 0xF0 0xB1 0x93 0xD8
		0xA9 0x1D 0x55 0xC3 0x3C 0x8D 0xE2 0x63
		0x87 0x56 0xAC 0x27 0x4E 0x36 0x72 0x5C
		0x4D 0x1B 0x0F 0xE4 0xA3 0x5A 0x95 0x2B
	: get-vector
		v0 := random 0b11111
		i  := bit-vectors
		i  += v0
		load v0
	;

This has the disadvantage that it's not complete- there are bit vectors which will never be generated. Depending on your game, this may be OK.

A slightly more complex approach is to generate a completely random number and then verify that it has the correct number of bits, trying new numbers until an appropriate one is found:

	: get-vector
		loop
			v0 := random 0xFF
			v1 := v0 # working copy
			v2 :=  0 # bit count
			loop
				while v1 != 0
				v1 >>= v1
				v2 += vf
			again
			if v2 != 4 then
		again
	;

The problem with this approach is it could take an arbitrarily long time to run if the random number generator keeps coming up with "bad" numbers.

The following algorithm is one way around that problem. This time we'll be manipulating a 16-bit vector, which requires us to use a pair of registers together and chain operations together through `vf`. For each of the N bits we want set in our output we rotate our bit vector by a random number of bits if the least significant bit is 1. Then we set the least significant 0 bit. Then we rotate the vector a second time.

	# rotate the output vector
	# by a random number of places:
	: rotate-random
		v3 := random 0b1111
		loop
			while v3 != 0
			v3 += -1

			# rotate the 16 bits in v1 and v0
			# using v4 as a temporary:
			v0 <<= v0
			v4 :=  vf
			v1 <<= v1
			v0 |=  vf
			v1 |=  v4
		again
	;
	
	# generate a random permutation of
	# 16 bits, with N of those bits set:
	: permute-bits
		v0 := 0 # output (hi)
		v1 := 0 # output (lo)
		v2 := 8 # loop counter (N)
				# trash v3, v4
		loop
			# rotate if the LSB of output is set,
			# to avoid creating runs of 1s:
			v3 >>= v1
			if vf != 0 then rotate-random
	
			# OR output vector with itself + 1
			# to set the least significant 0:
			v3 := v0
			v4 := 1
			v4 += v1
			v3 += vf
			v0 |= v3
			v1 |= v4
	
			# rotate again, to avoid always having
			# 1 as the least significant bit:
			rotate-random
	
			# repeat N times
			v2 += -1
			if v2 != 0 then
		again
	;

This algorithm has significant bias- contiguous runs of 1s are considerably more likely than other patterns. However, it can generate any 16-bit permutation with N bits set and the results may be sufficiently well distributed for many games. Note the use of several techniques described in the section on bitwise arithmetic.
