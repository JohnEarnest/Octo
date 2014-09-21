"use strict";

////////////////////////////////////
//
//   Configuration options:
//
////////////////////////////////////

var TICKS_PER_FRAME = 7;
var FILL_COLOR  = "#FFCC00";
var BACK_COLOR  = "#996600";
var BUZZ_COLOR  = "#FFAA00";
var QUIET_COLOR = "#000000";

var SHIFT_QUIRKS = false;
var LOAD_STORE_QUIRKS = false;

var KEYMAP = [
	// chip8    // keyboard
	/* 0 */ 88, // x
	/* 1 */ 49, // 1
	/* 2 */ 50, // 2
	/* 3 */ 51, // 3
	/* 4 */ 81, // q
	/* 5 */ 87, // w
	/* 6 */ 69, // e
	/* 7 */ 65, // a
	/* 8 */ 83, // s
	/* 9 */ 68, // d
	/* A */ 90, // z
	/* B */ 67, // c
	/* C */ 52, // 4
	/* D */ 82, // r
	/* E */ 70, // f
	/* F */ 86  // v
];

////////////////////////////////////
//
//   The Chip8 Interpreter:
//
////////////////////////////////////

var font = [
	0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
	0x20, 0x60, 0x20, 0x20, 0x70, // 1
	0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
	0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
	0x90, 0x90, 0xF0, 0x10, 0x10, // 4
	0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
	0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
	0xF0, 0x10, 0x20, 0x40, 0x40, // 7
	0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
	0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
	0xF0, 0x90, 0xF0, 0x90, 0x90, // A
	0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
	0xF0, 0x80, 0x80, 0x80, 0xF0, // C
	0xE0, 0x90, 0x90, 0x90, 0xE0, // D
	0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
	0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];

var bigfont = [
	0xFF, 0xFF, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, // 0
	0x18, 0x78, 0x78, 0x18, 0x18, 0x18, 0x18, 0x18, 0xFF, 0xFF, // 1
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // 2
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 3
	0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0x03, 0x03, // 4
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 5
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 6
	0xFF, 0xFF, 0x03, 0x03, 0x06, 0x0C, 0x18, 0x18, 0x18, 0x18, // 7
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 8
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 9
	0x7E, 0xFF, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xC3, // A
	0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, // B
	0x3C, 0xFF, 0xC3, 0xC0, 0xC0, 0xC0, 0xC0, 0xC3, 0xFF, 0x3C, // C
	0xFC, 0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFE, 0xFC, // D
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // E
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xC0, 0xC0  // F
];

var p  = [];       // pixels
var m  = [];       // memory (bytes)
var r  = [];       // return stack
var v  = [];       // registers
var pc = 0x200;    // program counter
var i  = 0;        // index register
var dt = 0;        // delay timer
var st = 0;        // sound timer
var hires = false; // are we in SuperChip high res mode?

var flags = []     // semi-persistent hp48 flag vars

var keys = {};       // track keys which are pressed
var waiting = false; // are we waiting for a keypress?
var waitReg = -1;    // destination register of an awaited key

var halted = false;
var breakpoint = false;
var metadata = {};
var tickCounter = 0;

function init(rom) {
	var program = rom.rom;
	metadata = rom;
	for(var z = 0; z < 4096; z++) { m[z] = 0; }
	for(var z = 0; z < font.length; z++) { m[z] = font[z]; }
	for(var z = 0; z < bigfont.length; z++) { m[z + font.length] = bigfont[z]; }
	for(var z = 0; z < program.length; z++) { m[0x200+z] = program[z]; }
	for(var z = 0; z < 16; z++) { v[z] = 0; }
	for(var z = 0; z < 32*64; z++) { p[z] = false; }
	pc = 0x200;
	r = [];
	i  = 0;
	dt = 0;
	st = 0;
	hires = false;
	keys = {};
	waiting = false;
	waitReg = -1;
	halted = false;
	breakpoint = false;
	tickCounter = 0;
}

function math(x, y, op) {
	switch(op) {
		case 0x0: v[x]  = v[y]; break;
		case 0x1: v[x] |= v[y]; break;
		case 0x2: v[x] &= v[y]; break;
		case 0x3: v[x] ^= v[y]; break;
		case 0x4: var t = v[x]+v[y]; v[0xF] = (t > 0xFF)    ?1:0 ; v[x] = (t & 0xFF); break;
		case 0x5: var t = v[x]-v[y]; v[0xF] = (v[x] > v[y]) ?1:0 ; v[x] = (t & 0xFF); break;
		case 0x7: var t = v[y]-v[x]; v[0xF] = (v[y] > v[x]) ?1:0 ; v[x] = (t & 0xFF); break;
		case 0x6:
			if (SHIFT_QUIRKS) { y = x; }
			var t = v[y] >> 1;
			v[0xF] = (v[y] & 0x1);
			v[x] = (t & 0xFF);
			break;
		case 0xE:
			if (SHIFT_QUIRKS) { y = x; }
			var t = v[y] << 1;
			v[0xF] = ((v[y] >> 7) & 0x1);
			v[x] = (t & 0xFF);
			break;
		default: throw "unknown math op: " + op;
	}
}

function misc(x, rest) {
	switch(rest) {
		case 0x07: v[x] = dt; break;
		case 0x0A: waiting = true; waitReg = x; break;
		case 0x15: dt = v[x]; break;
		case 0x18: st = v[x]; break;
		case 0x1E: i = (i + v[x]) & 0xFFF; break;
		case 0x29: i = ((v[x] & 0xF) * 5); break;
		case 0x30: i = ((v[x] & 0xF) * 10 + font.length); break;
		case 0x33: m[i] = Math.floor(v[x]/100)%10; m[i+1] = Math.floor(v[x]/10)%10; m[i+2] = v[x]%10; break;
		case 0x55:
			for(var z = 0; z <= x; z++) { m[i+z] = v[z]; }
			if (!LOAD_STORE_QUIRKS) { i = (i+x+1)&0xFFF; }
			break;
		case 0x65:
			for(var z = 0; z <= x; z++) { v[z] = m[i+z]; }
			if (!LOAD_STORE_QUIRKS) { i = (i+x+1)&0xFFF; }
			break;
		case 0x75:
			for(var z = 0; z <= x; z++) { flags[z] = v[z]; }
			localStorage.setItem("octoFlagRegisters", JSON.stringify(flags));
			break;
		case 0x85:
			flags = JSON.parse(localStorage.getItem("octoFlagRegisters"));
			if (typeof flags == "undefined") {
				flags = [0, 0, 0, 0, 0, 0, 0, 0];
			}
			for(var z = 0; z <= x; z++) { v[z] = flags[z]; }
			break;
		default: throw "unknown misc op: " + rest;
	}
}

function sprite(x, y, len) {
	v[0xF] = 0x0;
	var rowSize = hires ? 128 : 64;
	var colSize = hires ?  64 : 32;
	if (len == 0) {
		// draw a SuperChip 16x16 sprite.
		for(var a = 0; a < 16; a++) {
			for(var b = 0; b < 16; b++) {
				var target = ((x+b) % rowSize) + ((y+a) % colSize)*rowSize;
				var source = ((m[i+(a*2)+(b > 7 ? 1:0)] >> (7-(b%8))) & 0x1) != 0;
				if (!source) { continue; }
				if (p[target]) { p[target] = false; v[0xF] = 0x1; }
				else { p[target] = true; }
			}
		}
	}
	else {
		for(var a = 0; a < len; a++) {
			for(var b = 0; b < 8; b++) {
				var target = ((x+b) % rowSize) + ((y+a) % colSize)*rowSize;
				var source = ((m[i+a] >> (7-b)) & 0x1) != 0;
				if (!source) { continue; }
				if (p[target]) { p[target] = false; v[0xF] = 0x1; }
				else { p[target] = true; }
			}
		}
	}
}

function tick() {
	if (halted) { return; }
	tickCounter++;
	try {
		var op  = (m[pc  ] << 8) | m[pc+1];
		var o   = (m[pc  ] >> 4) & 0x00F;
		var x   = (m[pc  ]     ) & 0x00F;
		var y   = (m[pc+1] >> 4) & 0x00F;
		var n   = (m[pc+1]     ) & 0x00F;
		var nn  = (m[pc+1]     ) & 0x0FF;
		var nnn = op             & 0xFFF;
		pc += 2;

		if (op == 0x00E0) {
			for(var z = 0; z < p.length; z++) { p[z] = false; }
			return;
		}
		if (op == 0x00EE) {
			pc = r.pop();
			return;
		}
		if ((op & 0xF0FF) == 0xE09E) {
			if (KEYMAP[v[x]] in keys) { pc += 2; }
			return;
		}
		if ((op & 0xF0FF) == 0xE0A1) {
			if (!(KEYMAP[v[x]] in keys)) { pc += 2; }
			return;
		}
		if ((op & 0xFFF0) == 0x00C0) {
			// scroll down n pixels
			var rowSize = hires ? 128 : 64;
			for(var z = p.length; z >= 0; z--) {
				p[z] = (z > rowSize * n) ? p[z - (rowSize * n)] : 0;
			}
			return;
		}
		if (op == 0x00FB) {
			// scroll right 4 pixels
			var rowSize = hires ? 128 : 64;
			for(var a = 0; a < p.length; a += rowSize) {
				for(var b = rowSize-1; b >= 0; b--) {
					p[a + b] = (b > 3) ? p[a + b - 4] : 0;
				}
			}
			return;
		}
		if (op == 0x00FC) {
			// scroll left 4 pixels
			var rowSize = hires ? 128 : 64;
			for(var a = 0; a < p.length; a += rowSize) {
				for(var b = 0; b < rowSize; b++) {
					p[a + b] = (b < rowSize - 4) ? p[a + b + 4] : 0;
				}
			}
			return;
		}
		if (op == 0x00FD) {
			halted = true;
			reset();
			return;
		}
		if (op == 0x00FE) {
			hires = false;
			p = [];
			for(var z = 0; z < 32*64; z++) { p[z] = false; }
			return;
		}
		if (op == 0x00FF) {
			hires = true;
			p = [];
			for(var z = 0; z < 64*128; z++) { p[z] = false; }
			return;
		}

		switch(o) {
			case 0x0: throw "machinecode not supported.";
			case 0x1: pc = nnn;                      break;
			case 0x2: r.push(pc); pc = nnn;          break;
			case 0x3: if (v[x] == nn)   { pc += 2; } break;
			case 0x4: if (v[x] != nn)   { pc += 2; } break;
			case 0x5: if (v[x] == v[y]) { pc += 2; } break;
			case 0x6: v[x] = nn;                     break;
			case 0x7: v[x] = (v[x] + nn) & 0xFF;     break;
			case 0x8: math(x, y, n);                 break;
			case 0x9: if (v[x] != v[y]) { pc += 2; } break;
			case 0xA: i = nnn;                       break;
			case 0xB: pc = nnn + v[0];               break;
			case 0xC: v[x] = (Math.random()*255)&nn; break;
			case 0xD: sprite(v[x], v[y], n);         break;
			case 0xF: misc(x, nn);                   break;
			default: throw "unknown op: " + o;
		}
	}
	catch(err) {
		console.log("halted: " + err);
		halted = true;
	}
}