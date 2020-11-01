---
title: Octo Metaprogramming Cookbook
---

Octo Metaprogramming Cookbook
=============================

The Octo language, by virtue of maintaining a simple, straightforward mapping from statements to the underlying Chip8 bytecode, gives fine-grained control to the programmer. Sometimes there's a tradeoff between keeping programs well-structured and easy to modify, and making them efficient. Making a fast program might involve writing repetitive code or doing elaborate pre-processing on data.

To deal with these situations, Octo offers three constructs: `:calc`, `:macro`, and `:stringmode`. Each is useful on its own, and in concert they are surprisingly expressive. This guide will introduce these constructs and then explore some of their applications.

Using `:calc`
-----------
The `:calc` construct allows you to calculate the value of constants at compile time. We use `:calc`, followed by a name for our constant, and then an expression to calculate is enclosed in curly braces (`{}`):

```
:const single 21
:calc  double { 2 * single }  # 42
```

Calculated expressions can refer to constants and labels which have already been defined, but may not contain forward references:

```
:calc  double { 2 * single }  # Undefined constant 'single'.
:const single 21
```

Calculated expressions are subject to the same tokenization rules in the rest of an Octo program; smashing numbers, parentheses, and operators together will probably not do what you intend:

```
:calc a { 2+3 }  # Undefined constant '2+3'. 
```

Calculated expressions are strictly evaluated right to left, except where overridden by parentheses:

```
:calc a { 2 * 3 + 5 }      # 16
:calc c { 2 * ( 3 + 5 ) }  # 16
:calc b { ( 2 * 3 ) + 5 }  # 11
```

This may seem unfamiliar at first, but removes any ambiguity with respect to order of operations. With pratice, you may find yourself using far fewer "just in case" parentheses when using bitwise operators than in other languages. See the Octo manual for a complete listing of the unary and binary operators which are available.

Finally, while it is an error to declare a `:const` constant twice, `:calc` constants may be redefined any number of times over the course of compiling a program, and can even redefine themselves. The following fragment:

```
:calc a { 3 }
v0 += a
:calc a { a + 2 }
v0 += a
```

Is equivalent to writing:

```
v0 += 3
v0 += 5
```

Redefining like this is very useful when working with macros, but sometimes can hide errors which would otherwise be caught early.


Using `:macro`
------------
The `:macro` construct allows you to give a name to a pattern of tokens. When you use the name of a macro, that pattern of tokens is expanded into your program. Macros may themselves insert references to other macros, so a seemingly simple statement could create a lot of code! Note that unlike labels, and like calculated constants, macros must be defined before they are used.

The simplest way you might use macros is as a substitute for a subroutine. Imagine you've written a game, and abstracted a subroutine for drawing the player:

```
: draw-player
	i := player-sprite
	sprite player-x player-y 8
;
```

And then you're calling that routine from several places in your main loop:

```
draw-player
loop
	# ...move enemies
	# ...read keyboard

	draw-player

	# ...move player

	draw-player

	# ...wait for next frame
again
```

The subroutine's body consists of 2 instructions, but every reference to the subroutine must perform a call and then return from the subroutine when it completes, adding 2 cycles. In total, drawing the player consumes 8 cycles for every iteration of the above main loop. The subroutine itself takes up 6 bytes, and the three calls to it take an additional 6 bytes, for a total contribution of 12 bytes to the size of our program.

Instead, let's define `draw-player` as a macro. We use `:macro`, followed by a name for our macro, and then the body of the macro is enclosed in curly braces (`{}`):

```
:macro draw-player {
	i := player-sprite
	sprite player-x player-y 8
}
```

In the body of our main loop, expanding this macro looks exactly the same as calling the original subroutine. (This choice of syntax makes it easy to swap back and forth while fine-tuning your programs!) The code which is generated, however, is quite different. A copy of the two instructions in the body of our macro is inserted at each call site, and no call or return instructions are generated. It is as if you had written this instead:

```
i := player-sprite
sprite player-x player-y 8
loop
	# ...move enemies
	# ...read keyboard

	i := player-sprite
	sprite player-x player-y 8

	# ...move player

	i := player-sprite
	sprite player-x player-y 8

	# ...wait for next frame
again
```

Drawing the player now consumes 4 cycles for each iteration of the main loop, and the three inlined copies of the macro contribute, again, 12 bytes to the size of our program. In this instance, it's a pure win: we aren't repeating ourselves by manually copying and pasting code around, and our program is faster! In other situations, especially if a subroutine is longer or called in more places, replacing the subroutine with a macro will trade improved performance for consuming more memory. Experiment and find the right balance for your application.


Generalizing Over Registers
---------------------------
Macros can also take arguments. Between the macro name and the opening curly brace of its body, you may specify the names of any number of arguments. When a macro is referenced later, it expects to consume a token corresponding to each argument. As the tokens of the macro's body are expanded into the program, any tokens which match an argument are replaced with the token that was consumed initially.

As a trivial example, consider this macro which takes a single argument named `ARG`:

```
:macro pattern ARG { 0xAA ARG 0xBB }
```

If we invoke `pattern` twice with different arguments:

```
pattern 0xFF
pattern 0x99
```

It expands like so:

```
0xAA 0xFF 0xBB
0xAA 0x99 0xBB
```

One of the most useful applications of macros which take arguments is to generalize procedures so that they can operate on different sets of registers. Consider the following program fragment:

```
if v0 < v1 begin
	vf := v0
	v0 := v1
	v1 := vf
end
if v2 < v3 begin
	vf := v2
	v2 := v3
	v3 := vf
end
```

The pattern applied in each conditional block is identical, but this isn't obvious at first glance since the registers are different. It would be clearer to use a macro:

```
:macro order A B {
	if A < B begin
		vf := A
		A  := B
		B  := vf
	end
}
order v0 v1
order v2 v3
```

The bytecode generated in either case is identical, but the macro-based program is shorter, and far easier to change later. As with subroutines, the more times a pattern occurs, the larger an impact abstracting it will have on your program.


Data Packing
------------
It's not unusual to need a pre-initialized array of data where each element has a range smaller than 0-255. For example, imagine maps for a puzzle game which consist of only 10 different kinds of tile. We could "pack" multiple such values into a single byte, saving space at the cost of doing extra work at runtime to "unpack" the data before use.

We can use external tools to prepare packed data, but this makes it more tedious to tweak and iterate on our programs. Alternatively, we could define a macro which uses `:calc` to squash numbers together at compile time, and then `:byte` to append the calculated constant to the program:

```
:macro nybbles A B {
	:calc x { ( ( 0xF & A ) << 4 ) | 0xF & B }
	:byte x
}
```

Note that as a shorthand, if `:byte` is immediately followed by an expression in curly braces, we don't need to define an intermediate constant `x`:

```
:macro nybbles A B {
	:byte { ( ( 0xF & A ) << 4 ) | 0xF & B }
}
```

With this macro, the following source code:

```
nybbles 15  9
nybbles  3  4
nybbles 11 14
```

Substituting in macro arguments, expands into a sequence of `:byte` statements:

```
:byte { ( ( 0xF & 15 ) << 4 ) | 0xF &  9 }
:byte { ( ( 0xF &  3 ) << 4 ) | 0xF &  4 }
:byte { ( ( 0xF & 11 ) << 4 ) | 0xF & 14 }
```

Which, when evaluated, are equivalent to the byte literals:

```
0xF9 0x34 0xBE
```

Lookup Tables
-------------
Instead of trying to perform elaborate calculations at runtime, you should always consider pre-computing information and stashing it in a table. Tables of power-of-two sizes are especially easy to work with for anything cyclic, since you can bit-mask the index to take it modulo the table size. If the table is 256 bytes, simply storing the index in a normal register gives you cyclic indexing for free.

Octo macros are not, by design, capable of arbitrary compile-time iteration, but we can use a few macros calling one another to invoke a macro several times without being too repetitive. The following:

```
:macro a1 { 0xFF 0xAA }
:macro a0 { a1 a1 a1 }
a0 a0
```

(2 expansions * 3 expansions of `a1`), Compiles into:

```
0xFF 0xAA 0xFF 0xAA 0xFF 0xAA 0xFF 0xAA 0xFF 0xAA 0xFF 0xAA 
```

We could write a more general set of "higher-order" macros for invoking a macro 256 times:

```
:macro d1     X { X X X X }
:macro d0     X { d1 X d1 X d1 X d1 X d1 X d1 X d1 X d1 X }
:macro do-256 X { d0 X d0 X d0 X d0 X d0 X d0 X d0 X d0 X }
```

Building on these ideas, computing a pre-scaled, pre-offset, 256-byte sine table:

```
:macro sin-entry {
	:byte { 26 + 25 * sin ( HERE - table ) * ( 2 * PI ) / 256 }
}
: table
	do-256 sin-entry
```

The name `HERE`, used in a `:calc` expression, always indicates (at time of evaluation of `:calc`) the address where the next byte of the program will be assembled. By comparing `HERE` to the base address of the label `table`, the macro `S2` obtains the index into the table.

Alternatively, we could use `:calc` to count up on each invocation:

```
:macro sin-entry {
	:byte { 26 + 25 * sin index * ( 2 * PI ) / 256 }
	:calc index { 1 + index }
}
: table
	:calc index { 0 }
	do-256 sin-entry
```

Yet another approach would be to use the special name `CALLS`, which indicates the number of times the current macro (here, `sin-entry`) has been invoked:

```
:macro sin-entry {
	:byte { 26 + 25 * sin CALLS * ( 2 * PI ) / 256 }
}
: table
	do-256 sin-entry
```

Using `CALLS` is especially useful when the number of bytes emitted may be subject to change in the future, as in emitting code rather than simple table entries. See the "Keyboard Test" example for one such use-case.

XOR-Encoded Sprites
-------------------
Consider the following program, which displays a simple looped animation:

```
: main
	i := bat-0
	sprite v0 v0 9
	loop
		:breakpoint start
		sprite v0 v0 9
		i := bat-0
		sprite v0 v0 9
		
		sprite v0 v0 9
		i := bat-1
		sprite v0 v0 9

		sprite v0 v0 9
		i := bat-2
		sprite v0 v0 9

		sprite v0 v0 9
		i := bat-3
		sprite v0 v0 9
	again

: bat-0  0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC
: bat-1  0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC
: bat-2  0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC
: bat-3  0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC
```

This program draws each frame of the animation, then erases it, then displays the next frame. The period between redrawing each frame causes the animation to flicker. A popular technique for avoiding this problem is to pre-XOR animation frames with the preceding frame, toggling only the pixels which differ. Not only does this reduce flicker, it also reduces the number of sprite drawing instructions needed to update the display.

Let's look at several ways macros could help us prepare these frames. We'll start with this preamble each time:

```
: main
	i := bat-start
	sprite v0 v0 9
	loop
		i := bat-0
		sprite v0 v0 9
		
		i := bat-1
		sprite v0 v0 9

		i := bat-2
		sprite v0 v0 9

		i := bat-3
		sprite v0 v0 9
	again
```

First, a real monster of a macro:

```
:macro xor  a0 a1 a2 a3 a4 a5 a6 a7 a8   b0 b1 b2 b3 b4 b5 b6 b7 b8 {
	:byte { a0 ^ b0 }
	:byte { a1 ^ b1 }
	:byte { a2 ^ b2 }
	:byte { a3 ^ b3 }
	:byte { a4 ^ b4 }
	:byte { a5 ^ b5 }
	:byte { a6 ^ b6 }
	:byte { a7 ^ b7 }
	:byte { a8 ^ b8 }
}

: bat-start  0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC
: bat-0  xor 0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC # bat-start
             0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC # bat-1
: bat-1  xor 0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC # bat-1
             0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC # bat-2
: bat-2  xor 0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC # bat-2
             0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC # bat-3
: bat-3  xor 0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC # bat-3
             0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC # bat-start
```

The `xor` macro here takes 18 arguments: the complete bytes of two frames, and builds an xored frame. The animation is flicker-free, but editing the frames is a pain; as the comments suggest, we must manually specify the data of each frame in the sequence twice. Can we do better?

```
:macro xor_       { :byte { ( @ a + HERE - to ) ^ @ b + HERE - to } }
:macro xor A B    { :calc to { HERE }  :calc a  { A }  :calc b  { B }
                    xor_ xor_ xor_   xor_ xor_ xor_   xor_ xor_ xor_ }

: bat-start
: bat-t0 0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC
: bat-t1 0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC
: bat-t2 0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC
: bat-t3 0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC

: bat-0 xor bat-t0 bat-t1
: bat-1 xor bat-t1 bat-t2
: bat-2 xor bat-t2 bat-t3
: bat-3 xor bat-t3 bat-t0
```

This new macro uses `@` to read the contents of pre-existing sprites and lay down an xored-together version. We're able to directly express in code the pattern that was previously relegated to comments. There's a downside, though. The previous version of the program compiled to 67 bytes, while this one- which includes both xored and original frames- compiles to 94 bytes.

For some applications, this is fine- you might need the "plain" frames for some other reason. For the purposes of this example, say we want to avoid wasting these resources. Observing that the contents of addresses 0x000-0x200 are reserved for the Chip8 interpreter and never included in a compiled ROM, we can use `:org` to place any "temporary" data there as a staging area. All we need to do is wrap a pair of macros around the declarations of the orginal sprites which we don't want included in the final binary:

```
:macro temp-begin { :calc there { HERE }  :org 0 }
:macro temp-end   { :org there }

: bat-start
: bat-t0 0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC
temp-begin
: bat-t1 0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC
: bat-t2 0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC
: bat-t3 0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC
temp-end
```

Now we're back to 67 bytes, and we don't have to repeat or pre-scramble our sprite data. All together, for reference:

```
: main
	i := bat-start
	sprite v0 v0 9
	loop
		i := bat-0
		sprite v0 v0 9
		i := bat-1
		sprite v0 v0 9
		i := bat-2
		sprite v0 v0 9
		i := bat-3
		sprite v0 v0 9
	again

:macro temp-begin { :calc there { HERE }  :org 0 }
:macro temp-end   { :org there }
:macro xor_       { :byte { ( @ a + HERE - to ) ^ @ b + HERE - to } }
:macro xor A B    { :calc to { HERE }  :calc a  { A }  :calc b  { B }
                    xor_ xor_ xor_   xor_ xor_ xor_   xor_ xor_ xor_ }

: bat-start
: bat-t0 0x78 0xCC 0x84 0x84 0x84 0x84 0x84 0x84 0xFC
temp-begin
: bat-t1 0x78 0xCC 0x84 0x84 0x84 0xB4 0xB4 0x84 0xFC
: bat-t2 0x78 0xCC 0x84 0x84 0xB4 0xB4 0xB4 0x84 0xFC
: bat-t3 0x78 0xCC 0xB4 0xB4 0xB4 0xB4 0xB4 0x84 0xFC
temp-end
: bat-0 xor bat-t0 bat-t1
: bat-1 xor bat-t1 bat-t2
: bat-2 xor bat-t2 bat-t3
: bat-3 xor bat-t3 bat-t0
```

The technique of using low memory as temporary storage for "compile time data structures" is quite powerful. I'm sure that you can imagine writing even more elaborate macros to help prepare data for your own applications.

Custom Control Structures
-------------------------
In the previous example, we saw the use of low memory as a scratchpad for intermediate bytes. Octo will produce a compiler error if a program attempts to re-define the same portion of a ROM, but 0x000-0x200 are free game- these addresses will never be included in the final output of the compiler.

The following macro is one way we could formulate a rewritable variable in this storage area. Given an address `A` and a number `X`, we increment the value at `A` by `X` and, as a side-effect, leave the previous value of that address in a calculated constant named `prev`:

```
:macro inc A X {
	:calc there { HERE }
	:org  A
	:calc prev { @ HERE }
	:byte { X + prev }
	:org  there
}
```

Read over the following fragment and consider how reads, writes, and re-definitions produce the sequence of compiled bytes indicated in the comments:

```
: main
	exit            # 0x00FD
	:const pos 32
	inc pos 5
	:byte { prev }  # 0
	:byte { @ pos } # 5
	inc pos 4
	:byte { @ pos } # 9
	inc pos -2
	:byte { @ pos } # 7
	:byte { prev }  # 9
```

We can use this as a building block for making a compile-time stack, which in turn allows us to synthesize our own specialized control structures:

```
:const for-stack-pointer 0
inc for-stack-pointer 1

:macro for REG FROM COUNT STEP {
	REG := FROM loop
	:calc for-prog { HERE }
		inc for-stack-pointer 4
		:org { -3 + @ for-stack-pointer }
		REG += STEP
		:calc to { FROM + COUNT * STEP }
		if REG != to then
	:org for-prog
}
:macro next {
	inc for-stack-pointer -4
	:byte { @ prev - 3 }
	:byte { @ prev - 2 }
	:byte { @ prev - 1 }
	:byte { @ prev - 0 }
	again
}

# usage example
: main
	for v0 16 6 5
		for v1 3 4 6
			sprite v0 v1 5
		next
	next
```

Decompiling the output of the nested `for...next` constructs above helps show the behavior of the macros:

```
: main
	v0 := 16
	loop
		v1 := 3
		loop
			sprite v0 v1 5
			v1 += 6
			if v1 != 27 then
		again
		v0 += 5
		if v0 != 46 then
	again
```

The `for` macro builds the head of the loop in the program ROM, and then stages the two input-dependent instructions on a stack in scratchpad memory. The `next` macro pops the bytes of these instructions from this stack and closes the loop.

In general, be aware that macros of this nature tend to be _very_ difficult to design and debug, and prevent the compiler from producing useful error messages when things go off the rails- use them sparingly if at all.

Sprite Width
------------
Let's look at another place compile-time manipulation of sprites can be handy: variable-width text. We've drawn a series of 4-pixel tall characters, and we want to draw a series of these characters to spell out a word:

```
: let-I   0xC0 0x00 0xC0 0xC0
: let-L   0xC0 0xC0 0xC0 0xE0
: let-M   0xD8 0xE8 0xC8 0xC8
```

While they are are the same height, each of the above sprites vary in width- `I`, `L`, and `M` are 2, 3, and 5 pixels wide, respectively. Consider this approach:

```
:macro print S WIDTH {
	i := S
	sprite v0 v1 4
	:calc advance { 1 + WIDTH } # 1 pixel between letters
	v0 += advance
}
: macro print-I { print let-I 2 }
: macro print-L { print let-L 3 }
: macro print-M { print let-M 5 }

...

print let-M
print let-I
print let-L
print let-L
```

Usable, but a bit of a pain to maintain. We have to define a helper macro for every letter, and then manually update those macros if we ever alter the characters. Instead, let's calculate those character sizes in the `print` macro itself. If we use `@` we can take a bitwise OR of all the bytes which make up the rows of the character, stacking them together:

```
:calc pixels { ( @ S ) | ( @ 1 + S ) | ( @ 2 + S ) | ( @ 3 + S ) }
```

What we need now is the index of the least-significant set bit in `pixels`. The expression `x & - x` clears all but the least-significant bit in `x`. Taking the log base 2 of this number tells us what place (right-to-left) that bit is in, and then we simply need to offset it appropriately to incorporate one extra pixel between each character as it is drawn, to keep the text legible. All together:

```
:macro print S {
	:calc pixels  { ( @ S ) | ( @ 1 + S ) | ( @ 2 + S ) | ( @ 3 + S ) }
	:calc lsb     { pixels & - pixels }
	:calc index   { ( log lsb ) / log 2 }
	:calc advance { 9 - index }

	i := S
	sprite v0 v1 4
	v0 += advance
}
```

Or, more compactly,

```
:macro print S {
	:calc pixels  { ( @ S ) | ( @ 1 + S ) | ( @ 2 + S ) | ( @ 3 + S ) }
	:calc advance { 9 - ( log pixels & - pixels ) / log 2 }

	i := S
	sprite v0 v1 4
	v0 += advance
}
```

You can see a very similar routine in the example game "Slippery Slope".

Using `:stringmode`
-------------------
Octo has another facility for dealing with text: the ability to define _stringmodes_. A stringmode is a special type of macro which can be invoked for every character in a string literal in sequence. Defining a string mode uses `:stringmode`, followed by a name, an _alphabet_, and a macro body enclosed in curly braces (`{}`).

Let's start with a straightforward example: a tiny 4x3 pixel font, a corresponding stringmode, and an example of creating data with the stringmode and printing it.

```
: font-4x3
	0x40 0xA0 0xE0 0xA0  0xE0 0xC0 0xA0 0xC0  0x60 0x80 0x80 0x60  0xC0 0xA0 0xA0 0xC0 # ABCD
	0xE0 0xC0 0x80 0xE0  0xE0 0xC0 0x80 0x80  0x60 0x80 0xA0 0x60  0xA0 0xE0 0xA0 0xA0 # EFGH
	0xE0 0x40 0x40 0xE0  0xE0 0x20 0xA0 0x40  0xA0 0xC0 0xA0 0xA0  0x80 0x80 0x80 0xE0 # IJKL
	0xE0 0xE0 0xA0 0xA0  0xC0 0xA0 0xA0 0xA0  0x40 0xA0 0xA0 0x40  0xE0 0xA0 0xE0 0x80 # MNOP
	0x40 0xA0 0xE0 0x60  0xC0 0xA0 0xC0 0xA0  0xE0 0xC0 0x20 0xE0  0xE0 0x40 0x40 0x40 # QRST
	0xA0 0xA0 0xA0 0x40  0xA0 0xA0 0xC0 0x80  0xA0 0xA0 0xE0 0xE0  0xA0 0x40 0xA0 0xA0 # UVWX
	0xA0 0x40 0x40 0x40  0xE0 0x40 0x80 0xE0  0x00 0x00 0x00 0x40  0x00 0x00 0x40 0x80 # YZ.,
	0x40 0x40 0x00 0x40  0xE0 0x20 0x00 0x40  0x40 0x40 0x00 0x00  0x00 0x00 0x00 0x00 # !?'

:stringmode text "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,!?' " { :byte { VALUE * 4 } }
:stringmode text "\0"                               { :byte -1 }

: message
	text "HELLO, WORLD.   WELCOME TO OCTO!\0"

: main
	v1 := 0 # screen x
	v2 := 0 # screen y
	v3 := 0 # char index
	loop
		i := message
		i += v3
		load v0
		while v0 != -1
		v3 += 1
		i := font-4x3
		i += v0
		sprite v1 v2 4
		v1 += 4
		if v1 == 64 begin
			v2 += 5
			v1 := 0
		end
	again
```

With a little tinkering, this routine could easily be refined to handle newline characters or use indirection to fetch the source string.

Alternatively, if your program only has to display a handful of strings- or speed is essential- you could write something like the `print` macro in the previous section as a stringmode which emits directly-executable inlined code:

```
:stringmode print "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,!?' " {
	:calc addr { font-4x3 + VALUE * 4 }
	i := addr
	sprite v0 v1 4
	v0 += 4
}

: main
	print "EXAMPLE"
```

One obvious refinement would be to special-case the space character, since it doesn't actually need anything to be "drawn". Likewise, we could add a case for newlines:

```
:stringmode print "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,!?'" {
	:calc addr { font-4x3 + VALUE * 4 }
	i := addr
	sprite v0 v1 4
	v0 += 4
}
:stringmode print " " {
	v0 += 4
}
:stringmode print "\n" {
	v0 := 0
	v1 += 5
}

: main
	print "HERE ARE\nSOME WORDS"
```

If for some reason you want ASCII strings, (perhaps you have a CHIP-8 machine with a serial IO interface?) it's easy enough to furnish an appropriate stringmode. By wrapping it in an ordinary macro, we could even emulate the behavior of C-style null-terminated string literals, or pascal-style counted strings:

```
:stringmode ascii " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" { :byte { CHAR } }
:stringmode ascii "\0" { :byte 0  }
:stringmode ascii "\n" { :byte 10 }

:macro cstring      STR { ascii STR  :byte 0 }
:macro pascalstring STR { :byte { strlen STR }  ascii STR }
```

Note: use caution with the `strlen` function. It will only tell you the size of a literal in bytes. If you intend to use multi-clause stringmodes to drop some characters or encode them in multiple bytes, `strlen` will not reflect this! For a more elaborate pascal string you might need to `:org` forward over the size byte and then use `HERE` to compute the correct length and patch it up after processing the entire string.

Don't forget- stringmodes can be useful even when you aren't working with string data:

```
:const tape 256
:alias ptr v1
:alias tx  v2
:alias ty  v3
:stringmode bf ">" { ptr += 1 }
:stringmode bf "<" { ptr -= 1 }
:stringmode bf "+" { i := tape i += ptr load v0 - v0 v0 += 1 save v0 }
:stringmode bf "-" { i := tape i += ptr load v0 - v0 v0 -= 1 save v0 }
:stringmode bf "[" { loop i := tape i += ptr load v0 while v0 != 0 }
:stringmode bf "]" { again }
:stringmode bf "." { i := tape i += ptr load v0 i := hex v0 sprite tx ty 5 tx += 5 }

: main
    bf "++[.->++<]>[.-]"
```

Stringmodes can be used _anywhere_ you want to make a sequence of simple macro invocations more concise.
