CHIP-8 Development FAQ:
=======================
Can't figure something out based on the Octo [Reference Manual](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/Manual.md) or [other documentation](https://github.com/JohnEarnest/Octo#links)? You're in the right place.

How do I read from memory?
--------------------------
Let's look at some simple use cases. First, say you have a single byte in memory and you want to load it into a register:
```
: data  0xAB
...
i := data     # set i to the base address
load v0       # load from i into v0
```

Slightly more complex: you have an array of up to 256 bytes, and you want to load one by index into a register:
```
: data  1 1 2 3 5 8 11
...
i := data    # set i to the base address
i += v1      # add an offset (in this case, the value in v1)
load v0      # load data[v1] into v0
```

Same as before, but now we want 2 bytes:
```
i := data    # set i to the base address
i += v1      # add an offset. items are two bytes wide...
i += v1      # (we alternatively could have pre-doubled v1.)
load v1      # v0=data[2*v1], v1=data[(2*v1)+1]
```

Notice how `load` loads data into a range of registers from `v0` up to `vN`. Writing to memory with the `save` instruction works the same way:
```
i  := data   # set i to the base address
i  += v1     # add an offset
v0 := 0xAB   # the value we want to write goes in v0
save v0      # data[v1]=v0
```

If you're using XO-CHIP instructions, you can read or write using any contiguous range of registers, instead of always starting with `v0`:
```
i := data    # set i to the base address
i += v1      # add an offset
load ve - ve # ve=data[v1]
```


How do I decide what registers to use?
--------------------------------------
Most of the CHIP-8 registers can be used for any purpose, but there are a few useful rules of thumb:

- `vF` is is altered by many instructions as a "carry flag" and to report collisions after a `sprite` instruction. You _can't_ save anything important in here long-term!
- `v0` is always used by `load` and `save`, as well as `jump0`. If you want to work with memory or use `jump0`, you _must_ keep `v0` available as a temporary register.
- Since `load` and `save` operate on a range of low registers, it's best to organize your use of registers from most to least persistent- `vE,vD,VC...` should contain information that tends to remain useful for the whole lifetime of a program, while `v0,v1,v2...` should contain information that is relevant only to a local subroutine. In practice you should probably reserve `v0`, `v1`, and perhaps `v2` as temporary working registers.
- Use `:alias` to give high registers meaningful names- you'll thank yourself later when you have to reorganize your register layout!

If you're using XO-CHIP instructions, `load` and `save` can work on any range of registers, which means pressure on `v0` and `v1` is lighter. You might find it useful to reserve `vE` as a temporary register, since `vE` and `vF` can then be used together for copying around 16-bit pointers!


My program is over 3584 bytes, and it's crashing. What's happening?
-------------------------------------------------------------------
CHIP-8 has a 4kb address space, and the bottom 512 bytes of that are reserved, for historical reasons. If you use XO-CHIP, Octo gives you a much larger 64kb address space. However, there are still limitations in how that memory is used.

The instructions `jump NNN`, `:call NNN`, `jump0 NNN` and `i := NNN` only have space for a 12-bit immediate address. You cannot `jump` to an address outside the low 4kb of RAM! Octo's control structures like `if ... begin ... else ... end` and `loop ... again` use the `jump` instruction, so you can't have the head of a loop outside the low 4kb, either!

Sometimes XO-CHIP documentation will talk about the low 4kb of RAM as "code RAM", since any code can go there freely, and the other 60kb of RAM as "data RAM". XO-CHIP programs should try to organize their data (graphics, audio, level data, etc.) in data RAM, and save space in code RAM for... code! If a label is outside code RAM, it will be necessary to use `i := long NNNN` to reference it instead of `i := NNN`.

If you think your program's code may not fit in code ram, you can check by adding an assertion:
```
:assert "overflowed code RAM" { HERE < 4096 }
```


My program crashed with "breakpoint: call stack overflow". What gives?
----------------------------------------------------------------------
CHIP-8 has a very limited call stack. Every time you make a subroutine call, the return address is stored on this stack, and then later removed when you execute a `return` (`;`). CHIP-8 on the COSMAC VIP had a 12-level stack, and SCHIP and XO-CHIP offer a 16-level stack. This is enough for many complex and interesting programs, but it means that recursion should be used sparingly, if at all, on this platform.

If you get a stack overflow on the first run of your program, it _might_ genuinely be exhausting the stack. In this case, refactor your code by inlining some subroutines, and make sure you haven't accidentally "fallen through" the end of a subroutine by leaving off a terminal `return` (`;`).

A common error in writing CHIP-8 games is to have "game over" conditions determined somewhere deep in subroutine calls, and then immediately `jump` back to the `main` label. This will leave "junk" return addresses on the stack, which build up over the course of multiple game-overs until the program crashes. You can use the stack display in the register monitor (press `i` at any time during program execution) to see if this is the case. If so, restructure your "game over" code to set a flag of some kind which can trigger the game restart at the top level of your game loop, instead of from within a subroutine call.



I'm running out of space. How do I shrink my program?
-----------------------------------------------------
In general, if you want to make a program use less space, _do less_. Try replacing general routines with simpler, purpose-specific ones. Discard anything that doesn't pay for itself.

- Any time your program contains a subroutine call followed by a `return` (or `;`), replace the subroutine call with a `jump`- this process is called [Tail Call Elimination](https://en.wikipedia.org/wiki/Tail_call).
- Don't use `if ... begin ... end` when `if ... then` will do- the former has to produce a `jump`, which costs 2 extra bytes.
- Similarly, avoid the comparison pseudo-operationss (`<`,`>`,`<=`, and `>=`) if `!=` or `==` would work instead; the pseudo-ops each cost 4 extra bytes.
- If a macro is used in many places, consider refactoring it into a subroutine instead.
- Make your program more data-oriented. Can you replace a nest of conditional statements with a lookup table?
- Try overlapping your data. Re-use the same memory for multiple arrays you never need at once. Done using the graphics for a title screen? Overwrite them with a scratch buffer.
- Try overlapping your data with code. Do any of the instructions in your program happen to look like data or graphics your need elsewhere? Could you change your code to make some happy coincidences occur?
- Quantize brutally. Re-design your program to simplify the actions a user can take, and in turn the cases it must handle.
- On SCHIP and XO-CHIP, you can overwrite `0x000-0x200`, provided you don't intend to use the built-in hexadecimal font(s). This region is a perfect place to put any scratch buffers.


My program is too slow. How do I speed my program up?
-----------------------------------------------------
In general, if you want a program to be faster, _do less_. Try replacing general routines with simpler, purpose-specific ones. You can trade space for time. Macros are useful for generating repetitive machine code while keeping your source files [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself):

- "Unroll" a loop into a fixed sequence of operations, saving a conditional and `jump` for each loop iteration.
- "Inline" subroutines by substituting their bodies into call sites, saving a `:call` and `return`. Sometimes when you inline a subroutine, you'll realize there's other book-keeping instructions that can be removed.

Reconsider your register choices. Are you making use of all your registers? Can you avoid recomputing something (or loading it from memory again) by stashing it in an available register? Sometimes it's worth it to reserve some registers simply to always have a useful constant on hand. Initialize registers in a batch. `i := NNN  load vf` can fill 16 registers in 2 cycles.

Instead of making a decision inside a hot loop, could you hoist the decision outside the loop? This might require you to split the loop into two or more alternate versions. Alternatively, could you use self-modifying code to rewrite part of the loop up-front?

Try replacing elaborate computation with [lookup tables](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/MetaProgramming.md#lookup-tables).

While a program is running, you can press `p` to open Octo's profiler, and get an idea of how much time is spent in each subroutine.


Octo's error checking sucks! I shouldn't be allowed to ____!
------------------------------------------------------------
That isn't a question.

Octo assembly is a very flexible and low-level language, which means there isn't always enough information to disambiguate between careless errors and clever hacks. When the tradeoff is necessary, Octo errs on the side of allowing experts to write sophisticated programs, rather than preventing beginners from shooting themselves in the foot. Sometimes features have limitations and constraints arising from their interaction with other language features, or the design of CHIP-8 itself.

If you encounter an error message which seems wrong or misleading, and you see an actionable way to improve it, file a bug report on [Octo's GitHub repository](https://github.com/JohnEarnest/Octo#command-line-mode). Please include the simplest program you can devise which illustrates the problem.


Why don't the arithmetic comparison operators (comparators) seem to do the right thing?
---------------------------------------------------------------------------------------
Octo provides synthetic "pseudo-operations" for the arithmetic comparisons `<`,`>`,`<=`, and `>=`, since they are useful for clarifying the intent of code. It is important to keep in mind that these comparisons are _unsigned_. While Octo will happily allow users to store immediate values like `-1` in a v-register as its [two's-complement](https://en.wikipedia.org/wiki/Two%27s_complement) representation (`0xFF`), two's-complement is _merely a state of mind_. `0xFE` is greater than `0x03`, even if you intend for those values to mean -2 and 3, respectively.

If you want to compare values that could be "negative", consider storing them with an added bias.


I'm trying to do 16-bit math. Why isn't the carry flag working?
---------------------------------------------------------------
Say you're incrementing a 16-bit counter. Are you doing something like this?
```
v0 += 1   # increment low byte
v1 += vf  # carry into the high byte
```

The behavior of that snippet is _totally undefined_, because `v0 += 1` will _never alter the carry flag_. The fact that it may appear to work, sometimes, is all the more infuriating. You meant to do this, instead:
```
vf := 1   # put 1 in a temporary register
v0 += vf  # increment low byte with our constant 1
v1 += vf  # carry into the high byte
```


How do I produce a No-Op?
-------------------------
The simplest choice is an instruction of the form `vx := vx`, like `v0 := v0`. Instructions of the form `vx += 0` work, too- adding an immediate value to a v-register does not alter the carry flag `vf`.

Logic operations like `vx &= vx` are probably a bad idea. On the COSMAC VIP, these operations may alter the carry flag, even though this behavior was never officially documented.


How do I use pointers?
----------------------
In the simplest cases, just _don't_! Many programs that would need pointers in a language like C++ could instead be re-designed around simple array offsets. Give it a try! Avoid writing code that is more general than strictly necessary, and look for the simplest and smallest solution.

The `jump0` instruction can be used to perform subroutine dispatch or initialize `i` from a table:
```
: main
	v0 := 1
	get-address
	:breakpoint got-address

: address-table
	i := 0xAAA  return
	i := 0xBBB  return
	i := 0xCCC  return
	i := 0xDDD  return

: get-address
	v0 += v0 # table entries are 4 bytes,
	v0 += v0 # so double the index twice
	jump0 address-table
```

If you really need indirection, the most general approach is self-modifying code. You can overwrite a `:call` or `i := NNN` in-place, for example:
```
: main
	v0 := 1
	get-address
	:breakpoint got-address

: address-table
	i := 0xAAA
	i := 0xBBB
	i := 0xCCC
	i := 0xDDD

: get-address
	i := address-table
	i += v0 # table entries are 2 bytes,
	i += v0 # so add the index twice
	load v1
	i := address-slot
	save v1
: address-slot
	0x00 0x00
;
```

Self-modifying code is especially handy if you want to access the same "pointer" repeatedly in a loop- you only need to overwrite the instruction _once_. Read up on `:unpack` and `:next` for more help setting up self-modifying code.

If you need to _store_ a 16-bit pointer somewhere, a macro can be helpful:
```
:macro pointer ADDRESS {
	:byte { ADDRESS >> 8 }
	:byte { ADDRESS }
}
```

And likewise if you need to place a 16-bit pointer in registers, a macro can do the needful:
```
:macro unpack ADDRESS {
	:calc hi { 0xFF & ADDRESS >> 8 }
	:calc lo { 0xFF & ADDRESS }
	v0 := hi
	v1 := lo
}
```


How do I keep my program from flickering?
-----------------------------------------
The CHIP-8 virtual machine updates the display after executing some number of instructions. This speed varies, based Octo's settings. 15 cycles per frame is fairly realistic for CHIP-8 on a [COSMAC VIP](https://en.wikipedia.org/wiki/COSMAC_VIP), and 30 is realistic for SCHIP running on an [HP-48](https://en.wikipedia.org/wiki/HP_48_series). XO-CHIP programs can run at an arbitrary speed, but 200 or so is enough for many interesting programs.

If an object is drawn on the screen some frames, and missing other frames, it will appear to flicker. This may be a sign that your program is running too slowly or, sometimes, too quickly! To make programs run consistently on different emulators and execution speeds, it's a good idea to use the `delay` timer to burn off any excess time available at the end of a frame:
```
loop
	# count down 1/60th of a second:
	vf := 1
	delay := vf

	# your main loop body goes here...

	# if we've spent less than 1/60th of a second,
	# loop until the timer decrements:
	loop
		vf := delay
		if vf != 0 then
	again
again
```

Some other ideas for minimizing flicker:
- Increase emulation speed. Faster updates will often outright hide flicker. Some example programs suggest an appropriate speed to be run at; if the interpreter is too slow for a program, games will get sluggish and flicker more.
- Minimize how much of the display you're redrawing on each frame. Using `clear` and redrawing everything each time is usually not a good approach for an action game. Use the xor-drawing feature of sprites to erase just the parts of the display you want to change before redrawing them.
- Minimize how long objects are erased for before being redrawn. The longer the gap between erasing and redrawing a sprite, the larger the chance it will look flickery. With specially-prepared sprites, it may be possible to "xor" the next frame of animation on top of the old one without erasing, giving buttery-smooth animation on even slow interpreters.

The [EZ-Pack](http://beyondloom.com/tools/ezpack.html) utility can prepare an animation with each frame XORed with the previous.


How do I add large graphics to my program?
------------------------------------------
If you have a `.PNG` or `.GIF` file with your desired image data, you can use [EZ-Pack](http://beyondloom.com/tools/ezpack.html) to cut it up into CHIP-8-sprite-sized chunks and produce data ready to copy and paste into your program. If you check _Template Code_, _EZ-Pack_ will even generate example code for drawing your data!

If you want SCHIP-style 16x16 sprites, set the "Sprite Size" field in _EZ-Pack_ to `0`, just as if you were using the `sprite` instruction in Octo.

If you want graphics which are easily created/described through code, take a look at [EZ-Bake Animator](http://beyondloom.com/tools/ezbake.html). This tool allows you write JavaScript and create Octo-ready quantized 1-bit bitmaps and animations. The [Octojam 7 Greeting Card](https://github.com/JohnEarnest/chip8Archive/blob/master/src/octojam7title/octojam7title.8o#L67) was created, in part, with _EZ-Bake Animator_.


How do I display a number?
--------------------------
The `bcd` and `i := hex vx` instructions might be useful. Here's an example for printing out a 2-digit decimal counter based on a value from 0-99 in v3:
```
: main
	v3 := 42
	i := hundreds
	bcd v3
	i := tens
	load v0
	i := hex v0
	sprite v1 v2 5
	v1 += 5
	i := ones
	load v0
	i := hex v0
	sprite v1 v2 5
	loop again

: hundreds 0
: tens     0
: ones     0
```

The `bcd` instruction can decode a 3-digit value from 0-255, but if you need larger counters it is often simpler to store 2 digits in each byte (as shown here) or a single digit per byte (which removes the need for `bcd`).

On SCHIP, don't forget that `i := bighex vx` is an option!


How do I draw text (a string)?
------------------------------
This is a very, _very_ expansive question, and the answer will depend on your requirements. Let's look at a few ideas!

In the simplest cases, you can draw text like any other graphics- just make a bitmap and draw it with `sprite`:
```
: main
	i := text
	sprite v0 v1 11
	loop again
: text
	0x88 0x88 0xF8 0x88 0x88 0x00 0xF8 0x20 0x20 0x20 0xF8
```

If you have a very small amount of text, but you want to re-use the graphics for letters, you might write a `:stringmode` macro like this:
```
: font
	0x00 0x70 0x88 0x80 0x70 0x08 0x88 0x70 0x00 # S
	0x00 0x70 0x88 0x88 0x88 0x88 0x88 0x70 0x00 # O
	0x00 0x88 0xD8 0xA8 0x88 0x88 0x88 0x88 0x00 # M
	0x00 0xF8 0x80 0x80 0xF0 0x80 0x80 0xF8 0x00 # E
	0x00 0xF8 0x20 0x20 0x20 0x20 0x20 0x20 0x00 # T
	0x00 0x88 0x50 0x20 0x20 0x20 0x50 0x88 0x00 # X

:stringmode print-unrolled "SOMETX" {
	:calc addr { font + VALUE * 9 }
	i := addr
	sprite v0 v1 9
	v0 += 6
}
:stringmode print-unrolled " " {
	v0 += 6
}

: main
	print-unrolled "SOME TEXT"
	loop again
```

The above approach can quickly consume a great deal of RAM, since it emits 6 bytes of CHIP-8 code per character. If you want to print more than a few words this way, you'll want to write something more general:
```
: font
	0x00 0x70 0x88 0x80 0x70 0x08 0x88 0x70 0x00 # S
	0x00 0x70 0x88 0x88 0x88 0x88 0x88 0x70 0x00 # O
	0x00 0x88 0xD8 0xA8 0x88 0x88 0x88 0x88 0x00 # M
	0x00 0xF8 0x80 0x80 0xF0 0x80 0x80 0xF8 0x00 # E
	0x00 0xF8 0x20 0x20 0x20 0x20 0x20 0x20 0x00 # T
	0x00 0x88 0x50 0x20 0x20 0x20 0x50 0x88 0x00 # X
	0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 # space

:stringmode str "SOMETX " { :byte { VALUE * 9 } }
:stringmode str "\0"      { :byte 0xFF }

: print-string
	loop
		i := the-string # rewrite this in-place to dispatch multiple strings...
		i += v3
		v3 += 1
		load v0
		while v0 != 0xFF
		i := font
		i += v0
		sprite v1 v2 9
		v1 += 6
	again
;

: the-string
	str "SOME TEXT\0"
: main
	print-string
	loop again
```

If your program contains a large amount of text, and especially if you want lines to be wrapped to fit nicely on the CHIP-8 display, you might find [EZ-Writer](http://beyondloom.com/tools/ezwriter.html) useful. See the manual linked on the _EZ-Writer_ page for more info, and examples.


How do I prompt the user to press "any key"?
--------------------------------------------
The simplest approach is to use blocking input:
```
v2 := key
```

That approach won't work if you want animation or other action happening while the program waits for input. Otherwise, you might need a loop:
```
: main
	loop
		# simple animation:
		sprite v0 v1 5
		v0 += 2
		v1 += 3
		# check keys:
		vf := 0
		loop
			if vf key then jump done
			vf += 1
			if vf != 16 then
		again
	again
: done
	:breakpoint pressed-any-key
```

Alternatively, design around the problem entirely- just prompt the user to press "E", for example! Consider "debouncing" input to ensure that the user performs a full press-and-release:
```
vf := OCTO_KEY_E
loop if vf  key then again   # wait for release,
loop if vf -key then again   # wait for press,
loop if vf  key then again   # wait for release
```


I wrote a CHIP-8 program, but didn't use Octo. Can I still make a standalone HTML page?
---------------------------------------------------------------------------------------
In the _Binary Tools_ panel of the toolbox, choose "Open .ch8..." and select your pre-existing CHIP-8 ROM. This will load the file and display its contents as a hex dump in the field above.

Create a minimal Octo program- A `main` label followed by the hex dump, like this:
```
: main
  0xA2 0x1E 0xC2 0x01 0x32 0x01 0xA2 0x1A 0xD0 0x14 0x70 0x04 0x30 0x40 0x12 0x00
  0x60 0x00 0x71 0x04 0x31 0x20 0x12 0x00 0x12 0x18 0x80 0x40 0x20 0x10 0x20 0x40
  0x80 0x10
```

Customize your palette in the _Appearance_ panel, adjust compatibility flags or touch controls in the _Options_ panel (as necessary), and test your program by running it. When you're satisfied, choose "Save HTML..." from the _Binary Tools_ panel, and confirm the remaining settings. Your browser will then save a file to your default download location. You may need to rename it to add a `.html` extension.


How do I make a nice-looking label for an Octocart (Octo Cartridge File)?
-------------------------------------------------------------------------
"Nice-looking" is subjective, but we'll give it a shot.

When creating an Octocart from _Save Cartridge..._ in the _Binary Tools_ panel of the toolbox, you can click on the preview image to choose a local file. This should be a 128x64 pixel `.GIF` image, without transparency. A recording made with Octo works just fine. Black and white images work best, but Octo will do its best to re-color whatever you profide.


What do I do with an Octocart?
------------------------------
An Octocart is a perfectly ordinary animated GIF image which steganographically encodes an entire Octo project. They are a convenient way to store and distribute Octo programs to those in the know.

You can open an Octocart using the "Open" button in the top bar of Octo's user interface. This will restore all the configuration details for the project stored in the cartridge, as well as the source code. (Note: you can actually do the same thing with a standalone `.HTML` export, too, provided it hasn't been folded, spindled, or otherwise mutilated!)

Alternatively, you can drag an Octocart onto the Octo window to open and immediately run it. Neat, eh?

Octo's [CLI Frontend](https://github.com/JohnEarnest/Octo#command-line-mode) can also suck the source code and configuration details out of an Octocart.


I like Vim. Can you make Octo's editor more _correct_?
------------------------------------------------------
In the _Options_ panel of the toolbox, click "Keyboard Configuration..." and enable "Use Vim Keybindings". You will need to refresh the page for this setting to apply.


How do I run Octo programs without using a mouse like some kind of animal?
--------------------------------------------------------------------------
While in Octo's editor, pressing shift + enter will compile and run your program. While a program is running, you can press backtick (`` ` ``) to return to the editor.

If you're really serious about removing mice from your life, you might be interested in Octo's [CLI Frontend](https://github.com/JohnEarnest/Octo#command-line-mode).


How do I see the bytes of my compiled program?
----------------------------------------------
Run your program, stop it, and then click anywhere on the status bar at the bottom of the screen- this will toggle a tray with your program's raw compiled bytecode.


How do I see the contents of memory or registers while my program is running?
-----------------------------------------------------------------------------
At any time, you can drop into Octo's debugger by pressing `i` ("Interrupt"), which displays all of the registers. You can click the values of registers to cycle between a binary, decimal, or hex representation.

You can also view registers or memory by using `:monitor`. Set up some monitors, and then press `m` while the program is running to watch them change:
```
: scramble
	0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00
: main
	loop
		v1 += 1
		i  := scramble
		v0 := v1
		vf := 0b111
		v0 &= vf
		i  += v0
		v0 := random 0xFF
		save v0
	again

:monitor v1 1
:monitor vf 1
:monitor scramble 8
```
The [reference manual](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/Manual.md#debugging) has more information about `:monitor` features for controlling how data is presented.


Why is my constant being compiled as 0x20 0xNN?
-----------------------------------------------
Consider this example:
```
:const foo 0xAB
...
foo
```

When the name `foo` appears in a program, it will behave the same as a label: compiling as a subroutine call! In CHIP-8 bytecode, this looks like `2NNN`. If you want to store the constant as just a byte, use `:byte`:
```
:byte foo
```


Why doesn't my program play sound when I run it in standalone mode?
-------------------------------------------------------------------
Many web browsers do not allow JavaScript programs to start playing audio unless a user has directly interacted with a page. Octo will try to initialize audio when the user first presses a key on the keyboard or, on mobile devices, taps the display. Take this into account when designing audio for start screens and similar.

