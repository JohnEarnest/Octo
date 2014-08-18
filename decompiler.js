////////////////////////////////////
//
//   Decompiler:
//
//   A tracing decompiler and static
//   analyzer for Chip8 programs.
//
////////////////////////////////////

"use strict";

var LOAD_STORE_QUIRKS = false; // ignore i increment with loads
var SHIFT_QUIRKS      = false; // shift vx in place, ignore vy

// global state:
var program  = []; // chip8 memory
var reaching = {}; // map<address, map<register, set<int>>>

// analysis:
var type        = {}; // map<address, {code | data | smc}>
var labels      = {}; // map<address, list<reference addrs>>
var subroutines = {}; // map<address, list<caller addrs>>
var lnames      = {}; // map<address, name>
var snames      = {}; // map<address, name>

function display(a, nn) {
	// convert a pair of bytes representing an instruction
	// into a string of the equivalent octo statement.
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var n   = (nn     ) & 0xF;
	var nnn = op & 0xFFF;

	var vx = "v" + (x.toString(16).toUpperCase());
	var vy = "v" + (y.toString(16).toUpperCase());

	if (op == 0x00 && y == 0xC) { return "scroll-down " + n; } // schip
	if (op == 0x00E0)           { return "clear"; }
	if (op == 0x00EE)           { return "return"; }
	if (op == 0x00FB)           { return "scroll-right"; } // schip
	if (op == 0x00FC)           { return "scroll-left"; } // schip
	if (op == 0x00FD)           { return "exit"; } // schip
	if (op == 0x00FE)           { return "lores"; } // schip
	if (op == 0x00FF)           { return "hires"; } // schip
	if (o == 0x1)               { return "jump " + lnames[nnn]; }
	if (o == 0x2)               { return snames[nnn]; }
	if (o == 0x3)               { return "if " + vx + " != " + nn + " then"; }
	if (o == 0x4)               { return "if " + vx + " == " + nn + " then"; }
	if (o == 0x5)               { return "if " + vx + " != " + vy + " then"; }
	if (o == 0x6)               { return vx + " := " + nn; }
	if (o == 0x7)               { return vx + " += " + nn; }
	if (o == 0x8 && n == 0x0)   { return vx + " := " + vy; }
	if (o == 0x8 && n == 0x1)   { return vx + " |= " + vy; }
	if (o == 0x8 && n == 0x2)   { return vx + " &= " + vy; }
	if (o == 0x8 && n == 0x3)   { return vx + " ^= " + vy; }
	if (o == 0x8 && n == 0x4)   { return vx + " += " + vy; }
	if (o == 0x8 && n == 0x5)   { return vx + " -= " + vy; }
	if (o == 0x8 && n == 0x6)   { return vx + " >>= " + vy; }
	if (o == 0x8 && n == 0x7)   { return vx + " =- " + vy; }
	if (o == 0x8 && n == 0xE)   { return vx + " <<= " + vy; }
	if (o == 0x9)               { return "if " + rx + " == " + ry + " then"; }
	if (o == 0xA)               { return "i := " + lnames[nnn]; }
	if (o == 0xB)               { return "jump0 " + lnames[nnn]; }
	if (o == 0xC)               { return vx + " := random " + nn; }
	if (o == 0xD)               { return "sprite " + vx + " " + vy + " " + n; }
	if (o == 0xE && nn == 0x9E) { return "if " + vx + " -key then"; }
	if (o == 0xE && nn == 0xA1) { return "if " + vx + " key then"; }
	if (o == 0xF && nn == 0x07) { return vx + " := delay"; }
	if (o == 0xF && nn == 0x0A) { return vx + " := key"; }
	if (o == 0xF && nn == 0x15) { return "delay := " + vx; }
	if (o == 0xF && nn == 0x18) { return "buzzer := " + vx; }
	if (o == 0xF && nn == 0x1E) { return "i += " + vx; }
	if (o == 0xF && nn == 0x29) { return "i := hex " + vx; }
	if (o == 0xF && nn == 0x30) { return "i := bighex " + vx; } // schip
	if (o == 0xF && nn == 0x33) { return "bcd " + vx; }
	if (o == 0xF && nn == 0x55) { return "save " + vx; }
	if (o == 0xF && nn == 0x65) { return "load " + vx; }
	if (o == 0xF && nn == 0x75) { return "saveflags" + vx; } // schip
	if (o == 0xF && nn == 0x85) { return "loadflags" + vx; } // schip

	return "0x" + (op.toString(16).toUpperCase()) + " # bad opcode?";
}

function apply(address) {
	// apply this instruction to the reaching set
	// producing a successor reaching set.

	// flag this address as executable
	function setType(address, desired) {
		var t = type[address];
		if (desired == "code" && t == "smc" ) { return; }
		if (desired == "data" && t == "smc" ) { return; }
		if (desired == "code" && t == "data") { desired = "smc"; }
		if (desired == "data" && t == "code") { desired = "smc"; }
		type[address] = desired;
	}
	setType(address,     "code");
	setType(address + 1, "code");

	// start with a deep copy of the source reaching set:
	var ret = {};
	for(var reg in reaching[address]) {
		ret[reg] = {};
		for(var val in reaching[address][reg]) {
			ret[reg][val] = true;
		}
	}

	// decode the instruction:
	var a   = program[address];
	var nn  = program[address+1];
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var n   = (nn     ) & 0xF;
	var nnn = op & 0xFFF;


	// log label and subroutine references:
	if (o == 0x1 || o == 0xA || o == 0xB) {
		if (typeof labels[nnn] == "undefined") { labels[nnn] = []; }
		if (labels[nnn].indexOf(address) == -1) { labels[nnn].push(address); }
	}
	if (o == 0x2) {
		if (typeof subroutines[nnn] == "undefined") { subroutines[nnn] = []; }
		if (subroutines[nnn].indexOf(address) == -1) { subroutines[nnn].push(address); }
	}

	// helper routines:
	function iota(max) {
		var i = {};
		for(var z = 0; z <= max; z++) { i[z] = true; }
		return i;
	}
	function maskedrand() {
		var i = {};
		for(var z = 0; z <= 0xFF; z++) { i[z & nn] = true; }
		return i;
	}
	function single(value) {
		var s = {};
		s[value] = true;
		return s;
	}
	function unary(unop) {
		var r = {};
		for(var a in ret[x]) {
			r[unop(parseInt(a)) & 0xFF] = true
		}
		return r;
	}
	function binary(binop) {
		var r = {};
		for(var a in ret[x]) {
			for(var b in ret[y]) {
				r[(binop(parseInt(a), parseInt(b)) & 0xFF)] = true;
			}
		}
		ret[x] = r;
	}
	function ioffset(delta) {
		if (LOAD_STORE_QUIRKS) { return; }
		var s = {};
		for(var a in ret['i']) {
			s[(parseInt(a) + delta) & 0xFFF] = true;
		}
		ret['i'] = s;
	}
	function ioffsets() {
		var s = {};
		for(var a in ret['i']) {
			for(var b in ret[x]) {
				s[(parseInt(a) + parseInt(b)) & 0xFFF] = true;
			}
		}
		return s;
	}
	function bincarry(binop) {
		var r = {};
		var c = {};
		for(var a in ret[x]) {
			for(var b in ret[y]) {
				var v = binop(parseInt(a), parseInt(b));
				r[(v[0] & 0xFF) ] = true;
				c[(v[1] ? 1 : 0)] = true;
			}
		}
		ret[x]   = r;
		ret[0xF] = c;
	}
	function markRead(size) {
		for(var w in ret['i']) {
			var addr = parseInt(w);
			for(var z = 0; z <= size; z++) {
				setType(addr + z, "data");
			}
		}
	}
	function markWrite(size) {
		// todo: distinguish read-only/read-write data?
		markRead(size);
	}

	// simulate postconditions:
	if (SHIFT_QUIRKS && o == 0x8 && (n == 0x6 || n == 0xE)) { y = x; }

	if (op == 0x00EE)           { ret['rets'] = {};                              } // return
	if (o == 0x2)               { ret['rets'] = single(address + 2);             } // call
	if (o == 0x6)               { ret[x] = single(nn);                           } // vx := nn
	if (o == 0x7)               { ret[x] = unary(function(a) { return a + nn;}); } // vx += nn
	if (o == 0x8 && n == 0x0)   { binary  (function(a, b) { return     b; });    } // vx := vy
	if (o == 0x8 && n == 0x1)   { binary  (function(a, b) { return a | b; });    } // vx |= vy
	if (o == 0x8 && n == 0x2)   { binary  (function(a, b) { return a & b; });    } // vx &= vy
	if (o == 0x8 && n == 0x3)   { binary  (function(a, b) { return a ^ b; });    } // vx ^= vy
	if (o == 0x8 && n == 0x4)   { bincarry(function(a, b) { return [a +  b, a + b > 0xFF]; }); }
	if (o == 0x8 && n == 0x5)   { bincarry(function(a, b) { return [a -  b, a > b];        }); }
	if (o == 0x8 && n == 0x6)   { bincarry(function(a, b) { return [b >> 1, b & 1];        }); }
	if (o == 0x8 && n == 0x7)   { bincarry(function(a, b) { return [b -  a, b > a];        }); }
	if (o == 0x8 && n == 0xE)   { bincarry(function(a, b) { return [b << 1, b & 128];      }); }
	if (o == 0xA)               { ret['i'] = single(nnn);        } // i := nnn
	if (o == 0xC)               { ret[x]   = maskedrand();       } // vx := random nn
	if (o == 0xF && nn == 0x07) { ret[x]   = iota(0xFF);         } // vx := delay
	if (o == 0xF && nn == 0x0A) { ret[x]   = iota(0xF);          } // vx := key
	if (o == 0xF && nn == 0x1E) { ret['i'] = ioffsets();         } // i += vx
	if (o == 0xF && nn == 0x29) { ret['i'] = unary(function(a) { return 5*a; });         }
	if (o == 0xF && nn == 0x30) { ret['i'] = unary(function(a) { return 10*a + 16*5; }); }
	if (o == 0xF && nn == 0x75) { for(var z = 0; z <= x; z++) { ret['f'+z] = ret[z]; } }
	if (o == 0xF && nn == 0x85) { for(var z = 0; z <= x; z++) { ret[z] = ret['f'+z]; } }

	// memory operations:
	if (o == 0xD) {
		// sprite vx vy n
		ret[0xF] = { 1:true, 0:true };
		if (n == 0) { markRead(31);  }
		else        { markRead(n-1); }
	}
	if (o == 0xF && nn == 0x33) {
		// bcd
		markWrite(2);
	}
	if (o == 0xF && nn == 0x55) {
		// save vx
		markWrite(x);
		ioffset(x);
	}
	if (o == 0xF && nn == 0x65) {
		// load vx
		// todo: model written sets so that
		// load results can be more precise?
		var all = iota(0xFF);
		for(var z = 0; z <= x; z++) { ret[z] = all; }
		markRead(x);
		ioffset(x);
	}

	return ret;
}

function successors(address, prevret) {
	// produce a list of all possible successor addresses
	// of this one, honoring branches and dispatchers.

	var a   = program[address];
	var nn  = program[address+1];
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var nnn = op & 0xFFF;

	function preciseSkip(address, predicate) {
		// decide which skip paths are possible based
		// on the reaching set to an address.
		var pass = false;
		var skip = false;
		for(var vx in reaching[address][x]) {
			for(var vy in reaching[address][y]) {
				if (predicate(vx, vy, nn)) { skip = true; }
				else                       { pass = true; }
			}
		}
		var ret = [];
		if (pass) { ret.push(address + 2); }
		if (skip) { ret.push(address + 4); }
		return ret;
	}

	if (op == 0x0000) { return [];    } // octo implied halt
	if (op == 0x00FD) { return [];    } // superchip halt
	if (o  == 0x1)    { return [nnn]; } // simple jump
	if (o  == 0x2)    { return [nnn]; } // simple call

	// simple skips
	if (o == 0x3) {
		return preciseSkip(address, function(x, y, nn) { return x == nn; });
	}
	if (o == 0x4) {
		return preciseSkip(address, function(x, y, nn) { return x != nn; });
	}
	if (o == 0x5) {
		return preciseSkip(address, function(x, y, nn) { return x == y; });
	}
	if (o == 0x9) {
		return preciseSkip(address, function(x, y, nn) { return x != y; });
	}

	if ((a & 0xF0) == 0xE0 && (nn == 0x9E || nn == 0xA1)) {
		// key input skips - take both branches.
		return [address + 2, address + 4];
	}
	if (op == 0x00EE) {
		// return - follow all valid source addrs.
		var ret = [];
		for(var v in prevret) {
			ret.push(parseInt(v));
		}
		return ret;
	}
	if (o == 0xB) {
		// jump0 - follow all possible targets.
		var ret = [];
		for(var v in reaching[address][0]) {
			ret.push(nnn + parseInt(v));
		}
		return ret;
	}

	// default to next instruction in program.
	return [address + 2];
}

function analyze(rom) {
	reaching[0x200] = {
		0x0:{0:true}, 0x1:{0:true}, 0x2:{0:true}, 0x3:{0:true}, 0x4:{0:true}, 0x5:{0:true},
		0x6:{0:true}, 0x7:{0:true}, 0x8:{0:true}, 0x9:{0:true}, 0xA:{0:true}, 0xB:{0:true},
		0xC:{0:true}, 0xD:{0:true}, 0xE:{0:true}, 0xF:{0:true}, 'i':{0:true}, 'rets':{},
		f0:{0:true}, f1:{0:true}, f2:{0:true}, f3:{0:true},
		f4:{0:true}, f5:{0:true}, f6:{0:true}, f7:{0:true}
	};
	var fringe = [0x200];

	for(var x = 0; x < 4096; x++)       { program[x] = 0x00; }
	for(var x = 0; x < rom.length; x++) { program[x+0x200] = rom[x]; }
	
	function reachingMerge(a, b) {
		// take the union of two reaching sets.
		// if we altered b, it was a subset of a.
		var changed = false;
		for(var register in a) {
			for(var value in a[register]) {
				if(!(value in b[register])) {
					changed = true;
					b[register][value] = true;
				}
			}
		}
		return changed;
	}

	while(fringe.length > 0) {
		var here = fringe.pop();
	
		// compute successor reaching set
		var prevret = reaching[here]['rets']; // apply blows this away (!)
		var output = apply(here);

		// apply successor set to children and enlist them
		var children = successors(here, prevret);

		for(var x = 0; x < children.length; x++) {
			var child = children[x];

			if ((typeof reaching[child]) == "undefined") {
				// always explore fresh nodes:
				reaching[child] = output;
				if (fringe.lastIndexOf(child) == -1) {
					fringe.push(child);
				}
			}
			else if (reachingMerge(output, reaching[child])) {
				// if merging expanded the child reaching set,
				// explore it again:
				if (fringe.lastIndexOf(child) == -1) {
					fringe.push(child);
				}
			}
		}
	}

	// name all labels and subroutines by order of appearance:
	var lsize = 0;
	var ssize = 0;
	if (typeof labels[0x200] == "undefined") { labels[0x200] = [4097]; }
	lnames[0x200] = "main";
	snames[0x200] = "main";
	for(var x = 0; x < 4096; x++) {
		if (x == 0x200)       { continue; }
		if (x in labels)      { lnames[x] = "label-" + (lsize++); }
		if (x in subroutines) { snames[x] = "sub-"   + (ssize++); }
	}
}

function formatProgram(programSize) {
	// labels beyond rom boundaries
	// are converted into constants to avoid
	// introducing additional padding bytes
	// or lost label declarations.
	function findOutside(source, dest, names) {
		for(var a in source) {
			if (a < 0x200 || a >= 0x200 + programSize) {
				dest[a] = true;
				console.log(":const " + names[a] + " " + a);
			}
		}
	}
	var outside = {};
	findOutside(labels,      outside, lnames);
	findOutside(subroutines, outside, snames);

	// emit prototypes as necessary
	function findForwardRefs(source, dest, names) {
		for(var a in source) {
			var forwardref = false;
			for(var x = 0; x < source[a].length; x++) {
				forwardref |= (source[a][x] < a);
			}
			if (!forwardref) { continue; }
			if (a in outside) { continue; }
			dest.push(names[a]);
		}
	}
	var protos = [];
	findForwardRefs(labels,      protos, lnames);
	findForwardRefs(subroutines, protos, snames);
	for(var x = 0; x < protos.length; x++) {
		console.log(":proto " + protos[x]);
	}

	// emit code/data
	function hexFormat(num) {
		var hex = num.toString(16).toUpperCase();
		return "0x" + ((hex.length > 1) ? hex : "0" + hex);
	}
	function tabs(n) {
		var r = "";
		while(n --> 0) { r += "\t"; }
		return r;
	}
	var pendingAgain = [];
	for(var x = 0; x < programSize; x++) {
		var a = (x + 0x200);

		// emit labels and find loop heads
		if (a in labels) {
			if (lnames[a] == "main") { console.log(": main"); }

			for(var z = 0; z < labels[a].length; z++) {
				var u = labels[a][z];
				// must be a backref
				if (u < a) { continue; }
				// must be an unconditional jump
				if ((program[u] & 0x10) != 0x10) { continue; }
				// must be in a contiguous forward block
				var foundBreak = false;
				for(var scan = a; scan <= u; scan += 2) {
					if (scan in subroutines) {
						// a contiguous block can't contain subroutine entrypoints
						foundBreak = true;
						break;
					}
					if (type[scan] != "code" && type[scan] != "smc") {
						// a contiguous block can't contain non-code
						foundBreak = true;
						break;
					}
				}
				if (foundBreak) { continue; }

				// loop head identified:
				labels[a].splice(z--, 1);
				pendingAgain.push(u);
				console.log("%sloop", tabs(pendingAgain.length));
			}

			if (labels[a].length > 0 && lnames[a] != "main") {
				console.log(": " + lnames[a]);
			}
		}
		else if (a in subroutines) {
			console.log("\n: " + snames[a]);
		}

		// emit instruction/data
		var indent = tabs(pendingAgain.length + 1);
		if (pendingAgain.indexOf(a) != -1) {
			var index = pendingAgain.indexOf(a);
			pendingAgain.splice(index, 1);
			console.log("%sagain", tabs(pendingAgain.length + 1));
			x++;
		}
		else if (type[a] == "code") {
			console.log("%s%s", indent, display(program[a], program[a+1]));
			x++;
		}
		else if (type[a] == "data") {
			console.log("%s%s", indent, hexFormat(program[a]));
		}
		else if (type[a] == "smc" || type[a+1] == "smc") {
			console.log("%s%s %s # smc? %s",
				indent,
				hexFormat(program[a]),
				hexFormat(program[a+1]),
				display(program[a], program[a+1])
			);
			x++;
		}
		else {
			console.log("%s%s # unused?", indent, hexFormat(program[a]));
		}

		// space apart regions of differing types:
		if (type[a] != type[x+0x201]) {
			console.log("");
		}
	}
}

// notes/todos:
// - simple skips should (ideally) cleave the reaching set into taken/not taken
//   successor sets based on the values they inspect. The precision of this approach
//   is unclear to me right now; can we be more aggressive and establish invariants
//   for variables other than the variables directly tested by branches?
// - if I modeled dt I could calculate vx := dt using the max value set as an upper bound.

// - my first successful attempt at disassembling Brix seems pretty close,
//   but the ball/paddle appears screwed up and it took 2m37s to process (!)
//   like many of the ROMs I have been investigating, it seems to have a considerable
//   amount of statically dead data, with 0x00 padding between each sprite entry.
//   I'm starting to wonder if the original interpreter treated 'sprite' as drawing
//   a sprite of height n as n+1 pixels tall, achieving 1-16 tall sprites...

var fs = require('fs');
var buff = fs.readFileSync(process.argv[2]);

analyze(buff);
formatProgram(buff.length);
