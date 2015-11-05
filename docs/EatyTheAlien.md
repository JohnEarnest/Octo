Inside Eaty The Alien
=====================
Like I recommend in my documentation, I started this game by laying out graphics and planning a register map. I did some 128x64 mockup sketches, began slicing them and breaking out various pieces of animations. It's a little scary how quickly you chew through memory at first when you take this approach, but conservatively blocking out all the buffers and graphics you need early on makes it easy to prioritize features and get a sense of how close you are to the wire. I ended up with 153 bytes free, and I never had to sweat over carving out space to cram in something I felt was necessary.

In Cave Explorer I made use of self-modifying code in several places to keep the text drawing routines as fast as possible. In retrospect, that was serious overkill. I didn't use any self-modifying code this time around. Eaty doesn't do any general-purpose text rendering, and the only time I have to hop back and forth between two values in `i` was during the process of horizontal scroll screen transitions where I have more than enough cycles to work with. I didn't write any custom data-preparation tools for this project, so I limited myself to data structures I could easily write and edit by hand.

The world of Eaty is represented with two tables- `rooms` and `loot-data`. The former stores the graphical appearance of the overworld map- 64 bytes per room. The latter stores a list of item positions- roses, skittles, phone parts, etc- 8 bytes per room. With 5 rooms worth of data, that accounts for 360 bytes.

The overworld representation is a sequence of pairs of bytes which represent an offset into the overworld tile data and a y coordinate. The superchip `scroll-left` and `scroll-right` instructions scroll 4 pixels at a time, so for silky-smooth transitions I split all the overworld graphics into 4x15 strips, wasting half of the pixels in each contiguous sprite. In retrospect, I think I could've just scrolled 8 pixels at a time and halved the storage of those sprites without a noticeable degradation of quality. By storing Y positions per strip, I was able to get skewed overworld sprites "for free". Here's what that inner drawing loop looks like:

	v2 := 0
	v3 := 62
	loop
		this-room             # fetch address of the current room's tile data
		i += v3               # add offset
		load v1               # v0: sprite offset, v1: y position
		i := overworld-tiles
		iplus16               # multiply v0 by 16 and add to i
		scroll-right
		sprite v2 v1 15       # always draw at the left edge
		wait                  # delay for vblank so you can see it animate
		v3 += -2
		if v3 != -2 then
	again

Unskewed and skewed pits, followed by their overworld data:
![pits](http://i.imgur.com/msSnDgH.png)

	1 40    2 40    3 40    4 40 # normal
	...
	1 40    2 41    3 42    4 43 # skewed

Generalizing the game to handle larger environments would require some careful refactoring. The first four rooms vary and the final room is hardcoded- this means all the graphics data for rooms fits in a single 256-byte "page" and indexing via an 8-bit register is easy. Similar deal for the overworld tiles, but currently the tree and pit only take up 144 byte- I could have afforded to include a second type of tree or some other obstacle.

Logically the world is 1d- a looped linked list of rooms. Every 16-pixel wide strip of the overworld maps to one entry in the `loot` table, which makes displaying the item indicators very straightforward. The fifth room has fixed "loot"- the UFO pickup zone. At game initialization I then fill the lower 32 bytes of the loot table with random bytes 0-3. In pits, 1s are roses. Anywhere else (ie in an aboveground area) they'll be skittles. After placing inessentials, I do the quick-and-dirty approach for placing essential items- pick a number, check the table, make sure the location is suitable (parts go in pits, call points go on ground) and then place it:

	: try-place-part
		v3 := random 31
		is-v3-pit
		if v0 != 1 then jump try-place-part
		i := loot-data
		i += v3
		load v0
		if v0 > 3 then jump try-place-part
		i := loot-data
		i += v3
		v0 := v4 # v4 has the id of the part we're trying to place
		save v0
	;

The biggest challenge I had in writing this game was keeping the main display loop tight. A few too many cycles and I'd get a flickery HUD. I was particularly pleased with this snippet, which draws the combination of parts you're carrying or the big countdown timer, contextually. This is the reason the countdown timer is cut off-er, I mean, composed of mysterious but strangely familiar alien glyphs:

	v1 := -10
	i := part-tiles
	i += inventory
	if timer != 0 then i := bighex timer
	sprite v1 v1 8

There's still room for improvement- particularly avoiding redrawing all those life counter digits every frame- but I had to prioritize and work with the time I had. For anyone else trying to write a complex game in a tight cycle budget I'd recommend trying to draw life or score as bars rather than digits.

I think making a larger game world than this one is eminently possible, even without sacrificing too many graphics- coarser scrolling for the overworld could have halved both the size of my overworld tiles and the amount of data needed per room. Loot tables could have been byte-packed; I only used a handful of distinct values for each entry. There are probably a few hundred bytes to squeeze out by aliasing work buffers with initialization code, factoring reused code more aggressively and replacing a few "empty" sprites with special cases in code. The biggest challenge is always going to be representing more variety, so tricks like sprite skewing to get more mileage out of limited graphics data are helpful. I'd really like to see more attempts at roguelikes or adventure games on the chip8 platform- with cleverness and care you may be surprised how much you can pack into 3.5kb.
