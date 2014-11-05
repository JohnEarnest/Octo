---
title: Octo Extensions
---

Octo Extensions
===============
In the process of developing Octo, I have written and studied many Chip8 and SuperChip8 programs. I have also researched historical attempts to extend Chip8 such as [CHIP-8E](http://mattmik.com/downloads/viper/Volume2Issue08_09.pdf) as well as more modern and less conservative approaches like [Chip16](https://github.com/chip16/chip16). Chip8 has a simple, elegant instruction set which is easy to learn, but using it extensively reveals some shortcomings which limit the kinds of programs which can be written (to say nothing of convenience). In this document I will describe a series of extended instructions Octo provides called "XO-Chip" which, like SuperChip8, retain backwards compatibility with the original Chip8 instructions. The additions are sparing and try to retain some degree of historical plausibility and the flavor of Chip8's creative limitations. Authors of future Chip8 interpreters are encouraged to provide support for these instructions.

The XO-Chip instructions are summarized as follows:

- `save vx - vy` (`0x5XY2`) save an inclusive range of registers to memory starting at `i`.
- `load vx - vy` (`0x5XY3`) load an inclusive range of registers from memory starting at `i`.
- `bank n` (`0xFN00`) select a 4k memory bank used by `i` for all operations (0 <= n <= 1).
- `plane n` (`0xFN01`) select zero or more drawing planes by bitmask (0 <= n <= 3).
- `audio := i` (`0xF002`) store 16 bytes starting at `i` in the audio pattern buffer.
- `scroll-up n` (`0x00DN`) scroll the contents of the display up by 0-15 pixels.

Memory Access
-------------
Chip8 memory operations can prove clumsy. `load` and `save` place low registers at a premium and lead to difficulty in allocating registers. Code which attempts to load and work with two structs from memory must perform a number of copies:

	i := buffer1
	load v3
	v4 := v0
	v5 := v1
	v6 := v2
	v7 := v3
	i := buffer2
	load v3

Chip8E proposes a pair of instructions which load and save register ranges, specifying both a minimum and maximum (inclusive) register. XO-Chip adopts these as described using the CHIP-8E instruction encoding. Using these instructions, the above code could instead be written as:

	i := buffer1
	load v4 v7
	i := buffer2
	load v0 v3

Reads or writes proceed in the order the register arguments are provided. Thus, it is possible to use these instructions to do convenient in-place byte reversals:

	i := buffer1
	load v0 v3   # load 4 bytes sequentially
	save v3 v0   # write them back in reversed order

These instructions also provide another useful function. Unlike normal `load` and `store`, they do not postincrement `i`. The `i` postincrement is useful in some situations but inconvenient in others. When a postincrement is desired the standard `load` and `store` instructions may be used, and when it is not desired a programmer may substitute the ranged version specifying `v0` as the minimum range.

Banking
-------
The design of Chip8 instructions with immediate addresses such as `jump` limit Chip8 to a 4k address space, of which the low 512b is reserved for historical reasons. It would be difficult to expand this range, and 3.5kb of code space does seem to be sufficient for many applications. However, level-based games or anything graphically intensive (including games with color graphics as described below) would benefit tremendously from expanded space for data. The COSMAC-VIP had a 16-bit address space of which `i` can only conventionally access 12 bits. We propose an addition which allows the programmer to select between 4k "banks" of memory which i will address.

XO-Chip provides 2 memory banks, bank 0 (0x0000-0x1000) and bank 1 (0x1000-0x2000). At startup, `i` will access bank 0, providing compatibility with normal Chip8 operation. Octo provides an `:org` operative which causes subsequent code or data to be compiled at a given address, making it possible to specify that bulk data should begin at bank 1. The `hex` and `bighex` instructions may alter the current bank- Octo resets the bank to 0 for these instructions.

Prior to the addition of `bank` it was completely unnecessary for an Octo programmer to concern themselves with the absolute address at which code or data are stored, but this is an unfortunate side-effect which seems to be an inevitable consequence of the existing Chip8 semantics. The programmer must track which bank they have selected much as they would otherwise track whether or not they were in high-res SuperChip8 graphics mode. We can take advantage of this newfound concern in some situations. When buffers are aligned across banks we can quickly and easily switch between them without modifying `i`- this combines well with the ranged `load` and `store` instructions:

	bank 0
	i := thing1 # note that i := only sets the low 12 bits of i
	load v0 v3  # ranged loads do not disturb i
	bank 1      # now i points to thing2
	load v4 v7
	save v0 v1  # and we can efficiently swap the contents of the buffers:
	bank 0
	save v4 v7
	
	...
	
	# these buffers share the same low 12 address bits:
	:org 0x0F00 :thing1 0x1 0x2 0x3 0x4 ...
	:org 0x1F00 :thing2 0xA 0xB 0xC 0xD ...


Encoding is chosen to provide `bank` with the ability to supply a full 4-bit argument for the high bits of `i`, making it possible to expand data address space to 64k in the future should it prove necessary. The `bank` instruction is placed in unpopulated space in the `0xF`-prefix instructions.

Bitplanes
---------
Chip8 has a unique XOR-drawing approach to graphics which provides interesting challenges and solutions. However, with only 2 colors available there are many interesting kinds of games which cannot feasibly be rendered- for example, puzzle games where color matching is a key mechanic such as _Puyo-Puyo_ or _Dr. Mario_. It would be nice to augment Chip8 with the ability to draw a few additional colors without losing the unique flavor of its graphics drawing mode.

XO-Chip expands the display with a second drawing bitplane. The first bitplane functions exactly as normal in Chip8 or SuperChip8 mode. The second bitplane is superimposed on the first and draws in a different color. Where set pixels on both bitplanes overlap they are drawn using another color. This approach is thus capable of drawing images containing up to 4 colors- The background color, the first drawing plane's color, the second drawing plane's color and the color used when both planes overlap. Which colors appear on the display are left up to the implementation and may be grayscale, a preset palette or user-configurable.

The `plane` instruction takes a 2-bit bitmask which selects one, both or neither of the drawing planes, with the least significant bit being the first drawing plane. Thus, `plane 1` selects only the first drawing plane, `plane 2` selects only the second and `plane 3` selects both. By default, only the first drawing plane is selected for compatibility with normal Chip8 operation. `clear`, `sprite` and the various `scroll-` instructions apply only to the selected drawing plane(s). It is thus possible to scroll one plane as a "background" while a "foreground" remains fixed.

When a `sprite` is drawn with both planes selected the operation will consume twice as many bytes of graphics data as it normally would, first drawing the specified sprite height to the first plane and then drawing the same number of bytes to the second plane. If the sprite was 4 pixels high, the first plane would be drawn to using bytes at the addresses `i` to `i`+3 and the second plane would be drawn using bytes at the addresses `i`+4 to `i`+7. This means that drawing sprites with both planes selected will naturally and conveniently draw or erase 4-color sprites. With both planes selected the `vf` collision flag will be set after a sprite drawing operation if pixels from _either_ plane are toggled from on to off.

Encoding is chosen such that it would be possible to provide 4 bitplanes (and thus 16 colors!) in the future should it prove necessary. The `plane` instruction is placed in unpopulated space in the `0xF`-prefix instructions.

Audio
-----
Chip8 has the ability to make a single sound using a "buzzer". Implementations are free to make any sound when the buzzer timer is nonzero. It would be nice to provide Chip8 programs with a simple but flexible means of making a range of different sounds. The approach chosen must make it possible to store and play back sounds without using excessive amounts of ram or CPU cycles.

XO-Chip provides Chip8 with a 16-byte "pattern buffer" which, when the buzzer is played, is treated as a series of 1-bit samples at 4000 samples per second which control noise made by the buzzer. By loading different patterns into the this buffer it is possible to create various square wave tones with different duty cycles as well as percussive noise. Rapidly replacing the contents of the pattern buffer should even permit crude sampled audio playback or music. The 16-byte pattern buffer can fit entirely within `v` registers for purposes of this kind of realtime waveform generation.

	: click
		0x02 0xCD 0x00 0x00 0x00 0x00 0x00 0x00
		0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00
	
	...
	
	i := click
	audio := i
	v0 := 2 # play for 2/60ths of a second, as expected
	buzzer := v0

Note that the `audio` instruction makes a copy of the values in Chip8 memory- altering memory will not change the contents of the audio buffer unless a subsequent `audio` instruction is fired. The initial contents of the pattern buffer is implementation-defined, so programmers wishing to use sound effects should always initialize the pattern buffer explicitly. Octo will initialize the pattern buffer to zeroes, so without initialization no sound will occur when the buzzer goes off. 

The overloading of `i` as a means of specifying the address of the new pattern buffer is a bit inconvenient, but existing instruction encodings don't permit any other way to specify a 12-bit immediate value. Memory banks (as described in Banking) will be respected by this instruction. The `audio` instruction is placed in unpopulated space in the `0xF`-prefix instructions.

Scrolling
---------
SuperChip8 provided a set of screen scrolling instructions. These are very handy for some kinds of games, but having scrolling in only 3 directions seriously limits their utility. XO-Chip provides a `scroll-up` which is a functional complement to SuperChip8 `scroll-down`, capable of scrolling 0 to 15 pixels at a time. The encoding of `scroll-up` is chosen to fit the existing pattern of `scroll-down`.
