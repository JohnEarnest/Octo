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
			break;
		case 0x85:
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

////////////////////////////////////
//
//   Prettyprinting:
//
////////////////////////////////////

function hexFormat(num) {
	var hex = num.toString(16).toUpperCase();
	return "0x" + ((hex.length > 1) ? hex : "0" + hex);
}

function display(rom) {
	return "[" + (rom.map(hexFormat).join(", ")) + "]";
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

	return {
		rom        :c.rom,
		breakpoints:c.breakpoints,
		aliases    :c.aliases,
		labels     :c.dict
	};
}

var intervalHandle;

function run() {
	runRom(compile());
}

function runRom(rom) {
	if (rom === null) { return; }
	init(rom);
	document.getElementById("editor").style.display = "none";
	document.getElementById("options").style.display = "none";
	document.getElementById("emulator").style.display = "inline";
	window.addEventListener("keydown", keyDown, false);
	window.addEventListener("keyup"  , keyUp  , false);
	intervalHandle = setInterval(render, 1000/60);
	document.body.style.backgroundColor = "#000000";
}

function reset() {
	document.getElementById("editor").style.display = "inline";
	document.getElementById("emulator").style.display = "none";
	document.getElementById("options").style.display = "none";
	window.removeEventListener("keydown", keyDown, false);
	window.removeEventListener("keyup"  , keyUp  , false);
	window.clearInterval(intervalHandle);
	document.body.style.backgroundColor = "#FFFFFF";
	clearBreakpoint();
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
		"quietColor"      : QUIET_COLOR,
		"shiftQuirks"     : SHIFT_QUIRKS,
		"loadStoreQuirks" : LOAD_STORE_QUIRKS
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
			if (options["shiftQuirks"    ]) { SHIFT_QUIRKS = options["shiftQuirks"   ]; }
			if (options["loadStoreQuirks"]) { LOAD_STORE_QUIRKS = options["loadStoreQuirks"]; }
			run();
		}
	}
	xhr.send();
}

function framerate() {
	TICKS_PER_FRAME = document.getElementById("framerate").value;
}

function renderDisplay() {
	var c = document.getElementById("target");
	var g = c.getContext("2d");

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

function render() {
	for(var z = 0; (z < TICKS_PER_FRAME) && (!waiting); z++) {
		if (breakpoint != true) {
			tick();
			if (pc in metadata.breakpoints) {
				haltBreakpoint(metadata.breakpoints[pc]);
			}
		}
	}
	if (breakpoint != true) {
		if (dt > 0) { dt--; }
		if (st > 0) { st--; }
	}

	renderDisplay();

	if (halted) { return; }
	document.body.style.backgroundColor = (st > 0) ? BUZZ_COLOR : QUIET_COLOR;
}

function keyDown(event) {
	if (!(event.keyCode in keys)) { keys[event.keyCode] = true; }
}

function keyUp(event) {
	if (event.keyCode in keys) { delete keys[event.keyCode]; }
	if (event.keyCode == 27) { reset(); }
	if (event.keyCode == 73) { // i
		if (breakpoint) {
			clearBreakpoint();
		}
		else {
			haltBreakpoint("user interrupt");
		}
	}
	if (event.keyCode == 79) { // o
		if (breakpoint) {
			tick();
			renderDisplay();
			haltBreakpoint("single stepping");
		}
	}
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
//   Configuration options:
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

function toggleOptions() {
	var options = document.getElementById("options");
	if (options.style.display == "none") {
		options.style.display = "inline";
		document.getElementById("backEdit").value   = BACK_COLOR;  editBack();
		document.getElementById("foreEdit").value   = FILL_COLOR;  editFore();
		document.getElementById("buzzEdit").value   = BUZZ_COLOR;  editBuzz();
		document.getElementById("silentEdit").value = QUIET_COLOR; editSilent();
		document.getElementById("shiftQuirks").checked = SHIFT_QUIRKS;
		document.getElementById("loadStoreQuirks").checked = LOAD_STORE_QUIRKS;
	}
	else {
		options.style.display = "none";
	}
}

function setShiftQuirks() {
	var check = document.getElementById("shiftQuirks");
	if (check.checked) { SHIFT_QUIRKS = true;  }
	else               { SHIFT_QUIRKS = false; }
}

function setLoadStoreQuirks() {
	var check = document.getElementById("loadStoreQuirks");
	if (check.checked) { LOAD_STORE_QUIRKS = true;  }
	else               { LOAD_STORE_QUIRKS = false; }
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

function setSpriteEditorSize() {
	var check = document.getElementById("spriteEditorSize");
	var canvas = document.getElementById("draw");
	if (check.checked) {
		largeSprite = true;
		canvas.width  = 25 * 16;
		canvas.height = 25 * 16;
		var newpixels = [];
		for(var z = 0; z < 32; z++) { newpixels[z] = 0; }
		for(var z = 0; z < pixel.length; z++) {
			newpixels[z * 2] = pixel[z];
		}
		pixel = newpixels;
	}
	else {
		largeSprite = false;
		canvas.width  = 25 * 8;
		canvas.height = 25 * 15;
		var newpixels = [];
		for(var z = 0; z < 15; z++) {
			newpixels[z] = pixel[z*2];
		}
		pixel = newpixels;
	}
	showPixels();
	showHex();
}

function showPixels() {
	var canvas = document.getElementById("draw");
	var render = canvas.getContext("2d");
	render.fillStyle = BACK_COLOR;
	render.fillRect(0, 0, canvas.width, canvas.height);
	render.fillStyle = FILL_COLOR;
	if (largeSprite) {
		for(var row = 0; row < 16; row++) {
			for(var col = 0; col < 16; col++) {
				if (pixel[row*2 + (col > 7 ? 1:0)] & (1 << (7-(col%8)))) {
					render.fillRect(col * 25, row * 25, 25, 25);
				}
			}
		}
	}
	else {
		for(var row = 0; row < 15; row++) {
			for(var col = 0; col < 8; col++) {
				if (pixel[row] & (1 << (7-col))) {
					render.fillRect(col * 25, row * 25, 25, 25);
				}
			}
		}
	}
}

function showHex() {
	var output = document.getElementById("spriteData");
	var hex = "";
	for(var z = 0; z < pixel.length; z++) {
		var digits = pixel[z].toString(16).toUpperCase();
		hex += "0x" + (digits.length == 1 ? "0"+digits : digits) + " ";
	}
	output.value = hex;
}

function editHex() {
	var output = document.getElementById("spriteData");
	var bytes = output.value.trim().split(new RegExp("\\s+"));
	var maxBytes = largeSprite ? 32 : 15;
	for(var z = 0; z < maxBytes; z++) {
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
	var mx   = Math.floor((event.clientX - rect.left)/25);
	var my   = Math.floor((event.clientY - rect.top )/25);
	var dest = largeSprite ? (my*2 + (mx > 7 ? 1:0)) : my;
	var src  = (128 >> (mx % 8));
	if (mode == 1) { pixel[dest] |=  src; } // draw
	else           { pixel[dest] &= ~src; } // erase
	showHex();
	showPixels();
}

function release(event)    { mode = 0; drag(event); }
function pressDraw(event)  { if (event.button == 2) {mode = 2;} else {mode = 1;} drag(event); }

var largeSprite = false;
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

////////////////////////////////////
//
//   Debugger:
//
////////////////////////////////////

function getLabel(address) {
	var bestname = "hex-font";
	var besta = 0;
	for(var key in metadata.labels) {
		var v = metadata.labels[key];
		if ((v > besta) && (v <= address)) {
			bestname = key;
			besta = v;
		}
	}
	if (besta == address) { return " (" + bestname + ")"; }
	return " (" + bestname + " + " + (address - besta) + ")";
}

function formatAliases(id) {
	var names = [];
	for(var key in metadata.aliases) {
		if (metadata.aliases[key] == id) { names.push(key); }
	}
	if (names.length == 0) { return ""; }
	var ret = " (" + names[0];
	for(var x = 1; x < names.length; x++) {
		ret += ", " + names[x];
	}
	return ret + ")";
}

function haltBreakpoint(breakName) {
	var button = document.getElementById("continueButton");
	var regs   = document.getElementById("registerView");
	button.style.display = "inline";
	regs.style.display = "inline";

	var regdump =
		"breakpoint: " + breakName + "<br>" +
		"pc := " + hexFormat(pc) + getLabel(pc) + "<br>" +
		"i := " + hexFormat(i) + getLabel(i) + "<br>";
	for(var k = 0; k <= 0xF; k++) {
		var hex = k.toString(16).toUpperCase();
		regdump += "v" + hex + " := " + hexFormat(v[k]) + formatAliases(k) +"<br>";
	}

	regdump += "<br>inferred stack trace:<br>";
	for(var x = 0; x < r.length; x++) {
		regdump += hexFormat(r[x]) + getLabel(r[x]) + "<br>";
	}

	regs.innerHTML = regdump;
	breakpoint = true;
}

function clearBreakpoint() {
	var button = document.getElementById("continueButton");
	var regs   = document.getElementById("registerView");
	button.style.display = "none";
	regs.style.display = "none";
	breakpoint = false;
}

////////////////////////////////////
//
//   Decompiler:
//
////////////////////////////////////

function decompileShowModal() {
	document.getElementById("decompileModal").style.display = "inline";
}

function decompileClose() {
	document.getElementById("decompileModal").style.display = "none";
}

function decompileFile() {
	document.getElementById("fileinput").click();
}

function decompileRequestLoad() {
	var file = document.getElementById("fileinput").files[0];
	var reader = new FileReader();

	function actuallyLoad() {
		var buff = reader.result;
		var bytes = new Uint8Array(buff);
		var disp = "";
		if (bytes.length > 0) {
			disp = hexFormat(bytes[0]);
		}
		for(var z = 1; z < bytes.length; z++) {
			disp += ", " + hexFormat(bytes[z]);
		}
		document.getElementById("decompileInput").value = "[" + disp + "]";
	}

	reader.onload = actuallyLoad;
	reader.readAsArrayBuffer(file);
}

function getDecompileData() {
	var inData = document.getElementById("decompileInput").value;
	inData = inData.replace("[", "");
	inData = inData.replace("]", "");
	inData = inData.split(",");
	var buffer = [];
	for(var z = 0; z < inData.length; z++) {
		buffer[z] = parse(inData[z]);
	}
	return buffer;
}

function decompileRun() {
	var buffer = getDecompileData();
	document.getElementById("decompileModal").style.display = "none";
	runRom({ rom:buffer, breakpoints:{}, aliases:{}, labels:{} });
}

var decompileProgramLength = 0;

function decompileStart() {
	document.getElementById("decompileModal").style.display = "none";
	document.getElementById("decompileWork").style.display = "inline";

	var buffer = getDecompileData();

	var quirks = {};
	quirks['shiftQuirks'    ] = SHIFT_QUIRKS;
	quirks['loadStoreQuirks'] = LOAD_STORE_QUIRKS;
	analyzeInit(buffer, quirks);
	decompileProgramLength = buffer.length;
	window.setTimeout(decompileProcess, 0);
}

function decompileProcess() {
	var finished = false;
	for(var z = 0; z < 100; z++) {
		finished |= analyzeWork();
		if (finished) { break; }
	}
	if (finished) {
		analyzeFinish();
		document.getElementById("input").value = "# decompiled program:\n" + formatProgram(decompileProgramLength);
		document.getElementById("decompileWork").style.display = "none";
	}
	else {
		window.setTimeout(decompileProcess, 0);
	}
}
