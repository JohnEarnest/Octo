---
title: Octo Manual
---

Octo
====

Octo is a simple high-level assembler for the Chip8 virtual machine. Its syntax is in some ways inspired by Forth- a series of whitespace-delimited tokens. Subroutines are defined with `:` followed by a name, and simply using the name will perform a call. `;` terminates subroutines with a return. `#` indicates a single-line comment. Numbers can use `0x` or `0b` prefixes to indicate hexadecimal or binary encodings, respectively. Whenever numbers are encountered outside a statement they will be compiled as literal bytes. Names must always be defined before they can be used- programs are written in "reading" order. An entrypoint named `main` must be defined.

In the following descriptions, `vx` and `vy` refer to some register name (v0-vF), `l` refers to a (forth-style) identifier and `n` refers to some number.

Statements
----------

- `:const l n`      declare a constant with some numeric value.
- `:data l`         declare a label- can be used like a constant.
- `return`          return from the current subroutine.
- `clear`           clear the screen.
- `bcd vx`          decode vx into BCD at I, I+1, I+2.
- `save vx`         save registers v0-vx to I.
- `load vy`         load registers v0-vx from I.
- `sprite vx vy n`  draw a sprite at x/y position, n rows tall.
- `jump n`          jump to address.
- `jump0 n`         jump to address n + v0.

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
- `vx += vy`       add register to register.
- `vx -= vy`       subtract register from register.
- `vx |= vy`       bitwise OR register with register.
- `vx &= vy`       bitwise AND register with register.
- `vx ^= vy`       bitwise XOR register with register.
- `vx >>= vy`      shift vy right by 1 and store result in vx.
- `vx <<= vy`      shift vy left by 1 and store result in vx.

Control Flow
------------
The Chip8 conditional opcodes are all conditional skips, so Octo control structures have been designed to map cleanly to this approach. `if` conditionally executes a single statement (which could be a subroutine call or jump0), and `loop...again` is an infinite loop which can be exited by one of any contained `while` conditional breaks. Loops can be nested as desired. `if` and `while` should each be followed by a conditional expression. Conditional expressions can have one of the following six forms:

- `vx == n`
- `vx != n`
- `vx == vy`
- `vx != vy`
- `vx key` (true if the key indicated by vx is pressed)
- `vy -key` (true if the key indicated by vy is not pressed)

Control flow examples:

	if v3 != 3 then exit
	loop
		v1 += 1
		while v1 != 10
		v1 += 2
		while v1 != 10
	again

Basic sprite drawing:

	:data square
		0b11110000
		0b11110000
		0b11110000
		0b11110000

	: main
		v0 := 20
		v1 := 10
		i  := square

		sprite v0 v1 4
		v0 += 2
		v1 += 2
		sprite v0 v1 4

		v2 := vf
		v0 += 10
		i  := hex v2
		sprite v0 v1 5

		loop again
	;

Key input and hex display:

	: main
		v0 := 20
		v1 := 10
		loop
			v2 := key
			clear
			i  := hex v2
			sprite v0 v1 5
		again
	;
