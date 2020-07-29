---
title: Octo Assembly Language
---

Octo Assembly Language
----------------------

Octo programs are a series of _tokens_ separated by whitespace. Some tokens represent Chip8 instructions and some tokens are _directives_ which instruct Octo to do some special action as the program is compiled. The `:` directive, followed by a name (which cannot contain spaces) defines a _label_. A label represents a memory address- a location in your program. You must define at least one label called `main` which serves as the entrypoint to your program.

Using a label by itself will perform a subroutine call to the address the label represents. Alternatively, you can be more explicit by using `:call` followed by an address or name. A semicolon (`;`) is another way to write `return`, which returns from a subroutine. The `#` directive is a single-line comment; it ignores the rest of the current line. Numbers can be written using `0x` or `0b` prefixes to indicate hexadecimal or binary encodings, respectively.

Numeric constants can be defined with the `:const` directive followed by a name and then a value, which may be a number, another constant or a (non forward-declared) label. Registers may be given named aliases with `:alias` followed by a name and then a register. The `i` register may not be given an alias, but v registers can be given as many aliases as desired. Here are some examples of constants and aliases:

	:alias x v0
	:alias CARRY_FLAG vF
	:const iterations 16
	:const sprite-height 9

Chip8 has 16 general-purpose 8-bit registers named `v0` to `vF`. `vF` is the "flag" register", and some operations will modify it as a side effect. `i` is the memory index register and is used when reading and writing memory via `load`, `save` and `bcd`, and also provides the address of the graphics data drawn by `sprite`. Sprites are drawn by XORing their pixels with the contents of the screen. The screen is 64 pixels wide and 32 pixels tall, and sprites drawn off the edge of the display will wrap around. Drawing a sprite sets `vF` to 0, or to 1 if drawing the sprite toggles any pixels which were previously on. For a more detailed description of the behavior of Chip8 instructions consult <a href="http://mattmik.com/chip8.html" target="_blank">Mastering Chip8</a>.

In the following descriptions, `vx` and `vy` refer to some register name (v0-vF) and `n` refers to some number. The Chip8 keypad is represented on your keyboard as follows:

	Chip8 Key   Keyboard
	---------   ---------
	 1 2 3 C     1 2 3 4
	 4 5 6 D     q w e r
	 7 8 9 E     a s d f
	 A 0 B F     z x c v

For convenience, Octo predefines constants beginning with `OCTO_KEY_` for each keyboard key with the value of the corresponding Chip8 key. For example, `OCTO_KEY_W` has a value of `5`.

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
The Chip8 conditional opcodes are all conditional skips, so Octo control structures have been designed to map cleanly to this approach. The following conditional expressions can be used with `if` or `while`:

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

These are implemented by using the subtraction instructions `-=` and `=-` and querying `vf`. Note that these pseudo-ops produce 3 chip8 instructions each and should be avoided when the simpler direct comparisons are suitable.

If you wish to conditionally execute a group of statements, you can use `if...begin...end` instead of `if...then`. Optionally you may include an `else` clause.

	if v0 > 5 begin
		v1 := random 0xFF
		if v1 == 5 begin
			v2 := v1
			v3 := v1
		else
			delay := v1
		end
	end

`if...begin...else...end` will not always be the fastest or most compact way to express your desired conditions. Consider rearranging your logic, using jump tables with `jump0` or factoring the bodies of conditional clauses into subroutines if they are reused elsewhere. `if...begin...end` requires more instructions than a plain `if...then`, so prefer the latter when practical.

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

`loop...again` constructs may be nested as desired and will behave as expected, but note that simply chaining together `if...then` statements (as in `if v0 == 0 then if v1 == 1 then v2 := 4`) does not elicit useful behavior.

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

The behavior of `:unpack` and `:next` could also be obtained in a more general case using macros- see below.

You can also specify an address at which subsequent instructions should be compiled by using `:org` followed by an address. The use of this directive is very brittle, so it should be avoided unless absolutely necessary.

Metaprogramming
---------------
Sometimes your code will contain repetitive patterns that don't make sense to break out into subroutines. Perhaps they differ by the registers they operate upon, or for performance reasons you need to avoid the overhead of a call and a return. The `:macro` command is the solution. It takes a name, followed by names for 0 or more arguments, then a `{`, a sequence of arbitrary Octo statements and finally a terminal `}`. When you reference the name of a macro, you must provide tokens corresponding to each argument, and then Octo will inline the contents of the macro with any instances of the argument names substituted by the input tokens. Here's a trivial use and definition example:

	:macro swap A B {
		vf := A
		A  := B
		B  := vf
	}

	...

	swap v0 v1
	swap v2 v1

This generates code equivalent to the following:

	vf := v0
	v0 := v1
	v1 := vf
	vf := v2
	v2 := v1
	v1 := vf

Macros must be defined before expansion, and nesting macro definitions does not generally make sense, but macro invocations may appear within macro definitions. Unless it has been shadowed by a macro argument, the special name `CALLS` will be substituted within a macro with a number corresponding to how many times this macro has been expanded, counting from 0.

Sometimes there is an arithmetic relationship between constants in your program. Rather than computing them by hand, the `:calc` command allows you to perform calculations at compile time. It takes a name, followed by a `{`, a sequence of numbers, constant references, binary operators, unary operators or parentheses, and finally a terminal `}`. The name is assigned to the result of evaluating the expression within curly braces. The following operators are available:

	unary:  - ~ ! sin cos tan exp log abs sqrt sign ceil floor @ strlen
	binary: - + * / % & | ^ << >> pow min max < <= == != >= >

The unary operator `@` looks up an address in the compiled ROM at the time of evaluation. Logical operators return `0` or `1` to indicate false or true, respectively. Additionally, the mathematical constants `E` and `PI` are usable, and the constant `HERE` indicates the address immediately following the end of the compiled ROM at the time of evaluation. The `strlen` operator is special; it expects to be immediately followed by a string literal (or a symbol which expands into one) and expands into the length of said literal in characters.

Note that as with all Octo commands, the tokens of a `:calc` expression must be separated by whitespace. Bitwise operations are performed as if arguments were 32-bit signed integers, and otherwise they are treated as floating-point. When referenced, calculated constants are truncated to integegral values as appropriate. Order of evaluation is strictly right-to-left unless overridden by parentheses. The following expressions are equivalent:

	:calc foo { 2 * 3 + baz }
	:calc foo { 2 * ( 3 + baz ) }

When using `:calc` and `:macro` together, it is often useful to write the contents of some constant to the ROM; this can be done with `:byte`:

	:macro with-complement X {
		:calc Y { 0xFF & ~ X }
		:byte X
		:byte Y
	}

For convenience and brevity, if `:byte` is immediately followed by `{` the expression is computed as with `:calc` and compiled as a byte, without defining an intermediate constant. The `:org` and `:call` directives can also accept a constant expression, truncated to a 16-bit or 12-bit address, respectively.

Strings
-------
Many Chip8 programs do not require strings or text at all. When text is desired, representing it using ASCII is often very inconvenient. For example, fonts may not include all displayable ASCII characters, or a text rendering routine might want to work with glyph offsets. For this reason, Octo has an unusually flexible approach to working with string literals.

A string literal is enclosed in double-quotes (`"`), and may contain C-style backslash (`\`) escape sequences. The escape characters `tnrv0\"` are supported. Apart from their ability to contain whitespace and some special characters, string literals are totally interchangeable with ordinary tokens.

The `:stringmode` directive is used to define an approach for converting a string literal (or any other non-numeric token) into data in your program. The directive takes a _name_ for the mode, followed by an _alphabet_, and then a macro body enclosed in curly braces (`{ ... }`). The name of the mode will then behave like a macro which consumes one token (a data string) and invokes the mode's macro body for each character in the string. The macro body is provided with three bound arguments for each character: `CHAR`, the ASCII value of the character, `INDEX`, the index of the character in the data string, and `VALUE`, the index of the character in the mode's alphabet. Multiple `:stringmode` directives may be issued for a given mode name, to provide a different macro body for different ranges of characters. The alphabets of these definitions should not overlap.

Here is a simple example which generates premultiplied offsets to a font where each character is 8 pixels tall:

	:stringmode text8 "ABCDEFGHIJKLMNOPQRSTUVWXYZ !" {
		:byte { 8 * VALUE }
	}

	: message
		text8 "GAME OVER!"

This assembles as 10 bytes equivalent to:

	0x30 0x00 0x60 0x20 0xD0 0x70 0xA8 0x20 0x88 0xD8

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

XO-Chip
-------
Beyond SuperChip, Octo provides a set of unique extended instructions called XO-Chip. These instructions provide a 4-color display, improved scrolling functionality, a flexible audio generator, expanded ram and instructions which make memory manipulation more convenient.

- `save vx - vy` save an inclusive range of registers to memory starting at `i`.
- `load vx - vy` load an inclusive range of registers from memory starting at `i`.
- `i := long NNNN` load `i` with a 16-bit address. (this instruction is 4 bytes long.)
- `plane n` select zero or more drawing planes by bitmask (0 <= n <= 3).
- `audio` store 16 bytes starting at `i` in the audio pattern buffer.
- `scroll-up n` scroll the contents of the display up by 0-15 pixels.

For more details, consult the XO-Chip specification in Octo's documentation directory. At time of writing Octo is the only Chip8 interpreter which supports these instructions, but authors are encouraged to provide them in their own interpreters.

Debugging
---------
Octo provides basic debugging facilities for Chip8 programs. While a program is running, pressing the "i" key will interrupt execution and display the contents of the `v` registers, `i` and the program counter. Any register aliases and (guessed) labels will be indicated next to the raw register contents. You can click on registers in this view to cycle through displaying their contents in binary, decimal, or hexadecimal.

When interrupted, pressing "i" again or clicking the "continue" icon will resume execution, while pressing "o" will single-step through the program. The "u" key will attempt to step out (execute until the current subroutine returns) and the "l" key will attempt to step over (execute the contents of any subroutines until they return to the current level).

Pressing the "p" key will interrupt execution and display a profiler, indicating a best guess at the time spent in subroutines within your program so far. The profiler shows the top 20 results in a table, and you can also copy and paste a more detailed dump of profiling information for further analysis offline.

Breakpoints can also be placed in source code by using the command `:breakpoint` followed by a name- the name will be shown when the breakpoint is encountered so that multiple breakpoints can be readily distinguished. `:breakpoint` is an out-of-band debugging facility and inserting a breakpoint into your program will not add any code or modify any Chip8 registers.

The command `:monitor`, followed by a base address and length, will register a memory monitor. While your program runs, monitors will be updated continuously to reflect the contents of memory. Pressing "m" will toggle the memory monitor on and off. Like `:breakpoint`, `:monitor` is out-of-band and generates no instructions.

The command `:assert` is followed by an optional name and a mandatory constant expression enclosed in curly braces (as with `:calc`). If the expression evaluates to zero during compilation, compilation will halt and display the message. This can provide useful sanity-checks while modifying your programs, and is especially helpful when writing macros. For example:

```
:macro rol REG {
	# note: v-register tokens are equivalent to their positions
	# 0-15 when evaluating a constant expression:
	:assert "cannot rotate-left through carry register" { REG != vF }
	REG <<= REG
	REG |=  vF
}

: main
	va := 0b10110111
	rol va # modify this to use vF, and the macro will fail.
```

Assertions are strictly a compile-time facility and have no effect during the execution of a program.
