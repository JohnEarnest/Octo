
# Note the SDL2 license terms if distributing:
# http://www.libsdl.org/license.php

# Building on OSX:
# - ensure you have the latest XCode
# - brew install sdl2
# - make

ROM = blackrainbow.ch8
EXE = doct

all: doct.cpp
	(echo "static uint8_t rom[] = {"; hexdump -ve '/1 "0x%02x,"' $(ROM) ; echo "};") > rom.h
	clang++ -Weverything -c doct.cpp -o doct.o
	clang++ -L/usr/local/lib -lSDL2 doct.o -o $(EXE)

clean:
	rm *.o
	rm rom.h
	rm $(EXE)
