Octo
====

![Title Image](https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/images/f8z.gif)

[Octo](http://johnearnest.github.io/Octo/) is a high-level assembler for the [Chip8](http://mattmik.com/chip8.html) virtual machine, complete with an environment for testing programs. The Chip8 keypad is represented on your keyboard as follows:

	Chip8 Key   Keyboard
	---------   ---------
	 1 2 3 C     1 2 3 4
	 4 5 6 D     q w e r
	 7 8 9 E     a s d f
	 A 0 B F     z x c v

Links
-----
General information:

- [Language Manual](https://github.com/JohnEarnest/Octo/tree/gh-pages/docs/Manual.md)
- [Beginner's Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/BeginnersGuide.md)
- [Intermediate Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/IntermediateGuide.md)
- [Programming Techniques Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/Chip8%20Programming.md)
- [SuperChip Extensions](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/SuperChip.md)
- [XO-Chip Extensions](https://github.com/JohnEarnest/Octo/tree/gh-pages/docs/XO-ChipSpecification.md)
- [Octo Programming Google Group](https://groups.google.com/forum/#!forum/octo-programming)
- [OctoJam](http://www.awfuljams.com) an Octo-centric game jam held every October.

Third-party tools and references:

- [Mastering Chip-8](http://mattmik.com/chip8.html) the most accurate Chip-8 reference online.
- [HP48 SuperChip](https://github.com/Chromatophore/HP48-Superchip) research into the quirks and behavior of SuperChip.
- [Sublime Text syntax definitions](https://github.com/mattmikolay/octo-sublime)
- [Atom syntax definitions](https://github.com/james0x0A/language-octo)
- [Vim syntax definitions](https://github.com/jackiekircher/vim-chip8)
- [VSCode syntax definitions/integration](https://github.com/hoovercj/vscode-octo)
- [OctoFont](https://github.com/jdeeny/octofont) .TTF font converter.
- [wernsey chip8](https://github.com/wernsey/chip8) an alternative assembler/disassembler.

Third-party games, programs and libraries:

- [KNIGHT](https://github.com/simonklitjohnson/Knight) by Simon Klit-Johnson. (Game)
- [OCTOPEG](https://github.com/Chromatophore/Octopeg) by Chromatophore. (Game)
- [Masquer8](https://github.com/Chromatophore/Masquer8) by Chromatophore. (Game)
- [Glitch Ghost](https://github.com/jackiekircher/glitch-ghost) by Jackie Kircher. (Game)
- [CosmacCalc](https://abitoutofplace.wordpress.com/2015/05/02/cosmaccalc-the-cosmac-vip-s-place-in-spreadsheet-history/) a COSMAC VIP spreadsheet built with Octo.
- [Misc Samples](https://github.com/buffis/misc-samples/tree/master/Octo) small programs by Björn Kempen.
- [Stack](https://github.com/jackiekircher/stack.8o) reusable stack data structure.
- [Chip8-multiply](https://github.com/jdeeny/chip8-multiply) reusable multiplication routines.
- [Octo-Lfsr64](https://github.com/jdeeny/octo-lfsr64) reusable PRNG implementation.

If you've built a project on, with, or for Octo and you'd like to have a link added to this list, submit a pull request!

Command Line Mode
-----------------

The Octo assembler can also be used as a command-line tool via a [Node.js](http://nodejs.org) frontend:

	$ ./octo
		usage: octo [--decompile] [--roundtrip] [--qshift]
			[--qloadstore] <source> [<destination>]
	$ cat simple.8o
		: main
			va := 1
			vb := 2
	$ ./octo simple.8o simple.ch8
	$ hexdump simple.ch8
		0000000 6a 01 6b 02                                    
		0000004

The `--decompile` option can be used to send an existing Chip8 binary through Octo's general-purpose decompiler.

Embedded Mode
-------------

Octo has a `share` feature which stores source code and configuration metadata in Github gists. Following one of these links will run the program and then you can back out into the Octo IDE. Alternatively, you can use these urls to embed a Chip8 emulator in an `iframe` on your websites:

	<iframe
		src="http://johnearnest.github.io/Octo/embed.html?scale=2&gist=f3685a75817cde6d5c0d"
		width="256"
		height="128"
	></iframe>

(Special thanks to rmmh.)

The `scale` argument is optional and specifies the number of pixels which should make up a high-resolution mode Chip8 pixel. Low-resolution mode pixels will be twice this size.

Licensing
---------
Octo, along with all its associated documentation, examples and tooling, are made available under the MIT license. See LICENSE.txt for additional details. If for any reason this is insufficiently flexible or permissive for some application, please contact John Earnest with your request. Contributions to this repository are welcome, with the understanding that they will fall under the same licensing conditions.
