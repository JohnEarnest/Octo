Doct
====
Doct allows you to bundle programs developed with Octo into standalone native executables via an emulator stub written using C++ and the broadly available graphics library [SDL2](https://www.libsdl.org/download-2.0.php).

Editing `Makefile` allows you to configure the .ch8 rom file you wish to bundle:

    ROM = blackrainbow.ch8
    EXE = doct

Editing `doct.cpp` permits configuration of quirks modes, palette and other relevant settings:

    #define QUIRKS_SHIFT  false
    #define QUIRKS_MEMORY false
    #define QUIRKS_ORDER  false
    #define QUIRKS_JUMP   false
    #define QUIRKS_CLIP   false

    #define FULLSCREEN      true
    #define WINDOW_TITLE    "Doct 0.0"
    #define SCREEN_SCALE      3
    #define CYCLES_PER_FRAME 30

    static const uint32_t palette[] = {
    	0xFF996600, // background
    	0xFFFFCC00, // plane 1
    	0xFFFF6600, // plane 2
    	0xFF662200  // blended
    };

When you've prepared your .ch8 rom file and configured Doct to your liking, simply build with `make`:

    $ make
    (echo "static uint8_t rom[] = {"; hexdump -ve '/1 "0x%02x,"' blackrainbow.ch8 ; echo "};") > rom.h
    clang++ -Weverything -c doct.cpp -o doct.o
    clang++ -L/usr/local/lib -lSDL2 doct.o -o doct
    $ ./doc

The following features are planned. Feel free to help out:

- Windows/Linux compilation (with instructions)
- Audio output
- Filesystem-backed preservation of flag registers
- Support for gamepad input and arrow keys/space aliased to ASWD/E
