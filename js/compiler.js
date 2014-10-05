"use strict";

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
	this.breakpoints = {}; // map<address, name>
	this.hereaddr = 0x200;

	this.pos = null;

	this.data = function(a) {
		if (typeof this.rom[this.hereaddr-0x200] != "undefined") {
			throw "Data overlap. Address "+hexFormat(this.hereaddr)+" has already been defined.";
		}
		this.rom[this.hereaddr-0x200] = (a & 0xFF);
		this.hereaddr++;
	}

	this.tokens = tokenize(source);
	this.next = function()    { this.pos = this.tokens[0]; this.tokens.splice(0, 1); return this.pos[0]; }
	this.peek = function()    { return this.tokens[0][0]; }
	this.here = function()    { return this.hereaddr; }
	this.inst = function(a,b) { this.data(a); this.data(b); }

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
		return number;
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
			else {
				this.protos[nnn] = [this.here()];
				nnn = 0;
			}
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
			else { throw "Undefined name '"+nn+"'."; }
		}
		// silently trim negative numbers, but warn
		// about positive numbers which are too large:
		if ((typeof nn != "number") || (nn < -128) || (nn > 255)) {
			throw "Argument '"+nn+"' does not fit in a byte- must be in range [-128, 255].";
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
			throw "Invalid argument '"+n+"'; must be in range [0,15].";
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
			else if (token == "key" ) { token = "-key"; }
			else if (token == "-key") { token = "key"; }
			else if (token == "<"   ) { token = ">="; }
			else if (token == ">"   ) { token = "<="; }
			else if (token == ">="  ) { token = "<"; }
			else if (token == "<="  ) { token = ">"; }
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
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x3F, 1);                   // if vf == 1 then ...
		}
		else if (token == "<") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x3F, 1);                   // if vf == 1 then ...
		}
		else if (token == ">=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x4F, 1);                   // if vf != 1 then ...
		}
		else if (token == "<=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x4F, 1);                   // if vf != 1 then ...
		}
		else {
			throw "Conditional flag expected, got '" + token + "!";
		}
	}

	this.iassign = function(token) {
		if (token == ":=") {
			var o = this.next();
			if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
			else if (o == "bighex") {
				this.schip = true;
				this.inst(0xF0 | this.register(), 0x30);
			}
			else { this.immediate(0xA0, this.wideValue(o)); }
		}
		else if (token == "+=") {
			this.inst(0xF0 | this.register(), 0x1E);
		}
		else {
			throw "The operator '"+token+"' cannot target the i register.";
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

	this.resolveLabel = function(offset) {
		var target = (this.here() + offset);
		var label = this.next();
		if ((target == 0x202) && (label == "main")) {
			this.hasmain = false;
			this.rom = [];
			this.hereaddr = 0x200;
			target = this.here();
		}
		if (label in this.dict) { throw "The name '"+label+"' has already been defined."; }
		this.dict[label] = target;

		if (label in this.protos) {
			for(var z = 0; z < this.protos[label].length; z++) {
				var addr  = this.protos[label][z];
				if ((this.rom[addr - 0x200] & 0xF0) == 0x60) {
					// :unpack target
					this.rom[addr - 0x1FF] = (this.rom[addr - 0x1FF] & 0xF0) | ((target >> 8)&0xF);
					this.rom[addr - 0x1FD] = (target & 0xFF);
				}
				else {
					this.rom[addr - 0x200] = (this.rom[addr - 0x200] & 0xF0) | ((target >> 8)&0xF);
					this.rom[addr - 0x1FF] = (target & 0xFF);
				}
			}
			delete this.protos[label];
		}
	}

	this.instruction = function(token) {
		if (token == ":") { this.resolveLabel(0); }
		else if (token == ":next") { this.resolveLabel(1); }
		else if (token == ":unpack") {
			var v = this.tinyValue();
			var a = this.wideValue();
			this.inst(0x60 | this.aliases["unpack-hi"], (v << 4) | (a >> 8));
			this.inst(0x60 | this.aliases["unpack-lo"], a);
		}
		else if (token == ":breakpoint") { this.breakpoints[this.here()] = this.next(); }
		else if (token == ":proto")  { this.next(); } // deprecated.
		else if (token == ":alias")  { this.aliases[this.next()] = this.register(); }
		else if (token == ":const")  {
			var name = this.next();
			if (name in this.constants) { throw "The name '"+name+"' has already been defined."; }
			this.constants[name] = this.constantValue();
		}
		else if (token == ":org")    { this.hereaddr = this.constantValue(); }
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
		else if (token == "native")  { this.immediate(0x00, this.wideValue()); }
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
		else if (token == "exit")         { this.schip = true; this.inst(0x00, 0xFD); }
		else if (token == "lores")        { this.schip = true; this.inst(0x00, 0xFE); }
		else if (token == "hires")        { this.schip = true; this.inst(0x00, 0xFF); }
		else if (token == "saveflags") {
			var flags = this.register();
			if (flags > 7) { throw "saveflags argument must be v[0,7]."; }
			this.schip = true;
			this.inst(0xF0 | flags, 0x75);
		}
		else if (token == "loadflags") {
			var flags = this.register();
			if (flags > 7) { throw "loadflags argument must be v[0,7]."; }
			this.schip = true;
			this.inst(0xF0 | flags, 0x85);
		}
		else if (token == "i") {
			this.iassign(this.next());
		}
		else if (this.isRegister(token)) {
			this.vassign(this.register(token), this.next());
		}
		else {
			this.immediate(0x20, this.wideValue(token));
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
					throw "Literal value '"+nn+"' does not fit in a byte- must be in range [-128, 255].";
				}
				this.data(nn);
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
			throw "Undefined names: " + keys;
		}
		if (this.loops.length > 0) {
			this.pos = this.loops[0][1];
			throw "This 'loop' does not have a matching 'again'.";
		}
		for(var index = 0; index < this.rom.length; index++) {
			if (typeof this.rom[index] == "undefined") { this.rom[index] = 0x00; }
		}
	}
}

this.Compiler = Compiler;