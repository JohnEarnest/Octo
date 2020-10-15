Octo
====

![Title Image](https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/images/f8z.gif)

[Octo](http://johnearnest.github.io/Octo/) is a high-level assembler for the [Chip8](http://mattmik.com/chip8.html) virtual machine, complete with an environment for testing programs, and tools for sharing your creations. Read about the project on [Itch.io](https://internet-janitor.itch.io/octo)!

![IDE Screenshot](https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/images/octo-screenshot.png)

Links
-----
General information:

- [Language Manual](https://github.com/JohnEarnest/Octo/tree/gh-pages/docs/Manual.md)
- [Beginner's Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/BeginnersGuide.md)
- [Intermediate Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/IntermediateGuide.md)
- [Programming Techniques Guide](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/Chip8%20Programming.md)
- [Metaprogramming Cookbook](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/MetaProgramming.md)
- [SuperChip Extensions](https://github.com/JohnEarnest/Octo/blob/gh-pages/docs/SuperChip.md)
- [XO-Chip Extensions](https://github.com/JohnEarnest/Octo/tree/gh-pages/docs/XO-ChipSpecification.md)
- [OctoJam](http://octojam.com) an Octo-centric game jam held every October.
- [Chip-8 Archive](https://github.com/JohnEarnest/chip8Archive) A curated gallery of Chip-8 Programs.

Third-party tools and references:

- [Mastering Chip-8](http://mattmik.com/chip8.html) the most accurate Chip-8 reference online.
- [HP48 SuperChip](https://github.com/Chromatophore/HP48-Superchip) research into the quirks and behavior of SuperChip.
- [Sublime Text syntax definitions](https://github.com/mattmikolay/octo-sublime)
- [Atom syntax definitions](https://github.com/james0x0A/language-octo)
- [Emacs syntax definitions](https://github.com/cryon/octo-mode)
- [Vim syntax definitions](https://github.com/jackiekircher/vim-chip8) (Octo also has Vim keybindings; see _Options_ → _Keyboard Configuration_)
- [VSCode syntax definitions/integration](https://github.com/hoovercj/vscode-octo)
- [OctoFont](https://github.com/jdeeny/octofont) .TTF font converter.
- [wernsey chip8](https://github.com/wernsey/chip8) an alternative assembler/disassembler.
- [EZ-Bake Animator](http://beyondloom.com/tools/ezbake.html) a graphics preparation tool.
- [EZ-Writer](http://beyondloom.com/tools/ezwriter.html) a text preparation tool.
- [EZ-Pack](http://beyondloom.com/tools/ezpack.html) an image slicing/repaletting tool.

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

```
$ ./octo
usage: octo [--decompile] [--options <file.json>] <source> [<destination>]
       if <source> has a .gif extension, unpack an existing octo cartridge.
       if <destination> has a .gif extension, create an octo cartridge file.
       if <destination> has an .html extension, create a standalone HTML5 build.

$ cat simple.8o
	: main
		va := 1
		vb := 2

$ ./octo simple.8o simple.ch8

$ hexdump simple.ch8
	0000000 6a 01 6b 02
	0000004
```

The `--decompile` option can be used to send an existing Chip8 binary through Octo's general-purpose decompiler.

The `--options` option allows you to specify a JSON file with settings for all of Octo's feature flags and palette configuration, which will be used for exports and as hints during decompilation.

Sharing Your Programs
---------------------
Octo has a `share` feature which stores source code and configuration metadata and produces a URL you can share with others. By default, Octo stores programs in its own backend, indexed based on a `key`.

Using the "Save HTML" button in the "Binary Tools" panel of the toolbox, you can generate a single HTML file containing the Octo emulator and your program, allowing you to easily host a game yourself or on sites like [Itch.io](https://internet-janitor.itch.io/an-evening-to-die-for). Octo can be configured to offer adaptive multitouch controls, making your games playable on mobile devices and tablets!

![Screenshot of HTML export dialog](https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/images/html-export-screenshot.png)

Octo can also save "Cartridges" which embed programs and their metadata in an animated GIF. Cartridges are easy to share via email or image hosting sites, and include the source code of your programs, so others can riff on your creations:

![Cartridge Example](https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/images/murdercart.gif)

Finally, [Doct](https://github.com/JohnEarnest/Octo/tree/gh-pages/tools/Doct) is an experimental tool for building standalone binaries which run Octo programs. Give it a whirl!

Licensing
---------
Octo, along with all its associated documentation, examples and tooling, are made available under the MIT license. See LICENSE.txt for additional details. If for any reason this is insufficiently flexible or permissive for some application, please contact John Earnest with your request. Contributions to this repository are welcome, with the understanding that they will fall under the same licensing conditions.
