An Intermediate Guide to Game Development with Chip8
====================================================
This document builds on concepts described in the Octo readme and beginner's programming guide, and presents step by step instructions for creating a simple arcade-style game with Octo, along with the rationale behind design decisions.

First Steps
-----------
We're going to try to write a simplified recreation of the classic Atari 2600 game "Outlaw". Take a moment to find a video of gameplay online and study the mechanics.

Outlaw features two gunslingers, one on each side of the screen, who can move in four directions and fire a bullet. Bullets can be fired straight or at an angle, and angled bullets can ricochet off the top and bottom of the screen. The gunslingers are separated from one another by an obstacle in the center of the screen which can be slowly chewed away by bullets. The original game offers a number of variations on these settings, such as mobile barriers or a "target practice" mode, but for the sake of simplicity we'll stick to a single game mode.

The first step to planning a Chip8 game often comes down to graphics. After some freeze-framing of the "Outlaw" footage we can use the Octo sprite editor to put together the core decorations that will make up our display- left and right players with a "fire" and two-frame "walk" animation and a saguaro cactus. The original game had a few more frames of animation, but this should be close enough:

	: cactus 0x38 0x38 0x3B 0x1B 0x1B 0x1B 0xDF 0xDE 0xD8 0xD8 0xF8 0x78 0x18 0x1C 0x0C 
	: left   0x00 0x00 0x70 0xF8 0x70 0x67 0x7C 0x60 0x60 0x78 0x28 0xEC
	: lwalk1 0x18 0x3E 0x1C 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x66 0xC3
	: lwalk2 0x18 0x3E 0x1C 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x24 0x36
	: right  0x00 0x00 0x06 0x1F 0x0E 0xE6 0x3E 0x06 0x06 0x1E 0x14 0x37 
	: rwalk1 0x18 0x7C 0x38 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x66 0xC3
	: rwalk2 0x18 0x7C 0x38 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x24 0x6C

Note that each of the animation frames for the gunslingers are padded to 12 bytes long. Having a uniform size will make them easier to animate later, since we can just change the value of `i` appropriately before having a single `sprite` statement.

We'll also need a bullet. Mine is just a single pixel, but if you feel like having your gunslingers fire arrows or rocket-propelled grenades at one another I won't ruin your fun:

	: bullet 0x80

A Register Map
--------------
To make our game work, we'll need to keep track of various pieces of information (the game state), write rules for updating that information over time and instructions for drawing a visual representation of that information on the screen. Choosing how to represent the game world is the first set of decisions we need to make.

Chip8 has 16 v-registers, `v0`-`vf`, which we will use to store our game state. `vf` is used as a carry flag for arithmetic and is modified every time we draw a sprite, so we don't want to use it for tracking anything important. Register aliases allow us to give some of those registers more meaningful names and make our code easier to read. Let's start naming our registers from `ve` downwards.

For starters, we'll need to keep track of the player's position- the left gunslinger. Gunslingers can move in all four cardinal directions so both the x and y position of their sprite will need to be stored:

	:alias leftx      ve
	:alias lefty      vd

The player has several animation frames as they move around. If we want to alternate the walking frames we display we will need to keep track of their current frame:

	:alias leftframe  vc

The player also has a bullet which can move on both axes:

	:alias leftbx     vb
	:alias leftby     va

The bullet can be absent or, if it's moving, moving in one of three directions- straight, angled up or angled down. Since all these options are exclusive we can represent them with a single register:

	:alias leftfire   v9

`leftfire` will be 0 if the bullet isn't moving and otherwise we'll identify the angle using a named constant:

	:const FIRE_ST 1
	:const FIRE_UP 2
	:const FIRE_DN 3

And of course, the enemy (the right gunslinger) needs equivalents for all of this state:

	:alias rightx     v8
	:alias righty     v7
	:alias rightframe v6
	:alias rightbx    v5
	:alias rightby    v4
	:alias rightfire  v3

Fortunately this works out pretty well- everything we need to save can fit in registers at once and we have `v0`-`v2` and `vf` left over as temporary working registers. If we didn't have enough space (such as if we wanted to add score counters or hit point meters or other fancy features) we'd need to use `load` and `save` and plan out which registers will be used for what purpose at different times during the program.

Why did we allocate registers from `ve` down? It's most useful if low registers are free as temporaries. `v0` is the only register we can use for the `jump0` instruction and any use of `load` or `save` will alter it. Keeping `v0-v2` free for general use is a good practice.

Setting the Scene
-----------------
Now that we have graphics data and a register map planned, we can start putting things on the screen. Let's draw the static portion of the background. The cactus will go in the center:

	: main
		i  := cactus
		v0 := 28
		v1 :=  9
		sprite v0 v1 15

I'd also like to draw a border on the top and bottom of the screen, just for aesthetics- the bullets need something to ricochet off to make any sense. This requires an extra bit of sprite data:

	: edge   0xFF 0xFF

I could draw separate lines on the top and bottom edges of the screen with separate `sprite` instructions, but instead I can take advantage of the wraparound behavior of sprites at the edges of the screen:

	i  := edge
	v0 := 0
	v1 := 31
	loop
		sprite v0 v1 2
		v0 += 8
		if v0 != 64 then
	again

Finally, let's rough in the players so we can check their placement. We'll need to initialize the registers that keep track of their positions:

	leftx  :=  5
	lefty  := 10
	rightx := 51
	righty := 10

	i := left
	sprite leftx lefty 12
	i := right
	sprite rightx righty 12

Here's our complete program so far:

	: cactus 0x38 0x38 0x3B 0x1B 0x1B 0x1B 0xDF 0xDE 0xD8 0xD8 0xF8 0x78 0x18 0x1C 0x0C 
	: left   0x00 0x00 0x70 0xF8 0x70 0x67 0x7C 0x60 0x60 0x78 0x28 0xEC
	: lwalk1 0x18 0x3E 0x1C 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x66 0xC3
	: lwalk2 0x18 0x3E 0x1C 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x24 0x36
	: right  0x00 0x00 0x06 0x1F 0x0E 0xE6 0x3E 0x06 0x06 0x1E 0x14 0x37 
	: rwalk1 0x18 0x7C 0x38 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x66 0xC3
	: rwalk2 0x18 0x7C 0x38 0x18 0x7E 0x99 0x99 0x99 0x5A 0x3C 0x24 0x6C
	: edge   0xFF 0xFF
	: bullet 0x80

	:alias leftx      ve
	:alias lefty      vd
	:alias leftframe  vc
	:alias leftbx     vb
	:alias leftby     va
	:alias leftfire   v9
	:alias rightx     v8
	:alias righty     v7
	:alias rightframe v6
	:alias rightbx    v5
	:alias rightby    v4
	:alias rightfire  v3

	:const FIRE_ST 1
	:const FIRE_UP 2
	:const FIRE_DN 3

	: main
		i  := cactus
		v0 := 28
		v1 :=  9
		sprite v0 v1 15

		i  := edge
		v0 := 0
		v1 := 31
		loop
			sprite v0 v1 2
			v0 += 8
			if v0 != 64 then
		again

		leftx  :=  5
		lefty  := 10
		rightx := 51
		righty := 10

		i := left
		sprite leftx lefty 12
		i := right
		sprite rightx righty 12

It's starting to look like a game already!

Motion
------
Now we need to make the player mobile. We'll create a basic main loop and break player movement into a subroutine to keep things organized:

	loop
		move-left-player
	again

When the player moves, we'll need to erase the old player by redrawing their sprite (toggling all their pixels back off), update their position and animation frame and then drawing the updated sprite in its new position. We will begin by making a copy of their current position:

	: move-left-player
		v1 := leftx
		v2 := lefty

Then we'll use `key` conditions to update these temporary copies of the player's position. We load the key we want to test into v0 and then use an `if...then` statement to query and make the update.

		v0 := 7
		if v0 key then v1 += -1
		v0 := 9
		if v0 key then v1 +=  1
		v0 := 5
		if v0 key then v2 += -1
		v0 := 8
		if v0 key then v2 +=  1

The player's movement must be restricted to the left side of the screen. Since it moves 1 pixel at a time, we can use exact `==` comparisons to identify the situations where the player has moved out of bounds and counteract them. This is much more efficient than using the pseudo-ops for `>`, `<=` and so on that Octo offers:

		if v1 ==  0 then v1 :=  1
		if v1 == 21 then v1 := 20
		if v2 ==  0 then v2 :=  1
		if v2 == 18 then v2 := 17

Having calculated the player's next position we can erase, move and redraw the sprite:

		i := left
		sprite leftx lefty 12
		leftx     := v1
		lefty     := v2
		leftframe := v0
		sprite leftx lefty 12
	;

All together now:

	: move-left-player
		v1 := leftx
		v2 := lefty

		v0 := 7
		if v0 key then v1 += -1
		v0 := 9
		if v0 key then v1 +=  1
		v0 := 5
		if v0 key then v2 += -1
		v0 := 8
		if v0 key then v2 +=  1

		if v1 ==  0 then v1 :=  1
		if v1 == 21 then v1 := 20
		if v2 ==  0 then v2 :=  1
		if v2 == 18 then v2 := 17

		i := left
		sprite leftx lefty 12
		leftx     := v1
		lefty     := v2
		leftframe := v0
		sprite leftx lefty 12
	;

Try it out- you should be able to move the left gunslinger with ASWD on your keyboard. If you're running at a realistic emulation speed, you'll notice a slight flicker to the sprite. This comes from the gap between our two sprite drawing instructions- as our program executes it will occasionally display a frame in between those instructions, revealing the absence of the sprite. Keeping erasures and redraws close together will minimize the effect.

We planned for a somewhat more elaborate player animation. We'd like to show the gunslinger crouching when not moving and alternating between two walk frames while moving. Since the animation frames are sequential in memory and each 12 bytes long we can set `leftframe` to an offset of 0, 12 or 24 and and add that to the base `frame` address before we draw the sprite. We can also determine whether we're moving by comparing `v1` and `v2` to `leftx` and `lefty` after reading keypad input.

	# back up position into v1/v2
	# key input...

	v0 := 0
	if v1 != leftx then v0 := 24
	if v2 != lefty then v0 := 24
	if leftframe == 24 then v0 := 12
	
	# clamp position...
	
	i := left
	i += leftframe
	sprite leftx lefty 12
	leftx     := v1
	lefty     := v2
	leftframe := v0
	i := left
	i += leftframe
	sprite leftx lefty 12

Marvel at your gunslinger's newfound jaunty mosey.

Projectiles
-----------
When there is no bullet, pressing E should fire one. When there is a bullet, we'll need to update its position and make it ricochet. We'll start by inserting appropriate subroutine calls into our main loop:

	loop
		move-left-player
		if leftfire  != 0 then move-left-bullet
		if leftfire  == 0 then fire-left-bullet
	again

We'll start with firing. If the E key is not being held, we can bail out immediately:

	: fire-left-bullet
		v0 := 6
		if v0 -key then return

We'll default to firing straight, and adjust angle if W or S is pressed:

		leftfire := FIRE_ST
		v0 := 5
		if v0 key then leftfire := FIRE_UP
		v0 := 8
		if v0 key then leftfire := FIRE_DN

The bullet will be positioned relative to the player sprite so it appears to emerge from the player's gun:

		leftbx := leftx
		leftbx += 9
		leftby := lefty
		leftby += 5

And finally we'll draw the bullet. As with the player, drawing it once up-front allows us to have a consistent erase-reposition-redraw cycle in our main loop.

		i := bullet
		sprite leftbx leftby 1
	;

All together:

	: fire-left-bullet
		v0 := 6
		if v0 -key then return
		leftfire := FIRE_ST
		v0 := 5
		if v0 key then leftfire := FIRE_UP
		v0 := 8
		if v0 key then leftfire := FIRE_DN
		
		leftbx := leftx
		leftbx += 9
		leftby := lefty
		leftby += 5
		
		i := bullet
		sprite leftbx leftby 1
	;

Movement is also fairly straightforward. Erase the bullet, move it horizontally and vertically as appropriate:

	: move-left-bullet
		i := bullet
		sprite leftbx leftby 1
		leftbx += 1
		if leftfire == FIRE_UP then leftby += -1
		if leftfire == FIRE_DN then leftby +=  1

If the bullet hits the top or bottom of the screen it should reverse vertical direction, simulating a ricochet. As with the player, since it moves at 1 pixel per frame we can use exact comparisons to identify these collisions:

		if leftby ==  1 then leftfire := FIRE_DN
		if leftby == 30 then leftfire := FIRE_UP

If we hit the back wall we'll despawn:

		if leftbx   == 63 then leftfire := 0
		if leftfire == 0  then return

Otherwise we redraw. If we toggled a pixel off, we will despawn. Since this leaves the pixel toggled off it will naturally chew holes through the cactus or cut a pixel out of the player sprite. If the player sprite is redrawn this pixel will mismatch, allowing us to detect the collision. More on that later.

		sprite leftbx leftby 1
		if vf == 0 then return
		leftfire := 0
	;

All together:

	: move-left-bullet
		i := bullet
		sprite leftbx leftby 1
		leftbx += 1
		if leftfire == FIRE_UP then leftby += -1
		if leftfire == FIRE_DN then leftby +=  1

		if leftby ==  1 then leftfire := FIRE_DN
		if leftby == 30 then leftfire := FIRE_UP

		if leftbx   == 63 then leftfire := 0
		if leftfire == 0  then return

		sprite leftbx leftby 1
		if vf == 0 then return
		leftfire := 0
	;

Finally, let's make a small addition to the animation code in `move-left-player`- if the player is firing they should display frame 0 no matter what. It looks pretty strange if a gunslinger fires a bullet out of their shoulder:

		v0 := 0
		if v1 != leftx then v0 := 24
		if v2 != lefty then v0 := 24
		if leftframe == 24 then v0 := 12
		vf := 6
		if vf key then v0 := 0

You should now be able to fire projectiles, bounce them off walls and slowly drill through the cactus. The west just got dangerous! Our code is starting to do a lot of work now, so it might make sense to kick Octo's emulation speed from 7 cycles/frame up to 15. If you're feeling ambitious you could write a somewhat more sophisticated game loop so that bullets update (and move) faster than the gunslingers.

A Theory of Mind
----------------
Shooting at a cactus is all well and good, but we really need a worthy opponent, or at least a moving target. Let's expand our main loop again

	loop
		move-left-player
		move-right-player
		if leftfire  != 0 then move-left-bullet
		if leftfire  == 0 then fire-left-bullet
	again

`move-right-player` will work in a manner very similar to `move-left-player`, except it doesn't process keypad input and it works on a different set of registers:

	: move-right-player
		v1 := rightx
		v2 := righty

		do-brain

		v0 := 0
		if v1 != rightx then v0 := 24
		if v2 != righty then v0 := 24
		if rightframe == 24 then v0 := 12

		if v1 == 35 then v1 := 36
		if v1 == 56 then v1 := 55
		if v2 ==  0 then v2 :=  1
		if v2 == 18 then v2 := 17

		i := right
		i += rightframe
		sprite rightx righty 12
		rightx     := v1
		righty     := v2
		rightframe := v0
		i := right
		i += rightframe
		sprite rightx righty 12
	;

Our call to the mysterious `do-brain` needs to alter `v1` and `v2` (and possibly fire a bullet) as if an AI player were pressing keys of their own. One simple approach is to use a table of instructions and index into it randomly:

	: brain-table
		v1 += -1          return
		v1 +=  1          return
		v2 += -1          return
		v2 += -1          return
		v2 +=  1          return
		v2 +=  1          return
		v0 := v0          return
		fire-right-bullet return
	
	: do-brain
		v0 := random 0b11100
		jump0 brain-table

`do-brain` is its own subroutine so that when it does a `jump0` into `brain-table` it will be able to `return` to the caller of `do-brain`- that is, `move-right-player`. Every Chip8 instruction is 2 bytes long, so an assignment instruction (or a call) followed by a return is 4 bytes. Our `random` statement uses a mask constant which will produce multiples of 4, so it works out.

Also note that our table is chosen to have a small chance of doing nothing and twice as many opportunities to move vertically as horizontally. You can experiment with the makeup and size of the table to see what produces the best challenge.

Clearly we need to furnish a `fire-right-bullet` subroutine. This ends up being very similar to `fire-left-bullet`, but with a random choice of angle and different offsets:

	: fire-right-bullet
		if rightfire != 0 then return
		rightfire := FIRE_ST
		v0 := random 0b11
		if v0 == 1 then rightfire := FIRE_UP
		if v0 == 2 then rightfire := FIRE_DN
	
		rightbx := rightx
		rightbx += -1
		rightby := righty
		rightby += 5

		i := bullet
		sprite rightbx rightby 1
	;

You'll also need to create a `move-left-bullet` and call it from the main subroutine when appropriate. See if you can figure these details out on your own.

Blood in the Gutter
-------------------
At this point our cowpokes can hurl lead at one another but if a bullet collides with a gunslinger it will fall to the ground impotently and stay there. This simply won't do.

Fortunately, giving these bullets the necessary punch is a very simple addition. After we redraw the sprite for each frame, we can check `vf`. If it's set to 1, we know that redrawing the player overlapped something, and the only thing it could have overlapped with is a bullet:

	loop
		move-left-player
		if vf != 0 then jump gameover
		move-right-player
		if vf != 0 then jump gameover

		if leftfire  != 0 then move-left-bullet
		if leftfire  == 0 then fire-left-bullet
		if rightfire != 0 then move-right-bullet
	again

`gameover` could do whatever you like- perhaps freeze the game and turn on the buzzer? If you have two routines, one for the left player being hit and one for the right player being hit you could erase just the deceased gunslinger and the offending bullet.

Wrapping it Up
--------------
We've written a simple but interesting action game with Octo and observed a number of useful idioms and techniques. Our game still contains some subtle bugs, (what happens if two bullets collide mid-air?) but I'll leave fixing those to your discretion. Maybe they're features?

If you're still having fun working on Outlaw, see if you can implement more features of the original game. Perhaps multiple levels or progressively more challenging opponents? You can also refer to `outlaw.8o` in the examples directory to see a complete and slightly improved version of the game described here, including a reset after one gunslinger is defeated.
