A Beginner's Guide to Programming with Chip8
============================================
This document is meant to allow someone with little to no experience programming to ease into working with Octo and Chip8. It introduces basic programming concepts as well as the features of the Octo programming language.

First Steps
-----------
Chip8 is a very simple computer. It is similar in many ways to the real computers you work with every day. This guide will teach you how to write programs for Chip8. Programs are a sequence of instructions that the computer follows to accomplish some task, much like a recipe or a how-to guide. In order for computers to follow instructions, they must be written in a language the computer understands. The language we will learn is called *Octo*. The instructions that Chip8 understands work with numbers- adding them together, comparing them to one another and so on- to draw pictures and animate them.

Chip8 has 16 *registers*. They are named `v0` through `vf`- that is `v0`, `v1`, `v2`, `v3`, `v4`, `v5`, `v6`, `v7`, `v8`, `v9`, `va`, `vb`, `vc`, `vd`, `ve`, and `vf`. Each register can contain a number between 0 and 255. To put a number into a register, we use an instruction like this:

	v5 := 34

The symbols `:=` can be read as "becomes". This instruction, also called a *statement*, would store the number 34 in the register `v5`. We can also add numbers to registers:

	v3 += 15

This statement adds the number 15 to whatever number was stored in `v3` and stores the result in `v3`. You can also add the contents of one register to another or copy the contents of one register to another:

	v5 += v9

	v2 := v1

Instructions are carried out in sequence, one after another. To write programs we will have to combine many simple statements like this to achieve our goals. Let's look at a sequence of instructions. Can you work out what will be in register `v2` when they are done?

	v0 := 5
	v1 := 3
	v2 := v1
	v2 += 10
	v2 += v0

First we store 5 in register `v0`, then we store 3 in register `v1`. `v2 := v1` will store the contents of `v1` (which is presently 3) in `v2`. Then we add 10 to `v2`, giving a total of 13. Finally, we add the contents of `v0` (which is presently 5) to the contents of `v2`, giving a total of 18.

A First Program
---------------
Now we understand registers and some of the instructions which manipulate them. There are a few more things we must learn before we can write a program that shows an image on the screen.

The instructions that make up a program for Chip8 are stored in Chip8's *memory*. Memory is like a series of registers- each storing a number between 0 and 255- but there are over 3000 of them. An *address* is a number which indicates one of the spaces in memory. Chip8 has a special register called `i` which is used for storing addresses. There are differences between what we can do with `i` and what we can do with a v-register which we will discuss later, but we can store numbers in `i`:

	i := 47

A *label* is a colon (`:`) followed by a name. Names must be all one word- no spaces. Labels allow us to refer to the address of a position in our program. Programs must always have a label called "main", which is where the program begins.

To draw things on the screen, we use an instruction called `sprite`. Chip8's screen is 64 pixels wide and 32 pixels high. To use `sprite` we must indicate a register containing a horizontal position in pixels (counting from left to right), a register containing a vertical position in pixels (counting from top to bottom) and how tall the image is, in pixels. The tallest sprite we can draw is 15 pixels tall and the shortest we can draw is 1 pixel tall. Sprites are always 8 pixels wide. The `i` register must already contain the address of the image we want to draw. Let's look at an example:

	: image
		60 126 219 255 189 195 126 60

	: main
		v0 := 20
		v1 := 5
		i := image
		sprite v0 v1 8

First we have a label called `image`. After it are some numbers- in the next section we will talk about how those numbers make up the picture we want to draw. Then we have a label called `main`, which is where the instructions of our program begin. We set `v0` and `v1` to 20 and 5, respectively, and then store the address of `image` in `i`. Finally, `sprite` draws the image at the horizontal position given by `v0` (20) and the vertical position given by `v1` (5) which is 8 pixels tall. Try it!

If we change the values in `v0` or `v1` and say `sprite` again, we will see multiple copies of the image:

	: image
		60 126 219 255 189 195 126 60

	: main
		v0 := 20
		v1 := 5
		i := image
		sprite v0 v1 8
		v0 += 20
		v1 += 4
		sprite v0 v1 8

And we could give those sprites different images if we changed the value stored in `i` between drawing them:

	: image
		60 126 219 255 189 195 126 60

	: otherimage
		255 255 219 255 129 129 195 255

	: main
		v0 := 20
		v1 := 5
		i := image
		sprite v0 v1 8
		v0 += 20
		v1 += 4
		i := otherimage
		sprite v0 v1 8

Drawing sprites flips the color of pixels. This means that if you draw a sprite twice in the same position, it will be erased. Try drawing some partially overlapped sprites to see how it looks.

Hexadecimal and Binary
----------------------
Numbers can have different *bases*. This means how large a digit becomes before you carry. Most of the numbers you see on a daily basis are *decimal*, which means base 10- digits range from 0 to 9. When programming computers we often use *hexadecimal* (base 16- digits range from 0 to F) and *binary* (base 2- digits range from 0 to 1) numbers. In fact, hexadecimal numbers are the reason the v registers get their names.

When using Octo, numbers are decimal by default. If you start a number with "0x" you mean it is in hexadecimal:

	0xA9

If you start a number with "0b" you mean it is in binary:

	0b10100101

The largest two-digit number in hexadecimal (or *hex* for short), 0xFF, is 255 in decimal. That means the v registers can hold any two-digit hex number. The largest eight-digit number in binary, 0b11111111, is also 255 in decimal. That means the v registers can hold any 8 digit number in binary. Binary digits are often called *bits*, and since Chip8 works with 8 bits at a time it would be called an 8-bit computer. A *byte* is a common name for 8 bits.

Now that we understand hex and binary, we can explain how the images in the previous section worked. if we convert the decimal numbers for the first "image" into binary, they look like this:

	0b00111100
	0b01111110
	0b11011011
	0b11111111
	0b10111101
	0b11000011
	0b01111110
	0b00111100

If you squint, you can probably make out the smiley face! Every pixel that is turned on in the image when we draw it is a 1 and every pixel that is turned off is a 0 when we look at the number in binary, and every number is an 8-pixel row of a sprite.

Try making your own sprite images using binary, or use the sprite editor built into Octo to draw a sprite and get the corresponding hex numbers (or vice versa).

Animation
---------
We know how to draw sprites on the screen. To make animations we draw one or more sprites on the screen, erase some or all of the screen, redraw a slightly different scene and then repeat. You'll want to set Octo's emulation speed to "7 Cycles/Frame", it's lowest speed, so you can clearly see the animation take place in very short programs.

To erase everything on the screen, use the statement `clear`. The statements `loop` and `again` are how we write a program that does something over and over. Normally, statements are carried out one after another, from the top of the program to the bottom. When `again` is encountered, Chip8 will skip back to the matching `loop` and resume from that point. Let's look at an example:

	: arrow
		0x38 0x38 0x38 0xFE 0x7C 0x38 0x10

	: main
		i  := arrow
		va := 30 # the arrow's horizontal position
		vb :=  5 # the arrow's vertical position

		loop
			clear
			sprite va vb 7
			vb += 1
		again

Two of the lines in this program have a `#` symbol- this is called a *comment*. The computer ignores the rest of a line after the `#` and anything written there is for a human reader. Comments can be very helpful for explaining the meaning behind parts of your program or leaving yourself reminders for later. You can also "comment out" sections of statements by placing `#` symbols in front of them if you wish to temporarily (and reversibly) remove them from your program.

This program first sets up registers to get ready to draw an arrow at an initial position on the screen (30 pixels over, 5 pixels down). Then we see a `loop` which marks the beginning of the instructions we will carry out repeatedly. `clear` erases the screen, `sprite` draws an arrow and then the number in register `vb` is increased by 1. Then we encounter `again` and we resume with `clear`. Since we change `vb` (the vertical position of the arrow) each time, the arrow appears to move from the top of the screen to the bottom. You'll also notice that as the sprite is drawn off the edge of the screen it automatically "wraps" around to the opposite edge.

If we were to change the contents of the registers differently we could make the arrow move in a different direction:

	: arrow
		0x20 0x71 0xFB 0x7F 0x3F 0x1F 0x3F 0x7F

	: main
		i  := arrow
		va :=  0 # the arrow's horizontal position
		vb :=  0 # the arrow's vertical position

		loop
			clear
			sprite va vb 8
			va += 2
			vb += 1
		again

Try changing this program to move a sprite in a different direction, or to draw more than one moving object.

Making Decisions
----------------
Computers are good at doing arithmetic. The other thing they're good at is making simple decisions. By combining these abilities, we can write programs that carry out complex tasks.

Making decisions uses the `if` statement. The word `if` is followed by a comparison between registers or a register and number, the word `then` and then some other statement. If the comparison is *true* then the other statement is carried out. If the comparison is *false* then the other statement is skipped. Here are some examples:

	if v0 == 4  then v1 += 1
	if v2 != v9 then clear

The symbols `==` are read as "is equal to". This first `if` statement will be true if the number in the register `v0` is equal to the number 4, and if this is the case we will add 1 to the value in register `v1`. The symbols `!=` are read as "is not equal to". This second `if` statement will be true if the number in the register `v2` is not the same as the number in the register `v9`, and if this is the case then we will clear the screen.

Let's try to make a program similar to our earlier animations, with a ball that moves from left to right. The ball will bounce up and down, reversing direction every time it 'hits' the top or bottom of the screen.

	: ball
		0x3C 0x7A 0xFD 0xFF 0xFF 0xFF 0x7E 0x3C

	: main
		i  := ball
		va := 32 # the ball's horizontal position
		vb := 12 # the ball's vertical position
		vd :=  1 # the ball's vertical direction

		loop
			clear
			sprite va vb 8

			va += 1
			vb += vd
			if vb == 24 then vd := 255
			if vb ==  0 then vd :=   1
		again

Our program starts the same way as the earlier one- we set up registers to position the ball. We also use the register `vd` to keep track of whether the ball is moving up or down. In our "animation loop" we clear the screen, draw the sprite and then update the ball's position. The horizontal position always increases by 1, but the vertical position increases by a number stored in `vd`. If `vd` contains 1, (as it does initially), the ball moves down. if the ball, which is 8 pixels tall, reaches the 24th pixel down it will appear to be touching the bottom of the screen. This is where the first `if` statement comes in. When the ball appears to be touching the bottom of the screen, `vd` is set to 255. Adding 255 to a register is the same as subtracting 1, because numbers wrap around. This means that once we change `vd` to 255 the ball will appear to move up. The second `if` statement will trigger when the ball appears to be touching the top of the screen and sets `vd` back to `1` so that the ball moves down again.

Try modifying this program so that the ball bounces back and forth horizontally instead of vertically.

Player Control
--------------
The final thing we need to know how to do in order to make simple games is *input*- when the player presses a key on the keyboard they should be able to make something happen.

There are two ways to do this in Chip8. The first way waits for a player to press a key on the keyboard and stores a number in a register. Then we can examine that register to make something happen. The statement for reading a key looks like this:

	v0 := key

The number that will be stored in a register will be a hex digit from 0-F corresponding to the Chip8 keypad. Here's how Chip8 keys are represented on your keyboard:

	Chip8 Key   Keyboard
	---------   ---------
	 1 2 3 C     1 2 3 4
	 4 5 6 D     q w e r
	 7 8 9 E     a s d f
	 A 0 B F     z x c v

This means that if you pressed the "d" key on your keyboard it would leave the number 9 in the register you chose. Let's make a program which draws a person and makes them face left or right when A or D is pressed:

	: facing-left
		0x18 0x38 0x18 0x3C 0x7E 0x7E 0xBD 0xBD 0xA5 0x24 0x24 0x6C

	: facing-right
		0x18 0x1C 0x18 0x3C 0x7E 0x7E 0xBD 0xBD 0xA5 0x24 0x24 0x36

	: main
		i  := facing-left
		v0 := 30
		v1 := 12
		loop
			clear
			sprite v0 v1 12
			v2 := key
			if v2 == 7 then i := facing-left
			if v2 == 9 then i := facing-right
		again

The other way to handle player input allows you to check whether a given key is pressed or not. This is useful when you want to make an action game where the world continues to animate even if you stop pressing keys or if you want to allow multiple keys to be pressed at once.

This type of checking can be used directly in an `if` statement by stating a register and then `key` or `-key`:

	if v0  key then v1 += 1
	if v0 -key then v3 := 5

A comparison like `v0 key` is true if the key corresponding to the number in the register `v0` is currently pressed down. The comparison `v0 -key` will be true if the key corresponding to the number in the register `v0` is *not* pressed down.

Here is a simple program which allows the player to draw a line on the screen by moving a cursor with ASWD on the keyboard:

	: dot
		0b10000000

	: main
		i  := dot
		v0 := 10
		v1 := 10
	
		loop
			sprite v0 v1 1
			v2 := 7 if v2 key then v0 += 255 # left
			v2 := 9 if v2 key then v0 +=   1 # right
			v2 := 5 if v2 key then v1 += 255 # up
			v2 := 8 if v2 key then v1 +=   1 # down
		again

Note that the line is left behind because the `clear` statement is not used. Since we check each key individually, diagonal lines can be drawn if two directional keys are held at once.
 
Subroutines
-----------
So far, we've seen two reasons for using a label: saying where our program begins with a label called `main`, and giving a name to data. Another way we can use labels is to give a name to a *subroutine*. A subroutine is a small program that we can "call" from our main program. When the subroutine is finished, the computer will "return" to the place from which the subroutine was called.

That probably sounds a bit abstract, so let's look at an example:

	: image
		0xFF 0x81 0xA5 0x81 0xBD 0x81 0xFF

	: draw
		i := image
		sprite v0 v1 7
		v0 += 9
		v1 += 2
	;

	: main
		draw
		draw
		draw

When you run this program, you will see three images drawn along a diagonal line. Starting from `main`, using the word `draw` will call the subroutine beginning at that label. The subroutine sets the `i` register, draws a sprite, and then adds to `v0` and `v1`. The `;` statement (a semicolon, not to be confused with `:`!) indicates the end of the subroutine, returning us back to "main". Having completed the first `draw`, our program will proceed to the second, carrying out all the same steps, and when the subroutine returns we can proceed to the third.

Defining a subroutine has given us a different way of repeating things than `loop`s!

Now, consider this alternate program:

	: image1
		0xFF 0x81 0xA5 0x81 0xBD 0x81 0xFF

	: image2
		0xFF 0x81 0xE7 0x81 0x81 0x99 0xFF

	: draw1
		i := image1
		sprite v0 v1 7
		v0 += 9
		v1 += 2
	;

	: draw2
		i := image2
		sprite v0 v1 7
		v0 += 9
		v1 += 2
	;

	: main
		draw1
		draw1
		draw2
		draw1

Now we have two subroutines, each for drawing a different object on the screen. The subroutines `draw1` and `draw2` are identical except for their first instruction. A different way of writing this program might look something like the following:

	: image1
		0xFF 0x81 0xA5 0x81 0xBD 0x81 0xFF

	: image2
		0xFF 0x81 0xE7 0x81 0x81 0x99 0xFF

	: draw
		sprite v0 v1 7
		v0 += 9
		v1 += 2
	;

	: main
		i := image1
		draw
		draw
		i := image2
		draw
		i := image1
		draw

There are often many different ways to break down repeated parts of your program into subroutines- experiment, and see what seems clearest!

Remember: every subroutine starts with a label and ends with a semicolon. The statement `return` is identical in meaning to `;`. That last `draw` subroutine could also be written as:

	: draw
		sprite v0 v1 7
		v0 += 9
		v1 += 2
		return
