Adventures In Sorting
=====================
Sorting is one of the most fundamental classes of bread-and-butter algorithms in Computer Science. Implementing a sorting algorithm on the Chip8 has some interesting challenges. Registers are plentiful, Memory access is cumbersome and recursion is impractical. The Big-O complexity of algorithms tells us how well they should perform for some arbitrary size N, but once we tie ourselves to a specific ISA and an upper limit on practical Ns the story can change. Let's look at a few approaches.

Performance comparisons will be based on a common, arbitrarily chosen shuffled array- in practice different inputs will produce different results but one trial gives us a coarse idea of how algorithms stack up:

	:const SIZE   16
	:const SIZE-1 15
	: data  14 5 15 6 1 3 10 7 0 9 11 4 2 13 8 12

The O(n^2) sorting algorithms are often very compact and don't have much overhead. I went with a [selection sort](http://en.wikipedia.org/wiki/Selection_sort) for starters, because the linear scans it involves lend themselves well to Chip8 memory operations:

	:alias  here       v1
	:alias  rest       v2
	:alias  min-index  v3
	:alias  min-value  v4
	:alias  here-value v5

	: selection-sort
		here := 0
		loop
			min-index := here
			i := data
			i += here
			load v0
			min-value  := v0
			here-value := v0

			rest := here
			rest += 1
			i := data
			i += rest
			loop
				load v0
				if v0 >= min-value then jump no-better
					min-index := rest
					min-value := v0
				: no-better

				rest += 1
				if rest != SIZE then
			again

			if min-index == here then jump no-swap
				v0 := here-value
				i := data
				i += min-index
				save v0

				v0 := min-value
				i := data
				i += here
				save v0
			: no-swap

			here += 1
			if here != SIZE-1 then
		again
	;

I use a few tricks here. I access the pivot value for each pass up-front and carry it in registers. The loop which finds the minimum value takes advantage of how load increments `i`, removing the need to re-initialize it and add an offset on each loop iteration. The memory swap at the end of each iteration is fairly bulky, even though I've carefully arranged so that both values will already be in registers.

The algorithm weighs in at 70 bytes and takes roughly 1260 cycles to sort our 16 element array. It'll be hard to write a general-purpose sorting routine that consumes less memory, but we can improve the speed.

The next natural thought is to employ one of the O(n * lg(n)) algorithms. [Quicksort](http://en.wikipedia.org/wiki/Quicksort) seems to be right out because it is naturally implemented recursively and Chip8 doesn't have an argument stack. We could build one, but the overhead doesn't sound good. A better choice is [Heapsort](http://en.wikipedia.org/wiki/Heapsort):

	:const LIMIT   7 # (SIZE/2)+1

	:alias left-val  v0
	:alias right-val v1
	:alias start     v2
	:alias root      v3
	:alias end       v4
	:alias best      v5
	:alias left      v6
	:alias best-val  v7
	:alias root-val  v8

	: heap-sort
		start := LIMIT
		end   := SIZE
		loop
			root := start
			sift-down
			start += -1
			if start != -1 then
		again

		start := SIZE-1
		loop
			# swap data[0] with data[start]:
			i := data
			load v0
			vf := v0

			i := data
			i += start
			load v0
			i := data
			save v0

			i := data
			i += start
			v0 := vf
			save v0

			start += -1
			root := 0
			end := start
			sift-down

			if start != 0 then
		again
	;

	: assign-best
		best     := left
		best-val := left-val
		jump found-best

	: sift-down
		i := data
		i += root
		load v0
		root-val := v0

		loop
			left <<= root

			if left > end then return

			i := data
			i += left
			load v1

			best := left
			best += 1
			best-val := right-val

			if left-val > right-val then jump assign-best
			if left == end then jump assign-best
			: found-best

			if root-val >= best-val then return

			i := data
			i += root
			v0 := best-val
			save v0

			i := data
			i += best
			v0 := root-val
			save v0

			root := best
		again

This one was a little tricky to get debugged. Unfortunately, it's worse on both dimensions we're considering. The code takes up 130 bytes and takes 1941 cycles to sort the same 16 element array.

If we scale up the array to 64 elements the insertion sort takes about 17613 cycles while the heapsort is only about 11825. Algorithmic complexities work out as expected, but either approach is impractically slow.

There's a different way to approach this problem. If we have a small, fixed N we could aggressively unroll the steps in a normal sorting algorithm, producing a sequence of code snippets which look something like this:

	if v0 <= v1 then jump l-0
		vf := v0
		v0 := v1
		v1 := vf
	: l-0
	
_note: this was written prior to the addition of if...begin...else...end._

By using a `load vf` instruction it would be possible to pull the full 16 elements of an array into registers at once, and then this lattice of comparisons and swaps could take care of the rest. That won't quite work, though- comparing the magnitude of two values requires a subtraction, which will destroy the contents of `vf` as well as one other temporary register. As a result we'd only be able to sort 14 elements in this manner. The next lowest power of two is 8.

What is the best sequence of comparisons and swaps? The obvious approach is to unroll the steps of a [Bubble Sort](http://en.wikipedia.org/wiki/Bubble_sort)- for size N=8 that would mean 28 swaps. This is a loose bound, though- [this site](http://www.angelfire.com/blog/ronz/Articles/999SortingNetworksReferen.html) describes [optimal sorting networks](http://en.wikipedia.org/wiki/Sorting_network) for N <= 16. Here's one for N=8 that only requires 19 swaps:

![Sorting Network](http://i.imgur.com/4wXbKie.png)

This diagram is read left-to-right. Horizontal lines are values in a given position of an array, and vertical lines are a test-and-swap between two values. Vertical lines which are in the same column are swaps that can be carried out simultaneously or in any order and otherwise the test-and-swaps must be carried out left to right. Translating this into Octo code as in the example above, we get a subroutine called `sort-8` which is 268 bytes long and takes somewhere around 100 cycles to do its thing. This is fast enough that it could actually be employed in a Chip8 game if called sparingly!

For a fair comparison with the previous two algorithms, we can sort 16 elements by splitting the source array into two halves, using the sorting network on each and then performing a linear merge pass:

	: heap1 0 0 0 0 0 0 0 0
	: heap2 0 0 0 0 0 0 0 0

	:alias val1   v8
	:alias val2   v9
	:alias dest   va
	:alias index1 vb
	:alias index2 vc

	: fused-sort
		i := data
		load v7
		sort-8
		val1 := v0
		i := heap1
		save v7

		i := data
		load v7
		load v7 # cheaper than adding an offset of 8
		sort-8
		val2 := v0
		i := heap2
		save v7

		index1 := 1
		index2 := 1
		dest   := 0

	: merge
		if val1 > val2 then jump merge-2
		append-1
		if index1 != 9 then jump merge
		loop
			append-2
			if dest == 16 then return
		again

	: merge-2
		append-2
		if index2 != 9 then jump merge
		loop
			append-1
			if dest == 16 then return
		again

	: append-1
		v0 := val1
		i := data
		i += dest
		save v0
		dest += 1

		i := heap1
		i += index1
		load v0
		val1 := v0
		index1 += 1
	;

	: append-2
		v0 := val2
		i := data
		i += dest
		save v0
		dest += 1

		i := heap2
		i += index2
		load v0
		val2 := v0
		index2 += 1
	;

This could be done in-place but I used separate buffers for the sake of conceptual simplicty. The results are impressive: 418 bytes of code and a finished sort in about 479 cycles, completely blowing our previous attempts out of the water at the cost of some precious ram. If this is the best balance we can strike, I hope nobody needs to write a game that requires a routine like this, though- if we use what I believe is a historically accurate clock speed for Chip8 our fastest algorithm takes a little over a second to run.

Part 2
======
I've been tinkering with array languages recently and it lead me to realize that I entirely skipped over a useful class of sorting algorithms in my earlier investigation- [Counting Sorts](http://en.wikipedia.org/wiki/Counting_sort).

There are several variations on the idea, but the classic Counting Sort does a single scan of the input array, counting instances of each key in an array of "buckets" which correspond to each value the key could take on. From this histogram a second pass can read values back out in sequence and fill the source array. It's possible to achieve linear-time sorting in this manner, but it is only practical when the range of values to consider is fairly small.

For purposes of illustration I'll restrict the problem space to sorting nybbles (0-15)- as a result the cycle counts will not be directly comparable to those of the previous examples. Our first task is to declare and initialize our bucket array:

	: empty
		0 0 0 0 0 0 0 0

	: buckets
		0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0

	: bucket-sort
		# zero bucket array
		i := empty
		load v7
		save v7 # unrolled loop to zero bucket array
		save v7 # and initialize loop counters for later.

		...

I'm using several tricks here- I fill the lower 8 registers from an 'empty' buffer and then take advantage of the fact that i will automatically be incremented to the head of the buckets array and then perform two writes to "stamp" zeroes over the entire array. I could save an instruction if my empty array was large enough to zero all 16 registers, but it's a code size tradeoff. For zeroing a larger bucket array I might do something like this:

	: empty
		0 0 0 0 0 0 0 0 0

	: buckets
		0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0

	: bucket-sort
		i := empty
		load v8 # also initialize v8 as 0
		loop
			save v7     # zero 8 bytes
			v8 += 1
			if v8 != 32 # 8x32 = 256
		again
		...

Either way, fairly fast. We're able to make those autoincrements work for us. Summing the histogram is much clumsier as we have to juggle `i` between arrays:

		...
		# bucket the elements
		# v1 is data index (already 0)
		loop
			# load data
			i := data
			i += v1
			load v0
			vf := v0

			# increment bucket
			i := buckets
			i += vf
			load v0
			v0 += 1
			i := buckets
			i += vf
			save v0

			v1 += 1
			if v1 != SIZE then
		again
		...

And finally, unpacking runs. This is a bit clumsy, but we're able to build a very tight writing loop using a technique similar to our earlier memory fill. the longer our runs, the more this will pay off.

		...
		# unpack bucket counts
		# v1 is temporary count
		# v2 is data   index (already 0)
		# v3 is bucket index (already 0)
		loop
			i := buckets
			i += v3
			load v0
			if v0 == 0 then jump no-write
				v1 := v0
				v0 := v3
				i  := data
				i  += v2
				v2 += v1
				loop
					save v0
					v1 += -1
					if v1 != 0 then
				again
			: no-write
			v3 += 1
			if v3 != MAX_VAL then
		again
	;

Notice how overall I avoid initializing index registers explicitly by taking advantage of the fact that they will be zeroed as part of my initial memory fill routine.

Performance is impressive. The counting sort handles our example 16 element loose-packed nybble array in only 471 cycles, while our best previous (and slightly more general) attempt took 481, using only 122 bytes instead of 422. Increasing the range of sortable values rapidly increases memory requirements, but there are many possible tradeoffs and tweaks. Overall it looks like this type of algorithm provides a second viable option for running sorts on real hardware. See [the entire program together](https://github.com/JohnEarnest/Octo/blob/gh-pages/examples/sort4.8o).
