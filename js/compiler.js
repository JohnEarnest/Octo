"use strict";

////////////////////////////////////
//
//   Tokenization:
//
////////////////////////////////////

function parse(token) {
	var num = parseNumber(token);
	return isNaN(num) ? token : num;
}

function parseNumber(token) {

	// Check if this token is a valid binary number
	if (/^[+\-]?0b[01]+$/.test(token)) {

		var bitstring;
		var isNegative = (token.indexOf('-') == 0);

		// Check for any leading +/- sign character
		if(isNegative || (token.indexOf('+') == 0)) {
			// Remove sign character and 0b- prefix
			bitstring = token.slice(3);
		} else {
			// Remove 0b- prefix
			bitstring = token.slice(2);
		}

		var value = parseInt(bitstring, 2);
		return (isNegative) ? -value : value;
	}

	// Check if this token is a valid hexadecimal number
	if (/^[+\-]?0x[0-9a-f]+$/i.test(token)) {
		return parseInt(token, 16);
	}

	// Check if this token is a valid decimal number
	if (/^[+\-]?[0-9]+$/.test(token)) {
		return parseInt(token, 10);
	}

	return NaN;
}

var escapeChars = {
	't' : '\t',
	'n' : '\n',
	'r' : '\r',
	'v' : '\v',
	'0' : '\0',
	'\\': '\\',
	'"' : '\"',
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
		else if (c == '"') {
			if (token.length > 0) {
				ret.push([ parse(token), tokenStart, index ]);
			}
			var str = '';
			tokenStart = index;
			while (true) {
				if (index >= text.length) { throw "Missing a closing \" in a string literal."; }
				c = text.charAt(index++);
				if (c == '"') { break; }
				if (c == '\\') {
					var esc = text.charAt(index++);
					if (!(esc in escapeChars)) { throw "Unrecognized escape character '"+esc+"' in a string literal."; }
					c = escapeChars[esc];
				}
				str = str + c;
			}
			ret.push([ str, tokenStart, index+1 ]);
			tokenStart = -1;
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

function DebugInfo(source) {
	this.lines = source.split('\n');
	this._locs = {}; // map<addr, line>
}

DebugInfo.prototype.mapAddr = function(addr, pos) {
	this._locs[addr] = pos;
}

DebugInfo.prototype.getLine = function(addr) {
	var i = this._locs[addr];
	return i != undefined? this.posToLine(i): undefined
}

DebugInfo.prototype.getAddr = function(line) {
	for (var addr in this._locs) {
		if (this.posToLine(this._locs[addr]) == line) return addr
	}
	return undefined
}

DebugInfo.prototype.posToLine = function(pos) {
	var i;
	for (i = 0; i < this.lines.length; i++) {
		pos -= this.lines[i].length + 1;
		if (pos <= 0)
			break;
	}
	return i;
}

var unaryFunc = {
	'-'    : function(x) { return -x; },
	'~'    : function(x) { return ~x; },
	'!'    : function(x) { return +!x; },
	'sin'  : function(x) { return Math.sin(x);   },
	'cos'  : function(x) { return Math.cos(x);   },
	'tan'  : function(x) { return Math.tan(x);   },
	'exp'  : function(x) { return Math.exp(x);   },
	'log'  : function(x) { return Math.log(x);   },
	'abs'  : function(x) { return Math.abs(x);   },
	'sqrt' : function(x) { return Math.sqrt(x);  },
	'sign' : function(x) { return Math.sign(x);  },
	'ceil' : function(x) { return Math.ceil(x);  },
	'floor': function(x) { return Math.floor(x); },
	'@'    : function(x,m) { return m[(0|x)-0x200]||0; },
};
var binaryFunc = {
	'-'    : function(x,y) { return x-y; },
	'+'    : function(x,y) { return x+y; },
	'*'    : function(x,y) { return x*y; },
	'/'    : function(x,y) { return x/y; },
	'%'    : function(x,y) { return x%y; },
	'&'    : function(x,y) { return x&y; },
	'|'    : function(x,y) { return x|y; },
	'^'    : function(x,y) { return x^y; },
	'<<'   : function(x,y) { return x<<y; },
	'>>'   : function(x,y) { return x>>y; },
	'pow'  : function(x,y) { return Math.pow(x, y); },
	'min'  : function(x,y) { return Math.min(x, y); },
	'max'  : function(x,y) { return Math.max(x, y); },
	'<'    : function(x,y) { return +(x<y); },
	'>'    : function(x,y) { return +(x>y); },
	'<='   : function(x,y) { return +(x<=y); },
	'>='   : function(x,y) { return +(x>=y); },
	'=='   : function(x,y) { return +(x==y); },
	'!='   : function(x,y) { return +(x!=y); },
};

function Compiler(source) {
	this.rom       = []; // list<int>
	this.dbginfo   = new DebugInfo(source);
	this.loops     = []; // stack<[addr, marker]>
	this.branches  = []; // stack<[addr, marker, type]>
	this.whiles    = []; // stack<int>
	this.dict      = {}; // map<name, addr>
	this.protos    = {}; // map<name, list<addr>>
	this.longproto = {}; // set<name, true>
	this.aliases   = {}; // map<name, registernum>
	this.constants = {   // map<name, token>
		'OCTO_KEY_1': 0x1,
		'OCTO_KEY_2': 0x2,
		'OCTO_KEY_3': 0x3,
		'OCTO_KEY_4': 0xC,
		'OCTO_KEY_Q': 0x4,
		'OCTO_KEY_W': 0x5,
		'OCTO_KEY_E': 0x6,
		'OCTO_KEY_R': 0xD,
		'OCTO_KEY_A': 0x7,
		'OCTO_KEY_S': 0x8,
		'OCTO_KEY_D': 0x9,
		'OCTO_KEY_F': 0xE,
		'OCTO_KEY_Z': 0xA,
		'OCTO_KEY_X': 0x0,
		'OCTO_KEY_C': 0xB,
		'OCTO_KEY_V': 0xF,
	};
	this.macros    = {}; // map<name, {args, body}>
	this.stringmodes = {}; // map<name, map<chars,{args, body}>}>
	this.hasmain = true;
	this.schip = false;
	this.xo = false;
	this.breakpoints = {}; // map<address, name>
	this.monitors = {}; // map<name, {base, length}>
	this.hereaddr = 0x200;

	this.pos = null;
	this.currentToken = 0
	this.source = source;
	this.tokens = null;
}

Compiler.prototype.data = function(a) {
	if (typeof this.rom[this.hereaddr-0x200] != "undefined" && this.hereaddr-0x200 >= 0) {
		throw "Data overlap. Address "+hexFormat(this.hereaddr)+" has already been defined.";
	}
	this.rom[this.hereaddr-0x200] = (a & 0xFF);
	if (this.pos) this.dbginfo.mapAddr(this.hereaddr, this.pos[1]);
	this.hereaddr++;
}

Compiler.prototype.end = function()     { return this.currentToken >= this.tokens.length }
Compiler.prototype.next = function()    { this.pos = this.tokens[this.currentToken++]; return this.pos[0]; }
Compiler.prototype.raw  = function()    { this.pos = this.tokens[this.currentToken++]; return this.pos; }
Compiler.prototype.peek = function()    { return this.tokens[this.currentToken][0]; }
Compiler.prototype.here = function()    { return this.hereaddr; }
Compiler.prototype.inst = function(a,b) { this.data(a); this.data(b); }

Compiler.prototype.immediate = function(op, nnn) {
	this.inst(op | ((nnn >> 8) & 0xF), (nnn & 0xFF));
}

Compiler.prototype.fourop = function(op, x, y, n) {
	this.inst((op << 4) | x, (y << 4) | (n & 0xF));

}
Compiler.prototype.jump = function(addr, dest) {
	this.rom[addr - 0x200] = (0x10 | ((dest >> 8) & 0xF));
	this.rom[addr - 0x1FF] = (dest & 0xFF);
}

Compiler.prototype.isRegister = function(name) {
	if (!name && (name != 0)) { name = this.peek(); }
	if (typeof name != "string") { return false; }
	if (name in this.aliases) { return true; }
	name = name.toUpperCase();
	if (name.length != 2) { return false; }
	if (name[0] != 'V') { return false; }
	return "0123456789ABCDEF".indexOf(name[1]) >= 0;
}

Compiler.prototype.register = function(name) {
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

Compiler.prototype.expect = function(token) {
	var thing = this.next();
	if (thing != token) { throw "Expected '" + token + "', got '" + thing + "'!"; }
}

Compiler.prototype.constantValue = function() {
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

Compiler.prototype.reservedNames = {
	":=":true, "|=":true, "&=":true, "^=":true, "-=":true, "=-":true, "+=":true,
	">>=":true, "<<=":true, "==":true, "!=":true, "<":true, ">":true,
	"<=":true, ">=":true, "key":true, "-key":true, "hex":true, "bighex":true,
	"random":true, "delay":true, ":":true, ":next":true, ":unpack":true,
	":breakpoint":true, ":proto":true, ":alias":true, ":const":true,
	":org":true, ";":true, "return":true, "clear":true, "bcd":true,
	"save":true, "load":true, "buzzer":true, "if":true, "then":true,
	"begin":true, "else":true, "end":true, "jump":true, "jump0":true,
	"native":true, "sprite":true, "loop":true, "while":true, "again":true,
	"scroll-down":true, "scroll-right":true, "scroll-left":true,
	"lores":true, "hires":true, "loadflags":true, "saveflags":true, "i":true,
	"audio":true, "plane":true, "scroll-up":true, ":macro":true, ":calc":true, ":byte":true,
	":call":true, ":stringmode":true, ":assert":true,
};

Compiler.prototype.checkName = function(name, kind) {
	if (name in this.reservedNames || name.indexOf('OCTO_') == 0) {
		throw "The name '"+name+"' is reserved and cannot be used for a "+kind+".";
	}
	return name;
}

Compiler.prototype.veryWideValue = function(noForward) {
	// i := long NNNN
	var nnnn = this.next();
	if (typeof nnnn != "number") {
		if (nnnn in this.constants) {
			nnnn = this.constants[nnnn];
		}
		else if (nnnn in this.dict) {
			nnnn = this.dict[nnnn];
		}
		else if (noForward) {
			throw "The reference to '"+nnnn+"' may not be forward-declared.";
		}
		else if (nnnn in this.protos) {
			this.protos[nnnn].push(this.here()+2);
			this.longproto[this.here()+2] = true;
			nnnn = 0;
		}
		else {
			this.protos[this.checkName(nnnn, "label")] = [this.here()+2];
			this.longproto[this.here()+2] = true;
			nnnn = 0;
		}
	}
	if ((typeof nnnn != "number") || (nnnn < 0) || (nnnn > 0xFFFF)) {
		throw "Value '"+nnnn+"' cannot fit in 16 bits!";
	}
	return (nnnn & 0xFFFF);
}

Compiler.prototype.wideValue = function(nnn) {
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
			this.protos[this.checkName(nnn, "label")] = [this.here()];
			nnn = 0;
		}
	}
	if ((typeof nnn != "number") || (nnn < 0) || (nnn > 0xFFF)) {
		throw "Value '"+nnn+"' cannot fit in 12 bits!";
	}
	return (nnn & 0xFFF);
}

Compiler.prototype.shortValue = function(nn) {
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

Compiler.prototype.tinyValue = function() {
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

Compiler.prototype.conditional = function(negated) {
	var reg   = this.register();
	var token = this.next();
	var compTemp = 0xF;
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
		this.fourop(0x8, compTemp, reg, 0x5); // vf -= v1
		this.inst(0x4F, 0);                   // if vf != 0 then ...
	}
	else if (token == "<") {
		if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
		else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
		this.fourop(0x8, compTemp, reg, 0x7); // vf =- v1
		this.inst(0x4F, 0);                   // if vf != 0 then ...
	}
	else if (token == ">=") {
		if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
		else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
		this.fourop(0x8, compTemp, reg, 0x7); // vf =- v1
		this.inst(0x3F, 0);                   // if vf == 0 then ...
	}
	else if (token == "<=") {
		if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
		else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
		this.fourop(0x8, compTemp, reg, 0x5); // vf -= v1
		this.inst(0x3F, 0);                   // if vf == 0 then ...
	}
	else {
		throw "Conditional flag expected, got '" + token + "!";
	}
}

Compiler.prototype.controlToken = function() {
	// ignore a condition
	var op = this.tokens[this.currentToken + 1][0];
	var index = 3;
	if (op == "key" || op == "-key") { index = 2; }
	if (index + this.currentToken >= this.tokens.length) { index = this.tokens.length - this.currentToken - 1; }
	return this.tokens[index + this.currentToken];
}

Compiler.prototype.iassign = function(token) {
	if (token == ":=") {
		var o = this.next();
		if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
		else if (o == "bighex") {
			this.schip = true;
			this.inst(0xF0 | this.register(), 0x30);
		}
		else if (o == "long") {
			this.xo = true;
			var addr = this.veryWideValue();
			this.inst(0xF0, 0x00);
			this.inst((addr>>8)&0xFF, addr&0xFF);
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

Compiler.prototype.vassign = function(reg, token) {
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
	else if ("-="  == token) {
		if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x5); }
		else                   { this.inst(0x70 | reg, 0xFF&(1+~this.shortValue())); }
	}
	else if ("=-"  == token) { this.fourop(0x8, reg, this.register(), 0x7); }
	else if (">>=" == token) { this.fourop(0x8, reg, this.register(), 0x6); }
	else if ("<<=" == token) { this.fourop(0x8, reg, this.register(), 0xE); }
	else {
		throw "Unrecognized operator '"+token+"'.";
	}
}

Compiler.prototype.resolveLabel = function(offset) {
	var target = (this.here() + offset);
	var label = this.checkName(this.next(), "label");
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
			if (this.longproto[addr]) {
				// i := long target
				this.rom[addr - 0x200] = (target >> 8) & 0xFF;
				this.rom[addr - 0x1FF] = (target & 0xFF);
			}
			else if ((this.rom[addr - 0x200] & 0xF0) == 0x60) {
				// :unpack target
				if ((target & 0xFFF) != target)
					throw "Value '" + target + "' for label '" + label + "' cannot fit in 12 bits!";
				this.rom[addr - 0x1FF] = (this.rom[addr - 0x1FF] & 0xF0) | ((target >> 8)&0xF);
				this.rom[addr - 0x1FD] = (target & 0xFF);
			}
			else {
				if ((target & 0xFFF) != target)
					throw "Value '" + target + "' for label '" + label + "' cannot fit in 12 bits!";
				this.rom[addr - 0x200] = (this.rom[addr - 0x200] & 0xF0) | ((target >> 8)&0xF);
				this.rom[addr - 0x1FF] = (target & 0xFF);
			}
		}
		delete this.protos[label];
	}
}

Compiler.prototype.parseTerminal = function(name) {
	// NUMBER | CONSTANT | LABEL | VREGISTER | '(' expression ')'
	var x = this.peek();
	if (x == 'PI'  ) { this.next(); return Math.PI; }
	if (x == 'E'   ) { this.next(); return Math.E; }
	if (x == 'HERE') { this.next(); return this.hereaddr; }
	if (this.isRegister(x)) { this.next(); return this.register(x); }
	if (+x == +x) { return +this.next(); }
	if (x in this.constants)  { return this.constants[this.next()]; }
	if (x in this.dict)       { return this.dict[this.next()]; }
	if (x in this.protos) {
		throw "Cannot use forward declaration '"+x+"' in calculated constant '"+name+'".';
	}
	if (this.next() != '(') { throw "Undefined constant '"+x+"'."; }
	var value = this.parseCalc(name);
	if (this.next() != ')') { throw "Expected ')' for calculated constant '"+name+"'."; }
	return value;
}

Compiler.prototype.parseCalc = function(name) {
	// UNARY expression | terminal BINARY expression | terminal
	if (this.peek() == 'strlen') {
		return this.next(), (''+this.next()).length;
	}
	if (this.peek() in unaryFunc) {
		return unaryFunc[this.next()](this.parseCalc(name), this.rom);
	}
	var t = this.parseTerminal(name);
	if (this.peek() in binaryFunc) {
		return binaryFunc[this.next()](t, this.parseCalc(name));
	}
	else {
		return t;
	}
}

Compiler.prototype.parseCalculated = function(name) {
	if (this.next() != '{') { throw "Expected '{' for calculated constant '"+name+"'."; }
	var value = this.parseCalc(name);
	if (this.next() != '}') { throw "Expected '}' for calculated constant '"+name+"'."; }
	return value;
}

Compiler.prototype.macroBody = function(name, desc) {
	if (this.next() != '{') { throw "Expected '{' for definition of "+desc+" '"+name+"'."; }
	var body = [];
	var depth = 1;
	while(!this.end()) {
		if (this.peek() == '{') { depth += 1; }
		if (this.peek() == '}') { depth -= 1; }
		if (depth == 0) { break; }
		body.push(this.raw());
	}
	if (this.next() != '}') { throw "Expected '}' for definition of "+desc+" '"+name+"'."; }
	return body;
}

Compiler.prototype.instruction = function(token) {
	if (token == ":") { this.resolveLabel(0); }
	else if (token == ":next") { this.resolveLabel(1); }
	else if (token == ":unpack") {
		var v = this.tinyValue();
		var a = this.wideValue();
		this.inst(0x60 | this.aliases["unpack-hi"], (v << 4) | (a >> 8));
		this.inst(0x60 | this.aliases["unpack-lo"], a);
	}
	else if (token == ":breakpoint") { this.breakpoints[this.here()] = this.next(); }
	else if (token == ":monitor") { this.monitors[this.peek()] = { base:this.veryWideValue(true), length:this.veryWideValue(true) }; }
	else if (token == ":proto")  { this.next(); } // deprecated.
	else if (token == ":alias") {
		var name = this.checkName(this.next(), "alias");
		var val = this.peek() == '{' ? this.parseCalculated('ANONYMOUS') : this.register();
		if (val < 0 || val >= 16) { throw "Register index must be in the range [0,F]."; }
		this.aliases[name] = val;
	}
	else if (token == ":const")  {
		var name = this.checkName(this.next(), "constant");
		if (name in this.constants) { throw "The name '"+name+"' has already been defined."; }
		this.constants[name] = this.constantValue();
	}
	else if (token == ":macro")  {
		var name = this.checkName(this.next(), "macro");
		var args = [];
		while(this.peek() != '{' && !this.end()) {
			args.push(this.checkName(this.next(), "macro argument"));
		}
		this.macros[name] = { args: args, body:this.macroBody(name, 'macro'), calls:0 };
	}
	else if (token in this.macros) {
		var macro = this.macros[token];
		var bindings = { 'CALLS':[macro.calls++,0,0] };
		for (var x = 0; x < macro.args.length; x++) {
			if (this.end()) {
				throw "Not enough arguments for expansion of macro '"+token+"'";
			}
			bindings[macro.args[x]] = this.raw();
		}
		for (var x = 0; x < macro.body.length; x++) {
			var chunk = macro.body[x];
			var value = (chunk[0] in bindings) ? bindings[chunk[0]] : chunk;
			this.tokens.splice(x + this.currentToken, 0, value);
		}
	}
	else if (token == ':stringmode') {
		var name = this.checkName(this.next(), "stringmode");
		if (!(name in this.stringmodes)) {
			this.stringmodes[name] = {values:{}, bodies:{}};
		}
		var mode = this.stringmodes[name];
		var alphabet = this.next();
		alphabet.split('').forEach(char => {
			if (mode.bodies[char]) { throw "String mode '"+name+"' is already defined for the character '"+char+"'."; }
		})
		var macro = { args:[], body:this.macroBody(name, 'string mode'), calls:0 };
		alphabet.split('').forEach((char,index) => {
			mode.values[char] = index;
			mode.bodies[char] = macro;
		})
	}
	else if (token in this.stringmodes) {
		var mode = this.stringmodes[token];
		var string = this.next();
		if (typeof string == 'number') { throw "String mode '"+token+"' cannot be applied to a number ("+string+")."; }
		var insertion = this.currentToken;

		string.split('').forEach((char,index) => {
			if (!(char in mode.bodies)) { throw "String mode '"+token+"' is not defined for the character '"+char+"'."; }
			var macro = mode.bodies[char];
			var bindings = {
				'CALLS':[macro.calls++,0,0],      // how many times have we expanded this character class?
				'CHAR' :[char.charCodeAt(0),0,0], // ascii value of the current character
				'INDEX':[index,0,0],              // index of the current character in the input string
				'VALUE':[mode.values[char],0,0],  // index of the current character in the character class's alphabet
			};
			for (var x = 0; x < macro.body.length; x++) {
				var chunk = macro.body[x];
				var value = (chunk[0] in bindings) ? bindings[chunk[0]] : chunk;
				this.tokens.splice(insertion++, 0, value);
			}
		})
	}
	else if (token == ':calc') {
		var name = this.checkName(this.next(), "calculated constant");
		this.constants[name] = this.parseCalculated(name);
	}
	else if (token == ":byte") {
		this.data(this.peek() == '{' ? this.parseCalculated('ANONYMOUS') : this.shortValue());
	}
	else if (token == ":org") {
		var addr = this.peek() == '{' ? this.parseCalculated('ANONYMOUS') : this.constantValue();
		this.hereaddr = 0xFFFF & addr;
	}
	else if (token == ":assert") {
		var message = this.peek() == '{' ? null : this.next();
		var value = this.parseCalculated(message ? 'assert '+message : 'assert');
		if (!value) { throw message ? "Assertion failed: "+message : "Assertion failed."; }
	}
	else if (token == ";")       { this.inst(0x00, 0xEE); }
	else if (token == "return")  { this.inst(0x00, 0xEE); }
	else if (token == "clear")   { this.inst(0x00, 0xE0); }
	else if (token == "bcd")     { this.inst(0xF0 | this.register(), 0x33); }
	else if (token == "save")    {
		var reg = this.register();
		if (!this.end() && this.peek() == "-") {
			this.expect("-");
			this.xo = true;
			this.inst(0x50 | reg, (this.register() << 4) | 0x02);
		}
		else {
			this.inst(0xF0 | reg, 0x55);
		}
	}
	else if (token == "load") {
		var reg = this.register();
		if (!this.end() && this.peek() == "-") {
			this.expect("-");
			this.xo = true;
			this.inst(0x50 | reg, (this.register() << 4) | 0x03);
		}
		else {
			this.inst(0xF0 | reg, 0x65);
		}
	}
	else if (token == "delay")   { this.expect(":="); this.inst(0xF0 | this.register(), 0x15); }
	else if (token == "buzzer")  { this.expect(":="); this.inst(0xF0 | this.register(), 0x18); }
	else if (token == "if") {
		var control = this.controlToken();
		if (control[0] == "then") {
			this.conditional(false);
			this.expect("then");
		}
		else if (control[0] == "begin") {
			this.conditional(true);
			this.expect("begin");
			this.branches.push([this.here(), this.pos, "begin"]);
			this.inst(0x00, 0x00);
		}
		else {
			this.pos = control;
			throw "Expected 'then' or 'begin'.";
		}
	}
	else if (token == "else") {
		if (this.branches.length < 1) {
			throw "This 'else' does not have a matching 'begin'.";
		}
		this.jump(this.branches.pop()[0], this.here()+2);
		this.branches.push([this.here(), this.pos, "else"]);
		this.inst(0x00, 0x00);
	}
	else if (token == "end") {
		if (this.branches.length < 1) {
			throw "This 'end' does not have a matching 'begin'.";
		}
		this.jump(this.branches.pop()[0], this.here());
	}
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
		this.whiles.pop();
	}
	else if (token == "plane") {
		var plane = this.tinyValue();
		if (plane > 3) { throw "the plane bitmask must be [0, 3]."; }
		this.xo = true;
		this.inst(0xF0 | plane, 0x01);
	}
	else if (token == "audio") {
		this.xo = true;
		this.inst(0xF0, 0x02);
	}
	else if (token == "scroll-down")  { this.schip = true; this.inst(0x00, 0xC0 | this.tinyValue()); }
	else if (token == "scroll-up")    { this.xo    = true; this.inst(0x00, 0xD0 | this.tinyValue()); }
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
	else if (token == ":call") {
		var addr = this.peek() == '{' ? this.parseCalculated('ANONYMOUS') : this.wideValue(this.next());
		this.immediate(0x20, 0xFFF & addr);
	}
	else {
		this.immediate(0x20, this.wideValue(token));
	}
}

Compiler.prototype.go = function() {
	this.aliases["unpack-hi"] = 0x0;
	this.aliases["unpack-lo"] = 0x1;

	this.tokens = tokenize(this.source);
	this.inst(0, 0); // reserve a jump slot
	while(!this.end()) {
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
	if (this.branches.length > 0) {
		this.pos = this.branches[0][1];
		throw "This '"+this.branches[0][2]+"' does not have a matching 'end'.";
	}
	for(var index = 0; index < this.rom.length; index++) {
		if (typeof this.rom[index] == "undefined") { this.rom[index] = 0x00; }
	}
}

this.Compiler = Compiler;
