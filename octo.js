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

var keys = {};       // track keys which are pressed
var waiting = false; // are we waiting for a keypress?
var waitReg = -1;    // destination register of an awaited key

var halted = false;

function init(program) {
	for(var z = 0; z < 4096; z++) { m[z] = 0; }
	for(var z = 0; z < font.length; z++) { m[z] = font[z]; }
	for(var z = 0; z < bigfont.length; z++) { m[z + font.length] = bigfont[z]; }
	for(var z = 0; z < program.length; z++) { m[0x200+z] = program[z]; }
	for(var z = 0; z < 16; z++) { v[z] = 0; }
	for(var z = 0; z < 32*64; z++) { p[z] = false; }
	pc = 0x200;
	i  = 0;
	dt = 0;
	st = 0;
	hires = false;
	keys = {};
	waiting = false;
	waitReg = -1;
	halted = false;
}

function math(x, y, op) {
	switch(op) {
		case 0x0: v[x]  = v[y]; break;
		case 0x1: v[x] |= v[y]; break;
		case 0x2: v[x] &= v[y]; break;
		case 0x3: v[x] ^= v[y]; break;
		case 0x4: var t = v[x]+v[y]; v[0xF] = (t > 0xFF)    ?1:0 ; v[x] = (t & 0xFF); break;
		case 0x5: var t = v[x]-v[y]; v[0xF] = (v[x] > v[y]) ?1:0 ; v[x] = (t & 0xFF); break;
		case 0x6: var t = v[y] >> 1; v[0xF] = (v[y] & 0x1)       ; v[x] = (t & 0xFF); break;
		case 0x7: var t = v[y]-v[x]; v[0xF] = (v[y] > v[x]) ?1:0 ; v[x] = (t & 0xFF); break;
		case 0xE: var t = v[y] << 1; v[0xF] = ((v[y] >> 7) & 0x1); v[x] = (t & 0xFF); break;
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
		case 0x55: for(var z = 0; z <= x; z++) { m[i+z] = v[z]; } i = (i+x+1)&0xFFF; break;
		case 0x65: for(var z = 0; z <= x; z++) { v[z] = m[i+z]; } i = (i+x+1)&0xFFF; break;
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
					p[a + b] = (b > 4) ? p[a + b - 1] : 0;
				}
			}
			return;
		}
		if (op == 0x00FC) {
			// scroll left 4 pixels
			var rowSize = hires ? 128 : 64;
			for(var a = 0; a < p.length; a += rowSize) {
				for(var b = 0; b < rowSize; b++) {
					p[a + b] = (b < rowSize - 4) ? p[a + b + 1] : 0;
				}
			}
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

////////////////////////////////////
//
//   Tokenization:
//
////////////////////////////////////

function parse(token) {
	var num = (token.slice(0, 2) == "0b") ? parseInt(token.slice(2),2) : parseInt(token);
	return isNaN(num) ? token : num;
}

function tokenize(text) {
	var ret   = [];
	var index = 0;
	var token = "";
	var tokenStart = -1;

	while(index < text.length) {
		var c = text.charAt(index++);
		if (c == '#') {
			if (token.length > 0) {
				ret.push([ parse(token), tokenStart, index ]);
				tokenStart = -1;
			}
			token = "";
			while(c != '\n' && index < text.length) {
				c = text.charAt(index++);
			}
		}
		else if (" \t\n\r\v".indexOf(c) >= 0) {
			if (token.length > 0) {
				ret.push([ parse(token), tokenStart, index ]);
				tokenStart = -1;
			}
			token = "";
		}
		else {
			if (tokenStart == -1) { tokenStart = index; }
			token += c;
		}
	}
	if (token.length > 0) {
		ret.push([ parse(token), tokenStart, index+1]);
	}
	return ret;
}

////////////////////////////////////
//
//   Prettyprinting:
//
////////////////////////////////////

function display(rom) {
	function hexFormat(num) {
		var hex = num.toString(16).toUpperCase();
		return "0x" + ((hex.length > 1) ? hex : "0" + hex);
	}
	return "[" + (rom.map(hexFormat).join(", ")) + "]";
}

////////////////////////////////////
//
//   The Octo Compiler:
//
////////////////////////////////////

function Compiler(source) {
	this.rom       = []; // list<int>
	this.loops     = []; // stack<[addr, marker]>
	this.whiles    = []; // stack<int>
	this.dict      = {}; // map<name, addr>
	this.protos    = {}; // map<name, list<addr>>
	this.aliases   = {}; // map<name, registernum>
	this.constants = {}; // map<name, token>
	this.hasmain = true;
	this.schip = false;

	this.pos = null;

	this.tokens = tokenize(source);
	this.next = function()    { this.pos = this.tokens[0]; this.tokens.splice(0, 1); return this.pos[0]; }
	this.peek = function()    { return this.tokens[0][0]; }
	this.here = function()    { return this.rom.length + 0x200; }
	this.inst = function(a,b) { this.rom.push(a & 0xFF); this.rom.push(b & 0xFF); }

	this.immediate = function(op, nnn) {
		this.inst(op | ((nnn >> 8) & 0xF), (nnn & 0xFF));
	}

	this.fourop = function(op, x, y, n) {
		this.inst((op << 4) | x, (y << 4) | (n & 0xF));
	}

	this.jump = function(addr, dest) {
		this.rom[addr - 0x200] = (0x10 | ((dest >> 8) & 0xF));
		this.rom[addr - 0x1FF] = (dest & 0xFF);
	}

	this.isRegister = function(name) {
		if (!name && (name != 0)) { name = this.peek(); }
		if (typeof name != "string") { return false; }
		if (name in this.aliases) { return true; }
		name = name.toUpperCase();
		if (name.length != 2) { return false; }
		if (name[0] != 'V') { return false; }
		return "0123456789ABCDEF".indexOf(name[1]) >= 0;
	}

	this.register = function(name) {
		if (!name) { name = this.next(); }
		if (!this.isRegister(name)) {
			throw "Expected register, got '" + name + "'";
		}
		if (name in this.aliases) {
			return this.aliases[name];
		}
		name = name.toUpperCase();
		return "0123456789ABCDEF".indexOf(name[1]);
	}

	this.expect = function(token) {
		var thing = this.next();
		if (thing != token) { throw "Expected '" + token + "', got '" + thing + "'!"; }
	}

	this.constantValue = function() {
		var number = this.next();
		if (typeof number != "number") {
			if (number in this.protos) {
				throw "Constants cannot refer to the address of a forward declaration.";
			}
			else if (number in this.dict) {
				number = this.dict[number];
			}
			else if (number in this.constants) {
				number = this.constants[number];
			}
			else { throw "Undefined name '"+number+"'."; }
		}
		if ((typeof number != "number") || (number < -128) || (number > 0xFFF)) {
			throw "Constant value '"+number+"' is out of range- must be in [-128, 4095].";
		}
		return (number & 0xFFF);
	}

	this.wideValue = function(nnn) {
		// can be forward references.
		// call, jump, jump0, i:=
		if (!nnn & (nnn != 0)) { nnn = this.next(); }
		if (typeof nnn != "number") {
			if (nnn in this.constants) {
				nnn = this.constants[nnn];
			}
			else if (nnn in this.protos) {
				this.protos[nnn].push(this.here());
				nnn = 0;
			}
			else if (nnn in this.dict) {
				nnn = this.dict[nnn];
			}
			else { throw "Undefined name '"+nnn+"'."; }
		}
		if ((typeof nnn != "number") || (nnn < 0) || (nnn > 0xFFF)) {
			throw "Value '"+nnn+"' cannot fit in 12 bits!";
		}
		return (nnn & 0xFFF);
	}

	this.shortValue = function(nn) {
		// vx:=, vx+=, vx==, v!=, random
		if (!nn && (nn != 0)) { nn = this.next(); }
		if (typeof nn != "number") {
			if (nn in this.constants) { nn = this.constants[nn]; }
			else if (nn in this.dict) { nn = this.dict[nn]; }
			else { throw "Undefined name '"+nn+"'."; }
		}
		// silently trim negative numbers, but warn
		// about positive numbers which are too large:
		if ((typeof nn != "number") || (nn < -128) || (nn > 255)) {
			throw "Argument '"+nn+"' does not fit in a byte- must be in [-128, 255].";
		}
		return (nn & 0xFF);
	}

	this.tinyValue = function() {
		// sprite length, unpack high nybble
		var n = this.next();
		if (typeof n != "number") {
			if (n in this.constants) { n = this.constants[n]; }
			else { throw "Undefined name '"+n+"'."; }
		}
		if ((typeof n != "number") || (n < 0) || (n > 15)) {
			throw "Invalid argument '"+n+"'; must be in [0,15].";
		}
		return (n & 0xF);
	}

	this.conditional = function(negated) {
		var reg   = this.register();
		var token = this.next();
		var compTemp = this.aliases["compare-temp"];
		if (negated) {
			if      (token == "=="  ) { token = "!="; }
			else if (token == "!="  ) { token = "=="; }
			else if (token == "key" ) { token == "-key"; }
			else if (token == "-key") { token == "key"; }
			else if (token == "<"   ) { token == ">="; }
			else if (token == ">"   ) { token == "<="; }
			else if (token == ">="  ) { token == "<"; }
			else if (token == "<="  ) { token == ">"; }
		}
		if (token == "==") {
			if (this.isRegister()) { this.inst(0x90 | reg, this.register() << 4); }
			else                   { this.inst(0x40 | reg, this.shortValue()); }
		}
		else if (token == "!=") {
			if (this.isRegister()) { this.inst(0x50 | reg, this.register() << 4); }
			else                   { this.inst(0x30 | reg, this.shortValue()); }
		}
		else if (token == "key") {
			this.inst(0xE0 | reg, 0xA1);
		}
		else if (token == "-key") {
			this.inst(0xE0 | reg, 0x9E);
		}
		else if (token == ">") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x3F, 0);                   // if vf == 0 then ...
		}
		else if (token == "<") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x3F, 0);                   // if vf == 0 then ...
		}
		else if (token == ">=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x4F, 0);                   // if vf != 0 then ...
		}
		else if (token == "<=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x4F, 0);                   // if vf != 0 then ...
		}
		else {
			throw "Conditional flag expected, got '" + token + "!";
		}
	}

	this.iassign = function(token) {
		if (token == ":=") {
			var o = this.next();
			if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
			if (o == "bighex") {
				this.schip = true;
				this.inst(0xF0 | this.register(), 0x30);
			}
			else { this.immediate(0xA0, this.wideValue(o)); }
		}
		else if (token == "+=") {
			this.inst(0xF0 | this.register(), 0x1E);
		}
		else {
			throw "The operator '"+token+"' cannot target the I register.";
		}
	}

	this.vassign = function(reg, token) {
		if (token == ":=") {
			var o = this.next();
			if (this.isRegister(o)) { this.fourop(0x8, reg, this.register(o), 0x0); }
			else if (o == "random") { this.inst(0xC0 | reg, this.shortValue()); }
			else if (o == "key")    { this.inst(0xF0 | reg, 0x0A); }
			else if (o == "delay")  { this.inst(0xF0 | reg, 0x07); }
			else                    { this.inst(0x60 | reg, this.shortValue(o)); }
		}
		else if ("+=" == token) {
			if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x4); }
			else                   { this.inst(0x70 | reg, this.shortValue()); }
		}
		else if ("|="  == token) { this.fourop(0x8, reg, this.register(), 0x1); }
		else if ("&="  == token) { this.fourop(0x8, reg, this.register(), 0x2); }
		else if ("^="  == token) { this.fourop(0x8, reg, this.register(), 0x3); }
		else if ("-="  == token) { this.fourop(0x8, reg, this.register(), 0x5); }
		else if ("=-"  == token) { this.fourop(0x8, reg, this.register(), 0x7); }
		else if (">>=" == token) { this.fourop(0x8, reg, this.register(), 0x6); }
		else if ("<<=" == token) { this.fourop(0x8, reg, this.register(), 0xE); }
		else {
			throw "Unrecognized operator '"+token+"'.";
		}
	}

	this.instruction = function(token) {
		if (token == ":") {
			var label = this.next();
			if ((this.here() == 0x202) && (label == "main")) {
				this.hasmain = false;
				this.rom = [];
			}
			this.dict[label] = this.here();

			if (label in this.protos) {
				for(var z = 0; z < this.protos[label].length; z++) {
					var addr  = this.protos[label][z];
					var patch = this.here();
					this.rom[addr - 0x200] = (this.rom[addr - 0x200] & 0xF0) | ((patch >> 8)&0xF);
					this.rom[addr - 0x1FF] = (patch & 0xFF);
				}
				delete this.protos[label];
			}
		}
		else if (token == ":unpack") {
			var v = this.tinyValue();
			var a = this.wideValue();
			this.inst(0x60 | this.aliases["unpack-hi"], (v << 4) | (a >> 8));
			this.inst(0x60 | this.aliases["unpack-lo"], a);
		}
		else if (token == ":proto")  { this.protos[this.next()] = []; }
		else if (token == ":alias")  { this.aliases[this.next()] = this.register(); }
		else if (token == ":const")  { this.constants[this.next()] = this.constantValue(); }
		else if (token in this.protos) { this.immediate(0x20, this.wideValue(token)); }
		else if (token in this.dict) { this.immediate(0x20, this.wideValue(token)); }
		else if (token == ";")       { this.inst(0x00, 0xEE); }
		else if (token == "return")  { this.inst(0x00, 0xEE); }
		else if (token == "clear")   { this.inst(0x00, 0xE0); }
		else if (token == "bcd")     { this.inst(0xF0 | this.register(), 0x33); }
		else if (token == "save")    { this.inst(0xF0 | this.register(), 0x55); }
		else if (token == "load")    { this.inst(0xF0 | this.register(), 0x65); }
		else if (token == "delay")   { this.expect(":="); this.inst(0xF0 | this.register(), 0x15); }
		else if (token == "buzzer")  { this.expect(":="); this.inst(0xF0 | this.register(), 0x18); }
		else if (token == "if")      { this.conditional(false); this.expect("then"); }
		else if (token == "jump0")   { this.immediate(0xB0, this.wideValue()); }
		else if (token == "jump")    { this.immediate(0x10, this.wideValue()); }
		else if (token == "sprite")  {
			var r1 = this.register();
			var r2 = this.register();
			var size = this.tinyValue();
			if (size == 0) { this.schip = true; }
			this.inst(0xD0 | r1, (r2 << 4) | size);
		}
		else if (token == "loop") {
			this.loops.push([this.here(), this.pos]);
			this.whiles.push(null);
		}
		else if (token == "while") {
			if (this.loops.length < 1) {
				throw "This 'while' is not within a loop.";
			}
			this.conditional(true);
			this.whiles.push(this.here());
			this.immediate(0x10, 0);
		}
		else if (token == "again") {
			if (this.loops.length < 1) {
				throw "This 'again' does not have a matching 'loop'.";
			}
			this.immediate(0x10, this.loops.pop()[0]);
			while (this.whiles[this.whiles.length - 1] != null) {
				this.jump(this.whiles.pop(), this.here());
			}
		}
		else if (token == "scroll-down")  { this.schip = true; this.inst(0x00, 0xC0 | this.tinyValue()); }
		else if (token == "scroll-right") { this.schip = true; this.inst(0x00, 0xFB); }
		else if (token == "scroll-left")  { this.schip = true; this.inst(0x00, 0xFC); }
		else if (token == "lores")        { this.schip = true; this.inst(0x00, 0xFE); }
		else if (token == "hires")        { this.schip = true; this.inst(0x00, 0xFF); }
		else if (token == "i") {
			this.iassign(this.next());
		}
		else if (this.isRegister(token)) {
			this.vassign(this.register(token), this.next());
		}
		else {
			throw "Unrecognized token '"+token+"'.";
		}
	}

	this.go = function() {
		this.aliases["compare-temp"] = 0xE;
		this.aliases["unpack-hi"]    = 0x0;
		this.aliases["unpack-lo"]    = 0x1;

		this.inst(0, 0); // reserve a jump slot
		while(this.tokens.length > 0) {
			if (typeof this.peek() == "number") {
				var nn = this.next();
				if (nn < -128 || nn > 255) {
					throw "Literal value '"+nn+"' does not fit in a byte- must be [-128, 255].";
				}
				this.rom.push(nn & 0xFF);
			}
			else {
				this.instruction(this.next());
			}
		}
		if (this.hasmain == true) {
			// resolve the main branch
			this.jump(0x200, this.wideValue("main"));
		}
		var keys = [];
		for (var k in this.protos) { keys.push(k); }
		if (keys.length > 0) {
			throw "Unresolved prototypes: " + keys;
		}
		if (this.loops.length > 0) {
			this.pos = this.loops[0][1];
			throw "This 'loop' does not have a matching 'again'.";
		}
	}
}

////////////////////////////////////
//
//   UI Glue:
//
////////////////////////////////////

function compile() {
	var input  = document.getElementById("input");
	var output = document.getElementById("output");
	var status = document.getElementById("status");

	var MAX_ROM = 3584;

	var c = new Compiler(input.value);
	try {
		output.value = "";
		output.style.display = "none";
		c.go();
		if (c.rom.length > MAX_ROM) {
			throw "Rom is too large- " + (c.rom.length-MAX_ROM) + " bytes over!";
		}
		output.value = display(c.rom);
		output.style.display = "initial";
		status.innerHTML = ((c.rom.length) + " bytes, " + (MAX_ROM-c.rom.length) + " free.");
		if (c.schip) { status.innerHTML += " (SuperChip instructions used)"; }
	}
	catch(error) {
		status.innerHTML = "<font color='red'>" + error + "</font>";
		if (c.pos != null) {
			input.focus();
			input.selectionStart = c.pos[1]-1;
			input.selectionEnd   = c.pos[2]-1;
		}
		return null;
	}

	return c.rom;
}

var intervalHandle;

function run() {
	runRom(compile());
}

function runRom(rom) {
	if (rom === null) { return; }
	init(rom);
	document.getElementById("editor").style.display = "none";
	document.getElementById("colors").style.display = "none";
	document.getElementById("emulator").style.display = "inline";
	window.addEventListener("keydown", keyDown, false);
	window.addEventListener("keyup"  , keyUp  , false);
	intervalHandle = setInterval(render, 1000/60);
	document.body.style.backgroundColor = "#000000";
}

function reset() {
	document.getElementById("editor").style.display = "inline";
	document.getElementById("emulator").style.display = "none";
	document.getElementById("colors").style.display = "none";
	window.removeEventListener("keydown", keyDown, false);
	window.removeEventListener("keyup"  , keyUp  , false);
	window.clearInterval(intervalHandle);
	document.body.style.backgroundColor = "#FFFFFF";
}

function load() {
	var fileSelector = document.createElement('input');

	function requestLoad() {
		var file = fileSelector.files[0];
		var reader = new FileReader();

		function actuallyLoad() {
			var buff = reader.result;
			var bytes = new Uint8Array(buff);
			runRom(bytes);
		}

		reader.onload = actuallyLoad;
		reader.readAsArrayBuffer(file);
	}
	fileSelector.setAttribute('type', 'file');
	fileSelector.onchange = requestLoad;
	fileSelector.click();
}

function save() {
	var bytes = new Uint8Array(compile());
	var binaryString = "";
	for(var z = 0; z < bytes.byteLength; z++) {
		binaryString += String.fromCharCode(bytes[z]);
	}
	var dataUri = "data:application/octet-stream;base64," + btoa(binaryString);
	window.open(dataUri);
}

function share() {
	// cribbed from increpare/Puzzlescript/js/toolbar.js
	var xhr = new XMLHttpRequest();
	xhr.open('POST', 'https://api.github.com/gists');
	xhr.onreadystatechange = function() {
		if(xhr.readyState !== 4)
			return;
		var result = JSON.parse(xhr.responseText);
		if (xhr.status === 403) {
			alert(result.message);
		} else if (xhr.status !== 200 && xhr.status !== 201) {
			alert("HTTP Error "+ xhr.status + ' - ' + xhr.statusText);
		} else {
			window.location.href = window.location.href.replace(/(index.html|\?gist=.*)*$/, 'index.html?gist=' + result.id);
		}
	}
	var prog = document.getElementById("input").value;
	var options = JSON.stringify({
		"tickrate"        : TICKS_PER_FRAME,
		"backgroundColor" : BACK_COLOR,
		"fillColor"       : FILL_COLOR,
		"buzzColor"       : BUZZ_COLOR,
		"quietColor"      : QUIET_COLOR
	});
	xhr.send(JSON.stringify({
		"description" : "Octo Chip8 Program",
		"public" : true,
		"files": {
			"readme.txt" : {
				"content": "Play this game by pasting the program into http://johnearnest.github.io/Octo/"
			},
			"prog.ch8" : {"content": prog},
			"options.json": {"content": options}
		}
	}));
}

function runGist() {
	var xhr = new XMLHttpRequest();
	var gistId = location.search.match(/gist=(\w+)/);
	if (!gistId)
		return;
	xhr.open('GET', 'https://api.github.com/gists/' + gistId[1]);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status !== 201)) {
			var result = JSON.parse(xhr.responseText);
			document.getElementById("input").value = result.files["prog.ch8"].content;
			var options = JSON.parse(result.files["options.json"].content);
			var framerateNum = options["tickrate"]|0;
			var framerateEl = document.getElementById("framerate");
			framerateEl.value = framerateNum;
			if (framerateEl.value == "") {
				TICKS_PER_FRAME = framerateNum;
			} else {
				TICKS_PER_FRAME = framerateEl.value;
			}
			if (options["backgroundColor"]) { BACK_COLOR  = options["backgroundColor"]; }
			if (options["fillColor"      ]) { FILL_COLOR  = options["fillColor"      ]; }
			if (options["buzzColor"      ]) { BUZZ_COLOR  = options["buzzColor"      ]; }
			if (options["quietColor"     ]) { QUIET_COLOR = options["quietColor"     ]; }
			run();
		}
	}
	xhr.send();
}

function framerate() {
	TICKS_PER_FRAME = document.getElementById("framerate").value;
}

function render() {
	var c = document.getElementById("target");
	var g = c.getContext("2d");

	for(var z = 0; (z < TICKS_PER_FRAME) && (!waiting); z++) { tick(); }

	if (dt > 0) { dt--; }
	if (st > 0) { st--; }
	document.body.style.backgroundColor = (st > 0) ? BUZZ_COLOR : QUIET_COLOR;

	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = BACK_COLOR;
	g.fillRect(0, 0, 640, 320);
	g.fillStyle = FILL_COLOR;

	if (hires) {
		for(var z = 0; z < 64*128; z++) {
			if (p[z]) { g.fillRect(Math.floor(z%128)*5, Math.floor(z/128)*5, 5, 5); }
		}
	}
	else {
		for(var z = 0; z < 32*64; z++) {
			if (p[z]) { g.fillRect(Math.floor(z%64)*10, Math.floor(z/64)*10, 10, 10); }
		}
	}
}

function keyDown(event) {
	if (!(event.keyCode in keys)) { keys[event.keyCode] = true; }
}

function keyUp(event) {
	if (event.keyCode in keys) { delete keys[event.keyCode]; }
	if (event.keyCode == 27) { reset(); }
	if (waiting) {
		for(var z = 0; z < 16; z++) {
			if (KEYMAP[z] == event.keyCode) {
				waiting = false;
				v[waitReg] = z;
				return;
			}
		}
	}
}

document.getElementById("input").onkeydown = function(event) {
	if (event.keyCode == 9) {
		var text  = this.value;
		var start = this.selectionStart;
		var end   = this.selectionEnd;

		this.value = text.substring(0, start) + '\t' + text.substring(end);
		this.selectionStart = this.selectionEnd = start + 1;
		return false;
	}
};

////////////////////////////////////
//
//   Color picker stuff:
//
////////////////////////////////////

function editBack() {
	var val = document.getElementById("backEdit").value;
	document.getElementById("backSample").bgColor = val;
	BACK_COLOR = val;
	showPixels();
}

function editFore() {
	var val = document.getElementById("foreEdit").value;
	document.getElementById("foreSample").bgColor = val;
	FILL_COLOR = val;
	showPixels();
}

function editBuzz() {
	var val = document.getElementById("buzzEdit").value;
	document.getElementById("buzzSample").bgColor = val;
	BUZZ_COLOR = val;
}

function editSilent() {
	var val = document.getElementById("silentEdit").value;
	document.getElementById("silentSample").bgColor = val;
	QUIET_COLOR = val;
}

function toggleColors() {
	var colors = document.getElementById("colors");
	if (colors.style.display == "none") {
		colors.style.display = "inline";
		document.getElementById("backEdit").value   = BACK_COLOR;  editBack();
		document.getElementById("foreEdit").value   = FILL_COLOR;  editFore();
		document.getElementById("buzzEdit").value   = BUZZ_COLOR;  editBuzz();
		document.getElementById("silentEdit").value = QUIET_COLOR; editSilent();
	}
	else {
		colors.style.display = "none";
	}
}

////////////////////////////////////
//
//   Sprite editor stuff:
//
////////////////////////////////////

function toggleSpriteEditor() {
	var editor = document.getElementById("spriteEditor");
	if (editor.style.display == "none") {
		editor.style.display = "inline";
		showPixels();
	}
	else {
		editor.style.display = "none";
	}
}

function showPixels() {
	var render = document.getElementById("draw").getContext("2d");
	render.fillStyle = BACK_COLOR;
	render.fillRect(0, 0, 200, 375);
	render.fillStyle = FILL_COLOR;
	for(var row = 0; row < 16; row++) {
		for(var col = 0; col < 8; col++) {
			if (pixel[row] & (1 << (7-col))) {
				render.fillRect(col * 25, row * 25, 25, 25);
			}
		}
	}
}

function showHex() {
	var output = document.getElementById("spriteData");
	var hex = "";
	for(var z = 0; z < 15; z++) {
		var digits = pixel[z].toString(16).toUpperCase();
		hex += "0x" + (digits.length == 1 ? "0"+digits : digits) + " ";
	}
	output.value = hex;
}

function editHex() {
	var output = document.getElementById("spriteData");
	var bytes = output.value.trim().split(new RegExp("\\s+"));
	for(var z = 0; z < 15; z++) {
		if (z < bytes.length) {
			var tok = bytes[z].trim();
			var num = (tok.slice(0, 2) == "0b") ? parseInt(tok.slice(2),2) : parseInt(tok);
			pixel[z] = isNaN(num) ? 0 : num;
		}
		else {
			pixel[z] = 0;
		}
	}
	showPixels();
}

function drag(event) {
	if (mode == 0) { return; }
	var rect = document.getElementById("draw").getBoundingClientRect();
	var mx   = event.clientX - rect.left;
	var my   = event.clientY - rect.top;
	if (mode == 1) {
		// draw
		pixel[Math.floor(my/25)] |= (128 >> Math.floor(mx/25));
	}
	else {
		// erase
		pixel[Math.floor(my/25)] &= ~(128 >> Math.floor(mx/25));
	}
	showHex();
	showPixels();
}

function release(event)    { mode = 0; drag(event); }
function pressDraw(event)  { if (event.button == 2) {mode = 2;} else {mode = 1;} drag(event); }

var mode = 0;
var pixel = [];
for(var z = 0; z < 15; z++) { pixel[z] = 0; }

var spriteCanvas = document.getElementById("draw");
spriteCanvas.addEventListener("mousemove", drag, false);
spriteCanvas.addEventListener("mousedown", pressDraw, false);
spriteCanvas.addEventListener("mouseup"  , release, false);
spriteCanvas.oncontextmenu = function(event) { drag(event); return false; };
spriteCanvas.addEventListener("mouseout", release, false);

////////////////////////////////////
//
//   Virtual keypad stuff:
//
////////////////////////////////////

function buttonDn(key) {
	keyDown({ keyCode: KEYMAP[key]});
}
function buttonUp(key) {
	if (KEYMAP[key] in keys) {
		keyUp({ keyCode: KEYMAP[key]});
	}
}

for(var k = 0; k <= 0xF; k++) {
	var hex = k.toString(16).toUpperCase();
	var button = document.getElementById("0x" + hex);
	button.onmousedown = buttonDn.bind(undefined, k);
	button.onmouseup   = buttonUp.bind(undefined, k);
	button.onmouseout  = buttonUp.bind(undefined, k);
}

function toggleKeypad() {
	var keypad = document.getElementById("keypad");
	if (keypad.style.display == "none") {
		keypad.style.display = "inline";
	}
	else {
		keypad.style.display = "none";
	}
}