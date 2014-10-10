---
title: Octo Assembly Language
---

Octo Assembly Language
----------------------

Octo syntax is in some ways inspired by Forth- a series of whitespace-delimited tokens. Labels are defined with `:` followed by a name, and simply using a name by itself will perform a call. `;` terminates subroutines with a return. `#` indicates a single-line comment. Numbers can use `0x` or `0b` prefixes to indicate hexadecimal or binary encodings, respectively. Whenever numbers are encountered outside a statement they will be compiled as literal bytes. An entrypoint named `main` must be defined.

Numeric constants can be defined with `:const` followed by a name and then a value, which may be a number, another constant or a (non forward-declared) label. Registers may be given named aliases with `:alias` followed by a name and then a register. The `i` register may not be given an alias, but v registers can be given as many aliases as desired. Here are some examples of constants and aliases:

	:alias x v0
	:alias CARRY_FLAG vF
	:const iterations 16
	:const sprite-height 9

Chip8 has 16 general-purpose 8-bit registers named `v0` to `vF`. `vF` is the "flag" register", and some operations will modify it as a side effect. `i` is the memory index register and is used when reading and writing memory via `load`, `save` and `bcd`, and also provides the address of the graphics data drawn by `sprite`. Sprites are drawn by xoring their pixels with the contents of the screen. Drawing a sprite sets `vF` to 0, or to 1 if drawing the sprite toggles any pixels which were previously on.

In the following descriptions, `vx` and `vy` refer to some register name (v0-vF) and `n` refers to some number. The Chip8 keypad is represented on your keyboard as follows:

	Chip8 Key   Keyboard
	---------   ---------
	 1 2 3 C     1 2 3 4
	 4 5 6 D     q w e r
	 7 8 9 E     a s d f
	 A 0 B F     z x c v

Statements
----------

- `return`          return from the current subroutine. (alias for ;)
- `clear`           clear the screen.
- `bcd vx`          decode vx into BCD at i, i+1, i+2.
- `save vx`         save registers v0-vx to i.
- `load vx`         load registers v0-vx from i.
- `sprite vx vy n`  draw a sprite at x/y position, n rows tall.
- `jump n`          jump to address.
- `jump0 n`         jump to address n + v0.

The `load` and `save` instructions postincrement `i` by `x`+1. For example, `load v3` will add 4 to `i` after loading 4 bytes of memory into the first 4 `v` registers.

Assignments
-----------

The various chip8 copy/fetch/arithmetic opcodes have been abstracted to mostly fit into a consistent `<dest-reg> <operator> <source>` format. For some instructions, `<source>` can have several forms.

- `delay := vx`    set delay timer to register value.
- `buzzer := vx`   set sound timer to register value.
- `i  := n`        set I to constant.
- `i  := hex vx`   set I to hex char corresponding to register value.
- `i  += vx`       increment I by a register value.
- `vx := vy`       copy register to register.
- `vx := n`        set register to constant.
- `vx := random n` set register to random number AND n.
- `vx := delay`    set register to delay timer.
- `vx := key`      block for a keypress and then store code in register.
- `vx += n`        add constant to register.
- `vx += vy`       add register to register. (set vF to 1 if result overflows, else 0)
- `vx -= vy`       subtract y from x, store in x (set vF to 0 if result underflows, else 1)
- `vx =- vy`       subtract x from y, store in x (set vF to 0 if result underflows, else 1)
- `vx |= vy`       bitwise OR register with register. 
- `vx &= vy`       bitwise AND register with register.
- `vx ^= vy`       bitwise XOR register with register.
- `vx >>= vy`      shift vy right by 1 and store result in vx. (set vF to LSB of vy)
- `vx <<= vy`      shift vy left by 1 and store result in vx. (set vF to MSB of vy)

Control Flow
------------
The Chip8 conditional opcodes are all conditional skips, so Octo control structures have been designed to map cleanly to this approach. The following conditional expressions can be used with `if...then` or `while`:

- `vx == n`
- `vx != n`
- `vx == vy`
- `vx != vy`
- `vx key` (true if the key indicated by vx is pressed)
- `vx -key` (true if the key indicated by vx is not pressed)

`if...then` conditionally executes a single statement. For example,

	if v0 != 5 then v1 += 2

Octo also provides pseudo-ops for using `<`, `>`, `<=` and `>=` to compare two registers or a register with a constant:

	if v1 >  v2  then v3 := 5
	if v1 <= 0xA then v3 := 7

These are implemented by using the subtraction instructions `-=` and `=-` and querying `vf`, and will destroy the contents of a temporary register as well as `vf`. By default this temporary register will be `ve`, but defining an `:alias` named `compare-temp` can reassign it to any register but `vf`. Note that these pseudo-ops produce 3 chip8 instructions each and should be avoided when the simpler direct comparisons are suitable.

`loop...again` is an unconditional infinite loop. `loop` marks the address of the start of the loop and produces no code, while `again` compiles a jump instruction based on the address provided by `loop`. Since `again` is itself a statement, we can use an `if...then` at the end of a loop to skip over the backwards jump and efficiently break out of the loop. The following loop will execute 5 times:

	v0 := 0
	loop
		# do something...
		v0 += 1
		if v0 != 5 then
	again

The other way to break out of a loop is `while`. `while` creates a conditional skip around a forward jump. These forward jumps are resolved by `again` to point to the address immediately outside their loop. `while` will thus exit the current loop if its condition is not true. You can have as many `while` statements in a loop as you want. Here is an example of `while` which is similar to the previous except for when the condition is checked.

	v0 := 0
	loop
		v0 += 1
		while v0 != 5
		# do something...
	again

`loop...again` constructs may be nested as desired and will behave as expected, but note that simply chaining together `if...then` statements (as in `if v0 == 0 then if v1 == 1 then v2 := 4`) does not elicit useful behavior. If complex nested conditionals are desired, the first `if...then` should be combined with a `jump`, `jump0` or subroutine call to subsequent conditionals.

Self Modifying Code
-------------------
Sometimes you may wish to have the 12-bit address represented by a label available in `v` registers. Octo provides a command called `:unpack` for this purpose which expands into a pair of register assignment opcodes. It takes a nybble (0-15 numeric literal or constant) followed by a label as arguments. The lower 8 bits of the address will be stored in `v1` and the upper 4 bits of the address will be bitwise ORed with the specified nybble shifted left 4 bits and stored in `v0`. If the label `cucumber` represented the address `0x582`, the following sets of statements would be identical in meaning:

	v0 := 0xA5
	v1 := 0x82
	
	:unpack 0xA cucumber

This operation makes it possible to write self-modifying code without hardcoding addresses as numeric literals. If you wish to unpack addresses into registers other than `v0` and `v1` you can define aliases called `unpack-hi` or `unpack-lo`, respectively.

Another type of self-modifying code that comes up frequently is overwriting the second half of an instruction, particularly instructions like `vX := NN` whose second byte is an immediate operand. This requires a label at the second byte of an instruction, which can be achieved with `:next`:

	: init  :next target va := 2 ;
	
	...
	
	i := target
	v0 := 5
	save v0
	init # va will be set to 5 instead of 2.

You can also specify an address at which subsequent instructions should be compiled by using `:org` followed by an address. The use of this operative is very brittle, so it should be avoided unless absolutely necessary.

SuperChip
---------
SuperChip or SCHIP is a set of extended Chip8 instructions. Octo can emulate these instructions and will indicate if any such instructions are used in an assembled program. The SuperChip instructions are as follows:

- `hires` Switch to a 128x64 pixel high resolution display mode.
- `lores` Switch to the normal 64x32 pixel low resolution display mode.
- `scroll-down n` Scroll the contents of the display down by 0-15 pixels.
- `scroll-left` Scroll the contents of the display left by 4 pixels.
- `scroll-right` Scroll the contents of the display right by 4 pixels.
- `i := bighex vx` Set I to a large 8x10 hex char corresponding to register value.
- `exit` Halt the program and quit the emulator.
- `saveflags vx` Save v0-vn (n < 8) to flag registers. (Originally, HP-48 flag registers.)
- `loadflags vx` Restore v0-vn (n < 8) from flag registers.

Flag registers are persisted using browser local storage, so provided no applications blow them away intentionally they can be used to store information between play sessions such as high score information or progress.

Finally, drawing a sprite with height 0 (which would otherwise do nothing) is used by the SuperChip to draw a large 16x16 sprite. The sprite data itself is stored as 16 pairs of bytes representing each row.

Debugging
---------
Octo provides basic debugging facilities for Chip8 programs. While a program is running, pressing the "i" key will interrupt execution and display the contents of the `v` registers, `i` and the program counter. Any register aliases and (guessed) labels will be indicated next to the raw register contents. When interrupted, pressing "i" again or clicking the "continue" icon will resume execution, while pressing "o" will single-step through the program. Note that while single-stepping the Chip8 timers will not count down.

Breakpoints can also be placed in source code by using the command `:breakpoint` followed by a name- the name will be shown when the breakpoint is encountered so that multiple breakpoints can be readily distinguished. `:breakpoint` is an out-of-band debugging facility and inserting a breakpoint into your program will not add any code or modify any Chip8 registers.
