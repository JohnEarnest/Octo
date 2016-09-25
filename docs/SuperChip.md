Mastering SuperChip
===================
In 1990, Erik Bryntse wrote a Chip8 emulator for the [HP-48 graphing calculator](https://en.wikipedia.org/wiki/HP_48_series) called [CHIP-48](http://www.hpcalc.org/details.php?id=854) which adds a series of "SCHIP" or "SuperChip" extended instructions. SuperChip intends to be backwards compatible with the ordinary Chip8 instruction set and the new instructions occupy unused space in the Chip8 instruction encoding. In this document I will attempt to describe SuperChip instructions in detail and also discuss programming techniques which use them. Code examples will use Octo syntax.

Some of the details in this document have been superceded or given more explanation by [this guide](https://github.com/Chromatophore/HP48-Superchip), which describes the behavior of SCHIP based on original research and careful examination of the source code to several HP-48-based Chip8 emulators.

Compatibility
-------------
In the [SCHIP 1.1 documentation](http://devernay.free.fr/hacks/chip8/schip.txt), Bryntse describes both the Chip8 and SuperChip instruction set. Of particular note are the shift and memory load/store instructions:

	8XY6     VX := VX shr 1, VF := carry
	8XYE     VX := VX shl 1, VF := carry
	FX55     Store V0..VX in memory starting at M(I)
	FX65     Read V0..VX from memory starting at M(I)

These definitions are subtly incorrect. In the original Chip8, shift instructions shift `VY` into `VX` and `FX55`/`FX65` increment `i` in the process of saving and restoring by the number of registers read or written. It appears that the bugs introduced by this interpreter, combined with its popularity and the wealth of SuperChip games written for it, are the root cause of a great deal of difficulty we're faced with today in writing broadly compatible Chip8 emulators. Octo's approach is to favor the original Chip8 interpreter's behavior and provide "quirks modes" which selectively enable SCHIP style behaviors as a fallback. Many other Chip8 emulators simply go with the SuperChip behaviors, breaking older Chip8 programs.

SCHIP also raised the return stack capacity from 12 to 16 records. This is a fairly harmless change to Chip8 semantics. 12 nested subroutine calls is a considerable depth for the scale of programs that fit on Chip8, especially since recursion isn't practical without a user-accessible stack. At time of writing, there are no SuperChip programs known to make use of more than the 12 permitted Chip8 stack calls.

In practice, programs wishing to support a broad range of emulators which use shift instructions can simply restrict themselves to using an identical source and destination register as in `va <<= va`. Often this merely costs an extra copy instruction at the beginning or end of a series of shifts. The difference in behavior for memory instructions poses more of a challenge- before any read or write you must re-initialize `i` such that auto-increments have no effect. This prevents the use of fast copy, draw or fill routines like the following:

	i := somebuffer
	va := 0
	loop
		save v7
		va += 1
		if va != 8 then
	again

A comparable alternative which is "SuperChip Safe" could be:

	va := 0
	loop
		i := somebuffer
		i += va
		save v7
		va += 8
		if va != 64 then
	again

SuperChip scroll instructions were introduced with SCHIP v1.1, while all other SuperChip instructions were introduced with v1.0. The [CHIPPER](https://groups.google.com/forum/#!topic/comp.sys.hp48/e7In51mOgHY) assembler draws a distinction between these two revisions of SuperChip, but most emulators simply provide all the v1.1 instructions.

The SuperChip Instructions
--------------------------
SuperChip instructions add the ability to toggle a "high res" 128x64 pixel graphics mode with a scrollable display, larger sprites and a larger hexadecimal font, an instruction for exiting the interpreter and instructions for reading and writing the HP-48's "RPL user flag" registers.

- `00FF` (`hires`) Enable 128x64 high resolution graphics mode.
- `00FE` (`lores`) Disable high resolution graphics mode and return to 64x32.
- `00CN` (`scroll-down n`) Scroll the display down by 0 to 15 pixels.
- `00FB` (`scroll-right`) Scroll the display right by 4 pixels.
- `00FC` (`scroll-left`) Scroll the display left by 4 pixels.

Scroll instructions do not "wrap" the display- scrolling down, left or right leaves blank pixels at the top, right or left of the display, respectively. It is thus possible to use these instructions to selectively erase regions of the screen, but the technique is limited- horizontal scrolls always move in 4 pixel blocks and SuperChip offers no way to scroll the screen back up after a `scroll-down`.

- `DXY0` (`sprite vx vy 0`) Draw a 16x16 sprite.

SuperChip repurposes drawing a 0-height Chip8 sprite for a special drawing operation. SuperChip high resolution sprites are 16x16 pixels, stored row-wise in 32 bytes. Each row of the sprite data is a byte for the left half of the row followed by a byte for the right half of the row.

- `FX30` (`i := bighex vx`) Set `i` to a large hexadecimal character based on the value of `vx`.

SuperChip large hex characters are twice the size of the Chip8 font- 8 pixels wide and 10 pixels tall.

- `FX75` (`saveflags vx`) Save v0-vX to flag registers.
- `FX85` (`loadflags vx`) Restore v0-vX from flag registers.

Flag registers are particularly interesting, as they are persistent across program runs and between different programs. It's possible to make a Chip8 program behave differently on different runs without relying on randomness or save a high score table. On the HP-48 it also made it possible for Chip8 games to interact with [RPL](https://en.wikipedia.org/wiki/RPL_(programming_language)) programs. Octo saves flag registers via [Local Storage](http://diveintohtml5.info/storage.html). The HP-48 had 64 one-bit user flags, corresponding to 8x8 bit registers- thus the argument `X` must be between 0 and 7.

- `00FD` (`exit`) Exit the Chip8/SuperChip interpreter.

In Octo, an `exit` will immediately quit the program and drop back to the editor, while executing `0000` will leave the program on screen and halted. Well-behaved games should probably avoid using either instruction and instead automatically reset at a game over.

Full Screen Blit
----------------
The Chip8 display size is evenly divisible by the size of the 16x16 SuperChip sprite, and the display can be redrawn with a mere 8 draw calls. This makes it practical to make some very fast full-screen drawing routines. Suppose we have already used a tool like [ImagePack](https://github.com/JohnEarnest/Octo/tree/gh-pages/tools/ImagePack) to prepare a properly sliced 64x32 bitmap. We can use a simple loop to draw the bitmap in 4 vertical slices:

	i := bitmap
	v0 := 0  # horizontal position of sprites
	v1 := 0  # vertical position of first sprite
	v2 := 16 # vertical position of second sprite
	v3 := 32 # sprite stride
	loop
		sprite v0 v1 0
		i += v3
		sprite v0 v2 0
		i += v3
		v0 += 16
		if v0 != 64 then
	again

This takes 32 cycles. By more aggressively unrolling and doing a bulk initialization of registers from a buffer, we can make it even faster:

	i := blit-regs
	load v3
	i := bitmap
	sprite v0 v0 0  i += v2
	sprite v0 v1 0  i += v2
	sprite v1 v0 0  i += v2
	sprite v1 v1 0  i += v2
	sprite v2 v0 0  i += v2
	sprite v2 v1 0  i += v2
	sprite v3 v0 0  i += v2
	sprite v3 v1 0

	...

	: blit-regs  0 16 32 48

This only takes 18 cycles! This is fast enough to make it feasible to do simple full-screen animations. To avoid unnecessary flicker, avoid using the `clear` instruction between frames and instead prepare your data by XORing each frame with its predecessor. Similar tricks can also be employed to do full screen drawing in high resolution mode, but they are less practical. A full screen uncompressed bitmap at 64x32 is only 256 bytes (permitting as many as 13 such bitmaps and a single 256 byte "page" of code) while at 128x64 a single bitmap would be 1024 bytes and take up nearly a third of available RAM.

Screen Shake
------------
[ScreenShake](https://www.youtube.com/watch?v=AJdEqssNZ-U) is a popular stylistic technique in many "indie" video games today. It can be used to add punch and impact to games, enhancing the player's sense of feedback. A crude version of this effect can be created by using `scroll-left` and `scroll-right` in rapid succession:

	vf := 16
	delay := vf
	loop
		scroll-left
		scroll-right
		scroll-right
		scroll-left
		vf := delay
		if vf != 0 then
	again

For an idea of how this looks in action, try the example program [Sweet Copter](http://johnearnest.github.io/Octo/index.html?gist=7417dc52a3c0b1df9620). Note that as a side effect of the scrolling the 4 left- and rightmost pixels of the display will be cleared. Carefully designing your graphics to avoid these portions of the screen can hide this. You can further enhance the screenshake effect by offsetting game sprites slightly during the animation or using the buzzer.
