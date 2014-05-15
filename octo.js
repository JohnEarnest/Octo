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

var p  = [];    // pixels
var m  = [];    // memory (bytes)
var r  = [];    // return stack
var v  = [];    // registers
var pc = 0x200; // program counter
var i  = 0;     // index register
var dt = 0;     // delay timer
var st = 0;     // sound timer

var keys = {};       // track keys which are pressed
var waiting = false; // are we waiting for a keypress?
var waitReg = -1;    // destination register of an awaited key

function init(program) {
	for(var z = 0; z < 4096; z++) { m[z] = 0; }
	for(var z = 0; z < font.length; z++) { m[z] = font[z]; }
	for(var z = 0; z < program.length; z++) { m[0x200+z] = program[z]; }
	for(var z = 0; z < 16; z++) { v[z] = 0; }
	for(var z = 0; z < 32*64; z++) { p[z] = false; }
	pc = 0x200;
	i  = 0;
	dt = 0;
	st = 0;
	keys = {};
	waiting = false;
	waitReg = -1;
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
		case 0x33: m[i] = Math.floor(v[x]/100)%10; m[i+1] = Math.floor(v[x]/10)%10; m[i+2] = v[x]%10; break;
		case 0x55: for(var z = 0; z <= x; z++) { m[i+z] = v[z]; } i = (i+x+1)&0xFFF; break;
		case 0x65: for(var z = 0; z <= x; z++) { v[z] = m[i+z]; } i = (i+x+1)&0xFFF; break;
		default: throw "unknown misc op: " + rest;
	}
}

function sprite(x, y, len) {
	v[0xF] = 0x0;
	for(var a = 0; a < len; a++) {
		for(var b = 0; b < 8; b++) {
			var target = ((x+b) % 64) + ((y+a) % 32)*64;
			var source = ((m[i+a] >> (7-b)) & 0x1) != 0;
			if (!source) { continue; }
			if (p[target]) { p[target] = false; v[0xF] = 0x1; }
			else { p[target] = true; }
		}
	}
}

function tick() {
	var op  = (m[pc  ] << 8) | m[pc+1];
	var o   = (m[pc  ] >> 4) & 0x00F;
	var x   = (m[pc  ]     ) & 0x00F;
	var y   = (m[pc+1] >> 4) & 0x00F;
	var n   = (m[pc+1]     ) & 0x00F;
	var nn  = (m[pc+1]     ) & 0x0FF;
	var nnn = op             & 0xFFF;
	pc += 2;

	if (op == 0x00E0) {
		for(var z = 0; z < 32*64; z++) { p[z] = false; }
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

	while(index < text.length) {
		var c = text.charAt(index++);
		if (c == '#') {
			if (token.length > 0) { ret.push(parse(token)); }
			token = "";
			while(c != '\n' && index < text.length) {
				c = text.charAt(index++);
			}
		}
		else if (" \t\n\r\v".indexOf(c) >= 0) {
			if (token.length > 0) { ret.push(parse(token)); }
			token = "";
		}
		else {
			token += c;
		}
	}
	if (token.length > 0) { ret.push(parse(token)); }
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
	this.rom    = []; // list<int>
	this.loops  = []; // stack<int>
	this.whiles = []; // stack<int>
	this.dict   = {}; // map<name, addr>
	this.vars   = {}; // map<name, addr>

	this.tokens = tokenize(source);
	this.next = function()    { var ret = this.tokens[0]; this.tokens.splice(0, 1); return ret; }
	this.here = function()    { return this.rom.length + 0x200; }
	this.inst = function(a,b) { this.rom.push(a); this.rom.push(b); }

	this.wordLabel = function(name) {
		if (!(name in this.dict)) { throw "No word '" + name + "' declared."; }
		return this.dict[name];
	}

	this.immediate = function(op, nnn) {
		this.inst(op | ((nnn >> 8) & 0xF), (nnn & 0xFF));
	}

	this.fourop = function(op, x, y, n) {
		this.inst((op << 4) | x, (y << 4) | n);
	}

	this.jump = function(addr, dest) {
		this.rom[addr - 0x200] = (0x10 | ((dest >> 8) & 0xF));
		this.rom[addr - 0x1FF] = (dest & 0xFF);
	}

	this.isRegister = function(name) {
		if (!name && (name != 0)) { name = this.tokens[0]; }
		if (typeof name != "string") { return false; }
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
		name = name.toUpperCase();
		return "0123456789ABCDEF".indexOf(name[1]);
	}

	this.expect = function(token) {
		var thing = this.next();
		if (thing != token) { throw "Expected '" + token + "', got '" + thing + "'!"; }
	}

	this.value = function(thing) {
		if (!thing && (thing != 0)) { thing = this.next(); }
		if (thing in this.vars) { return this.vars[thing]; }
		if (thing in this.dict) { return this.dict[thing]; }
		if (typeof thing == "number") { return thing; }
		throw "Undefined name '"+thing+"'.";
	}

	this.conditional = function(negated) {
		var reg   = this.register();
		var token = this.next();
		if (negated) {
			if      (token == "=="  ) { token = "!="; }
			else if (token == "!="  ) { token = "=="; }
			else if (token == "key" ) { token == "-key"; }
			else if (token == "-key") { token == "key"; }
		}
		if (token == "==") {
			if (this.isRegister()) { this.inst(0x90 | reg, this.register() << 4); }
			else                   { this.inst(0x40 | reg, this.value()); }
		}
		else if (token == "!=") {
			if (this.isRegister()) { this.inst(0x50 | reg, this.register() << 4); }
			else                   { this.inst(0x30 | reg, this.value()); }
		}
		else if (token == "key") {
			this.inst(0xE0 | reg, 0xA1);
		}
		else if (token == "-key") {
			this.inst(0xE0 | reg, 0x9E);
		}
		else {
			throw "Conditional flag expected, got '" + token + "!";
		}
	}

	this.iassign = function(token) {
		if (token == ":=") {
			var o = this.next();
			if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
			else            { this.immediate(0xA0, this.value(o)); }
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
			else if (o == "random") { this.inst(0xC0 | reg, this.value()); }
			else if (o == "key")    { this.inst(0xF0 | reg, 0x0A); }
			else if (o == "delay")  { this.inst(0xF0 | reg, 0x07); }
			else                    { this.inst(0x60 | reg, this.value(o)); }
		}
		else if ("+=" == token) {
			if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x4); }
			else                   { this.inst(0x70 | reg, this.value()); }
		}
		else if ("|="  == token) { this.fourop(0x8, reg, this.register(), 0x1); }
		else if ("&="  == token) { this.fourop(0x8, reg, this.register(), 0x2); }
		else if ("^="  == token) { this.fourop(0x8, reg, this.register(), 0x3); }
		else if ("-="  == token) { this.fourop(0x8, reg, this.register(), 0x5); }
		else if (">>=" == token) { this.fourop(0x8, reg, this.register(), 0x6); }
		else if ("<<=" == token) { this.fourop(0x8, reg, this.register(), 0xE); }
		else {
			throw "Unrecognized operator '"+token+"'.";
		}
	}

	this.instruction = function(token) {
		if      (token == ":data")   { this.vars[this.next()] = this.here(); }
		else if (token == ":const")  { this.vars[this.next()] = this.value(this.next()); }
		else if (token == ":")       { this.dict[this.next()] = this.here(); }
		else if (token in this.dict) { this.immediate(0x20, this.wordLabel(token)); }
		else if (token == ";")       { this.inst(0x00, 0xEE); }
		else if (token == "return")  { this.inst(0x00, 0xEE); }
		else if (token == "clear")   { this.inst(0x00, 0xE0); }
		else if (token == "bcd")     { this.inst(0xF0 | this.register(), 0x33); }
		else if (token == "save")    { this.inst(0xF0 | this.register(), 0x55); }
		else if (token == "load")    { this.inst(0xF0 | this.register(), 0x65); }
		else if (token == "delay")   { this.expect(":="); this.inst(0xF0 | this.register(), 0x15); }
		else if (token == "buzzer")  { this.expect(":="); this.inst(0xF0 | this.register(), 0x18); }
		else if (token == "if")      { this.conditional(false); this.expect("then"); }
		else if (token == "jump0")   { this.immediate(0xB0, this.value()); }
		else if (token == "jump")    { this.immediate(0x10, this.value()); }
		else if (token == "sprite")  { this.inst(0xD0 | this.register(), (this.register() << 4) | this.value()); }
		else if (token == "loop") {
			this.loops.push(this.here());
			this.whiles.push(null);
		}
		else if (token == "while") {
			this.conditional(true);
			this.whiles.push(this.here());
			this.immediate(0x10, 0);
		}
		else if (token == "again") {
			this.immediate(0x10, this.loops.pop());
			while (this.whiles[this.whiles.length - 1] != null) {
				this.jump(this.whiles.pop(), this.here());
			}
		}
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
		this.inst(0, 0); // reserve a jump slot
		while(this.tokens.length > 0) {
			if (typeof this.tokens[0] == "number") {
				this.rom.push(this.next());
			}
			else if (this.tokens[0] in this.vars) {
				this.rom.push(this.vars[this.next()]);
			}
			else {
				this.instruction(this.next());
			}
		}
		this.jump(0x200, this.wordLabel("main")); // resolve the main branch
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
	}
	catch(error) {
		status.innerHTML = "<font color='red'>" + error + "</font>";
	}

	return c.rom;
}

var intervalHandle;

function run() {
	runRom(compile());
}

function runRom(rom) {
	init(rom);
	document.getElementById("editor").style.display = "none";
	document.getElementById("target").style.display = "inline";
	window.addEventListener("keydown", keyDown, false);
	window.addEventListener("keyup"  , keyUp  , false);
	intervalHandle = setInterval(render, 1000/60);
	document.body.style.backgroundColor = "#000000";
}

function reset() {
	document.getElementById("editor").style.display = "inline";
	document.getElementById("target").style.display = "none";
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
	var options = JSON.stringify({"tickrate": TICKS_PER_FRAME});
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
			for (var i = 0; i < framerateEl.options.length; i++) {
				if (framerateEl.options[i].text == framerateNum + ' Cycles/Frame') {
					framerateEl.selectedIndex = i;
					framerate();
					break;
				}
			}
			if (i == framerateEl.options.length)
				TICKS_PER_FRAME = framerateNum;
			run();
		}
	}
	xhr.send();
}

function framerate() {
	TICKS_PER_FRAME = parseInt(document.getElementById("framerate").value.split(' ')[0], 10);
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
	for(var z = 0; z < 32*64; z++) {
		if (p[z]) { g.fillRect(Math.floor(z%64)*10, Math.floor(z/64)*10, 10, 10); }
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
